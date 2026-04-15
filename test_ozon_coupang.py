import asyncio
import os
from dotenv import load_dotenv

load_dotenv()
os.environ['PYTHONIOENCODING'] = 'utf-8'

from price_comparison.scraper.retailers import OzonScraper, CoupangScraper
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
                scraper.search(query, subcat, 3),
                timeout=30
            )
            if results:
                print(f"  [OK] {len(results)} results:")
                for r in results:
                    print(f"    - {r.title[:60]} | {r.price} {r.currency}")
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
