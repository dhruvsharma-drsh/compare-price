import requests
import json
import time

data = {
    "query": "iPhone 16",
    "queryType": "name", 
    "countries": ["US", "IN"], 
    "platforms": ["amazon", "flipkart", "walmart"], 
    "baseCurrency": "USD", 
    "category": "electronics", 
    "subcategory": "smartphones"
}

print("Testing Node.js scraper endpoint...")
r = requests.post("http://localhost:3002/search", json=data)
res = r.json()
print("Total results (Node):", res.get("stats", {}).get("count"))
for l in res.get("listings", []):
    print(f"[{l['platform']}] {l['product']['title'][:80]} | {l['converted']['amount']} USD")


print("\nTesting Python scraper endpoint...")
r2 = requests.post("http://localhost:3002/python-search", json=data)
res2 = r2.json()
print("Total results (Python):", res2.get("stats", {}).get("count"))
for l in res2.get("listings", []):
    print(f"[{l['platform']}] {l['product']['title'][:80]} | {l['converted']['amount']} USD")
