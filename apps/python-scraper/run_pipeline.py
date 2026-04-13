import asyncio
from price_comparison.main import PriceComparisonSystem

async def test():
    system = PriceComparisonSystem()
    print("Starting Comparison for 'iPhone 15 Pro 128GB' in IN...")
    report = await system.compare(
        'iPhone 15 Pro 128GB',
        countries=['IN'],
        category_id='electronics',
        subcategory_id='smartphones',
    )
    report.print_summary()
    if report.errors:
        print('Errors:', report.errors)

if __name__ == "__main__":
    asyncio.run(test())
