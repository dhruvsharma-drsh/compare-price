import asyncio
import os
os.environ['PROXY_URL'] = ''
from price_comparison.main import PriceComparisonSystem

async def run_test():
    print("Testing Price Comparison System...")
    sys = PriceComparisonSystem()
    
    # We will test searching for 'iphone' in US electronics category
    # assuming category 'electronics' and subcat 'smartphones' exist in CATEGORIES
    
    # Let's override to only use Amazon for a fast test if we want, or just let it use the US defaults
    # which is Amazon, Walmart, BestBuy, Ebay
    print("Initializing compare...")
    try:
        report = await sys.compare("iphone 15", ["US"], "electronics", "smartphones")
        report.print_summary()
    except Exception as e:
        print(f"Error during compare: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
