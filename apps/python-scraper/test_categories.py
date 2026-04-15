import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from price_comparison.gemini_filter import filter_results_with_gemini

async def run_test(query, category, subcategory, titles):
    print(f"\n{'='*50}")
    print(f"Testing Category: {category} -> {subcategory}")
    print(f"Query: '{query}'")
    print(f"{'='*50}")
    
    results = await filter_results_with_gemini(query, titles, category, subcategory)
    for t, keep in zip(titles, results):
        status = "\033[92mKEEP\033[0m  " if keep else "\033[91mREMOVE\033[0m"
        print(f"  [{status}] {t}")

async def main():
    test_cases = [
        {
            "query": "Dyson V15 Detect",
            "category": "home",
            "subcategory": "vacuum_cleaners",
            "titles": [
                "Dyson V15 Detect Absolute Vacuum Cleaner",
                "Replacement Filter for Dyson V15 Detect Series",
                "Dyson Outsize Cordless Vacuum Cleaner",  # Alternative, should keep
                "Wall Mount Docking Station for Dyson V15",
                "Dyson V15 Submarine Wet and Dry Vacuum",
                "Motorhead Brush Roll for Dyson V15 Replacement",
            ]
        },
        {
            "query": "Nike Air Jordan 1 High",
            "category": "fashion",
            "subcategory": "sneakers",
            "titles": [
                "Nike Air Jordan 1 Retro High OG Chicago",
                "Crep Protect Shoe Cleaning Kit",
                "Air Jordan 1 High Travis Scott Mocha",
                "Replacement Laces for Jordan 1 High Black 72 inch",
                "Sneaker Display Box Clear Drop Front (Set of 6)",
                "Nike Dunk Low Retro Panda", # Alternative sneaker
            ]
        },
        {
            "query": "Sony PlayStation 5",
            "category": "gaming",
            "subcategory": "consoles",
            "titles": [
                "Sony PlayStation 5 Disc Edition Console",
                "DualSense Wireless Controller for PS5",
                "Silicone Skin Cover for PS5 Controller",
                "PlayStation 5 Digital Edition Slim",
                "PS5 Cooling Stand with Controller Charging Station",
                "Xbox Series X 1TB Console", # Competitor console
            ]
        }
    ]
    
    for case in test_cases:
        await run_test(case["query"], case["category"], case["subcategory"], case["titles"])

if __name__ == "__main__":
    asyncio.run(main())
