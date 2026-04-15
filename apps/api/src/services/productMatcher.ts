export interface MatchScore {
  score: number;
  isMatch: boolean;
  reasons: string[];
}

// Simple English stopwords and typical e-commerce noise words
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "with", "for", "to", "by",
  "of", "at", "from", "cm", "mm", "kg", "g", "new", "original", "authentic",
  "fast", "shipping", "free", "global", "unlocked", "sealed", "warranty",
  "buy", "online", "best", "price", "india", "reviews", "ratings"
]);

function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ") // replace punctuation with space
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function computeLevenshteinDistance(a: string, b: string): number {
  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + indicator // substitution
      );
    }
  }
  return matrix[a.length][b.length];
}

export function evaluateMatch(anchor: string, target: string, anchorBrand?: string, targetBrand?: string): MatchScore {
  let score = 0;
  const reasons: string[] = [];

  const anchorTokens = tokenize(anchor);
  const targetTokens = tokenize(target);

  if (anchorTokens.length === 0 || targetTokens.length === 0) {
    return { score: 0, isMatch: false, reasons: ["Empty tokens"] };
  }

  // 1. Brand Match (+20 points if matched, -30 if mismatched explicitly)
  if (anchorBrand && targetBrand) {
    if (anchorBrand.toLowerCase() === targetBrand.toLowerCase()) {
      score += 20;
      reasons.push("Exact brand match");
    } else {
      score -= 30;
      reasons.push("Brand mismatch");
    }
  }

  // 2. Token Overlap — how many of the SEARCH QUERY tokens appear in the product title?
  let overlapCount = 0;
  const matchedTokens = new Set<string>();
  
  for (const aToken of anchorTokens) {
    // Check if this anchor token exists in the target
    for (const tToken of targetTokens) {
      if (matchedTokens.has(tToken)) continue;
      
      if (aToken === tToken) {
        overlapCount++;
        matchedTokens.add(tToken);
        break;
      }
      
      const dist = computeLevenshteinDistance(aToken, tToken);
      // Allow minor typos for longer words
      if ((aToken.length > 5 && dist === 1) || (aToken.length > 8 && dist <= 2)) {
        overlapCount += 0.8; // Partial credit
        matchedTokens.add(tToken);
        break;
      }
    }
  }

  const overlapRatio = overlapCount / anchorTokens.length;
  // Up to 60 points for token overlap
  if (overlapRatio > 0) {
    score += Math.round(overlapRatio * 60);
    reasons.push(`Token overlap: ${Math.round(overlapRatio * 100)}%`);
  }

  // 3. KEY RULE: If ALL search query tokens are found in the product, it's very likely a match.
  //    Product titles are ALWAYS longer than search queries — "iphone 16" vs 
  //    "Apple iPhone 16, 128GB, Black - Unlocked". Extra words are just product details.
  //    Only penalize extra tokens if overlap is LOW (< 80%), indicating a different product.
  if (overlapRatio < 0.8) {
    const extraTokens = targetTokens.length - overlapCount;
    if (extraTokens > Math.max(8, anchorTokens.length * 2)) {
      score -= Math.min(15, extraTokens);
      reasons.push("Low overlap + many extra tokens");
    }
  }
  
  // 4. Specific anti-accessory patterns
  const ACCESSORY_KEYWORDS = [
    "case", "cover", "pouch", "sleeve", "holster", "shell", "housing",
    "screen protector", "tempered glass", "screen guard", "film",
    "charger", "adapter", "cable", "cord", "dock", "stand", "mount", "holder",
    "sticker", "decal", "skin", "wrap",
    "ring", "grip", "popsocket",
    "earbuds", "headphones", "airpods",
    "armband", "strap", "band",
    "stylus", "pen",
    "replacement", "spare", "repair", "tool kit"
  ];

  const textLow = target.toLowerCase();
  const queryLow = anchor.toLowerCase();
  
  // Filter out keywords that actually appear in the search query
  const activeAntiKeywords = ACCESSORY_KEYWORDS.filter(k => !queryLow.includes(k));
  
  // If the product title contains any of the active anti-keywords as full words, heavily penalize
  const isAccessory = activeAntiKeywords.some(k => {
    // \b is word boundary, ensuring "pen" doesn't match "opens", and "band" doesn't match "brand"
    const regex = new RegExp(`\\b${k}s?\\b`, 'i');
    return regex.test(textLow);
  });

  if (isAccessory) {
      score -= 50;
      reasons.push("Accessory detected but not in query");
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  // Match threshold: 25 points (achievable with ~50% token overlap alone)
  // 100% overlap = 60 points → always accepted
  // 75% overlap = 45 points → accepted
  // 50% overlap = 30 points → accepted
  // 40% overlap = 24 points → borderline, rejected unless brand match
  const isMatch = normalizedScore >= 25;

  return { score: normalizedScore, isMatch, reasons };
}
