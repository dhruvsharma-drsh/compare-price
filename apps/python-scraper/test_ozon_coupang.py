import asyncio
from price_comparison.scraper.retailers import OzonScraper, CoupangScraper
from dotenv import load_dotenv
load_dotenv('.env')

async def main():
    print('Testing Coupang')
    cs = CoupangScraper()
    res_c = await cs.search('iPhone 16', 'smartphones', 3)
    for r in res_c:
        print(f"Coupang: {r.title} - {r.price} {r.currency}")
        
    print('\nTesting Ozon')
    os = OzonScraper()
    res_o = await os.search('iPhone 16', 'smartphones', 3)
    for r in res_o:
        print(f"Ozon: {r.title} - {r.price} {r.currency}")

if __name__ == '__main__':
    asyncio.run(main())
