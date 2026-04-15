declare module "cors" {
  import type { RequestHandler } from "express";

  type Cors = () => RequestHandler;

  const cors: Cors;
  export default cors;
}

declare module "@prisma/client" {
  export const Platform: {
    amazon: "amazon";
    ebay: "ebay";
    walmart: "walmart";
    flipkart: "flipkart";
    brand_store: "brand_store";
    noon: "noon";
    coupang: "coupang";
    ozon: "ozon";
  };

  export type Platform = (typeof Platform)[keyof typeof Platform];

  export const CountryCode: {
    US: "US";
    UK: "UK";
    DE: "DE";
    IN: "IN";
    JP: "JP";
    AU: "AU";
    CA: "CA";
    AE: "AE";
    KR: "KR";
    RU: "RU";
  };

  export type CountryCode = (typeof CountryCode)[keyof typeof CountryCode];

  export const CurrencyCode: {
    USD: "USD";
    EUR: "EUR";
    GBP: "GBP";
    INR: "INR";
    JPY: "JPY";
    AUD: "AUD";
    CAD: "CAD";
    AED: "AED";
    KRW: "KRW";
    RUB: "RUB";
  };

  export type CurrencyCode = (typeof CurrencyCode)[keyof typeof CurrencyCode];

  export class PrismaClient {
    constructor(options?: unknown);
    [key: string]: any;
  }
}
