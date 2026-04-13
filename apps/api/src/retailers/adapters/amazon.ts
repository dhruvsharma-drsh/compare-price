import { CountryCode, CurrencyCode, Platform } from "@prisma/client";
import { getBrowser, STEALTH_CONTEXT_OPTIONS } from "../browser";
import { extractProductPage } from "../pageExtract";
import { normalizeWhitespace, stableHash } from "../utils";
import type { RetailerAdapter, RetailerFetchResult } from "../types";

function currencyFromAmazonHost(host: string, fallbackCountry: CountryCode): CurrencyCode {
  if (host.endsWith("amazon.co.uk")) return "GBP";
  if (host.endsWith("amazon.de")) return "EUR";
  if (host.endsWith("amazon.in")) return "INR";
  if (host.endsWith("amazon.co.jp")) return "JPY";
  if (host.endsWith("amazon.ca")) return "CAD";
  if (host.endsWith("amazon.com.au")) return "AUD";
  if (host.endsWith("amazon.ae")) return "AED";
  // default
  switch (fallbackCountry) {
    case "DE":
      return "EUR";
    case "UK":
      return "GBP";
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

function extractAsin(url: string): string | undefined {
  const m = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  return m?.[1]?.toUpperCase();
}

// Amazon requires delivery location cookies to show prices
// Without these, it shows "This item cannot be shipped" and hides the price
function getAmazonLocationCookies(hostname: string, country: CountryCode) {
  // Map country to Amazon zip/postal codes for delivery location
  const locationMap: Record<string, { zip: string; city: string; state: string }> = {
    US: { zip: "10001", city: "New York", state: "NY" },
    UK: { zip: "SW1A 1AA", city: "London", state: "London" },
    DE: { zip: "10117", city: "Berlin", state: "Berlin" },
    IN: { zip: "110001", city: "New Delhi", state: "Delhi" },
    CA: { zip: "M5V 2T6", city: "Toronto", state: "ON" },
    AU: { zip: "2000", city: "Sydney", state: "NSW" },
    JP: { zip: "100-0001", city: "Tokyo", state: "Tokyo" },
    AE: { zip: "00000", city: "Dubai", state: "Dubai" },
  };

  const loc = locationMap[country] ?? locationMap["US"];
  const domain = hostname.startsWith(".") ? hostname : `.${hostname}`;

  return [
    {
      name: "sp-cdn",
      value: `"L5Z:${loc.zip}"`,
      domain,
      path: "/",
    },
    {
      name: "ubid-main",
      value: "134-5308230-4168763",
      domain,
      path: "/",
    },
  ];
}

export const amazonAdapter: RetailerAdapter = {
  platform: "amazon",
  supportsUrl(url: string) {
    try {
      const u = new URL(url);
      return /(^|\.)amazon\./i.test(u.hostname);
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
      // Set Amazon delivery location cookies to ensure prices are shown
      const u = new URL(url);
      const locationCookies = getAmazonLocationCookies(u.hostname, country);
      if (locationCookies.length > 0) {
        await context.addCookies(locationCookies);
      }

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

      // Wait for price to render before extracting
      await page.waitForSelector("span.a-price span.a-offscreen, #corePriceDisplay_desktop_feature_div, #productTitle", { timeout: 8000 }).catch(() => {});

      const extracted = await extractProductPage(page, {
        titleSelectors: ["#productTitle"],
        priceSelectors: [
          "#corePriceDisplay_desktop_feature_div span.a-offscreen",
          'span.a-price span.a-offscreen',
          '[data-a-color="price"] span.a-offscreen'
        ],
        imageSelectors: [{ selector: "#imgTagWrapperId img", attr: "src" }],
        availabilitySelectors: ["#availability span", "#availabilityInsideBuyBox_feature_div span"],
        ratingSelectors: ['span[data-hook="rating-out-of-text"]', 'i[data-hook="average-star-rating"] span.a-icon-alt'],
        reviewSelectors: ["#acrCustomerReviewText", '[data-hook="total-review-count"]'],
        brandSelectors: ["#bylineInfo", "tr.po-brand td.a-span9 span.a-size-base"]
      });

      const currency = extracted.priceCurrency ?? currencyFromAmazonHost(u.hostname, country);
      const asin = extractAsin(url);
      const canonicalKey = asin ?? `${u.hostname}${u.pathname}`;

      return {
        ok: true,
        product: {
          title: normalizeWhitespace(extracted.title ?? (await page.title().catch(() => url))),
          imageUrl: extracted.imageUrl || undefined,
          brand: extracted.brand,
          category: extracted.category
        },
        listing: {
          platform: Platform.amazon,
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
            asin
          })
        }
      };
    } catch (e) {
      return {
        ok: false,
        platform: Platform.amazon,
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
