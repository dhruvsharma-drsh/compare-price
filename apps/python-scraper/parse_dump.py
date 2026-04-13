from bs4 import BeautifulSoup

with open("ebay_dump.html", "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

items = soup.find_all("li", class_=lambda c: c and "s-item" in c)
for li in items[:5]:
    try:
        title = li.find(class_=lambda c: c and "title" in c)
        price = li.find(class_=lambda c: c and "price" in c)
        print("s-item - Title:", title.text if title else "None", "Price:", price.text if price else "None")
    except Exception as e:
        print("Error on s-item:", e)

cards = soup.find_all("li", class_=lambda c: c and "s-card" in c)
for li in cards[:10]:
    try:
        title = li.find(class_=lambda c: c and "title" in c)
        price = li.find(class_=lambda c: c and "price" in c)
        print("s-card - Title:", title.text if title else "None", "Price:", price.text if price else "None")
    except Exception as e:
        print("Error on s-card:", e)
