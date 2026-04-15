import os
import urllib.parse
import aiohttp
import asyncio
from dotenv import load_dotenv

load_dotenv('apps/python-scraper/.env')

async def fetch_sb(url, out_file):
    key = os.environ.get('SCRAPINGBEE_API_KEY')
    sb_url = f"https://app.scrapingbee.com/api/v1?api_key={key}&url={urllib.parse.quote(url)}&render_js=true"
    async with aiohttp.ClientSession() as session:
        async with session.get(sb_url) as resp:
            html = await resp.text()
            with open(out_file, 'w', encoding='utf-8') as f:
                f.write(html)
            print(f"Saved {len(html)} bytes to {out_file}")

async def main():
    await fetch_sb('https://www.coupang.com/np/search?q=iPhone+16', 'coupang_sb.html')
    await fetch_sb('https://www.ozon.ru/search/?text=iPhone+16', 'ozon_sb.html')

if __name__ == '__main__':
    asyncio.run(main())
