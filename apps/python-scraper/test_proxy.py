import urllib.request
import os
import time
import ssl
from dotenv import load_dotenv

load_dotenv()
proxy_url = os.getenv('PROXY_URL')
print(f"Testing Proxy: {proxy_url}")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

proxy = urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url})
opener = urllib.request.build_opener(proxy, urllib.request.HTTPSHandler(context=ctx))
urllib.request.install_opener(opener)

start = time.time()
try:
    req = urllib.request.Request("https://www.amazon.com/s?k=samsung+s24")
    resp = urllib.request.urlopen(req, timeout=60)
    print(f"Success in {time.time()-start:.2f}s: {len(resp.read())} bytes")
except Exception as e:
    print(f"Failed after {time.time()-start:.2f}s: {e}")
