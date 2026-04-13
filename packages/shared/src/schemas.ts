import { z } from "zod";

export const QueryTypeEnum = z.enum(["name", "barcode", "url"]);

export const CountryCodeEnum = z.enum([
  "US",
  "UK",
  "DE",
  "IN",
  "JP",
  "AU",
  "CA",
  "AE"
]);

export const PlatformEnum = z.enum([
  "amazon",
  "ebay",
  "walmart",
  "flipkart",
  "brand_store"
]);

export const CurrencyCodeEnum = z.enum(["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "AED"]);

export const SearchRequestSchema = z.object({
  queryType: QueryTypeEnum,
  query: z.string().min(1),
  countries: CountryCodeEnum.array().nonempty(),
  platforms: PlatformEnum.array().nonempty(),
  baseCurrency: CurrencyCodeEnum,
  includeShipping: z.boolean().default(true),
  includeTaxes: z.boolean().default(false)
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

