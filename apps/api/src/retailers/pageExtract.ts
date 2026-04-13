import type { CurrencyCode } from "@prisma/client";
import type { Page } from "playwright";
import { normalizeWhitespace, parsePriceToNumber } from "./utils";

type AttrSelector = {
  selector: string;
  attr: string;
};

type ExtractionOptions = {
  titleSelectors?: string[];
  priceSelectors?: string[];
  imageSelectors?: AttrSelector[];
  brandSelectors?: string[];
  availabilitySelectors?: string[];
  ratingSelectors?: string[];
  reviewSelectors?: string[];
};

export type ExtractedProductPage = {
  title?: string;
  imageUrl?: string;
  brand?: string;
  category?: string;
  priceAmount?: number;
  priceCurrency?: CurrencyCode;
  inStock?: boolean;
  rating?: number;
  reviews?: number;
};

const DEFAULT_TITLE_SELECTORS = [
  'h1[itemprop="name"]',
  '[data-testid*="product-title"]',
  '[data-testid*="title"]',
  ".product-title",
  "h1"
];

const DEFAULT_PRICE_SELECTORS = [
  '[itemprop="price"]',
  '[data-testid*="price"]',
  'meta[property="product:price:amount"]',
  ".price",
  '[class*="price"]'
];

const DEFAULT_IMAGE_SELECTORS: AttrSelector[] = [
  { selector: 'meta[property="og:image"]', attr: "content" },
  { selector: 'meta[name="twitter:image"]', attr: "content" },
  { selector: 'img[itemprop="image"]', attr: "src" },
  { selector: "img[alt][src]", attr: "src" }
];

const DEFAULT_BRAND_SELECTORS = ['[itemprop="brand"]', '[data-testid*="brand"]', 'meta[property="product:brand"]'];

const DEFAULT_AVAILABILITY_SELECTORS = ['[itemprop="availability"]', '[data-testid*="availability"]', ".stock"];

const DEFAULT_RATING_SELECTORS = ['[itemprop="ratingValue"]', '[data-testid*="rating"]', '[class*="rating"]'];

const DEFAULT_REVIEW_SELECTORS = [
  '[itemprop="reviewCount"]',
  '[data-testid*="review"]',
  '[class*="review-count"]',
  '[class*="reviews"]'
];

const META_TITLE_SELECTORS: AttrSelector[] = [
  { selector: 'meta[property="og:title"]', attr: "content" },
  { selector: 'meta[name="twitter:title"]', attr: "content" },
  { selector: 'meta[itemprop="name"]', attr: "content" }
];

const META_PRICE_SELECTORS: AttrSelector[] = [
  { selector: 'meta[property="product:price:amount"]', attr: "content" },
  { selector: 'meta[property="og:price:amount"]', attr: "content" },
  { selector: 'meta[itemprop="price"]', attr: "content" }
];

const META_CURRENCY_SELECTORS: AttrSelector[] = [
  { selector: 'meta[property="product:price:currency"]', attr: "content" },
  { selector: 'meta[property="og:price:currency"]', attr: "content" },
  { selector: 'meta[itemprop="priceCurrency"]', attr: "content" }
];

const COOKIE_BUTTON_SELECTORS = [
  'button:has-text("Accept")',
  'button:has-text("I agree")',
  'button:has-text("Allow all")',
  'button:has-text("Agree")',
  'button:has-text("Got it")',
  '[aria-label*="accept" i]'
];

function uniqueStrings(values: string[] | undefined, defaults: string[]) {
  return Array.from(new Set([...(values ?? []), ...defaults]));
}

function uniqueAttrs(values: AttrSelector[] | undefined, defaults: AttrSelector[]) {
  const seen = new Set<string>();
  const merged = [...(values ?? []), ...defaults];
  return merged.filter((entry) => {
    const key = `${entry.selector}::${entry.attr}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractCurrencyFromText(raw: string | undefined): CurrencyCode | undefined {
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  if (upper.includes("USD") || raw.includes("$")) return "USD";
  if (upper.includes("EUR") || raw.includes("€")) return "EUR";
  if (upper.includes("GBP") || raw.includes("£")) return "GBP";
  if (upper.includes("INR") || raw.includes("₹") || raw.includes("RS") || raw.includes("Rs.")) return "INR";
  if (upper.includes("JPY") || raw.includes("¥")) return "JPY";
  if (upper.includes("AUD")) return "AUD";
  if (upper.includes("CAD")) return "CAD";
  if (upper.includes("AED")) return "AED";
  return undefined;
}

function normalizeCurrency(raw: unknown): CurrencyCode | undefined {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  switch (value) {
    case "USD":
    case "EUR":
    case "GBP":
    case "INR":
    case "JPY":
    case "AUD":
    case "CAD":
    case "AED":
      return value;
    default:
      return extractCurrencyFromText(value);
  }
}

function parseNumber(raw: string | undefined) {
  if (!raw) return undefined;
  const match = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return undefined;
  const normalized = match[0].includes(",") && !match[0].includes(".")
    ? match[0].replace(",", ".")
    : match[0].replace(/,/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function parseCount(raw: string | undefined) {
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const value = Number(digits);
  return Number.isFinite(value) ? value : undefined;
}

function parseAvailability(raw: string | undefined) {
  if (!raw) return undefined;
  const text = raw.toLowerCase();
  if (/(out of stock|currently unavailable|sold out|unavailable)/.test(text)) return false;
  if (/(in stock|available|ready to ship|ships today)/.test(text)) return true;
  return undefined;
}

function readString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = normalizeWhitespace(value);
    return normalized || undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = readString(item);
      if (found) return found;
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      readString(record.url) ??
      readString(record.contentUrl) ??
      readString(record.name) ??
      readString(record.text)
    );
  }

  return undefined;
}

function flattenObjects(value: unknown, results: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) flattenObjects(item, results);
    return results;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    results.push(record);
    for (const nested of Object.values(record)) flattenObjects(nested, results);
  }

  return results;
}

function hasType(node: Record<string, unknown>, typeName: string) {
  const type = node["@type"];
  if (typeof type === "string") return type.toLowerCase() === typeName.toLowerCase();
  if (Array.isArray(type)) return type.some((entry) => typeof entry === "string" && entry.toLowerCase() === typeName.toLowerCase());
  return false;
}

function extractStructuredData(blocks: string[]): ExtractedProductPage {
  const nodes: Record<string, unknown>[] = [];

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      flattenObjects(parsed, nodes);
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  const productNode = nodes.find((node) => hasType(node, "Product"));
  const offerNode =
    (Array.isArray(productNode?.offers) ? productNode?.offers[0] : productNode?.offers) ??
    nodes.find((node) => hasType(node, "Offer"));
  const aggregateRating =
    (productNode?.aggregateRating as Record<string, unknown> | undefined) ??
    nodes.find((node) => hasType(node, "AggregateRating"));

  const offerPriceRaw =
    readString((offerNode as Record<string, unknown> | undefined)?.price) ??
    readString((offerNode as Record<string, unknown> | undefined)?.lowPrice) ??
    readString(productNode?.price);

  const availabilityRaw =
    readString((offerNode as Record<string, unknown> | undefined)?.availability) ??
    readString(productNode?.availability);

  return {
    title: readString(productNode?.name),
    imageUrl: readString(productNode?.image),
    brand: readString((productNode?.brand as Record<string, unknown> | undefined)?.name ?? productNode?.brand),
    category: readString(productNode?.category),
    priceAmount: parsePriceToNumber(offerPriceRaw ?? ""),
    priceCurrency: normalizeCurrency(
      readString((offerNode as Record<string, unknown> | undefined)?.priceCurrency) ??
        readString(productNode?.priceCurrency)
    ),
    inStock: parseAvailability(availabilityRaw),
    rating: parseNumber(
      readString((aggregateRating as Record<string, unknown> | undefined)?.ratingValue) ??
        readString(productNode?.ratingValue)
    ),
    reviews: parseCount(
      readString((aggregateRating as Record<string, unknown> | undefined)?.reviewCount) ??
        readString((aggregateRating as Record<string, unknown> | undefined)?.ratingCount) ??
        readString(productNode?.reviewCount)
    )
  };
}

async function dismissCommonOverlays(page: Page) {
  for (const selector of COOKIE_BUTTON_SELECTORS) {
    await page.locator(selector).first().click({ timeout: 1200 }).catch(() => {});
  }
}

async function firstText(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    // Try up to 5 matches per selector — some sites have empty placeholder
    // elements that match first (e.g. Amazon's empty a-offscreen spans)
    const count = await page.locator(selector).count().catch(() => 0);
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = await page.locator(selector).nth(i).textContent({ timeout: 800 }).catch(() => "");
      const normalized = normalizeWhitespace(text ?? "");
      if (normalized) return normalized;
    }
  }

  return undefined;
}

async function firstAttr(page: Page, selectors: AttrSelector[]) {
  for (const entry of selectors) {
    const value = await page.locator(entry.selector).first().getAttribute(entry.attr, { timeout: 800 }).catch(() => null);
    const normalized = value ? normalizeWhitespace(value) : "";
    if (normalized) return normalized;
  }

  return undefined;
}

export async function extractProductPage(page: Page, options: ExtractionOptions = {}): Promise<ExtractedProductPage> {
  await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500).catch(() => {});
  await dismissCommonOverlays(page);

  const structured = extractStructuredData(
    await page.$$eval('script[type="application/ld+json"]', (nodes) =>
      nodes.map((node) => (node.textContent ?? "").trim()).filter(Boolean)
    )
  );

  const title =
    (await firstText(page, uniqueStrings(options.titleSelectors, DEFAULT_TITLE_SELECTORS))) ??
    (await firstAttr(page, META_TITLE_SELECTORS)) ??
    structured.title ??
    (normalizeWhitespace((await page.title().catch(() => "")) || "") || undefined);

  const priceText =
    (await firstText(page, uniqueStrings(options.priceSelectors, DEFAULT_PRICE_SELECTORS))) ??
    (await firstAttr(page, META_PRICE_SELECTORS));

  const availabilityText = await firstText(
    page,
    uniqueStrings(options.availabilitySelectors, DEFAULT_AVAILABILITY_SELECTORS)
  );

  return {
    title,
    imageUrl:
      (await firstAttr(page, uniqueAttrs(options.imageSelectors, DEFAULT_IMAGE_SELECTORS))) ?? structured.imageUrl,
    brand:
      (await firstText(page, uniqueStrings(options.brandSelectors, DEFAULT_BRAND_SELECTORS))) ?? structured.brand,
    category: structured.category,
    priceAmount: parsePriceToNumber(priceText ?? "") ?? structured.priceAmount,
    priceCurrency:
      normalizeCurrency(await firstAttr(page, META_CURRENCY_SELECTORS)) ?? 
      extractCurrencyFromText(priceText) ??
      structured.priceCurrency,
    inStock: parseAvailability(availabilityText) ?? structured.inStock,
    rating:
      parseNumber(await firstText(page, uniqueStrings(options.ratingSelectors, DEFAULT_RATING_SELECTORS))) ??
      structured.rating,
    reviews:
      parseCount(await firstText(page, uniqueStrings(options.reviewSelectors, DEFAULT_REVIEW_SELECTORS))) ??
      structured.reviews
  };
}
