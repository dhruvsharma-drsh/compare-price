import { prisma } from "../db/prisma";

/**
 * Keep history small enough for v1:
 * - Keep last N days (default 30)
 * - Also cap max rows per listing to avoid runaway storage
 */
export async function compactListingHistory(listingId: string, days = 30, maxRows = 200) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  await prisma.pricePoint.deleteMany({
    where: {
      listingId,
      at: { lt: cutoff }
    }
  });

  const count = await prisma.pricePoint.count({ where: { listingId } });
  if (count <= maxRows) return;

  const toDelete = count - maxRows;
  const old = await prisma.pricePoint.findMany({
    where: { listingId },
    orderBy: { at: "asc" },
    take: toDelete,
    select: { id: true }
  });

  if (old.length) {
    await prisma.pricePoint.deleteMany({
      where: { id: { in: old.map((x) => x.id) } }
    });
  }
}

