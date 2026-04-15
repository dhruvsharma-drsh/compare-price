import os
import re
import urllib.parse
from typing import List
from ..models import ProductResult
from ..categories import Subcategory
from .base_scraper import StealthScraper

try:
    from amazon_paapi5 import DefaultApi
except ImportError:
    DefaultApi = None

ANTI_ACCESSORY_KEYWORDS = [
    "case", "cover", "pouch", "sleeve", "holster", "shell", "housing",
    "screen protector", "tempered glass", "screen guard", "film",
    "charger", "adapter", "cable", "cord", "dock", "stand", "mount", "holder",
    "sticker", "decal", "skin", "wrap",
    "ring", "grip", "popsocket",
    "earbuds", "headphones", "airpods",
    "armband", "strap", "band",
    "stylus", "pen",
    "replacement", "spare", "repair", "tool kit"
]

def is_accessory(product_name: str, search_query: str, subcat: Subcategory = None) -> bool:
    """Check if the product name looks like an accessory, unless the search query naturally includes those terms."""
    query_lower = search_query.lower()
    name_lower = product_name.lower()
    keywords = subcat.anti_keywords if subcat and hasattr(subcat, 'anti_keywords') and subcat.anti_keywords else ANTI_ACCESSORY_KEYWORDS
    active_anti_keywords = [ak for ak in keywords if ak not in query_lower]
    return any(ak in name_lower for ak in active_anti_keywords)


async def _serpapi_search(engine: str, query: str, extra_params: dict = None) -> dict:
    """Helper: call SerpAPI and return JSON response."""
    serpapi_key = os.getenv('SERPAPI_KEY')
    if not serpapi_key:
        return {}
    import aiohttp
    params = {
        "engine": engine,
        "api_key": serpapi_key,
    }
    if engine == "walmart":
        params["query"] = query
    elif engine == "amazon":
        params["k"] = query
    else:
        params["q"] = query
    if extra_params:
        params.update(extra_params)
    url = "https://serpapi.com/search.json?" + urllib.parse.urlencode(params)
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                if resp.status == 200:
                    return await resp.json()
    except Exception as e:
        print(f"  [SerpAPI] {engine} error: {e}")
    return {}


class AmazonScraper(StealthScraper):
    def __init__(self, country: str):
        super().__init__(country)
        self.platform = "amazon"
        
    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        # Try SerpAPI first (Amazon blocks headless browsers)
        results = await self._search_serpapi(product, subcat, max_results)
        if results:
            return results
        # Fallback to Playwright
        return await self._search_playwright(product, subcat, max_results)

    async def _search_serpapi(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        """Use SerpAPI for Amazon — avoids bot detection issues."""
        domain_map = {
            "IN": "amazon.in", "US": "amazon.com", "UK": "amazon.co.uk",
            "DE": "amazon.de", "CA": "amazon.ca", "AU": "amazon.com.au",
            "JP": "amazon.co.jp", "AE": "amazon.ae", "FR": "amazon.fr",
        }
        amazon_domain = domain_map.get(self.country.upper(), "amazon.com")
        
        # Use Amazon engine directly instead of google_shopping
        data = await _serpapi_search("amazon", product, {
            "amazon_domain": amazon_domain,
        })
        
        results = []
        currency_map = {
            "IN": "INR", "US": "USD", "AE": "AED", "UK": "GBP", "GB": "GBP",
            "DE": "EUR", "CA": "CAD", "AU": "AUD", "JP": "JPY", "KR": "KRW",
            "FR": "EUR", "IT": "EUR", "ES": "EUR", "NL": "EUR", "MX": "MXN",
            "BR": "BRL", "RU": "USD", "SG": "SGD"
        }
        
        # Amazon engine returns results in 'organic_results'
        for item in data.get("organic_results", [])[:max_results * 2]:
            title = item.get("title", "")
            if not title or is_accessory(title, product, subcat):
                continue
            
            price_raw = item.get("price", {})
            if isinstance(price_raw, dict):
                price_val = price_raw.get("raw") or price_raw.get("extracted") or price_raw.get("value")
            else:
                price_val = price_raw
            
            price = self._clean_price(str(price_val)) if price_val else None
            if not price:
                price_val = item.get("extracted_price") or item.get("price_raw")
                price = self._clean_price(str(price_val)) if price_val else None
            
            link = item.get("link") or item.get("url", "")
            img = item.get("thumbnail") or item.get("image")
            
            if price is not None and link:
                results.append(ProductResult(
                    name=title, price=price,
                    currency=currency_map.get(self.country.upper(), "USD"),
                    url=link, platform=self.platform, country=self.country,
                    image_url=img, asin=item.get("asin")
                ))
                if len(results) >= max_results:
                    break
        
        if results:
            print(f"  [SerpAPI] Amazon {self.country}: {len(results)} results")
        return results

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
            "KR": "amazon.com",
            "RU": "amazon.com",
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
                    
                    if is_accessory(name, product, subcat):
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
        return await self._search_playwright(product, subcat, max_results)

    async def _search_playwright(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        results = []
        query = urllib.parse.quote_plus(product)
        url = f"https://www.flipkart.com/search?q={query}"
            
        try:
            print(f"[{self.platform.upper()} {self.country}] Navigating to {url}")
            page, ctx = await self._navigate_with_proxy_fallback(url, wait_until="domcontentloaded", timeout=45000, expected_selector='div[data-id]')
            if page is None:
                return results

            await self._human_delay()
            await self._scroll_page(page, loops=3)

            items = await page.locator('div[data-id]').all()
            print(f"[{self.platform.upper()}] Found {len(items)} items")
            for item in items[:max_results * 2]:
                if len(results) >= max_results:
                    break
                try:
                    # Title from img alt attribute (most reliable)
                    img_loc = item.locator('img[alt]')
                    if await img_loc.count() == 0:
                        continue
                    name = await img_loc.first.get_attribute('alt')
                    if not name or name == "Image" or len(name) < 5:
                        continue
                    
                    if is_accessory(name, product, subcat):
                        continue

                    # Price from inner HTML using regex (₹ symbol)
                    html = await item.inner_html()
                    price_matches = re.findall(r'[\u20B9\u20A8][0-9,]+', html)
                    if not price_matches:
                        continue
                    
                    price = self._clean_price(price_matches[0])
                    
                    # URL from first anchor
                    link_loc = item.locator('a[href*="pid="], a[target="_blank"]')
                    if await link_loc.count() == 0:
                        continue
                    item_url = await link_loc.first.get_attribute('href')
                    
                    # Image URL
                    img_url = await img_loc.first.get_attribute('src')

                    if price is not None and item_url:
                        full_url = item_url if item_url.startswith('http') else f"https://www.flipkart.com{item_url}"
                        results.append(ProductResult(
                            name=name, price=price, currency="INR",
                            url=full_url, platform=self.platform, country=self.country,
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
        # SerpAPI primary (Walmart blocks bots heavily)
        results = await self._search_serpapi(product, subcat, max_results)
        if results:
            return results
        return await self._search_playwright(product, subcat, max_results)

    async def _search_serpapi(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        data = await _serpapi_search("walmart", product)
        results = []
        for item in data.get("organic_results", [])[:max_results * 2]:
            title = item.get("title", "")
            if not title or is_accessory(title, product, subcat):
                continue
            price_dict = item.get("primary_offer", {})
            price_val = price_dict.get("offer_price")
            if price_val:
                results.append(ProductResult(
                    name=title, price=float(price_val), currency="USD",
                    url=item.get("product_page_url", ""),
                    platform=self.platform, country=self.country,
                    image_url=item.get("thumbnail")
                ))
                if len(results) >= max_results:
                    break
        if results:
            print(f"  [SerpAPI] Walmart: {len(results)} results")
        return results

    async def _search_playwright(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
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
                    
                    if await name_loc.count() == 0:
                        continue
                        
                    name = await name_loc.first.text_content()
                    
                    if is_accessory(name, product, subcat):
                        continue
                    
                    raw_price = None
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
            page, ctx = await self._navigate_with_proxy_fallback(url, wait_until="domcontentloaded", timeout=45000, expected_selector='.s-card')
            if page is None:
                return results
                
            await self._human_delay()
            await self._scroll_page(page, loops=2)

            # eBay now uses .s-card elements. First ~2 are "Shop on eBay" placeholders.
            cards = await page.locator('.s-card').all()
            print(f"[{self.platform.upper()}] Found {len(cards)} s-card items")
            
            for card in cards:
                if len(results) >= max_results:
                    break
                try:
                    # Get the card's inner text to extract title + price
                    inner = await card.inner_text()
                    lines = [l.strip() for l in inner.split('\n') if l.strip() and l.strip() != '\u2063']
                    
                    # Skip placeholder "Shop on eBay" cards
                    if not lines or "Shop on eBay" in lines[0] or "Shop on eBay" in inner:
                        continue
                    
                    # Skip noise lines that appear before the title
                    while lines and (lines[0] in ["Find more like this", "Sponsored", "Opens in a new window or tab"] or "NEW LISTING" in lines[0].upper()):
                        lines.pop(0)

                    if not lines:
                        continue

                    # Title is the first meaningful line — strip badge prefixes
                    name = re.sub(r'^(NEW LOW PRICE|NEW LISTING|GREAT PRICE|Sponsored)', '', lines[0], flags=re.IGNORECASE).strip()
                    if not name or len(name) < 5:
                        continue
                    
                    if is_accessory(name, product, subcat):
                        continue
                    
                    # Find price in text lines (look for $, GBP, EUR patterns)
                    raw_price = None
                    for line in lines:
                        if re.match(r'^[\$\u00A3\u20AC][\d,]+\.?\d*', line):
                            raw_price = line
                            break
                    
                    if not raw_price:
                        # Try regex on the whole text
                        price_match = re.search(r'[\$\u00A3\u20AC][\d,]+\.?\d*', inner)
                        if price_match:
                            raw_price = price_match.group(0)
                    
                    price = self._clean_price(raw_price) if raw_price else None
                    
                    # Get the product link (should contain /itm/)
                    link_loc = card.locator('a[href*="/itm/"]')
                    if await link_loc.count() == 0:
                        # Fallback: any link
                        link_loc = card.locator('a')
                    
                    if await link_loc.count() == 0:
                        continue
                    
                    item_url = await link_loc.first.get_attribute('href')
                    if not item_url or 'itm/123456' in item_url:
                        continue
                    
                    # Get image
                    img_loc = card.locator('img')
                    img_url = await img_loc.first.get_attribute('src') if await img_loc.count() > 0 else None

                    currency_map = {"US": "USD", "UK": "GBP", "DE": "EUR", "CA": "CAD", "AU": "AUD", "IT": "EUR", "FR": "EUR", "ES": "EUR", "IN": "USD", "AE": "USD"}
                    
                    if price is not None and item_url:
                        results.append(ProductResult(
                            name=name, 
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
        # Primary: SerpAPI Google Shopping (gl=kr returns Coupang listings)
        results = await self._search_serpapi_shopping(product, subcat, max_results)
        if results:
            return results
        # Secondary: SerpAPI Google Search with site:coupang.com
        results = await self._search_serpapi_google(product, subcat, max_results)
        if results:
            return results
        return []

    async def _search_serpapi_shopping(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        """Use Google Shopping API localized to South Korea — returns Coupang listings."""
        data = await _serpapi_search("google_shopping", product, {
            "gl": "kr",
            "hl": "ko",
            "location": "South Korea",
        })
        results = []
        for item in data.get("shopping_results", [])[:max_results * 2]:
            title = item.get("title", "")
            source = (item.get("source") or "").lower()
            if not title or is_accessory(title, product, subcat):
                continue
            # Prefer Coupang listings but accept all Korean shopping results
            price_val = item.get("extracted_price") or item.get("price")
            price = self._clean_price(str(price_val)) if price_val else None
            if price is None or price <= 0:
                continue
            link = item.get("link") or item.get("product_link") or ""
            img = item.get("thumbnail")
            platform_name = "coupang" if "coupang" in source else f"coupang ({source})"
            results.append(ProductResult(
                name=title, price=price,
                currency="KRW",
                url=link, platform=platform_name, country=self.country,
                image_url=img
            ))
            if len(results) >= max_results:
                break
        if results:
            print(f"  [SerpAPI] Coupang/KR Shopping: {len(results)} results")
        return results

    async def _search_serpapi_google(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        """Fallback: Google Search with site:coupang.com to find product pages."""
        data = await _serpapi_search("google", f"{product} site:coupang.com", {
            "gl": "kr",
            "hl": "ko",
        })
        results = []
        for item in data.get("organic_results", [])[:max_results * 2]:
            title = item.get("title", "")
            link = item.get("link", "")
            snippet = item.get("snippet", "")
            if not title or not link or "coupang.com" not in link:
                continue
            if is_accessory(title, product, subcat):
                continue
            # Try to extract price from snippet (e.g. "39,900원" or "₩39,900")
            price = None
            price_match = re.search(r'[\d,.]+ *(?:원|won)', snippet, re.IGNORECASE)
            if price_match:
                price = self._clean_price(price_match.group())
            if not price:
                price_match = re.search(r'₩ *[\d,.]+', snippet)
                if price_match:
                    price = self._clean_price(price_match.group())
            # Even without price, include the result so the user gets a link
            if price is None:
                price = 0.0
            img = item.get("thumbnail")
            results.append(ProductResult(
                name=title, price=price if price > 0 else None,
                currency="KRW",
                url=link, platform=self.platform, country=self.country,
                image_url=img
            ))
            if len(results) >= max_results:
                break
        if results:
            print(f"  [SerpAPI] Coupang Google Search: {len(results)} results")
        return results


class OzonScraper(StealthScraper):
    def __init__(self, country: str = "RU"):
        super().__init__(country)
        self.platform = "ozon"

    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        # Primary: SerpAPI Google Shopping (gl=ru returns Ozon listings)
        results = await self._search_serpapi_shopping(product, subcat, max_results)
        if results:
            return results
        # Secondary: SerpAPI Google Search with site:ozon.ru
        results = await self._search_serpapi_google(product, subcat, max_results)
        if results:
            return results
        return []

    async def _search_serpapi_shopping(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        """Use Google Shopping API localized to Russia — returns Ozon/Russian retailer listings."""
        data = await _serpapi_search("google_shopping", product, {
            "gl": "ru",
            "hl": "ru",
            "location": "Russia",
        })
        results = []
        for item in data.get("shopping_results", [])[:max_results * 2]:
            title = item.get("title", "")
            source = (item.get("source") or "").lower()
            if not title or is_accessory(title, product, subcat):
                continue
            price_val = item.get("extracted_price") or item.get("price")
            price = self._clean_price(str(price_val)) if price_val else None
            if price is None or price <= 0:
                continue
            link = item.get("link") or item.get("product_link") or ""
            img = item.get("thumbnail")
            platform_name = "ozon" if "ozon" in source else f"ozon ({source})"
            results.append(ProductResult(
                name=title, price=price,
                currency="RUB",
                url=link, platform=platform_name, country=self.country,
                image_url=img
            ))
            if len(results) >= max_results:
                break
        if results:
            print(f"  [SerpAPI] Ozon/RU Shopping: {len(results)} results")
        return results

    async def _search_serpapi_google(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        """Fallback: Google Search with site:ozon.ru to find product pages."""
        data = await _serpapi_search("google", f"{product} site:ozon.ru", {
            "gl": "ru",
            "hl": "ru",
        })
        results = []
        for item in data.get("organic_results", [])[:max_results * 2]:
            title = item.get("title", "")
            link = item.get("link", "")
            snippet = item.get("snippet", "")
            if not title or not link or "ozon.ru" not in link:
                continue
            if is_accessory(title, product, subcat):
                continue
            # Try to extract price from snippet (e.g. "39 900 ₽" or "39900 руб")
            price = None
            price_match = re.search(r'[\d\s,.]+\s*(?:₽|руб|rub)', snippet, re.IGNORECASE)
            if price_match:
                price = self._clean_price(price_match.group())
            if price is None:
                price = 0.0
            img = item.get("thumbnail")
            results.append(ProductResult(
                name=title, price=price if price > 0 else None,
                currency="RUB",
                url=link, platform=self.platform, country=self.country,
                image_url=img
            ))
            if len(results) >= max_results:
                break
        if results:
            print(f"  [SerpAPI] Ozon Google Search: {len(results)} results")
        return results

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
