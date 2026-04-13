import { CountryCode, CurrencyCode, Platform } from "@prisma/client";

export type Money = {
  currency: CurrencyCode;
  amount: number;
};

export type NormalizedProduct = {
  title: string;
  imageUrl?: string;
  category?: string;
  brand?: string;
  barcode?: string;
};

export type NormalizedListing = {
  platform: Platform;
  country: CountryCode;
  url: string;
  canonicalKey: string;
  price?: Money;
  shipping?: Money;
  inStock?: boolean;
  rating?: number;
  reviews?: number;
  rawHash?: string;
};

export type RetailerFetchResult =
  | { ok: true; product?: NormalizedProduct; listing: NormalizedListing }
  | { ok: false; platform: Platform; country: CountryCode; url: string; error: string };

export type RetailerAdapter = {
  platform: Platform;
  supportsUrl(url: string): boolean;
  fetchByUrl(input: { url: string; country: CountryCode }): Promise<RetailerFetchResult>;
};

