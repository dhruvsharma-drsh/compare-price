import crypto from "crypto";

export function stableHash(input: unknown): string {
  const json = JSON.stringify(input);
  return crypto.createHash("sha256").update(json).digest("hex");
}

export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function parsePriceToNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return;

  const dotCount = (cleaned.match(/\./g) ?? []).length;
  const commaCount = (cleaned.match(/,/g) ?? []).length;

  let normalized = cleaned;

  if (dotCount > 0 && commaCount > 0) {
    const decimalSep = cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",") ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    normalized = cleaned.replace(new RegExp(`\\${thousandsSep}`, "g"), "");
    if (decimalSep === ",") normalized = normalized.replace(",", ".");
  } else if (dotCount > 0 || commaCount > 0) {
    const sep = dotCount > 0 ? "." : ",";
    const parts = cleaned.split(sep);
    const last = parts[parts.length - 1] ?? "";

    if (parts.length > 2) {
      normalized = last.length === 2 ? `${parts.slice(0, -1).join("")}.${last}` : parts.join("");
    } else if (last.length === 3 && (parts[0]?.length ?? 0) >= 1) {
      normalized = parts.join("");
    } else {
      normalized = parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts[0] ?? cleaned;
    }
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}
