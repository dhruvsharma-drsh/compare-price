"""
FastAPI server exposing the Python price-comparison scraper.

The Node.js API backend delegates to this service via HTTP when it
needs to run the heavyweight Playwright scrapers.
"""

import sys
import os

# Fix Windows console encoding — cp1252 can't handle emoji/unicode in product names
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import asyncio
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from price_comparison.main import PriceComparisonSystem, ComparisonReport
from price_comparison.categories import CATEGORIES

# ────────────────────────────── Models ──────────────────────────────

class SearchRequest(BaseModel):
    query: str
    countries: List[str]                      # ["US", "IN", "AE", …]
    category: Optional[str] = "electronics"
    subcategory: Optional[str] = "smartphones"
    max_results: int = 5

class ListingOut(BaseModel):
    name: str
    price: Optional[float]
    currency: str
    price_usd: Optional[float]
    url: str
    platform: str
    country: str
    image_url: Optional[str] = None

class GroupOut(BaseModel):
    name: str
    listing_count: int
    cheapest_usd: Optional[float]
    cheapest_platform: Optional[str]
    cheapest_country: Optional[str]
    listings: List[ListingOut]

class SearchResponse(BaseModel):
    query: str
    category: str
    subcategory: str
    total_listings: int
    groups: List[GroupOut]
    errors: dict

# ────────────────────────────── App ──────────────────────────────

app = FastAPI(
    title="Price Comparison Scraper API",
    description="Playwright-based scraper microservice for global price comparison",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

system = PriceComparisonSystem()

# ────────────────────────────── Routes ──────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "python-scraper"}


@app.get("/categories")
async def list_categories():
    """Return available categories & subcategories so the Node API can validate."""
    out = {}
    for cat_id, cat in CATEGORIES.items():
        out[cat_id] = {
            "id": cat_id,
            "subcategories": [
                {"id": sc.id, "display_name": sc.display_name}
                for sc in cat.subcategories
            ],
        }
    return out


@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    """
    Run a full scrape across the requested countries.
    Returns grouped & price-converted results.
    """
    # Validate category / subcategory exist
    cat = CATEGORIES.get(req.category)
    if not cat:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown category '{req.category}'. Available: {list(CATEGORIES.keys())}",
        )
    subcat = next((s for s in cat.subcategories if s.id == req.subcategory), None)
    if not subcat:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown subcategory '{req.subcategory}' in category '{req.category}'.",
        )

    print(f"\n{'='*60}")
    print(f"[PYTHON SCRAPER] Search request")
    print(f"   Query: \"{req.query}\"")
    print(f"   Countries: {req.countries}")
    print(f"   Category: {req.category} / {req.subcategory}")
    print(f"{'='*60}")

    try:
        report: ComparisonReport = await system.compare(
            product_query=req.query,
            countries=req.countries,
            category_id=req.category,
            subcategory_id=req.subcategory,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        detail = str(e).encode("ascii", errors="replace").decode("ascii")
        raise HTTPException(status_code=500, detail=f"Scrape failed: {detail}")

    result = report.to_dict()

    try:
        print(f"   Done -- {result['total_listings']} listings, {len(result['groups'])} groups")
    except UnicodeEncodeError:
        print(f"   Done -- {result['total_listings']} listings, {len(result['groups'])} groups (unicode print error)")

    return result


# ────────────────────────────── Entrypoint ──────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PYTHON_SCRAPER_PORT", "8000"))
    print(f">> Starting Python Scraper API on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
