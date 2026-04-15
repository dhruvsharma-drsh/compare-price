"""Debug: dump the actual HTML from each retailer to see what's being blocked."""
import asyncio
import os
os.environ['PYTHONIOENCODING'] = 'utf-8'

from playwright.async_api import async_playwright

URLS = {
    "Amazon US": "https://www.amazon.com/s?k=iPhone+16",
    "Amazon IN": "https://www.amazon.in/s?k=iPhone+16",
    "Flipkart": "https://www.flipkart.com/search?q=iPhone+16",
    "eBay": "https://www.ebay.com/sch/i.html?_nkw=iPhone+16",
}

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--ignore-certificate-errors'])
        
        for name, url in URLS.items():
            print(f"\n{'='*50}")
            print(f"Testing: {name}")
            print(f"URL: {url}")
            print(f"{'='*50}")
            
            ctx = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080}
            )
            page = await ctx.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(3000)
                
                content = await page.content()
                title = await page.title()
                print(f"  Title: {title}")
                print(f"  Page length: {len(content)} chars")
                
                # Check for bot detection
                if "captcha" in content.lower() or "robot" in content.lower():
                    print(f"  [CAPTCHA/BOT DETECTED]")
                elif len(content) < 5000:
                    print(f"  [BLOCKED - tiny page]")
                    print(f"  Content preview: {content[:500]}")
                else:
                    # Try to count product elements
                    if "amazon" in name.lower():
                        count = len(await page.locator('[data-component-type="s-search-result"]').all())
                        print(f"  Amazon results found: {count}")
                    elif "flipkart" in name.lower():
                        count = len(await page.locator('div[data-id]').all())
                        count2 = len(await page.locator('a[href*="pid="]').all())
                        print(f"  Flipkart data-id items: {count}, pid links: {count2}")
                    elif "ebay" in name.lower():
                        count = len(await page.locator('.s-item').all())
                        count2 = len(await page.locator('.s-card').all())
                        print(f"  eBay s-item: {count}, s-card: {count2}")
                    print(f"  [OK - page loaded]")
            except Exception as e:
                print(f"  [ERROR] {e}")
            finally:
                await ctx.close()
        
        await browser.close()

asyncio.run(main())
