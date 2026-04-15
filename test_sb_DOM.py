import asyncio
import os
import urllib.parse
from dotenv import load_dotenv
import aiohttp
from playwright.async_api import async_playwright

load_dotenv('apps/python-scraper/.env')

async def test_html(url, cc, expected_selector):
    key = os.environ.get('SCRAPINGBEE_API_KEY')
    sb_url = f"https://app.scrapingbee.com/api/v1?api_key={key}&url={urllib.parse.quote(url)}&render_js=true&premium_proxy=true&country_code={cc}"
    print(f"Requesting ScrapingBee for {cc}...")
    async with aiohttp.ClientSession() as session:
        async with session.get(sb_url, timeout=45) as resp:
            print(f"Status: {resp.status}")
            html = await resp.text()
            with open(f'{cc}_test.html', 'w', encoding='utf-8') as f:
                f.write(html)
            
            async with async_playwright() as p:
                browser = await p.chromium.launch()
                page = await browser.new_page()
                await page.set_content(html)
                items = await page.query_selector_all(expected_selector)
                print(f"Found {len(items)} items using {expected_selector}")
                if items:
                    print(await items[0].inner_text())
                await browser.close()

async def main():
    await test_html('https://www.coupang.com/np/search?q=iPhone+16', 'KR', 'a.search-product-link')
    await test_html('https://www.ozon.ru/search/?text=iPhone+16', 'RU', "a[href*='-']")

asyncio.run(main())
