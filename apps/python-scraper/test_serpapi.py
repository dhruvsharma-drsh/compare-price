import asyncio
from price_comparison.scraper.retailers import FlipkartScraper
from price_comparison.categories import CATEGORIES

async def test():
    from dotenv import load_dotenv
    load_dotenv()
    
    print("Testing Flipkart via SerpAPI...")
    scraper = FlipkartScraper("IN")
    subcat = CATEGORIES["electronics"].subcategories[0]
    
    import os
    serpapi_key = os.getenv('SERPAPI_KEY')
    import aiohttp
    import urllib.parse
    query = urllib.parse.quote_plus('iPhone 15 Pro')
    url = f"https://serpapi.com/search.json?engine=flipkart&q={query}&api_key={serpapi_key}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            print("Status code:", resp.status)
            data = await resp.json()
            print("Data keys:", data.keys())
            if 'error' in data:
                print("Error:", data['error'])
            print("First Organic:", data.get('organic_results', [])[:1])


if __name__ == "__main__":
    asyncio.run(test())
