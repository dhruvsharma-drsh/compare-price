import { CountryCode, CurrencyCode, Platform } from "@prisma/client";
import { getBrowser, STEALTH_CONTEXT_OPTIONS } from "../browser";
import { extractProductPage } from "../pageExtract";
import { normalizeWhitespace, stableHash } from "../utils";
import type { RetailerAdapter, RetailerFetchResult } from "../types";

function currencyFromCountry(country: CountryCode): CurrencyCode {
  switch (country) {
    case "CA":
      return "CAD";
    default:
      return "USD";
  }
}

function extractWalmartId(url: string): string | undefined {
  const m = url.match(/\/ip\/[^/]+\/(\d+)/);
  return m?.[1];
}

export const walmartAdapter: RetailerAdapter = {
  platform: "walmart",
  supportsUrl(url: string) {
    try {
      const u = new URL(url);
      return /(^|\.)walmart\./i.test(u.hostname);
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
        titleSelectors: ['h1[data-automation-id="product-title"]', "h1"],
        priceSelectors: ['[data-automation-id="product-price"]', 'span[itemprop="price"]'],
        imageSelectors: [{ selector: 'img[data-automation-id="hero-image"]', attr: "src" }],
        availabilitySelectors: ['[data-automation-id="fulfillment-summary"]', '[data-testid="sold-by-and-fulfilled-by"]'],
        ratingSelectors: ['[itemprop="ratingValue"]', '[data-testid="reviews-and-ratings"] [aria-label*="stars"]'],
        reviewSelectors: ['[itemprop="reviewCount"]', '[link-identifier="reviewsLink"]']
      });

      const currency = extracted.priceCurrency ?? currencyFromCountry(country);
      const id = extractWalmartId(url);
      const u = new URL(url);
      const canonicalKey = id ?? `${u.hostname}${u.pathname}`;

      return {
        ok: true,
        product: {
          title: normalizeWhitespace(extracted.title ?? (await page.title().catch(() => url))),
          imageUrl: extracted.imageUrl || undefined,
          brand: extracted.brand,
          category: extracted.category
        },
        listing: {
          platform: Platform.walmart,
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
            id
          })
        }
      };
    } catch (e) {
      return {
        ok: false,
        platform: Platform.walmart,
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
