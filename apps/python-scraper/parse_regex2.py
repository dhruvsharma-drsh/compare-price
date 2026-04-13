import re

try:
    with open('flipkart_dump.html', 'r', encoding='utf-8') as f:
        html = f.read()

    matches = re.finditer(r'<div[^>]*data-id[^>]*>.*?Apple iPhone 16.*?₹([0-9,]+).*?</div>', html, re.I | re.DOTALL)
    for m in matches:
        print("MATCH FOUND:")
        text = re.sub(r'<[^>]+>', ' ', m.group(0))  # strip tags
        text = re.sub(r'\s+', ' ', text)
        print("TEXT:", text[:500])
        print("PRICE:", m.group(1))
        
        # print specific selectors
        break

except Exception as e:
    print(e)
