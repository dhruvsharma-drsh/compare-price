import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # --- Flipkart price ---
        print("=== FLIPKART - FIND PRICE ===")
        ctx = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36", viewport={"width": 1920, "height": 1080})
        page = await ctx.new_page()
        await page.goto("https://www.flipkart.com/search?q=iPhone+16", wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(3000)
        item = page.locator('div[data-id]').first
        # Get ALL inner HTML to find price pattern
        html = await item.inner_html()
        # Find anything with rupee
        import re
        prices = re.findall(r'[\u20B9₹][0-9,]+', html)
        print(f"  Prices found in HTML: {prices}")
        # Try various selectors for price
        for sel in ['div._30jeq3', 'div._1_WHN1', 'div.Nx9bqj', 'span._30jeq3', '[class*="price"]', '[class*="Price"]']:
            count = await item.locator(sel).count()
            if count > 0:
                txt = await item.locator(sel).first.inner_text()
                print(f"  Selector '{sel}': '{txt}'")
        await ctx.close()

        # --- eBay - look for REAL product items ---
        print("\n=== EBAY - FIND REAL PRODUCTS ===")
        ctx = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36", viewport={"width": 1920, "height": 1080})
        page = await ctx.new_page()
        await page.goto("https://www.ebay.com/sch/i.html?_nkw=iPhone+16", wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(3000)
        
        # Try different selectors
        for sel in ['li.s-item', '.srp-results .s-item', '[data-viewport]', '.srp-river-results li', 'ul.srp-results li']:
            count = await page.locator(sel).count()
            print(f"  '{sel}': {count} items")
        
        # Try finding any real product links
        links = await page.locator('a[href*="/itm/"]').all()
        print(f"\n  Real /itm/ links: {len(links)}")
        seen = set()
        for a in links[:5]:
            href = await a.get_attribute('href')
            txt = (await a.inner_text()).strip()
            if href not in seen and txt and len(txt) > 10 and 'Shop on eBay' not in txt:
                seen.add(href)
                print(f"  '{txt[:60]}' -> {href[:80]}")
        
        # Check for s-card structure more carefully - skip first few placeholder cards
        cards = await page.locator('.s-card').all()
        print(f"\n  Checking s-card items beyond placeholders...")
        for i, card in enumerate(cards[2:7]):
            inner = await card.inner_text()
            lines = [l.strip() for l in inner.split('\n') if l.strip() and l.strip() != '\u2063']
            if 'Shop on eBay' not in str(lines):
                print(f"  Card {i+2}: {lines[:5]}")
                link = await card.locator('a').first.get_attribute('href')
                print(f"    href: {link[:80] if link else 'None'}")
            
        await ctx.close()
        await browser.close()

asyncio.run(main())
