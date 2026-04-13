from dataclasses import dataclass, field
from typing import List, Dict

@dataclass
class Subcategory:
    id: str
    display_name: str
    search_hints: List[str]
    retailer_paths: Dict[str, str] = field(default_factory=dict)

@dataclass
class Category:
    id: str
    subcategories: List[Subcategory]

CATEGORIES = {
    "electronics": Category(
        id="electronics",
        subcategories=[
            Subcategory(
                id="smartphones",
                display_name="Smartphones",
                search_hints=["phone", "smartphone"],
                retailer_paths={
                    "amazon_in": "/s?i=electronics&rh=n%3A1389401031",
                    "amazon_us": "/s?i=electronics&rh=n%3A2811409011",
                    "amazon_ae": "/s?i=electronics&rh=n%3A12050259031",
                    "amazon_uk": "/s?i=electronics&rh=n%3A5362060031",
                    "amazon_de": "/s?i=electronics&rh=n%3A3468301",
                    "amazon_ca": "/s?i=electronics&rh=n%3A6205124011",
                    "amazon_au": "/s?i=electronics&rh=n%3A4975185051",
                    "amazon_jp": "/s?i=electronics&rh=n%3A128187011",
                    "flipkart": "/mobiles/smartphones~type/pr?sid=tyy,4io",
                    "walmart": "/browse/electronics/cell-phones/3944_542371",
                    "noon": "/uae-en/electronics-and-mobiles/mobiles-and-accessories/mobiles-20905/",
                    "coupang": "/np/categories/413979",
                }
            ),
            Subcategory(
                id="laptops",
                display_name="Laptops",
                search_hints=["notebook", "computer"],
                retailer_paths={}
            )
        ]
    )
}

def build_search_query(product_name: str, subcat: Subcategory) -> str:
    # As per prompt: ONLY the top 2 are appended to the query, so order matters
    hints = " ".join(subcat.search_hints[:2])
    return f"{product_name} {hints}".strip()
