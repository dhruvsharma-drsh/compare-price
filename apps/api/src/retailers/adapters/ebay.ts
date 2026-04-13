import { CountryCode, CurrencyCode, Platform } from "@prisma/client";
import { getBrowser, STEALTH_CONTEXT_OPTIONS } from "../browser";
import { extractProductPage } from "../pageExtract";
import { normalizeWhitespace, stableHash } from "../utils";
import type { RetailerAdapter, RetailerFetchResult } from "../types";

function currencyFromCountry(country: CountryCode): CurrencyCode {
  switch (country) {
    case "UK":
      return "GBP";
    case "DE":
      return "EUR";
    case "IN":
      return "INR";
    case "JP":
      return "JPY";
    case "AU":
      return "AUD";
    case "CA":
      return "CAD";
    case "AE":
      return "AED";
    default:
      return "USD";
  }
}

function extractEbayItemId(url: string): string | undefined {
  const m = url.match(/\/itm\/(\d{8,})/);
  return m?.[1];
}

export const ebayAdapter: RetailerAdapter = {
  platform: "ebay",
  supportsUrl(url: string) {
    try {
      const u = new URL(url);
      return /(^|\.)ebay\./i.test(u.hostname);
    } catch {
      return false;
    }
  },
  async fetchByUrl({ url, country }): Promise<RetailerFetchResult> {
    const browser = await getBrowser();
    const context = await browser.newContext(STEALTH_CONTEXT_OPTIONS);
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

      const extracted = await extractProductPage(page, {
        titleSelectors: ["#itemTitle", "h1.x-item-title__mainTitle span"],
        priceSelectors: ["#prcIsum", '[itemprop="price"]', '[data-testid="x-price-primary"]'],
        imageSelectors: [{ selector: "#icImg", attr: "src" }],
        availabilitySelectors: ['[data-testid="x-quantity__availability"]', ".x-buybox-quantity__availability"],
        ratingSelectors: ['[data-testid="x-star-rating"]', ".reviews-star-rating"],
        reviewSelectors: ['[data-testid="x-review-star-rating"]', '[href*="#rwid"]']
      });

      const currency = extracted.priceCurrency ?? currencyFromCountry(country);
      const itemId = extractEbayItemId(url);
      const u = new URL(url);
      const canonicalKey = itemId ?? `${u.hostname}${u.pathname}`;

      return {
        ok: true,
        product: {
          title: normalizeWhitespace((extracted.title ?? (await page.title().catch(() => url))).replace(/^Details about\s+/i, "")),
          imageUrl: extracted.imageUrl || undefined,
          brand: extracted.brand,
          category: extracted.category
        },
        listing: {
          platform: Platform.ebay,
          country,
          url,
          canonicalKey,
          price: extracted.priceAmount != null ? { currency, amount: extracted.priceAmount } : undefined,
          inStock: extracted.inStock,
          rating: extracted.rating,
          reviews: extracted.reviews,
          rawHash: stableHash({
            title: extracted.title,
            imageUrl: extracted.imageUrl,
            priceAmount: extracted.priceAmount,
            currency,
            itemId
          })
        }
      };
    } catch (e) {
      return {
        ok: false,
        platform: Platform.ebay,
        country,
        url,
        error: e instanceof Error ? e.message : "Unknown error"
      };
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  }
};
