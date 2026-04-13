import os
import random
import asyncio
from typing import List, Optional
from playwright.async_api import async_playwright, BrowserContext, Page
from dotenv import load_dotenv

from ..models import ProductResult
from ..categories import Subcategory

load_dotenv()

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

VIEWPORTS = [
    {"width": 1920, "height": 1080},
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
]

PROXY_LIST = [p.strip() for p in os.getenv('PROXY_LIST', '').split(',') if p.strip()]

class StealthScraper:
    def __init__(self, country: str):
        self.country = country
        self.platform = "base"
        self._pw = None
        self._browser = None

    def _get_proxy(self):
        proxy_url = os.getenv('PROXY_URL')
        if not proxy_url and PROXY_LIST:
            proxy_url = random.choice(PROXY_LIST)
            
        if proxy_url:
            if '@' in proxy_url:
                try:
                    from urllib.parse import urlparse
                    parsed = urlparse(proxy_url)
                    if parsed.username and parsed.password:
                        return {
                            "server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}",
                            "username": parsed.username,
                            "password": parsed.password
                        }
                except Exception as e:
                    print(f"Proxy parse error: {e}")
            return {"server": proxy_url}
        return None

    async def __aenter__(self):
        self._pw = await async_playwright().start()
        proxy = self._get_proxy()
        self._has_proxy = proxy is not None
        self._browser = await self._pw.chromium.launch(
            headless=True, 
            proxy=proxy,
            args=['--ignore-certificate-errors']
        )
        return self

    async def _get_no_proxy_browser(self):
        """Launch a second browser without proxy for fallback."""
        if not self._has_proxy:
            return self._browser  # Already no proxy
        return await self._pw.chromium.launch(
            headless=True,
            args=['--ignore-certificate-errors']
        )

    async def __aexit__(self, exc_type, exc, tb):
        if self._browser:
            await self._browser.close()
        if self._pw:
            await self._pw.stop()

    async def _new_stealth_context(self) -> BrowserContext:
        ctx = await self._browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport=random.choice(VIEWPORTS),
            locale=f"en-{self.country}",
            ignore_https_errors=True
        )
        # Advanced stealth evasion
        await ctx.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-', 'en'] });
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : originalQuery(parameters)
            );
        """)
        return ctx

    async def _human_delay(self, min_ms: int = 1000, max_ms: int = 3000):
        delay = random.uniform(min_ms, max_ms) / 1000.0
        await asyncio.sleep(delay)

    async def _scroll_page(self, page: Page, loops: int = 4):
        for _ in range(loops):
            await page.mouse.wheel(0, 1000)
            await self._human_delay(500, 1500)

    def _clean_price(self, raw_string: str) -> Optional[float]:
        if not raw_string:
            return None
        cleaned = "".join(c for c in raw_string if c.isdigit() or c in ".,")
        
        # Handle comma as decimal separator common in Europe
        if ',' in cleaned and '.' in cleaned:
            cleaned = cleaned.replace(',', '')
        elif ',' in cleaned and '.' not in cleaned:
            # If there's multiple commas, it's just thousands separator (e.g. 1,000,000)
            if cleaned.count(',') > 1:
                cleaned = cleaned.replace(',', '')
            # If one comma, check if it's likely a decimal separator (last 2 digits)
            elif len(cleaned.split(',')[1]) in (1, 2):
                cleaned = cleaned.replace(',', '.')
            else:
                cleaned = cleaned.replace(',', '')
                
        try:
            return float(cleaned)
        except ValueError:
            return None

    async def _navigate_with_proxy_fallback(self, url: str, wait_until: str = "domcontentloaded", timeout: int = 45000):
        """Navigate to URL; if proxy tunnel fails, retry without proxy."""
        ctx = await self._new_stealth_context()
        page = await ctx.new_page()
        try:
            await page.goto(url, wait_until=wait_until, timeout=timeout)
            return page, ctx
        except Exception as e:
            err_msg = str(e)
            if "net::ERR_TUNNEL_CONNECTION_FAILED" in err_msg or "net::ERR_PROXY" in err_msg or "net::ERR_TIMED_OUT" in err_msg:
                print(f"[{self.platform.upper()} {self.country}] Proxy tunnel or timeout failed. Retrying without proxy...")
                try:
                    await page.close()
                    await ctx.close()
                except Exception:
                    pass
                try:
                    no_proxy_browser = await self._get_no_proxy_browser()
                    ctx2 = await no_proxy_browser.new_context(
                        user_agent=random.choice(USER_AGENTS),
                        viewport=random.choice(VIEWPORTS),
                        locale=f"en-{self.country}",
                        ignore_https_errors=True,
                    )
                    page2 = await ctx2.new_page()
                    await page2.goto(url, wait_until=wait_until, timeout=timeout)
                    print(f"[{self.platform.upper()} {self.country}] [OK] Retry without proxy succeeded")
                    return page2, ctx2
                except Exception as e2:
                    print(f"[{self.platform.upper()} {self.country}] [FAIL] Retry without proxy also failed: {e2}")
                    return None, None
            else:
                print(f"{self.platform.upper()} error: Page.goto: {err_msg}")
                return None, None

    async def search(self, product: str, subcat: Subcategory, max_results: int) -> List[ProductResult]:
        raise NotImplementedError("Subclasses must implement search")
