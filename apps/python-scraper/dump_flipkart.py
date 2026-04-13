import asyncio
from price_comparison.scraper.base_scraper import StealthScraper

async def test():
    async with StealthScraper('IN') as s:
        ctx = await s._new_stealth_context()
        page = await ctx.new_page()
        url = "https://www.flipkart.com/search?q=iphone+16"
        print("Navigating...")
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(3000)
        print("Getting HTML...")
        html = await page.content()
        with open("flipkart_dump.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("Done")

asyncio.run(test())
