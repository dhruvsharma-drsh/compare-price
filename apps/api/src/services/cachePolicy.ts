export function getListingTtlMs(): number {
  const raw = process.env.LISTING_TTL_MINUTES;
  const minutes = raw ? Number(raw) : 20;
  if (!Number.isFinite(minutes) || minutes <= 0) return 20 * 60 * 1000;
  return minutes * 60 * 1000;
}

export function isFresh(lastFetchedAt: Date | null | undefined, now = new Date()): boolean {
  if (!lastFetchedAt) return false;
  return now.getTime() - lastFetchedAt.getTime() <= getListingTtlMs();
}

