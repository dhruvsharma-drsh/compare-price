"""
Gemini AI-powered product relevance filter.

Uses Google's Gemini API to intelligently determine whether scraped
product listings are genuinely the item the user searched for,
filtering out accessories, unrelated products, and mis-matches
that keyword-based heuristics miss.
"""

import os
import json
import asyncio
from typing import List, Tuple

from dotenv import load_dotenv

load_dotenv()

# Lazy-load the client so the module doesn't crash if the key is missing
_client = None

def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            return None
        from groq import AsyncGroq
        _client = AsyncGroq(api_key=api_key)
    return _client


async def filter_results_with_gemini(
    search_query: str,
    product_names: List[str],
    category: str = "",
    subcategory: str = "",
) -> List[bool]:
    """
    Use Gemini to classify each product name as relevant or irrelevant
    to the user's search query.

    Returns a list of booleans, one per product name.
    True = keep (relevant), False = discard (accessory / unrelated).

    Falls back to keeping everything if the API call fails.
    """
    client = _get_client()
    if client is None or not product_names:
        # No API key configured or nothing to filter -- keep everything
        return [True] * len(product_names)

    # Build a numbered list so the model can reference items easily
    numbered = "\n".join(f"{i+1}. {name}" for i, name in enumerate(product_names))

    prompt = f"""You are an expert product classifier for a price comparison engine.

The user searched for: "{search_query}"
Category: {category or "unknown"}
Subcategory: {subcategory or "unknown"}

Below is a numbered list of product titles scraped from online retailers.
For EACH product, decide if it is the **actual main product** the user is looking for,
or if it is an **accessory, case, cover, charger, screen protector, cable, or unrelated item**.

Rules:
- The product must be the EXACT SAME core product family/model as the search query.
- Different storage variants, sizes, or colors of the exact same product ARE relevant.
- Renewed/Refurbished versions of the exact product ARE relevant.
- Cases, covers, screen protectors, chargers, cables, mounts, stands, skins, stickers, bands, straps, and other accessories are NOT relevant.
- Replacement parts (filters, brush rolls, laces, ear pads, etc.) are NOT relevant.
- Entirely different or "alternative" products (e.g., searching for "PlayStation 5" but getting "Xbox Series X", or searching for "Dyson V15" but getting "Dyson V8") are NOT relevant. Discard them. If the user searched for a specific model, only that model is relevant.

Products:
{numbered}

Respond with ONLY a JSON array of booleans, one per product.
Example: [true, true, false, true, false]
No other text, no markdown, no explanation."""

    MODELS_TO_TRY = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    last_error = None

    for model_name in MODELS_TO_TRY:
        for attempt in range(3):  # retry up to 3 times per model
            try:
                response = await client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0,
                )

                raw = response.choices[0].message.content.strip()
                # Strip markdown fences if the model wraps its answer
                if raw.startswith("```"):
                    raw = raw.split("\n", 1)[1]  # drop opening ```json
                    raw = raw.rsplit("```", 1)[0]  # drop closing ```
                    raw = raw.strip()

                verdicts = json.loads(raw)

                if isinstance(verdicts, list) and len(verdicts) == len(product_names):
                    print(f"   [GEMINI] Filtered with {model_name} (attempt {attempt+1})")
                    return [bool(v) for v in verdicts]
                else:
                    print(f"[GEMINI] Unexpected response length ({len(verdicts)} vs {len(product_names)}), keeping all")
                    return [True] * len(product_names)

            except Exception as e:
                last_error = e
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    wait = (attempt + 1) * 5  # 5s, 10s, 15s
                    print(f"   [GEMINI] Rate limited on {model_name}, retrying in {wait}s (attempt {attempt+1}/3)")
                    await asyncio.sleep(wait)
                    continue
                else:
                    print(f"   [GEMINI] Error on {model_name}: {e}")
                    break  # non-rate-limit error, try next model

    print(f"[GEMINI] All models exhausted: {last_error}  -- keeping all results")
    return [True] * len(product_names)


async def smart_filter(
    search_query: str,
    product_names: List[str],
    category: str = "",
    subcategory: str = "",
) -> List[int]:
    """
    Convenience wrapper: returns the *indices* of products that Gemini
    considers relevant to the search query.
    """
    verdicts = await filter_results_with_gemini(
        search_query, product_names, category, subcategory
    )
    return [i for i, keep in enumerate(verdicts) if keep]
