/**
 * Gemini AI-powered product relevance filter for the Node.js API.
 *
 * After scraping search results, this module sends product titles to
 * Gemini Flash for a fast relevance check, filtering out accessories
 * and unrelated items that keyword heuristics miss.
 */

import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (!GEMINI_API_KEY) return null;
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return _client;
}

export interface GeminiFilterInput {
  searchQuery: string;
  productTitles: string[];
  category?: string;
  subcategory?: string;
}

const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Ask Gemini whether each product title is relevant to the search query.
 * Returns a boolean array (true = keep, false = discard).
 * Retries on rate limits and falls back across multiple models.
 * Gracefully keeps everything on persistent failure.
 */
export async function filterWithGemini(
  input: GeminiFilterInput
): Promise<boolean[]> {
  const client = getClient();
  if (!client || input.productTitles.length === 0) {
    return input.productTitles.map(() => true);
  }

  const numbered = input.productTitles
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n");

  const prompt = `You are an expert product classifier for a price comparison engine.

The user searched for: "${input.searchQuery}"
Category: ${input.category || "unknown"}
Subcategory: ${input.subcategory || "unknown"}

Below is a numbered list of product titles scraped from online retailers.
For EACH product, decide if it is the **actual main product** the user is looking for,
or if it is an **accessory, case, cover, charger, screen protector, cable, or unrelated item**.

Rules:
- The product must be the SAME TYPE of item as the search query.
- Different storage variants or colors of the same product ARE relevant.
- Renewed/Refurbished versions ARE relevant.
- Cases, covers, screen protectors, chargers, cables, mounts, stands, skins, stickers, bands, straps, earbuds (unless searched for), and other accessories are NOT relevant.
- Completely different products of the same type (e.g. searching "iPhone 16" but getting "Samsung Galaxy S24") are still relevant as comparison alternatives.

Products:
${numbered}

Respond with ONLY a JSON array of booleans, one per product.
Example: [true, true, false, true, false]
No other text, no markdown, no explanation.`;

  let lastError: unknown = null;

  for (const modelName of MODELS_TO_TRY) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await client.models.generateContent({
          model: modelName,
          contents: prompt,
        });

        let raw = (response.text ?? "").trim();

        // Strip markdown code fences if present
        if (raw.startsWith("```")) {
          raw = raw.split("\n").slice(1).join("\n");
          raw = raw.replace(/```\s*$/, "").trim();
        }

        const verdicts: boolean[] = JSON.parse(raw);

        if (
          Array.isArray(verdicts) &&
          verdicts.length === input.productTitles.length
        ) {
          console.log(`   🤖 [GEMINI] Filtered with ${modelName} (attempt ${attempt + 1})`);
          return verdicts.map(Boolean);
        }

        console.log(
          `[GEMINI] Unexpected array length (${verdicts.length} vs ${input.productTitles.length}), keeping all`
        );
        return input.productTitles.map(() => true);
      } catch (err) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
          const waitMs = (attempt + 1) * 5000;
          console.log(
            `   🤖 [GEMINI] Rate limited on ${modelName}, retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/3)`
          );
          await sleep(waitMs);
          continue;
        } else {
          console.log(`   🤖 [GEMINI] Error on ${modelName}: ${errMsg}`);
          break; // non-rate-limit error, try next model
        }
      }
    }
  }

  console.log(
    `[GEMINI] All models exhausted: ${lastError instanceof Error ? lastError.message : lastError} -- keeping all`
  );
  return input.productTitles.map(() => true);
}
