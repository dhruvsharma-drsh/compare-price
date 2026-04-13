import { CountryCode, CurrencyCode, Platform } from "@prisma/client";
import { getBrowser, STEALTH_CONTEXT_OPTIONS } from "../browser";
import { extractProductPage } from "../pageExtract";
import { normalizeWhitespace, parsePriceToNumber, stableHash } from "../utils";
import type { RetailerAdapter, RetailerFetchResult } from "../types";

function currencyFromCountry(country: CountryCode): CurrencyCode {
  switch (country) {
    case "IN":
      return "INR";
    default:
      return "INR";
  }
}

function extractFlipkartPid(url: string): string | undefined {
  const u = new URL(url);
  return u.searchParams.get("pid") ?? undefined;
}

export const flipkartAdapter: RetailerAdapter = {
  platform: "flipkart",
  supportsUrl(url: string) {
    try {
      const u = new URL(url);
      return /(^|\.)flipkart\./i.test(u.hostname);
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
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

      // Wait a bit for JS to render, then try to extract price
      await page.waitForTimeout(3000);

      // Try CSS-class extraction first
      const extracted = await extractProductPage(page, {
        titleSelectors: ["h1", "span.VU-ZEz", "span.B_NuCI"],
        priceSelectors: ["div.Nx9bqj", "div.CxhGGd", "div._30jeq3", "[class*='hl05eU'] div.Nx9bqj", '[class*="price"]'],
        imageSelectors: [{ selector: 'img[alt][src*="rukminim"]', attr: "src" }],
        availabilitySelectors: ['[class*="stock"]', '[class*="delivery"]'],
        ratingSelectors: ["div.XQDdHH", '[class*="rating"]'],
        reviewSelectors: ["span.Wphh3N", '[class*="review"]']
      });

      // If CSS extraction didn't find price, try extracting from page text
      let priceAmount = extracted.priceAmount;
      if (priceAmount == null) {
        console.log(`      [flipkartAdapter] CSS price selectors failed, trying text extraction...`);
        const pageText = await page.evaluate(() => document.body?.innerText ?? "");
        // Look for ₹XX,XXX patterns — the first one after "₹" that isn't crossed out
        const priceMatches = pageText.match(/₹[\d,]+/g);
        if (priceMatches) {
          // On product pages, prices appear like: "₹21,999 ₹17,999" (MRP then sale price)
          // or "₹17,999" directly. Try all matches.
          for (const pm of priceMatches) {
            const parsed = parsePriceToNumber(pm);
            if (parsed != null && parsed > 0) {
              priceAmount = parsed;
              console.log(`      [flipkartAdapter] Extracted price from text: ${pm} → ${parsed}`);
              break;
            }
          }
        }
      }

      const currency = extracted.priceCurrency ?? currencyFromCountry(country);
      const pid = extractFlipkartPid(url);
      const u = new URL(url);
      const canonicalKey = pid ?? `${u.hostname}${u.pathname}`;

      return {
        ok: true,
        product: {
          title: normalizeWhitespace(extracted.title ?? (await page.title().catch(() => url))),
          imageUrl: extracted.imageUrl || undefined,
          brand: extracted.brand,
          category: extracted.category
        },
        listing: {
          platform: Platform.flipkart,
          country,
          url,
          canonicalKey,
          price: priceAmount != null ? { currency, amount: priceAmount } : undefined,
          inStock: extracted.inStock,
          rating: extracted.rating,
          reviews: extracted.reviews,
          rawHash: stableHash({
            title: extracted.title,
            imageUrl: extracted.imageUrl,
            priceAmount,
            currency,
            pid
          })
        }
      };
    } catch (e) {
      return {
        ok: false,
        platform: Platform.flipkart,
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
