import urllib.request
import json
import time

body = json.dumps({
    'query': 'samsung s24',
    'countries': ['US', 'IN', 'UK'],
    'category': 'electronics',
    'subcategory': 'smartphones'
}).encode('utf-8')

req = urllib.request.Request('http://localhost:8000/search', data=body, headers={'Content-Type': 'application/json'})

print('Sending request to Python API...')
start = time.time()
try:
    with urllib.request.urlopen(req, timeout=120) as response:
        data = json.loads(response.read().decode())
        print(f'Done in {time.time() - start:.2f}s')
        print(f'Total Listings: {data.get("total_listings")}')
        print(f'Groups: {len(data.get("groups", []))}')
        for g in data.get('groups', []):
            print(f" - {g['name'][:60]}: {g['listing_count']} items, cheapest: ${g.get('cheapest_usd', 0)}")
        print('Errors:', data.get('errors'))
except Exception as e:
    print('Failed:', e)
