import { CountryCode, CurrencyCode, Platform } from "@prisma/client";
import { getBrowser } from "../browser";
import { extractProductPage } from "../pageExtract";
import { normalizeWhitespace, stableHash } from "../utils";
import type { RetailerAdapter, RetailerFetchResult } from "../types";

export const coupangAdapter: RetailerAdapter = {
  platform: "coupang",
  supportsUrl(url: string) {
    try {
      const u = new URL(url);
      return /(^|\.)coupang\./i.test(u.hostname);
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
        titleSelectors: ["h1.prod-buy-header__title", "h2.prod-buy-header__title"],
        priceSelectors: ["span.total-price > strong", "span.price-value", "span.total-price"],
        imageSelectors: [{ selector: "img.prod-image__detail", attr: "src" }],
        availabilitySelectors: ["button.prod-buy-btn", "div.prod-not-sell-block"],
        ratingSelectors: ["span.rating-star-num"],
        brandSelectors: ["a.prod-brand-name"]
      });

      const currency = extracted.priceCurrency ?? "KRW";
      
      const u = new URL(url);
      const idMatch = u.searchParams.get("itemId") || url.match(/\/products\/(\d+)/);
      const canonicalKey = idMatch ? (Array.isArray(idMatch) ? idMatch[1] : idMatch) : `${u.hostname}${u.pathname}`;

      return {
        ok: true,
        product: {
          title: normalizeWhitespace(extracted.title ?? (await page.title().catch(() => url))),
          imageUrl: extracted.imageUrl || undefined,
          brand: extracted.brand,
          category: extracted.category
        },
        listing: {
          platform: Platform.coupang,
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
        platform: Platform.coupang,
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
