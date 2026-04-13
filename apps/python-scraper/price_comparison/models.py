from dataclasses import dataclass
from typing import Optional

@dataclass
class ProductResult:
    name: str
    price: Optional[float]
    currency: str
    url: str
    platform: str
    country: str
    image_url: Optional[str] = None
    asin: Optional[str] = None
    sku: Optional[str] = None
    price_usd: Optional[float] = None

@dataclass
class ProductAttributes:
    brand: Optional[str] = None
    storage: Optional[str] = None
    screen_size: Optional[str] = None
    color: Optional[str] = None
    model_number: Optional[str] = None
