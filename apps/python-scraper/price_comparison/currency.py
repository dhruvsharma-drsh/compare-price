import aiohttp
from typing import Dict, Optional

STATIC_RATES: Dict[str, float] = {
    "USD": 1.0,
    "EUR": 1.08,
    "GBP": 1.25,
    "INR": 0.012,
    "AED": 0.27,
    "KRW": 0.00074,
    "RUB": 0.011,
}

class CurrencyConverter:
    def __init__(self):
        self.rates: Dict[str, float] = STATIC_RATES.copy()
        
    async def fetch_live_rates(self):
        # Implement live API fetch here securely later
        pass

    def convert_to_usd(self, amount: float, currency: str) -> Optional[float]:
        currency = currency.upper()
        if currency == "USD":
            return amount
            
        rate = self.rates.get(currency)
        if rate:
            return round(amount * rate, 2)
            
        return None
