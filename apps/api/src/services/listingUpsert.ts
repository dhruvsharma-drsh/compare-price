import { CountryCode, Platform, type CurrencyCode } from "@prisma/client";
import { prisma } from "../db/prisma";
import type { NormalizedProduct, NormalizedListing } from "../retailers/types";
import { compactListingHistory } from "./historyCompaction";

export async function upsertFromScrape(input: {
  platform: Platform;
  country: CountryCode;
  product?: NormalizedProduct;
  listing: NormalizedListing;
}) {
  const existingListing = await prisma.listing.findUnique({
    where: {
      platform_country_canonicalKey: {
        platform: input.platform,
        country: input.country,
        canonicalKey: input.listing.canonicalKey
      }
    },
    include: {
      product: true
    }
  });

  const productData =
    input.product != null
      ? {
          title: input.product.title,
          brand: input.product.brand,
          category: input.product.category,
          imageUrl: input.product.imageUrl,
          barcode: input.product.barcode
        }
      : {
          title: existingListing?.product.title ?? "Unknown product",
          brand: existingListing?.product.brand ?? undefined,
          category: existingListing?.product.category ?? undefined,
          imageUrl: existingListing?.product.imageUrl ?? undefined,
          barcode: existingListing?.product.barcode ?? undefined
        };

  const product = existingListing
    ? await prisma.product.update({
        where: { id: existingListing.productId },
        data: {
          title: productData.title,
          brand: productData.brand,
          category: productData.category,
          imageUrl: productData.imageUrl,
          barcode: productData.barcode
        }
      })
    : await prisma.product.create({
        data: productData
      });

  const price = input.listing.price?.amount;
  const shipping = input.listing.shipping?.amount;
  const currency = (input.listing.price?.currency ??
    input.listing.shipping?.currency ??
    "USD") as CurrencyCode;

  const listing = existingListing
    ? await prisma.listing.update({
        where: { id: existingListing.id },
        data: {
          productId: product.id,
          url: input.listing.url,
          currency,
          localPrice: price,
          shipping,
          inStock: input.listing.inStock,
          rating: input.listing.rating,
          reviews: input.listing.reviews,
          lastFetchedAt: new Date(),
          lastError: null,
          rawHash: input.listing.rawHash
        }
      })
    : await prisma.listing.create({
        data: {
          productId: product.id,
          platform: input.platform,
          country: input.country,
          url: input.listing.url,
          canonicalKey: input.listing.canonicalKey,
          currency,
          localPrice: price,
          shipping,
          inStock: input.listing.inStock,
          rating: input.listing.rating,
          reviews: input.listing.reviews,
          lastFetchedAt: new Date(),
          lastError: null,
          rawHash: input.listing.rawHash
        }
      });

  await prisma.pricePoint.create({
    data: {
      listingId: listing.id,
      at: new Date(),
      currency,
      localPrice: price,
      shipping,
      inStock: input.listing.inStock
    }
  });

  await compactListingHistory(listing.id, 30, 200);

  return { product, listing };
}
