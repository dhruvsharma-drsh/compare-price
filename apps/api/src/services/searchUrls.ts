import { CountryCode, Platform } from "@prisma/client";

export function buildSearchUrl(platform: Platform, country: CountryCode, query: string): string | null {
  const q = encodeURIComponent(query);

  if (platform === "amazon") {
    const host =
      country === "UK"
        ? "www.amazon.co.uk"
        : country === "DE"
          ? "www.amazon.de"
          : country === "IN"
            ? "www.amazon.in"
            : country === "JP"
              ? "www.amazon.co.jp"
              : country === "AU"
                ? "www.amazon.com.au"
                : country === "CA"
                  ? "www.amazon.ca"
                  : country === "AE"
                    ? "www.amazon.ae"
                    : "www.amazon.com";
    return `https://${host}/s?k=${q}`;
  }

  if (platform === "ebay") {
    // Keep it simple for v1; item pages will still be parsed by adapter.
    return `https://www.ebay.com/sch/i.html?_nkw=${q}`;
  }

  if (platform === "walmart") {
    if (country !== "US") return null;
    return `https://www.walmart.com/search?q=${q}`;
  }

  if (platform === "flipkart") {
    if (country !== "IN") return null;
    return `https://www.flipkart.com/search?q=${q}`;
  }

  if (platform === "noon") {
    if (country !== "AE") return null;
    return `https://www.noon.com/uae-en/search/?q=${q}`;
  }

  if (platform === "coupang") {
    if (country !== "KR") return null;
    return `https://www.coupang.com/np/search?q=${q}`;
  }

  if (platform === "ozon") {
    if (country !== "RU") return null;
    return `https://www.ozon.ru/search/?text=${q}`;
  }

  return null;
}

