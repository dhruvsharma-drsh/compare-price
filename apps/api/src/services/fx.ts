import axios from "axios";
import { CurrencyCode } from "@prisma/client";
import { prisma } from "../db/prisma";

type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

const FX_TTL_MS = 6 * 60 * 60 * 1000; // 6h cache in DB

export async function getFxRate(base: CurrencyCode, quote: CurrencyCode): Promise<number> {
  if (base === quote) return 1;

  const cached = await prisma.fxRate.findUnique({
    where: { base_quote: { base, quote } }
  });

  if (cached && Date.now() - cached.fetchedAt.getTime() <= FX_TTL_MS) {
    return Number(cached.rate);
  }

  const res = await axios.get<FrankfurterResponse>("https://api.frankfurter.app/latest", {
    params: { from: base, to: quote }
  });

  const rate = res.data.rates?.[quote];
  if (!rate) throw new Error(`FX rate missing for ${base}->${quote}`);

  await prisma.fxRate.upsert({
    where: { base_quote: { base, quote } },
    create: { base, quote, rate },
    update: { rate, fetchedAt: new Date() }
  });

  return rate;
}

