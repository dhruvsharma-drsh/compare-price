import re

try:
    with open('flipkart_dump.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Find the block containing 'Apple iPhone 16'
    matches = re.finditer(r'<div[^>]*data-id[^>]*>.{0,2000}?Apple iPhone 16.{0,2000}?</div>', html, re.I | re.DOTALL)
    for m in matches:
        print("MATCH FOUND:")
        print(m.group(0)[:1500]) # Print first part of the div
        break

    if not any(matches):
        print("No structured data-id blocks found with Apple iPhone 16")
        
        # Look for any URL containing Apple iPhone 16
        m2 = re.finditer(r'<a[^>]*href="[^"]*iphone-16[^"]*"[^>]*>.*?</a>', html, re.I | re.DOTALL)
        for m in m2:
            print("LINK FOUND:")
            print(m.group(0)[:500])
            break

except Exception as e:
    print(e)
