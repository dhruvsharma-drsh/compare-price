import { CountryCode, Platform } from "@prisma/client";

export function buildSearchUrl(
  platform: Platform,
  country: CountryCode,
  query: string,
  category?: string,
  subcategory?: string
): string | null {
  const q = encodeURIComponent(query);

  if (platform === "amazon") {
    const hostMap: Record<string, string> = {
      UK: "www.amazon.co.uk",
      DE: "www.amazon.de",
      IN: "www.amazon.in",
      JP: "www.amazon.co.jp",
      AU: "www.amazon.com.au",
      CA: "www.amazon.ca",
      AE: "www.amazon.ae",
      US: "www.amazon.com",
    };
    const host = hostMap[country] || "www.amazon.com";
    
    // Category-specific Amazon search paths
    if (category === "electronics" && subcategory === "smartphones") {
      const nodeMap: Record<string, string> = {
        IN: "n%3A1389401031",
        US: "n%3A2811409011",
        AE: "n%3A12050259031",
        UK: "n%3A5362060031",
        DE: "n%3A3468301",
        CA: "n%3A6205124011",
        AU: "n%3A4975185051",
        JP: "n%3A128187011",
      };
      const node = nodeMap[country];
      if (node) {
        return `https://${host}/s?i=electronics&rh=${node}&k=${q}`;
      }
    }
    
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
    if (category === "electronics" && subcategory === "smartphones") {
      return `https://www.flipkart.com/search?q=${q}&p%5B%5D=facets.brand%255B%255D%3DApple`; // Simplified, usually flipkart searches everything
    }
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

