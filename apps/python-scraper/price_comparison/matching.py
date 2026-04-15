import re
from rapidfuzz import fuzz
from typing import List, Tuple, Dict, Any, Optional

from .models import ProductResult, ProductAttributes

KNOWN_BRANDS = ["apple", "samsung", "google", "sony", "microsoft", "dell", "hp", "lenovo", "asus"]

STORAGE_PATTERN = re.compile(r'(\d+)\s*(gb|tb)', re.IGNORECASE)
SCREEN_PATTERN = re.compile(r'(\d+\.?\d*)\s*(inch|"|-inch|)', re.IGNORECASE)

MATCH_THRESHOLD = 85

def extract_attributes(name: str) -> ProductAttributes:
    name_lower = name.lower()
    
    brand = next((b for b in KNOWN_BRANDS if b in name_lower), None)
    
    storage_match = STORAGE_PATTERN.search(name_lower)
    storage = storage_match.group(0).replace(" ", "") if storage_match else None
    
    screen_match = SCREEN_PATTERN.search(name_lower)
    screen_size = screen_match.group(1) if screen_match else None
    
    variants = re.findall(r'\b(max|plus|ultra|pro|mini|fe|se|lite|fold|flip|slim|disc|digital|oled)\b', name_lower)
    model_number = " ".join(sorted(set(variants))) if variants else None
    
    return ProductAttributes(brand=brand, storage=storage, screen_size=screen_size, model_number=model_number)

def compute_similarity(a: ProductResult, b: ProductResult, category_threshold: float = MATCH_THRESHOLD) -> float:
    # Exact identifier match
    if (a.asin and b.asin and a.asin == b.asin) or (a.sku and b.sku and a.sku == b.sku):
        return 100.0

    # Base score
    base_score = fuzz.token_set_ratio(a.name, b.name)
    
    attr_a = extract_attributes(a.name)
    attr_b = extract_attributes(b.name)
    
    score = base_score
    
    # Bonuses / Penalties
    if attr_a.brand and attr_b.brand:
        if attr_a.brand == attr_b.brand:
            score += 8
        else:
            score -= 20
            
    if attr_a.storage and attr_b.storage:
        if attr_a.storage == attr_b.storage:
            score += 6
        else:
            score -= 12
            
    if attr_a.screen_size and attr_b.screen_size:
        if attr_a.screen_size == attr_b.screen_size:
            score += 4
        else:
            score -= 8
            
    if attr_a.model_number != attr_b.model_number:
        score -= 40
            
    return max(0.0, min(100.0, score))

class ProductGroup:
    def __init__(self, listings: List[ProductResult]):
        self.listings = listings
        
    @property
    def representative(self) -> str:
        if not self.listings:
            return ""
        return self.listings[0].name
        
    @property
    def cheapest(self) -> Optional[ProductResult]:
        valid = [l for l in self.listings if l.price_usd is not None]
        if not valid:
            return self.listings[0] if self.listings else None
        return min(valid, key=lambda x: x.price_usd)

def group_products(products: List[ProductResult], threshold: float = MATCH_THRESHOLD) -> List[ProductGroup]:
    groups: List[List[ProductResult]] = []
    
    for product in products:
        matched = False
        for group in groups:
            rep = group[0]
            if compute_similarity(product, rep, threshold) >= threshold:
                group.append(product)
                matched = True
                break
        if not matched:
            groups.append([product])
            
    return [ProductGroup(g) for g in groups]
