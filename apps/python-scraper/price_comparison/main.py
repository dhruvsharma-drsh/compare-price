import asyncio
import json
import csv
import io
from typing import List, Dict

from .models import ProductResult
from .categories import CATEGORIES
from .matching import group_products, ProductGroup
from .currency import CurrencyConverter
from .scraper.retailers import AmazonScraper, FlipkartScraper

class ComparisonReport:
    def __init__(self, query: str, category: str, subcategory: str):
        self.product_query = query
        self.category = category
        self.subcategory = subcategory
        self.all_results: List[ProductResult] = []
        self.groups: List[ProductGroup] = []
        self.errors: Dict[str, str] = {}

    def print_summary(self):
        print(f"Comparison Report: {self.product_query}")
        print(f"Total Listings: {len(self.all_results)}")
        print(f"Total Groups: {len(self.groups)}")
        for i, group in enumerate(self.groups):
            print(f"--- Group {i+1}: {group.representative[:50]} ---")
            for listing in group.listings:
                usd = listing.price_usd if listing.price_usd else "N/A"
                print(f"  [{listing.country}] {listing.platform:<15} {listing.name[:45]:<45} ${usd}")

    def to_dict(self) -> dict:
        def pick_representative_name(g): return g.representative
        return {
            'query': self.product_query,
            'category': self.category,
            'subcategory': self.subcategory,
            'total_listings': len(self.all_results),
            'groups': [
                {
                    'name': pick_representative_name(g),
                    'listing_count': len(g.listings),
                    'cheapest_usd': g.cheapest.price_usd if g.cheapest else None,
                    'cheapest_platform': g.cheapest.platform if g.cheapest else None,
                    'cheapest_country': g.cheapest.country if g.cheapest else None,
                    'listings': [
                        {
                            'name': r.name, 'platform': r.platform,
                            'country': r.country, 'price': r.price,
                            'currency': r.currency, 'price_usd': r.price_usd,
                            'url': r.url, 'image_url': r.image_url,
                        }
                        for r in sorted(g.listings, key=lambda x: x.price_usd or 999999)
                    ],
                }
                for g in self.groups
            ],
            'errors': self.errors,
        }

    def to_json(self, indent=2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)
        
    def to_csv(self) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Group", "Name", "Platform", "Country", "Price", "Currency", "Price_USD", "URL"])
        for i, group in enumerate(self.groups):
            for r in group.listings:
                writer.writerow([i+1, r.name, r.platform, r.country, r.price, r.currency, r.price_usd, r.url])
        return output.getvalue()


class PriceComparisonSystem:
    def __init__(self):
        self.currency_converter = CurrencyConverter()
        # Limit concurrent browser instances to prevent resource starvation
        self._browser_semaphore = asyncio.Semaphore(4)

    # Per-scraper timeout in seconds
    SCRAPER_TIMEOUT = 45

    async def _safe_scrape(self, scraper, product, subcat, max_results, report, retries=0):
        """Run a single scraper with timeout, retry, and concurrency limiting."""
        for attempt in range(retries + 1):
            try:
                async with self._browser_semaphore:
                    async with scraper:
                        return await asyncio.wait_for(
                            scraper.search(product, subcat, max_results),
                            timeout=self.SCRAPER_TIMEOUT,
                        )
            except asyncio.TimeoutError:
                name = scraper.__class__.__name__
                print(f"   [TIMEOUT] {name} timed out after {self.SCRAPER_TIMEOUT}s (attempt {attempt+1})")
                if attempt >= retries:
                    report.errors[name] = f"Timed out after {self.SCRAPER_TIMEOUT}s"
            except Exception as e:
                name = scraper.__class__.__name__
                if attempt < retries:
                    wait = 2 ** attempt
                    print(f"   [RETRY] {attempt+1}/{retries} for {name}: {e}")
                    await asyncio.sleep(wait)
                else:
                    report.errors[name] = str(e)
        return []

    def get_scrapers_for_country(self, country: str):
        c = country.upper()
        if c == 'IN':
            return [AmazonScraper('IN'), FlipkartScraper('IN')]
        elif c == 'US':
            return [AmazonScraper('US')]
        elif c == 'UK' or c == 'GB':
            return [AmazonScraper('UK')]
        elif c == 'AE':
            return [AmazonScraper('AE')]
        elif c == 'DE':
            return [AmazonScraper('DE')]
        elif c == 'CA':
            return [AmazonScraper('CA')]
        elif c == 'AU':
            return [AmazonScraper('AU')]
        elif c == 'JP':
            return [AmazonScraper('JP')]
        elif c == 'KR':
            return [AmazonScraper('KR')]
        elif c == 'RU':
            return [AmazonScraper('RU')]
        return [AmazonScraper(c)]

    async def _scrape_country(self, country: str, product_query: str, subcat, report: ComparisonReport):
        """Scrape all retailers for a single country concurrently."""
        scrapers = self.get_scrapers_for_country(country)
        print(f"   [{country}] Launching {len(scrapers)} scrapers...")
        tasks = [
            self._safe_scrape(scraper, product_query, subcat, max_results=5, report=report) 
            for scraper in scrapers
        ]
        results_lists = await asyncio.gather(*tasks)
        results = []
        for res_list in results_lists:
            results.extend(res_list)
        print(f"   [{country}] Done -- {len(results)} results")
        return results

    async def compare(self, product_query: str, countries: List[str], category_id: str, subcategory_id: str) -> ComparisonReport:
        report = ComparisonReport(product_query, category_id, subcategory_id)
        
        category = CATEGORIES.get(category_id)
        if not category:
            raise ValueError(f"Category {category_id} not found")
        subcat = next((s for s in category.subcategories if s.id == subcategory_id), None)
        if not subcat:
            raise ValueError(f"Subcategory {subcategory_id} not found in {category_id}")
            
        await self.currency_converter.fetch_live_rates()

        # Scrape ALL countries concurrently (semaphore limits actual browser instances)
        country_tasks = [
            self._scrape_country(country, product_query, subcat, report)
            for country in countries
        ]
        all_country_results = await asyncio.gather(*country_tasks)

        all_results = []
        for country_results in all_country_results:
            all_results.extend(country_results)

        for r in all_results:
            if r.price is not None:
                r.price_usd = self.currency_converter.convert_to_usd(r.price, r.currency)

        report.all_results = all_results
        report.groups = group_products(all_results)
        
        return report

