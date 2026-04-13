import { CountryCode, CurrencyCode, Platform } from "@prisma/client";
import { getBrowser } from "../browser";
import { extractProductPage } from "../pageExtract";
import { normalizeWhitespace, stableHash } from "../utils";
import type { RetailerAdapter, RetailerFetchResult } from "../types";

function guessCurrencyFromCountry(country: CountryCode): CurrencyCode {
  switch (country) {
    case "US":
      return "USD";
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

export const brandStoreGenericAdapter: RetailerAdapter = {
  platform: "brand_store",
  supportsUrl(url: string) {
    try {
      const u = new URL(url);
      return ["http:", "https:"].includes(u.protocol);
    } catch {
      return false;
    }
  },
  async fetchByUrl({ url, country }): Promise<RetailerFetchResult> {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    });

    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

      const extracted = await extractProductPage(page, {
        availabilitySelectors: ['[itemprop="availability"]', '[class*="stock"]', '[class*="availability"]'],
        ratingSelectors: ['[itemprop="ratingValue"]', '[class*="rating"]'],
        reviewSelectors: ['[itemprop="reviewCount"]', '[class*="review"]'],
        brandSelectors: ['[itemprop="brand"]', '[class*="brand"]']
      });

      const currency = extracted.priceCurrency ?? guessCurrencyFromCountry(country);

      const canonicalKey = new URL(url).origin + new URL(url).pathname;

      const listing = {
        platform: Platform.brand_store,
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
          currency
        })
      };

      return {
        ok: true,
        product: {
          title: normalizeWhitespace(extracted.title ?? (await page.title().catch(() => url))),
          imageUrl: extracted.imageUrl || undefined,
          brand: extracted.brand,
          category: extracted.category
        },
        listing
      };
    } catch (e) {
      return {
        ok: false,
        platform: Platform.brand_store,
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
