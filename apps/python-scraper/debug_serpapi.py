import asyncio
import os
import aiohttp
from dotenv import load_dotenv

load_dotenv()

async def test_serpapi(engine, query, extra_params=None):
    serpapi_key = os.getenv('SERPAPI_KEY')
    if not serpapi_key:
        print("NO SERPAPI KEY")
        return
    params = {
        "engine": engine,
        "api_key": serpapi_key,
    }
    if engine == "walmart":
        params["query"] = query
    else:
        params["q"] = query
    if extra_params:
        params.update(extra_params)
    
    import urllib.parse
    url = "https://serpapi.com/search.json?" + urllib.parse.urlencode(params)
    print(f"\nUrl: {url.replace(serpapi_key, 'HIDDEN')}")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                data = await resp.json()
                print(f"Status: {resp.status}")
                if "error" in data:
                    print(f"Error: {data['error']}")
                else:
                    results = data.get("organic_results") or data.get("shopping_results") or []
                    print(f"Results: {len(results)}")
                    for r in results[:3]:
                        print(f" - {r.get('title')[:60]} | {r.get('price')} | {r.get('link')}")
    except Exception as e:
        print(f"Error: {e}")

async def main():
    await test_serpapi("amazon", "iPhone 16", {"amazon_domain": "amazon.com"})
    await test_serpapi("google_shopping", "iPhone 16", {"google_domain": "google.com", "gl": "us"})
    await test_serpapi("flipkart", "iPhone 16")
    await test_serpapi("walmart", "iPhone 16")

asyncio.run(main())
