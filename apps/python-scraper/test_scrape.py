import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from price_comparison.scraper.retailers import AmazonScraper
from price_comparison.categories import Subcategory

async def main():
    print("Testing Amazon US scraper directly...")
    scraper = AmazonScraper("US")
    subcat = Subcategory(
        id="smartphones",
        display_name="Smartphones",
        search_hints=[],
        retailer_paths={"amazon_us": "/s?i=electronics&rh=n%3A2811409011"}
    )
    async with scraper as s:
        results = await s.search("samsung s24", subcat, 5)
    print("Results:")
    for r in results:
        print(f" - {r.name[:50]}: {r.price}")

asyncio.run(main())
