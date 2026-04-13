import os
import urllib.parse
from typing import List
from ..models import ProductResult
from ..categories import Subcategory
from .base_scraper import StealthScraper

try:
    from amazon_paapi5 import DefaultApi
except ImportError:
    DefaultApi = None

class AmazonScraper(StealthScraper):
    def __init__(self, country: str):
        super().__init__(country)
        self.platform = "amazon"
        
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        # PA-API fallback logic here
        return await self._search_playwright(product, subcat, max_results)
        
    async def _search_playwright(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        domain_map = {
            "IN": "amazon.in",
            "US": "amazon.com",
            "AE": "amazon.ae",
            "UK": "amazon.co.uk",
            "GB": "amazon.co.uk",
            "DE": "amazon.de",
            "CA": "amazon.ca",
            "AU": "amazon.com.au",
            "JP": "amazon.co.jp",
            "SG": "amazon.sg",
            "FR": "amazon.fr",
            "IT": "amazon.it",
            "ES": "amazon.es",
            "NL": "amazon.nl",
            "MX": "amazon.com.mx",
            "BR": "amazon.com.br",
            "KR": "amazon.com",  # No local Amazon; use global
            "RU": "amazon.com",  # No local Amazon; use global
        }
        domain = domain_map.get(self.country.upper(), "amazon.com")
        path = subcat.retailer_paths.get(f"amazon_{self.country.lower()}", "")
        
        query = urllib.parse.quote_plus(product)
        if path and "rh=" in path:
            url = f"https://www.{domain}{path}&k={query}"
        else:
            url = f"https://www.{domain}/s?k={query}"
            
        results = []
        try:
            print(f"[{self.platform.upper()} {self.country}] Navigating to {url}")
            page, ctx = await self._navigate_with_proxy_fallback(url, wait_until="domcontentloaded", timeout=60000)
            if page is None:
                return results

            await self._human_delay(2000, 4000)
            await self._scroll_page(page, loops=2)
            
            # Selector for search results
            items = await page.locator('[data-component-type="s-search-result"]').all()
            print(f"[{self.platform.upper()} {self.country}] Found {len(items)} items. Page length: {len(await page.content())}")
            
            # Anti-keywords to filter out accessories when searching for the main product
            anti_keywords = ["case", "cover", "screen protector", "enclosure", "charging cable", "adapter", "charger", "pouch", "housing", "shell", "sticker", "decal"]
            query_lower = product.lower()
            filtered_anti = [ak for ak in anti_keywords if ak not in query_lower]

            for item in items:
                if len(results) >= max_results:
                    break
                    
                name_loc = item.locator('h2 a span, [data-cy="title-recipe"] h2, .a-size-medium.a-text-normal')
                price_loc = item.locator('.a-price .a-offscreen, [data-a-color="price"] .a-offscreen, .a-price-whole')
                img_loc = item.locator('img.s-image').first
                
                try:
                    if await name_loc.count() == 0 or await price_loc.count() == 0:
                        continue
                    
                    name = await name_loc.first.text_content()
                    name = name.strip()
                    
                    # Basic filtering for accessories
                    name_lower = name.lower()
                    if any(ak in name_lower for ak in filtered_anti):
                        continue
                        
                    raw_price = await price_loc.first.text_content()
                    price = self._clean_price(raw_price)
                    
                    link_loc = item.locator('h2 a, a.a-link-normal').first
                    item_url = await link_loc.get_attribute('href')
                    
                    img_url = await img_loc.get_attribute('src') if await img_loc.count() > 0 else None
                    
                    currency_map = {
                        "IN": "INR", "US": "USD", "AE": "AED", "UK": "GBP", "GB": "GBP",
                        "DE": "EUR", "CA": "CAD", "AU": "AUD", "JP": "JPY", "KR": "KRW",
                        "FR": "EUR", "IT": "EUR", "ES": "EUR", "NL": "EUR", "MX": "MXN",
                        "BR": "BRL", "RU": "USD", "SG": "SGD"
                    }
                    
                    if price is not None and item_url:
                        full_url = item_url if item_url.startswith('http') else f"https://www.{domain}{item_url}"
                        
                        results.append(ProductResult(
                            name=name, 
                            price=price, 
                            currency=currency_map.get(self.country.upper(), "USD"),
                            url=full_url, 
                            platform=self.platform, 
                            country=self.country,
                            image_url=img_url
                        ))
                except Exception as e:
                    print(f"Extraction error on {self.country}: {e}")
                    continue
        except Exception as e:
            print(f"Amazon error: {e}")
            pass
        return results


class FlipkartScraper(StealthScraper):
    def __init__(self, country: str = "IN"):
        super().__init__(country)
        self.platform = "flipkart"

    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        serpapi_key = os.getenv('SERPAPI_KEY')
        if serpapi_key:
            try:
                import aiohttp
                query = urllib.parse.quote_plus(product)
                url = f"https://serpapi.com/search.json?engine=flipkart&q={query}&api_key={serpapi_key}"
                async with aiohttp.ClientSession() as session:
                    async with session.get(url) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            results = []
                            for item in data.get('organic_results', [])[:max_results]:
                                price_val = item.get('price') or item.get('extracted_price')
                                price = self._clean_price(str(price_val)) if price_val else None
                                if price is not None:
                                    results.append(ProductResult(
                                        name=item.get('title'),
                                        price=price,
                                        currency="INR",
                                        url=item.get('link'),
                                        platform=self.platform,
                                        country=self.country,
                                        image_url=item.get('thumbnail')
                                    ))
                            if results:
                                return results
            except Exception as e:
                print(f"SerpAPI Error: {e}")
                # Fallback to Playwright
        
        results = []
        path = subcat.retailer_paths.get("flipkart", "/search?q=")
        query = urllib.parse.quote_plus(product)
        if "q=" not in path:
            url = f"https://www.flipkart.com{path}&q={query}"
        else:
            url = f"https://www.flipkart.com{path}{query}"
            
        try:
            print(f"[{self.platform.upper()} {self.country}] Navigating to {url}")
            page, ctx = await self._navigate_with_proxy_fallback(url, wait_until="domcontentloaded", timeout=45000)
            if page is None:
                return results

            await self._human_delay()
            await self._scroll_page(page, loops=3)

            items = await page.locator('div[data-id]').all()
            print(f"[{self.platform.upper()}] Found {len(items)} items")
            for item in items[:max_results]:
                try:
                    # Generic robust selectors
                    name_loc = item.locator('img[alt]')
                    price_loc = item.locator('text=₹')
                    
                    if await name_loc.count() == 0 or await price_loc.count() == 0:
                        continue
                        
                    name = await name_loc.first.get_attribute('alt')
                    if not name or name == "Image":
                        # fallback
                        name = await item.locator('a[target="_blank"][title]').first.text_content()
                    
                    raw_price = await price_loc.first.text_content()
                    price = self._clean_price(raw_price)
                    item_url = await item.locator('a[target="_blank"]').first.get_attribute('href')
                    
                    img_url = await name_loc.first.get_attribute('src')

                    if price is not None and item_url:
                        results.append(ProductResult(
                            name=name, price=price, currency="INR",
                            url=f"https://www.flipkart.com{item_url}", platform=self.platform, country=self.country,
                            image_url=img_url
                        ))
                except Exception as e:
                    print(f"Flipkart extraction err: {e}")
        except Exception as e:
            print(f"Flipkart nav err: {e}")
        return results

class WalmartScraper(StealthScraper):
    def __init__(self, country: str = "US"):
        super().__init__(country)
        self.platform = "walmart"

    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        serpapi_key = os.getenv('SERPAPI_KEY')
        if serpapi_key:
            try:
                import urllib.parse, aiohttp
                query = urllib.parse.quote_plus(product)
                url = f"https://serpapi.com/search.json?engine=walmart&query={query}&api_key={serpapi_key}"
                async with aiohttp.ClientSession() as session:
                    async with session.get(url) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            results = []
                            for item in data.get("organic_results", [])[:max_results]:
                                price_dict = item.get("primary_offer", {})
                                price_val = price_dict.get("offer_price")
                                if price_val:
                                    results.append(ProductResult(
                                        name=item.get("title", ""),
                                        price=float(price_val),
                                        currency="USD",
                                        url=item.get("product_page_url", ""),
                                        platform=self.platform,
                                        country=self.country,
                                        image_url=item.get("thumbnail")
                                    ))
                            if results:
                                return results
            except Exception as e:
                print(f"Walmart SerpAPI Error: {e}")

        # Fallback Playwright
        results = []
        domain = "walmart.ca" if self.country.upper() == "CA" else "walmart.com"
        query = urllib.parse.quote_plus(product)
        url = f"https://www.{domain}/search?q={query}"
        try:
            print(f"[{self.platform.upper()} {self.country}] Navigating to {url}")
            page, ctx = await self._navigate_with_proxy_fallback(url, wait_until="domcontentloaded", timeout=45000)
            if page is None:
                return results
                
            await self._human_delay()
            items = await page.locator('div[data-testid="item-stack"] > div').all()
            for item in items:
                if len(results) >= max_results:
                    break
                try:
                    name_loc = item.locator('span[data-automation-id="product-title"]')
                    price_loc = item.locator('div[data-automation-id="product-price"] span.w_iUH7')  # W_iUH7 or similar dynamic class, try more generic
                    
                    if await name_loc.count() == 0:
                        continue
                        
                    name = await name_loc.first.text_content()
                    
                    raw_price = None
                    # Fallback generic price selector
                    price_spans = await item.locator('[data-automation-id="product-price"] span').all()
                    for span in price_spans:
                        txt = await span.text_content()
                        if "$" in txt:
                            raw_price = txt
                            break
                            
                    if not raw_price:
                        continue
                        
                    price = self._clean_price(raw_price)
                    url_val = await item.locator('a').first.get_attribute('href')
                    if url_val and url_val.startswith('/'):
                        url_val = f"https://www.{domain}" + url_val
                        
                    img_val = await item.locator('img').first.get_attribute('src')
                    
                    if price is not None:
                        results.append(ProductResult(
                            name=name, price=price, currency="CAD" if domain == "walmart.ca" else "USD",
                            url=url_val, platform=self.platform, country=self.country, image_url=img_val
                        ))
                except:
                    pass
        except Exception as e:
            print(f"Walmart Error: {e}")
            
        return results

class NoonScraper(StealthScraper):
    def __init__(self, country: str = "AE"):
        super().__init__(country)
        self.platform = "noon"

    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        return []

class CoupangScraper(StealthScraper):
    def __init__(self, country: str = "KR"):
        super().__init__(country)
        self.platform = "coupang"

    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        return []

class OzonScraper(StealthScraper):
    def __init__(self, country: str = "RU"):
        super().__init__(country)
        self.platform = "ozon"

    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        return []

class MyntraScraper(StealthScraper):
    def __init__(self, country: str = "IN"):
        super().__init__(country)
        self.platform = "myntra"
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]: return []

class MeeshoScraper(StealthScraper):
    def __init__(self, country: str = "IN"):
        super().__init__(country)
        self.platform = "meesho"
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]: return []

class BestBuyScraper(StealthScraper):
    def __init__(self, country: str = "US"):
        super().__init__(country)
        self.platform = "bestbuy"
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]: return []

class EbayScraper(StealthScraper):
    def __init__(self, country: str = "US"):
        super().__init__(country)
        self.platform = "ebay"
        
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        domain_map = {
            "US": "ebay.com", "UK": "ebay.co.uk", "DE": "ebay.de",
            "CA": "ebay.ca", "AU": "ebay.com.au", "IT": "ebay.it",
            "FR": "ebay.fr", "ES": "ebay.es", "IN": "ebay.com",
            "AE": "ebay.com"
        }
        domain = domain_map.get(self.country.upper(), "ebay.com")
        query = urllib.parse.quote_plus(product)
        url = f"https://www.{domain}/sch/i.html?_nkw={query}"
        
        results = []
        try:
            print(f"[{self.platform.upper()} {self.country}] Navigating to {url}")
            page, ctx = await self._navigate_with_proxy_fallback(url, wait_until="domcontentloaded", timeout=45000)
            if page is None:
                return results
                
            await self._human_delay()
            await self._scroll_page(page, loops=2)

            items = await page.locator('.s-item, .s-card').all()
            print(f"[{self.platform.upper()}] Found {len(items)} items")
            
            for item in items:
                if len(results) >= max_results:
                    break
                try:
                    name_loc = item.locator('.s-item__title, .s-card__title')
                    price_loc = item.locator('.s-item__price, .s-card__price')
                    
                    if await name_loc.count() == 0 or await price_loc.count() == 0:
                        continue
                        
                    name = await name_loc.first.text_content()
                    if name.lower() == "shop on ebay":
                        continue
                        
                    raw_price = await price_loc.first.text_content()
                    if " to " in raw_price:
                        raw_price = raw_price.split("to")[0].strip()
                    price = self._clean_price(raw_price)
                    
                    link_loc = item.locator('a.s-item__link, a.s-card__link')
                    item_url = await link_loc.first.get_attribute('href') if await link_loc.count() > 0 else None
                    if not item_url:
                        continue
                        
                    img_loc = item.locator('img')
                    img_url = await img_loc.first.get_attribute('src') if await img_loc.count() > 0 else None

                    currency_map = {"US": "USD", "UK": "GBP", "DE": "EUR", "CA": "CAD", "AU": "AUD", "IT": "EUR", "FR": "EUR", "ES": "EUR", "IN": "USD", "AE": "USD"}
                    
                    if price is not None and item_url:
                        results.append(ProductResult(
                            name=name.replace("New Listing", ""), 
                            price=price, 
                            currency=currency_map.get(self.country.upper(), "USD"),
                            url=item_url, 
                            platform=self.platform, 
                            country=self.country,
                            image_url=img_url
                        ))
                except Exception as e:
                    pass
        except Exception as e:
            print(f"Ebay error: {e}")
            pass
        return results

class GmarketScraper(StealthScraper):
    def __init__(self, country: str = "KR"):
        super().__init__(country)
        self.platform = "gmarket"
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]: return []

class ElevenStreetScraper(StealthScraper):
    def __init__(self, country: str = "KR"):
        super().__init__(country)
        self.platform = "11street"
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]: return []

class NaverShopScraper(StealthScraper):
    def __init__(self, country: str = "KR"):
        super().__init__(country)
        self.platform = "navershop"
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]: return []

class WildberriesScraper(StealthScraper):
    def __init__(self, country: str = "RU"):
        super().__init__(country)
        self.platform = "wildberries"
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]: return []

class YandexMarketScraper(StealthScraper):
    def __init__(self, country: str = "RU"):
        super().__init__(country)
        self.platform = "yandexmarket"
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]: return []

class AliExpressRuScraper(StealthScraper):
    def __init__(self, country: str = "RU"):
        super().__init__(country)
        self.platform = "aliexpress"
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]: return []
