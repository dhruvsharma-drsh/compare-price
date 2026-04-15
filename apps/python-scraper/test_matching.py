from price_comparison.models import ProductResult
from price_comparison.matching import compute_similarity, group_products

def run_tests():
    print("="*50)
    print("Testing Fuzzy Linguistic Matching Logic (Non-Tech Categories)")
    print("="*50 + "\n")

    # Fashion / Sneakers
    print("--- CATEGORY: FASHION (Sneakers) ---")
    s1 = ProductResult(name="Nike Air Jordan 1 Retro High OG Chicago (2015)", url="", platform="stockx", country="US", price=1000.0, currency="USD", price_usd=1000.0)
    s2 = ProductResult(name="Air Jordan 1 High Chicago", url="", platform="goat", country="US", price=950.0, currency="USD", price_usd=950.0)
    s3 = ProductResult(name="Nike Air Jordan 4 Retro Bred", url="", platform="stockx", country="US", price=400.0, currency="USD", price_usd=400.0)
    s4 = ProductResult(name="Nike Dunk Low Retro White Black Panda", url="", platform="goat", country="US", price=120.0, currency="USD", price_usd=120.0)

    print(f"Jordan 1 Chicago vs Jordan 1 Chicago (Short) -> Score: {compute_similarity(s1, s2)}")
    print(f"Jordan 1 Chicago vs Jordan 4 Bred          -> Score: {compute_similarity(s1, s3)}")
    print(f"Jordan 1 Chicago vs Nike Dunk Panda        -> Score: {compute_similarity(s1, s4)}")
    print("")

    # Home / Appliances
    print("--- CATEGORY: HOME (Vacuums) ---")
    v1 = ProductResult(name="Dyson V15 Detect Cordless Vacuum Cleaner", url="", platform="amazon", country="US", price=750.0, currency="USD", price_usd=750.0)
    v2 = ProductResult(name="Dyson V15 Detect Absolute System", url="", platform="dyson", country="US", price=700.0, currency="USD", price_usd=700.0)
    v3 = ProductResult(name="Dyson V8 Absolute Cordless Vacuum", url="", platform="amazon", country="US", price=400.0, currency="USD", price_usd=400.0)

    print(f"Dyson V15 Detect vs V15 Detect Absolute -> Score: {compute_similarity(v1, v2)}")
    print(f"Dyson V15 Detect vs V8 Absolute         -> Score: {compute_similarity(v1, v3)}")
    print("")

    # Books
    print("--- CATEGORY: BOOKS ---")
    b1 = ProductResult(name="Atomic Habits by James Clear (Hardcover)", url="", platform="amazon", country="US", price=15.0, currency="USD", price_usd=15.0)
    b2 = ProductResult(name="Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones", url="", platform="barnes", country="US", price=14.0, currency="USD", price_usd=14.0)
    b3 = ProductResult(name="The Power of Habit by Charles Duhigg", url="", platform="amazon", country="US", price=12.0, currency="USD", price_usd=12.0)

    print(f"Atomic Habits (Hardcover) vs Atomic Habits (Full Title) -> Score: {compute_similarity(b1, b2)}")
    print(f"Atomic Habits vs The Power of Habit                     -> Score: {compute_similarity(b1, b3)}")
    print("")

    print("\n" + "="*50)
    print("Simulating Grouping Engine")
    print("="*50)
    groups = group_products([s1, s2, s3, s4, v1, v2, v3, b1, b2, b3])
    
    for i, g in enumerate(groups):
        print(f"\n[ Group {i+1} ]: {len(g.listings)} items")
        for item in g.listings:
            print(f"  > ({item.platform.capitalize()}) {item.name}")

if __name__ == "__main__":
    run_tests()
