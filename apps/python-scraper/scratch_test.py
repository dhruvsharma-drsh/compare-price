import asyncio
from price_comparison.scraper.retailers import FlipkartScraper, EbayScraper
from price_comparison.categories import CATEGORIES

async def test():
    subcat = CATEGORIES['electronics'].subcategories[0]
    print("Testing Flipkart...")
    async with FlipkartScraper('IN') as s:
        res = await s.search('iphone 16', subcat, 5)
        print(f"Flipkart found: {len(res)} items")
        for item in res:
            print(item)

    print("\nTesting eBay...")
    async with EbayScraper('US') as e:
        res2 = await e.search('iphone 16', subcat, 5)
        print(f"eBay found: {len(res2)} items")
        for item in res2:
            print(item)

asyncio.run(test())
