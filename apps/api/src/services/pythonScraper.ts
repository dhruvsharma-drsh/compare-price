/**
 * Proxy service to call the Python scraper microservice.
 * 
 * The Python scraper runs as a separate FastAPI server and provides
 * Playwright-based scraping with enhanced stealth capabilities.
 */

function normalizeServiceUrl(raw?: string): string {
  const value = raw?.trim();
  if (!value) return "http://localhost:8000";
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  return `http://${value.replace(/\/+$/, "")}`;
}

const PYTHON_SCRAPER_URL = normalizeServiceUrl(process.env.PYTHON_SCRAPER_URL);

export interface PythonScraperRequest {
  query: string;
  countries: string[];
  platforms?: string[];
  category?: string;
  subcategory?: string;
  max_results?: number;
}

export interface PythonListing {
  name: string;
  price: number | null;
  currency: string;
  price_usd: number | null;
  url: string;
  platform: string;
  country: string;
  image_url: string | null;
}

export interface PythonGroup {
  name: string;
  listing_count: number;
  cheapest_usd: number | null;
  cheapest_platform: string | null;
  cheapest_country: string | null;
  listings: PythonListing[];
}

export interface PythonScraperResponse {
  query: string;
  category: string;
  subcategory: string;
  total_listings: number;
  groups: PythonGroup[];
  errors: Record<string, string>;
}

/**
 * Check if the Python scraper microservice is running.
 */
export async function isPythonScraperHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${PYTHON_SCRAPER_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send a search request to the Python scraper microservice.
 */
export async function searchViaPython(
  req: PythonScraperRequest
): Promise<PythonScraperResponse> {
  const res = await fetch(`${PYTHON_SCRAPER_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(300_000), // 5 min timeout — scraping across many countries is very slow
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Python scraper returned ${res.status}: ${body}`);
  }

  return (await res.json()) as PythonScraperResponse;
}
