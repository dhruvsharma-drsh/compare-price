import { z } from "zod";

export const QueryTypeEnum = z.enum(["name", "barcode", "url"]);

export const CountryCodeEnum = z.enum(["US", "UK", "DE", "IN", "JP", "AU", "CA", "AE", "KR", "RU"]);

export const PlatformEnum = z.enum(["amazon", "ebay", "walmart", "flipkart", "brand_store", "noon", "coupang", "ozon"]);

export const CurrencyCodeEnum = z.enum(["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "AED", "KRW", "RUB"]);

export const SearchRequestSchema = z.object({
  queryType: QueryTypeEnum,
  query: z.string().min(1),
  countries: CountryCodeEnum.array().nonempty(),
  platforms: PlatformEnum.array().nonempty(),
  baseCurrency: CurrencyCodeEnum,
  includeShipping: z.boolean().default(true),
  includeTaxes: z.boolean().default(false),
  category: z.string().optional(),
  subcategory: z.string().optional()
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

