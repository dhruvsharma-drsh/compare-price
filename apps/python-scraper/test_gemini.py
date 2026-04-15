import asyncio
import os
os.environ['GEMINI_API_KEY'] = 'AIzaSyBnn7M3Eup_hNZUL3LYEPbzT0en2m8hDLU'

from price_comparison.gemini_filter import filter_results_with_gemini

async def main():
    titles = [
        'Apple iPhone 16 (128GB) - Black',
        'iPhone 16 Silicone Case with MagSafe - Stone Gray',
        'Apple iPhone 16 Pro Max 256GB Natural Titanium',
        'Spigen Tempered Glass Screen Protector for iPhone 16',
        'Apple 20W USB-C Power Adapter',
        'Apple iPhone 16 Plus (256GB) - Ultramarine',
        'ESR Classic Kickstand Case for iPhone 16 Pro',
        'Samsung Galaxy S24 Ultra 256GB',
    ]
    results = await filter_results_with_gemini('iPhone 16', titles, 'electronics', 'smartphones')
    for t, keep in zip(titles, results):
        status = 'KEEP' if keep else 'REMOVE'
        print(f'  [{status}] {t}')

asyncio.run(main())
