import type { RetailerAdapter } from "./types";
import { brandStoreGenericAdapter } from "./adapters/brandStoreGeneric";
import { amazonAdapter } from "./adapters/amazon";
import { ebayAdapter } from "./adapters/ebay";
import { walmartAdapter } from "./adapters/walmart";
import { flipkartAdapter } from "./adapters/flipkart";
import { noonAdapter } from "./adapters/noon";
import { coupangAdapter } from "./adapters/coupang";
import { ozonAdapter } from "./adapters/ozon";

export const retailerAdapters: RetailerAdapter[] = [
  amazonAdapter,
  ebayAdapter,
  walmartAdapter,
  flipkartAdapter,
  noonAdapter,
  coupangAdapter,
  ozonAdapter,
  brandStoreGenericAdapter
];

export function findAdapterByUrl(url: string): RetailerAdapter | undefined {
  return retailerAdapters.find((a) => a.supportsUrl(url));
}

