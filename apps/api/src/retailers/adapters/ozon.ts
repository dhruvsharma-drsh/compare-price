import { CountryCode, CurrencyCode, Platform } from "@prisma/client";
import { getBrowser } from "../browser";
import { extractProductPage } from "../pageExtract";
import { normalizeWhitespace, stableHash } from "../utils";
import type { RetailerAdapter, RetailerFetchResult } from "../types";

export const ozonAdapter: RetailerAdapter = {
  platform: "ozon",
  supportsUrl(url: string) {
    try {
      const u = new URL(url);
      return /(^|\.)ozon\./i.test(u.hostname);
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
        priceSelectors: ['div[data-widget="webPrice"] span', '[slot="content"] span'],
        imageSelectors: [{ selector: 'img[alt="product"]', attr: "src" }],
        availabilitySelectors: ['[data-widget="webAddToCart"]'],
        ratingSelectors: ['[data-widget="webReviewProductScore"]'],
        brandSelectors: ['[data-widget="webBrand"]']
      });

      const currency = extracted.priceCurrency ?? "RUB";
      
      const u = new URL(url);
      const idMatch = url.match(/-(\d+)\/?$/);
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
          platform: Platform.ozon,
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
        platform: Platform.ozon,
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
