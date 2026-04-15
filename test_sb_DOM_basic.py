import asyncio
import os
import urllib.parse
from dotenv import load_dotenv
import aiohttp

load_dotenv('apps/python-scraper/.env')

async def test_html(url, cc):
    key = os.environ.get('SCRAPINGBEE_API_KEY')
    sb_url = f"https://app.scrapingbee.com/api/v1?api_key={key}&url={urllib.parse.quote(url)}&render_js=true"
    print(f"Requesting ScrapingBee for {cc} (no premium proxy)...")
    async with aiohttp.ClientSession() as session:
        async with session.get(sb_url, timeout=45) as resp:
            print(f"Status: {resp.status}")
            print((await resp.text())[:200])

async def main():
    await test_html('https://www.coupang.com/np/search?q=iPhone+16', 'KR')
    await test_html('https://www.ozon.ru/search/?text=iPhone+16', 'RU')

asyncio.run(main())
