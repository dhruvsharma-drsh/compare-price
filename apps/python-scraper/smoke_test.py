import asyncio
from price_comparison.scraper.base_scraper import StealthScraper

async def test():
    print("Testing StealthScraper with bot.sannysoft.com")
    try:
        async with StealthScraper("US") as s:
            ctx = await s._new_stealth_context()
            page = await ctx.new_page()
            await page.goto('https://bot.sannysoft.com', timeout=30000, wait_until="domcontentloaded")
            title = await page.title()
            print('Page title:', title)
            await ctx.close()
        print("Smoke test PASSED!")
    except Exception as e:
        print(f"Smoke test FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test())
