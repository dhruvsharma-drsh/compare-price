import { CountryCode, CurrencyCode, Platform } from "@prisma/client";
import { getBrowser, STEALTH_CONTEXT_OPTIONS } from "../retailers/browser";
import { normalizeWhitespace, parsePriceToNumber } from "../retailers/utils";
import { buildSearchUrl } from "./searchUrls";
import type { NormalizedListing, NormalizedProduct } from "../retailers/types";

function currencyFromCountry(country: CountryCode): CurrencyCode {
  switch (country) {
    case "UK": return "GBP";
    case "DE": return "EUR";
    case "IN": return "INR";
    case "JP": return "JPY";
    case "AU": return "AUD";
    case "CA": return "CAD";
    case "AE": return "AED";
    case "KR": return "KRW";
    case "RU": return "RUB";
    default: return "USD";
  }
}

/** Clean Flipkart product card text into a usable title */
function cleanFlipkartTitle(rawText: string): string {
  let t = rawText;
  // Remove UI noise FIRST — order matters!
  // "Add to Compare" must be removed before single-word prefixes
  t = t.replace(/^Add to Compare\s*/i, "");
  // Now remove single-word prefixes that might appear before the brand
  t = t.replace(/^(?:Bestseller|Sponsored)\s*/i, "");
  // Truncate at common delimiters:
  // - Variant specs in parens: "(Black, 128 GB)", "(Tube Pack of 2)"
  // - Ratings: "4.428,123 Ratings" 
  // - Price symbol: "₹" (marks start of embedded price text)
  // - Spec suffixes: "6 GB RAM"
  const m = t.match(/^(.+?)(?:\s*\([^)]+\)|\d+\.\d[\d,]*\s*Ratings|₹|\d+\s*GB\s*RAM)/i);
  return m ? m[1].trim() : t.slice(0, 80).trim();
}

export type QuickSearchResult = {
  product: NormalizedProduct;
  listing: NormalizedListing;
} | null;

export type QuickSearchWithFallback = {
  result: QuickSearchResult;
  fallbackProductUrl: string | null;
};

export async function quickSearchFallback(input: {
  platform: Platform;
  country: CountryCode;
  query: string;
}): Promise<QuickSearchWithFallback> {
  const searchUrl = buildSearchUrl(input.platform, input.country, input.query);
  if (!searchUrl) {
    console.log(`      [quickSearch] No search URL for ${input.platform}/${input.country}`);
    return { result: null, fallbackProductUrl: null };
  }
  console.log(`      [quickSearch] ${input.platform}/${input.country} → ${searchUrl.slice(0, 90)}`);

  const browser = await getBrowser();
  const context = await browser.newContext(STEALTH_CONTEXT_OPTIONS);
  const page = await context.newPage();
  // Hide webdriver property
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    console.log(`      [quickSearch] Navigating...`);

    // Set location cookies for Amazon to avoid "item cannot be shipped" messages
    if (input.platform === "amazon") {
      const amazonHost = new URL(searchUrl).hostname;
      const domain = `.${amazonHost}`;
      const zipMap: Record<string, string> = {
        US: "10001", IN: "110001", UK: "SW1A1AA", DE: "10117",
        CA: "M5V2T6", AU: "2000", JP: "1000001", AE: "00000"
      };
      const zip = zipMap[input.country] ?? "10001";
      await context.addCookies([
        { name: "sp-cdn", value: `"L5Z:${zip}"`, domain, path: "/" },
        { name: "ubid-main", value: "134-5308230-4168763", domain, path: "/" },
      ]);
    }

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

    let title = "";
    let href = "";
    let priceText = "";
    let fallbackProductUrl: string | null = null;

    if (input.platform === "amazon") {
      // Wait longer for Amazon's heavy JS, but with a targeted selector
      await page.waitForSelector("[data-component-type='s-search-result'] h2 a[href]", { timeout: 10000 }).catch(() => {});

      const result = await page.evaluate((searchQuery) => {
        const queryTokens = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 1);
        const rows = document.querySelectorAll("[data-component-type='s-search-result']");
        const candidates: { title: string; href: string; price: string; score: number }[] = [];

        for (const row of rows) {
          // Skip sponsored results — they often have different structure
          if (row.querySelector("[data-component-type='sp-sponsored-result']")) continue;
          const a = row.querySelector("h2 a, h2 span a, .a-link-normal.s-underline-text") as HTMLAnchorElement | null;
          const priceWhole = row.querySelector("span.a-price-whole");
          const priceFraction = row.querySelector("span.a-price-fraction");
          const priceOffscreen = row.querySelector("span.a-price span.a-offscreen");
          // Get title from h2 specifically (not from the anchor which might contain review counts)
          const titleEl = row.querySelector("h2 span, h2 a span, h2") as HTMLElement | null;
          
          let t = titleEl?.textContent?.trim() ?? "";
          // Skip if title looks like a review count (e.g. "(5.1K)")
          if (/^\([\d.]+K?\)$/i.test(t) || t.length < 5) {
            t = a?.textContent?.trim() ?? "";
          }
          const h = a?.getAttribute("href") ?? "";
          let p = priceOffscreen?.textContent?.trim() ?? "";
          // Fallback: construct price from whole + fraction
          if (!p && priceWhole) {
            const whole = priceWhole.textContent?.replace(/[.,]\s*$/, "").trim() ?? "";
            const frac = priceFraction?.textContent?.trim() ?? "00";
            p = whole ? `${whole}.${frac}` : "";
          }
          if (t && t.length > 5 && h) {
            // Score by how many query tokens appear in the title
            const tLower = t.toLowerCase();
            const score = queryTokens.reduce((acc, tok) => tLower.includes(tok) ? acc + 1 : acc, 0);
            candidates.push({ title: t, href: h, price: p, score });
          }
          if (candidates.length >= 8) break;
        }

        // Return the candidate with the highest query-match score
        if (candidates.length === 0) return null;
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0];
      }, input.query);

      if (result) {
        title = result.title;
        href = result.href;
        priceText = result.price;
      }

      // If evaluate found nothing, try a broader fallback
      if (!href) {
        const fallbackResult = await page.evaluate(() => {
          // Try any link with /dp/ in it (Amazon product link pattern)
          const dpLinks = document.querySelectorAll("a[href*='/dp/']");
          for (const el of dpLinks) {
            const h = el.getAttribute("href") ?? "";
            const t = el.textContent?.trim() ?? "";
            if (h && t.length > 10) return { href: h, title: t };
          }
          return null;
        });
        if (fallbackResult) {
          href = fallbackResult.href;
          title = title || fallbackResult.title;
        }
      }

      if (href) {
        try { fallbackProductUrl = new URL(href, searchUrl).toString(); } catch {}
      }

    } else if (input.platform === "flipkart") {
      // Flipkart SSR: price + title are embedded in anchor text, not separate CSS elements
      await page.waitForSelector("a[href*='pid=']", { timeout: 8000 }).catch(() => {});

      const result = await page.evaluate(() => {
        const anchors = document.querySelectorAll("a[href*='pid=']");
        for (const a of anchors) {
          const href = a.getAttribute("href") ?? "";
          const text = a.textContent ?? "";
          // Skip nav/filter links (too short to be a product card)
          if (text.length < 15) continue;
          
          // Try to find price in the anchor text OR in the parent card
          let cardText = text;
          // Walk up to find the product card container
          let parent = a.parentElement;
          for (let i = 0; i < 4 && parent; i++) {
            const parentText = parent.textContent ?? "";
            if (parentText.includes("₹")) {
              cardText = parentText;
              break;
            }
            parent = parent.parentElement;
          }
          return { href, text, cardText };
        }
        return null;
      });

      if (result) {
        href = result.href;
        title = cleanFlipkartTitle(result.text);

        // Extract price from anchor text or parent card text
        const priceMatches = result.cardText.match(/₹[\d,]+/g);
        if (priceMatches && priceMatches.length > 0) {
          priceText = priceMatches[0]; // First match = sale price
          console.log(`      [quickSearch] Flipkart prices in text: ${priceMatches.join(', ')}`);
        }

        if (href) {
          try { fallbackProductUrl = new URL(href, searchUrl).toString(); } catch {}
        }
      }

    } else if (input.platform === "ebay") {
      // eBay sometimes blocks bots, so be generous with wait
      await page.waitForSelector("li.s-item a.s-item__link", { timeout: 10000 }).catch(() => {});

      const result = await page.evaluate(() => {
        const rows = document.querySelectorAll("li.s-item");
        for (const row of rows) {
          const a = row.querySelector("a.s-item__link") as HTMLAnchorElement | null;
          const titleEl = row.querySelector(".s-item__title, .s-item__title span");
          const priceEl = row.querySelector(".s-item__price");
          const t = titleEl?.textContent?.trim() ?? "";
          // Skip the eBay header row and "Shop on eBay"
          if (!t || t === "Shop on eBay" || t.length < 5) continue;
          const h = a?.getAttribute("href") ?? "";
          // Skip placeholder, fragment-only, or javascript: links
          if (!h || h === "#" || h.startsWith("javascript:") || h === "https://ebay.com/itm/123456") continue;
          // Skip non-product titles (cookie banners, feedback buttons)
          if (t.includes("Let us know") || t.includes("cookie") || t.includes("privacy")) continue;
          return {
            title: t,
            href: h,
            price: priceEl?.textContent?.trim() ?? ""
          };
        }
        return null;
      });

      if (result) {
        title = result.title;
        href = result.href;
        priceText = result.price;
      }
      if (href) {
        try { fallbackProductUrl = new URL(href, searchUrl).toString(); } catch {}
      }

    } else if (input.platform === "walmart") {
      // Walmart is a heavy React SPA — need networkidle + explicit wait for content
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      // Wait for product links to appear after React renders
      await page.waitForSelector("a[href*='/ip/'], [data-item-id]", { timeout: 10000 }).catch(() => {});
      // Extra wait for price rendering
      await page.waitForTimeout(2000).catch(() => {});

      const result = await page.evaluate(() => {
        // Strategy 1: data-item-id cards
        const cards = document.querySelectorAll("[data-item-id]");
        for (const card of cards) {
          const a = card.querySelector("a[href*='/ip/']") as HTMLAnchorElement | null;
          const titleSpan = card.querySelector('[data-automation-id="product-title"], span[class*="normal"]');
          const priceEl = card.querySelector('[data-automation-id="product-price"], [class*="price"]');
          const t = titleSpan?.textContent?.trim() ?? a?.textContent?.trim() ?? "";
          const h = a?.getAttribute("href") ?? "";
          if (t && h) return { title: t, href: h, price: priceEl?.textContent?.trim() ?? "" };
        }
        // Strategy 2: any /ip/ link
        const links = document.querySelectorAll("a[href*='/ip/']");
        for (const a of links) {
          const h = a.getAttribute("href") ?? "";
          const t = a.textContent?.trim() ?? "";
          if (h && t.length > 10) return { title: t, href: h, price: "" };
        }
        // Strategy 3: parse price from nearby text with $
        const allLinks = document.querySelectorAll("a[link-identifier]");
        for (const a of allLinks) {
          const h = a.getAttribute("href") ?? "";
          if (!h.includes("/ip/")) continue;
          const t = a.textContent?.trim() ?? "";
          // Look for price in parent
          let parent = a.parentElement;
          let priceStr = "";
          for (let i = 0; i < 5 && parent; i++) {
            const text = parent.textContent ?? "";
            const pm = text.match(/\$[\d,]+\.?\d*/);
            if (pm) { priceStr = pm[0]; break; }
            parent = parent.parentElement;
          }
          if (h && t.length > 5) return { title: t, href: h, price: priceStr };
        }
        return null;
      });

      if (result) {
        title = result.title;
        href = result.href;
        priceText = result.price;
        // Extract price from text if selector didn't get it
        if (!parsePriceToNumber(priceText)) {
          const priceMatch = result.title.match(/\$[\d,.]+/);
          if (priceMatch) priceText = priceMatch[0];
        }
      }
      if (href) {
        try { fallbackProductUrl = new URL(href, searchUrl).toString(); } catch {}
      }

    } else if (input.platform === "noon") {
      await page.waitForSelector("a[href*='/p-']", { timeout: 8000 }).catch(() => {});
      const row = page.locator("a[href*='/p-']").first();
      title = (await row.locator('[data-qa="product-name"]').first().innerText().catch(() => "")) || "";
      href = (await row.getAttribute("href").catch(() => "")) || "";
      priceText = (await row.locator(".amount").first().innerText().catch(() => "")) || "";
      if (href) {
        try { fallbackProductUrl = new URL(href, searchUrl).toString(); } catch {}
      }

    } else if (input.platform === "coupang") {
      await page.waitForSelector("a.search-product-link", { timeout: 8000 }).catch(() => {});
      const row = page.locator("a.search-product-link").first();
      title = (await row.locator(".name").first().innerText().catch(() => "")) || "";
      href = (await row.getAttribute("href").catch(() => "")) || "";
      priceText = (await row.locator(".price-value").first().innerText().catch(() => "")) || "";
      if (href) {
        try { fallbackProductUrl = new URL(href, searchUrl).toString(); } catch {}
      }

    } else if (input.platform === "ozon") {
      await page.waitForSelector("a[href*='-']", { timeout: 8000 }).catch(() => {});
      const row = page.locator("a[href*='-']").first();
      title = (await row.innerText().catch(() => "")) || "";
      href = (await row.getAttribute("href").catch(() => "")) || "";
      priceText = (await page.locator('.c3016-a1 span').first().innerText().catch(() => "")) || "";
      if (href) {
        try { fallbackProductUrl = new URL(href, searchUrl).toString(); } catch {}
      }
    }

    const amount = parsePriceToNumber(priceText);
    console.log(`      [quickSearch] Page loaded, extracting...`);
    // Reject invalid results: no href, fragment-only href, zero/missing price
    if (!href || href === "#" || href.startsWith("javascript:") || amount == null || amount <= 0) {
      console.log(`      [quickSearch] Extraction failed — href: ${href ? (href === '#' ? 'BOGUS(#)' : 'yes') : 'NO'}, price: ${amount ?? 'NULL'}, title: "${title.slice(0, 40)}"`);
      // Sanitize fallbackProductUrl — reject junk URLs
      if (fallbackProductUrl) {
        try {
          const fu = new URL(fallbackProductUrl);
          // Reject if it's just a search page URL (contains /s? or /search? or ends with #)
          if (fu.pathname.match(/^\/(s|search|sch)\b/) || fu.hash === "#" || !fu.pathname.match(/\/(dp|p|ip|itm)\b/i)) {
            fallbackProductUrl = null;
          }
        } catch { fallbackProductUrl = null; }
      }
      return { result: null, fallbackProductUrl };
    }
    console.log(`      [quickSearch] ✅ Extracted — title: "${title.slice(0, 50)}", price: ${amount}, href: ${href.slice(0, 60)}`);

    const absUrl = new URL(href, searchUrl).toString();
    const u = new URL(absUrl);

    return {
      result: {
        product: {
          title: normalizeWhitespace(title || input.query)
        },
        listing: {
          platform: input.platform,
          country: input.country,
          url: absUrl,
          canonicalKey: `${u.hostname}${u.pathname}`,
          price: { currency: currencyFromCountry(input.country), amount }
        }
      },
      fallbackProductUrl: null
    };
  } catch (e) {
    console.log(`      [quickSearch] Error: ${e instanceof Error ? e.message : 'unknown'}`);
    return { result: null, fallbackProductUrl: null };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}
