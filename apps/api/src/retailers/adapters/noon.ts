import { CountryCode, CurrencyCode, Platform } from "@prisma/client";
import { getBrowser } from "../browser";
import { extractProductPage } from "../pageExtract";
import { normalizeWhitespace, stableHash } from "../utils";
import type { RetailerAdapter, RetailerFetchResult } from "../types";

export const noonAdapter: RetailerAdapter = {
  platform: "noon",
  supportsUrl(url: string) {
    try {
      const u = new URL(url);
      return /(^|\.)noon\./i.test(u.hostname);
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
        titleSelectors: ["h1"],
        priceSelectors: [".priceNow", '[data-qa="div-price-now"]'],
        imageSelectors: [{ selector: 'img[alt*="product"]', attr: "src" }],
        availabilitySelectors: ['[data-qa="btn-addToCart"]'],
        ratingSelectors: ['[data-qa="btn-goToReview"]', '[class*="rating"]'],
        brandSelectors: ['[data-qa="btn-brand"]']
      });

      const currency = extracted.priceCurrency ?? "AED";
      
      const u = new URL(url);
      // extracting unique id from url /p-12345/ or similar
      const idMatch = url.match(/\/p-([A-Z0-9]+)/i) || url.match(/-([A-Z0-9]+)\/p\/?$/i);
      const canonicalKey = idMatch ? idMatch[1] : `${u.hostname}${u.pathname}`;

      return {
        ok: true,
        product: {
          title: normalizeWhitespace(extracted.title ?? (await page.title().catch(() => url))),
          imageUrl: extracted.imageUrl || undefined,
          brand: extracted.brand,
          category: extracted.category
        },
        listing: {
          platform: Platform.noon,
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
            canonicalKey
          })
        }
      };
    } catch (e) {
      return {
        ok: false,
        platform: Platform.noon,
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
