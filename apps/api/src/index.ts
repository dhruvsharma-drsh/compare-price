import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./db/prisma";
import { SearchRequestSchema } from "./schemas";
import { findAdapterByUrl } from "./retailers/registry";
import { buildSearchUrl } from "./services/searchUrls";
import { resolveFirstResultUrl } from "./services/searchResolve";
import { upsertFromScrape } from "./services/listingUpsert";
import { getFxRate } from "./services/fx";
import { quickSearchFallback } from "./services/quickSearchFallback";
import { evaluateMatch } from "./services/productMatcher";
import { filterWithGemini } from "./services/geminiFilter";

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: ".env.example" });
}

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/** Simple concurrency limiter */
function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => { if (queue.length > 0 && active < concurrency) { active++; queue.shift()!(); } };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => fn().then(resolve, reject).finally(() => { active--; next(); });
      queue.push(run);
      next();
    });
}

app.post("/search", async (req, res) => {
  const searchStart = Date.now();
  const parsed = SearchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log("❌ [SEARCH] Invalid request body", parsed.error.flatten());
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const body = parsed.data;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔍 [SEARCH] New search request`);
  console.log(`   Query: "${body.query}"`);
  console.log(`   Countries: [${body.countries.join(', ')}]`);
  console.log(`   Platforms: [${body.platforms.join(', ')}]`);
  console.log(`   Base Currency: ${body.baseCurrency}`);
  console.log(`${'═'.repeat(60)}`);

  const isUrlInput = /^https?:\/\//i.test(body.query.trim());
  const effectiveQueryType = isUrlInput ? "url" : body.queryType;
  const directUrlAdapter = effectiveQueryType === "url" ? findAdapterByUrl(body.query.trim()) : undefined;
  const platformsToUse = effectiveQueryType === "url" && directUrlAdapter ? [directUrlAdapter.platform] : body.platforms;
  const countriesToUse = effectiveQueryType === "url" ? body.countries.slice(0, 1) : body.countries;
  const searchAnchor = effectiveQueryType === "url" ? null : body.query;
  
  const totalCombos = countriesToUse.length * platformsToUse.length;
  console.log(`   Query type: ${effectiveQueryType} | ${countriesToUse.length} countries × ${platformsToUse.length} platforms = ${totalCombos} combinations (parallel)`);

  let persistenceAvailable = true;
  let fxAvailable = true;

  // Build all combo tasks
  const combos: { country: string; platform: string; index: number }[] = [];
  let idx = 0;
  for (const country of countriesToUse) {
    for (const platform of platformsToUse) {
      combos.push({ country, platform, index: ++idx });
    }
  }

  const limit = pLimit(3); // max 3 parallel browser sessions

  // Process a single platform/country combination
  async function processCombo(combo: { country: string; platform: string; index: number }) {
    const { country, platform, index } = combo;
    const comboStart = Date.now();
    console.log(`\n── [${index}/${totalCombos}] ${platform} / ${country} ──`);
    
    let successful: any = null;
    let fetchedForError: any = null;

    // For NAME/BARCODE searches, use search-page extraction first
    let fallbackProductUrl: string | null = null;
    if (effectiveQueryType !== "url") {
      console.log(`   ⏳ Trying quickSearchFallback...`);
      const fallbackStart = Date.now();
      const quickResult = await quickSearchFallback({
        platform: platform as any,
        country: country as any,
        query: body.query,
        category: body.category,
        subcategory: body.subcategory
      });
      const fallbackMs = Date.now() - fallbackStart;
      if (quickResult.result && quickResult.result.listing.price?.amount && quickResult.result.listing.price.amount > 0) {
        console.log(`   ✅ quickSearch found result in ${fallbackMs}ms — title: "${quickResult.result.product.title?.slice(0, 60)}..."  price: ${quickResult.result.listing.price?.amount} ${quickResult.result.listing.price?.currency}`);
        successful = {
          ok: true,
          product: quickResult.result.product,
          listing: quickResult.result.listing
        };
      } else {
        console.log(`   ⚠️  quickSearch returned null (${fallbackMs}ms)${quickResult.fallbackProductUrl ? ' — but got fallback URL' : ''}`);
        fallbackProductUrl = quickResult.fallbackProductUrl;
      }
    }

    // If search-page extraction failed, try product-page scraping
    if (!successful) {
      console.log(`   ⏳ Trying product-page scraping...`);
      let urlToFetch: string | null = null;

      if (effectiveQueryType === "url") {
        urlToFetch = body.query;
      } else if (fallbackProductUrl) {
        // Use the URL quickSearch already found — skip the redundant resolveFirstResultUrl!
        console.log(`   🔗 Using fallback URL from quickSearch: ${fallbackProductUrl.slice(0, 80)}`);
        urlToFetch = fallbackProductUrl;
      } else {
        const searchUrl = buildSearchUrl(platform as any, country as any, body.query, body.category, body.subcategory);
        if (searchUrl) {
          console.log(`   🌐 resolveFirstResultUrl(${searchUrl.slice(0, 80)}...)`);
          const resolveStart = Date.now();
          urlToFetch = await resolveFirstResultUrl({
            platform: platform as any,
            country: country as any,
            searchUrl,
            query: body.query
          });
          console.log(`   ${urlToFetch ? '✅' : '❌'} Resolved in ${Date.now() - resolveStart}ms${urlToFetch ? ': ' + urlToFetch.slice(0, 80) : ''}`);
        } else {
          console.log(`   ❌ No search URL pattern for ${platform}/${country}`);
        }
      }

      if (urlToFetch) {
        const adapter = findAdapterByUrl(urlToFetch);
        if (adapter && adapter.platform === platform) {
          console.log(`   ⏳ Fetching product page via adapter...`);
          const fetchStart = Date.now();
          const fetched = await adapter.fetchByUrl({ url: urlToFetch, country: country as any });
          console.log(`   ${fetched.ok ? '✅' : '❌'} Adapter fetch in ${Date.now() - fetchStart}ms — price: ${fetched.ok ? fetched.listing?.price?.amount : 'N/A'}`);
          fetchedForError = fetched;
          if (fetched.ok && fetched.listing.price?.amount != null && fetched.listing.price.amount > 0) {
            successful = fetched;
          }
        } else {
          console.log(`   ❌ No matching adapter for URL`);
        }
      }
    }

    if (!successful) {
      const errMsg = fetchedForError?.ok
        ? "Listing found but price could not be extracted"
        : "No valid result found for this platform/country";
      console.log(`   ❌ FAILED: ${errMsg} (${Date.now() - comboStart}ms)`);
      return {
        type: "error" as const,
        error: fetchedForError?.ok
          ? { ok: false, platform, country, error: "Listing found but price could not be extracted" }
          : fetchedForError ?? { ok: false, platform, country, error: "No valid result found for this platform/country" }
      };
    }

    console.log(`   ✅ DONE in ${Date.now() - comboStart}ms`);
    return { type: "success" as const, successful, platform, country };
  }

  // Run all combos in parallel with concurrency limit
  const comboResults = await Promise.allSettled(
    combos.map((combo) => limit(() => processCombo(combo)))
  );

  // Collect results
  let results: any[] = [];
  const errors: any[] = [];
  const warnings = new Set<string>();
  const seenCanonical = new Set<string>();
  let primaryProduct: any = null;

  for (const settled of comboResults) {
    if (settled.status === "rejected") {
      errors.push({ ok: false, error: settled.reason?.message ?? "Unknown error" });
      continue;
    }
    const outcome = settled.value;
    if (outcome.type === "error") {
      errors.push(outcome.error);
      continue;
    }

    const { successful, platform, country } = outcome;

    const canonicalGlobalKey = `${successful.listing.platform}:${successful.listing.canonicalKey}`;
    if (seenCanonical.has(canonicalGlobalKey)) continue;
    
    const liveProduct = successful.product ?? null;
    
    let matchDetails = { score: 100, isMatch: true, reasons: ["URL search or no anchor"] };
    if (searchAnchor && liveProduct?.title) {
        matchDetails = evaluateMatch(searchAnchor, liveProduct.title, undefined, liveProduct.brand);
        console.log(`   🎯 Match score: ${matchDetails.score} — ${matchDetails.isMatch ? 'ACCEPTED' : 'REJECTED'} (${matchDetails.reasons.join(', ')})`);
        if (!matchDetails.isMatch) {
            errors.push({
               ok: false,
               platform,
               country,
               error: `Found product but excluded due to low match score (${matchDetails.score}). Reason: ${matchDetails.reasons.join(", ")}`
            });
            continue;
        }
    }
    
    seenCanonical.add(canonicalGlobalKey);

    if (!primaryProduct && liveProduct?.title) {
      primaryProduct = liveProduct;
    }

    let saved: Awaited<ReturnType<typeof upsertFromScrape>> | null = null;
    if (persistenceAvailable) {
      try {
        saved = await upsertFromScrape({
          platform: successful.listing.platform,
          country: successful.listing.country,
          product: successful.product,
          listing: successful.listing
        });
        if (!primaryProduct && saved.product?.title) {
          primaryProduct = saved.product;
        }
      } catch {
        persistenceAvailable = false;
        warnings.add("Live results are working, but saving history to the database is unavailable right now.");
      }
    }

    const localPrice = successful.listing.price?.amount ?? null;
    const localCurrency = successful.listing.price?.currency ?? null;

    let convertedPrice: number | null = null;
    if (localPrice != null && localCurrency != null) {
      if (localCurrency === body.baseCurrency) {
        convertedPrice = localPrice;
      } else if (fxAvailable) {
        try {
          const fx = await getFxRate(localCurrency, body.baseCurrency as any);
          convertedPrice = localPrice * fx;
        } catch {
          fxAvailable = false;
          warnings.add("Currency conversion is temporarily unavailable, so some listings only show local pricing.");
        }
      }
    }

    console.log(`   ✅ SUCCESS: ${successful.listing.platform}/${successful.listing.country} — ${localPrice} ${localCurrency}${convertedPrice != null ? ` → ${convertedPrice.toFixed(2)} ${body.baseCurrency}` : ''}`);

    results.push({
      listingId: saved?.listing.id ?? null,
      productId: saved?.product.id ?? null,
      product: liveProduct,
      platform: successful.listing.platform,
      country: successful.listing.country,
      url: successful.listing.url,
      canonicalKey: successful.listing.canonicalKey,
      local: localPrice != null && localCurrency != null ? { amount: localPrice, currency: localCurrency } : null,
      converted:
        convertedPrice != null
          ? { amount: convertedPrice, currency: body.baseCurrency }
          : null,
      shipping: successful.listing.shipping ?? null,
      inStock: successful.listing.inStock ?? null,
      rating: successful.listing.rating ?? null,
      reviews: successful.listing.reviews ?? null,
      lastFetchedAt: saved?.listing.lastFetchedAt?.toISOString?.() ?? new Date().toISOString(),
      isTracked: Boolean(saved),
      matchScore: matchDetails.score,
      matchReasons: matchDetails.reasons
    });
  }

  // --- Gemini AI relevance filter (post-scrape) ---
  if (results.length > 0 && process.env.GEMINI_API_KEY) {
    try {
        const titles = results
          .map((r) => r.product?.title ?? "")
          .filter((p): p is string => Boolean(p));
      if (titles.length > 0) {
        const verdicts = await filterWithGemini({
          searchQuery: body.query,
          productTitles: titles,
          category: body.category,
          subcategory: body.subcategory,
        });
        const beforeCount = results.length;
        results = results.filter((_, i) => verdicts[i] !== false);
        const removed = beforeCount - results.length;
        if (removed > 0) {
          console.log(`   🤖 [GEMINI] Filtered out ${removed} irrelevant result(s)`);
        }
      }
    } catch (err) {
      console.log(`   🤖 [GEMINI] Filter skipped: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Summary stats (using converted when available)
  const convertedVals = results
    .map((r) => (r.converted?.amount != null ? Number(r.converted.amount) : null))
    .filter((x): x is number => x != null && Number.isFinite(x));

  const lowest = convertedVals.length ? Math.min(...convertedVals) : null;
  const highest = convertedVals.length ? Math.max(...convertedVals) : null;
  const avg = convertedVals.length ? convertedVals.reduce((a, b) => a + b, 0) / convertedVals.length : null;
  const maxSaving = avg != null && lowest != null ? Math.max(0, avg - lowest) : null;

  const cheapestRow =
    lowest == null
      ? null
      : results.find((r) => r.converted?.amount != null && Number(r.converted.amount) === lowest) ?? null;

  const totalMs = Date.now() - searchStart;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ [SEARCH COMPLETE] ${results.length} results, ${errors.length} errors in ${(totalMs / 1000).toFixed(1)}s`);
  if (results.length > 0) {
    console.log(`   Cheapest: ${lowest != null ? lowest.toFixed(2) + ' ' + body.baseCurrency : 'N/A'}`);
  }
  console.log(`${'═'.repeat(60)}\n`);

  res.json({
    product: primaryProduct,
    listings: results,
    errors,
    warnings: Array.from(warnings),
    diagnostics: {
      totalAttempts: countriesToUse.length * platformsToUse.length,
      successCount: results.length,
      errorCount: errors.length,
      queryTypeUsed: effectiveQueryType,
      persistenceEnabled: persistenceAvailable,
      fxEnabled: fxAvailable
    },
    stats: {
      lowest: cheapestRow
        ? {
            amount: lowest,
            currency: body.baseCurrency,
            platform: cheapestRow.platform,
            country: cheapestRow.country
          }
        : null,
      highest: highest != null ? { amount: highest, currency: body.baseCurrency } : null,
      count: results.length,
      maxSavingVsAverage: maxSaving != null ? { amount: maxSaving, currency: body.baseCurrency } : null
    }
  });
});

app.get("/product/:productId/history", async (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    const baseCurrency = (req.query.baseCurrency as any) || "USD";

    const cutoff = new Date(Date.now() - (Number.isFinite(days) ? days : 30) * 24 * 60 * 60 * 1000);

    const listingRows = await prisma.listing.findMany({
      where: { productId: req.params.productId },
      include: {
        pricePoints: {
          where: { at: { gte: cutoff } },
          orderBy: { at: "asc" }
        }
      }
    });

    const series = [];
    for (const l of listingRows) {
      let fx = 1;
      if (l.currency !== baseCurrency) {
        try {
          fx = await getFxRate(l.currency as any, baseCurrency);
        } catch {
          fx = 1;
        }
      }

      series.push({
        listingId: l.id,
        platform: l.platform,
        country: l.country,
        currency: l.currency,
        baseCurrency,
        points: l.pricePoints.map((p: { at: Date; localPrice: unknown; shipping: unknown; inStock: boolean | null }) => ({
          at: p.at,
          local: p.localPrice != null ? Number(p.localPrice) : null,
          localShipping: p.shipping != null ? Number(p.shipping) : null,
          converted: p.localPrice != null ? Number(p.localPrice) * fx : null,
          convertedShipping: p.shipping != null ? Number(p.shipping) * fx : null,
          inStock: p.inStock
        }))
      });
    }

    res.json({ productId: req.params.productId, days, series });
  } catch (e) {
    res.status(503).json({
      error: "History is unavailable right now",
      details: e instanceof Error ? e.message : "Unknown error"
    });
  }
});

import { isPythonScraperHealthy, searchViaPython } from "./services/pythonScraper";

/**
 * POST /python-search
 * 
 * Delegates scraping to the Python microservice.
 * This endpoint provides the same response shape as /search so the
 * frontend can use either interchangeably.
 */
app.post("/python-search", async (req, res) => {
  const searchStart = Date.now();
  const { query, countries, platforms, baseCurrency, category, subcategory } = req.body;

  if (!query || !countries?.length) {
    res.status(400).json({ error: "query and countries are required" });
    return;
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🐍 [PYTHON-SEARCH] Delegating to Python scraper`);
  console.log(`   Query: "${query}"`);
  console.log(`   Countries: [${countries.join(', ')}]`);
  console.log(`   Platforms: [${(platforms || []).join(', ')}]`);
  console.log(`${'═'.repeat(60)}`);

  // Check if the Python scraper is running
  const healthy = await isPythonScraperHealthy();
  if (!healthy) {
    console.log("   ❌ Python scraper is not running!");
    res.status(503).json({
      error: "Python scraper microservice is not running. Start it with: cd apps/python-scraper && venv\\Scripts\\python.exe api.py",
      listings: [],
      errors: [{ error: "Python scraper offline" }],
      warnings: ["The Python scraper service is not running. Start it separately."],
      stats: { lowest: null, highest: null, count: 0, maxSavingVsAverage: null },
    });
    return;
  }

  try {
    const pyResult = await searchViaPython({
      query,
      countries,
      platforms: platforms || [],
      category: category || "electronics",
      subcategory: subcategory || "smartphones",
    });

    // Transform Python scraper response into the same shape the frontend expects
    const listings: any[] = [];
    const usedCurrency = baseCurrency || "USD";

    for (const group of pyResult.groups) {
      for (const item of group.listings) {
        listings.push({
          listingId: null,
          productId: null,
          product: {
            title: item.name,
            imageUrl: item.image_url,
          },
          platform: item.platform,
          country: item.country,
          url: item.url,
          canonicalKey: `${item.platform}:${item.country}:${item.name.slice(0, 40)}`,
          local: item.price != null ? { amount: item.price, currency: item.currency } : null,
          converted: item.price_usd != null ? { amount: item.price_usd, currency: "USD" } : null,
          shipping: null,
          inStock: null,
          rating: null,
          reviews: null,
          lastFetchedAt: new Date().toISOString(),
          isTracked: false,
          matchScore: 100,
          matchReasons: ["Python scraper result"],
        });
      }
    }

    // Sort by converted price
    listings.sort((a, b) => {
      if (!a.converted) return 1;
      if (!b.converted) return -1;
      return a.converted.amount - b.converted.amount;
    });

    // Compute stats
    const convertedVals = listings
      .map((r) => r.converted?.amount)
      .filter((x): x is number => x != null && Number.isFinite(x));

    const lowest = convertedVals.length ? Math.min(...convertedVals) : null;
    const highest = convertedVals.length ? Math.max(...convertedVals) : null;
    const avg = convertedVals.length ? convertedVals.reduce((a, b) => a + b, 0) / convertedVals.length : null;
    const maxSaving = avg != null && lowest != null ? Math.max(0, avg - lowest) : null;

    const cheapestRow = lowest == null ? null : listings.find((r) => r.converted?.amount === lowest) ?? null;

    const totalMs = Date.now() - searchStart;
    console.log(`\n✅ [PYTHON-SEARCH COMPLETE] ${listings.length} listings in ${(totalMs / 1000).toFixed(1)}s`);

    const errorList = Object.entries(pyResult.errors).map(([platform, error]) => ({
      ok: false,
      platform,
      error,
    }));

    res.json({
      product: listings[0]?.product ?? null,
      listings,
      errors: errorList,
      warnings: [],
      diagnostics: {
        totalAttempts: countries.length,
        successCount: listings.length,
        errorCount: errorList.length,
        queryTypeUsed: "python-scraper",
        persistenceEnabled: false,
        fxEnabled: false,
      },
      stats: {
        lowest: cheapestRow
          ? { amount: lowest, currency: "USD", platform: cheapestRow.platform, country: cheapestRow.country }
          : null,
        highest: highest != null ? { amount: highest, currency: "USD" } : null,
        count: listings.length,
        maxSavingVsAverage: maxSaving != null ? { amount: maxSaving, currency: "USD" } : null,
      },
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    console.log(`   ❌ Python scraper error: ${errMsg}`);
    res.status(500).json({
      error: errMsg,
      listings: [],
      errors: [{ error: errMsg }],
      warnings: [],
      stats: { lowest: null, highest: null, count: 0, maxSavingVsAverage: null },
    });
  }
});


/**
 * GET /scraper-status
 * Reports which scraping backends are available.
 */
app.get("/scraper-status", async (_req, res) => {
  const pythonHealthy = await isPythonScraperHealthy();
  res.json({
    node: true,
    python: pythonHealthy,
  });
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
