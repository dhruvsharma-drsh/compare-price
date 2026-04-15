"""Test Coupang and Ozon scrapers via SerpAPI."""
import asyncio
import os
import sys
from dotenv import load_dotenv

# Force UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

load_dotenv()
os.environ['PYTHONIOENCODING'] = 'utf-8'

from price_comparison.scraper.retailers import CoupangScraper, OzonScraper
from price_comparison.categories import CATEGORIES

async def test_scraper(ScraperClass, country, query="iPhone 16"):
    subcat = CATEGORIES['electronics'].subcategories[0]
    name = f"{ScraperClass.__name__}({country})"
    print(f"\n{'='*50}")
    print(f"Testing {name} with query: '{query}'")
    print(f"{'='*50}")
    try:
        scraper = ScraperClass(country)
        async with scraper:
            results = await asyncio.wait_for(
                scraper.search(query, subcat, 5),
                timeout=30
            )
            if results:
                print(f"  [OK] {len(results)} results:")
                for r in results:
                    safe_name = r.name.encode('ascii', 'replace').decode('ascii')
                    print(f"    - {safe_name[:60]} | {r.price} {r.currency} | {r.platform}")
                    print(f"      URL: {r.url[:80]}")
            else:
                print(f"  [FAIL] 0 results returned")
    except asyncio.TimeoutError:
        print(f"  [TIMEOUT] Scraper timed out after 30s")
    except Exception as e:
        print(f"  [ERROR] {type(e).__name__}: {e}")

async def main():
    await test_scraper(CoupangScraper, "KR")
    await test_scraper(OzonScraper, "RU")

asyncio.run(main())
