import { CountryCode, Platform } from "@prisma/client";
import { getBrowser, STEALTH_CONTEXT_OPTIONS } from "../retailers/browser";

export async function resolveFirstResultUrl(input: {
  platform: Platform;
  country: CountryCode;
  searchUrl: string;
  query: string;
}): Promise<string | null> {
  const queryTokens = input.query
    .toLowerCase()
    .split(/\s+/)
    .filter((x) => x.length > 1);

  const scoreTitle = (title: string) => {
    if (!title) return 0;
    const t = title.toLowerCase();
    return queryTokens.reduce((acc, token) => (t.includes(token) ? acc + 1 : acc), 0);
  };

  const browser = await getBrowser();
  const context = await browser.newContext(STEALTH_CONTEXT_OPTIONS);
  const page = await context.newPage();
  // Hide webdriver property
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  try {
    await page.goto(input.searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

    if (input.platform === "amazon") {
      await page.waitForSelector("[data-component-type='s-search-result'] h2 a[href], a[href*='/dp/']", { timeout: 10000 }).catch(() => {});
      const candidates = await page.$$eval("[data-component-type='s-search-result']", (rows) =>
        rows
          .slice(0, 8)
          .map((row) => {
            const a = row.querySelector("h2 a, h2 span a, .a-link-normal.s-underline-text") as HTMLAnchorElement | null;
            const titleEl = a ?? row.querySelector("h2, .a-text-normal");
            const title = titleEl?.textContent?.trim() ?? "";
            const href = a?.getAttribute("href") ?? "";
            return { title, href };
          })
          .filter((x) => x.href)
      );

      // Fallback: look for any /dp/ product links
      if (candidates.length === 0) {
        const dpCandidates = await page.$$eval("a[href*='/dp/']", (links) =>
          links.slice(0, 8).map((a) => ({
            title: a.textContent?.trim() ?? "",
            href: a.getAttribute("href") ?? ""
          })).filter((x) => x.href && x.title.length > 5)
        );
        candidates.push(...dpCandidates);
      }

      const best = candidates
        .map((c) => ({ ...c, score: c.href.includes("/dp/") ? 5 : 0 }))
        .map((c) => ({ ...c, score: c.score + scoreTitle(c.title) }))
        .sort((a, b) => b.score - a.score)[0];

      return best?.href ? new URL(best.href, input.searchUrl).toString() : null;
    }

    if (input.platform === "ebay") {
      await page.waitForSelector("li.s-item a.s-item__link", { timeout: 10000 }).catch(() => {});
      const candidates = await page.$$eval("li.s-item", (rows) =>
        rows
          .slice(0, 8)
          .map((row) => {
            const a = row.querySelector("a.s-item__link");
            const title = row.querySelector(".s-item__title")?.textContent?.trim() ?? "";
            const href = a?.getAttribute("href") ?? "";
            return { title, href };
          })
          .filter((x) => x.href)
      );

      const best = candidates.map((c) => ({ ...c, score: scoreTitle(c.title) })).sort((a, b) => b.score - a.score)[0];
      return best?.href ? new URL(best.href, input.searchUrl).toString() : null;
    }

    if (input.platform === "walmart") {
      // Walmart is a React SPA — need to wait for full render
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForSelector("a[href*='/ip/'], [data-item-id]", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000).catch(() => {});
      const candidates = await page.$$eval("a[href*='/ip/']", (links) =>
        links
          .slice(0, 8)
          .map((a) => ({
            title: (a.textContent ?? "").trim(),
            href: a.getAttribute("href") ?? ""
          }))
          .filter((x) => x.href)
      );
      const best = candidates.map((c) => ({ ...c, score: scoreTitle(c.title) })).sort((a, b) => b.score - a.score)[0];
      return best?.href ? new URL(best.href, input.searchUrl).toString() : null;
    }

    if (input.platform === "flipkart") {
      await page.waitForSelector("a[href*='pid='], a[href*='/p/']", { timeout: 8000 }).catch(() => {});
      const candidates = await page.$$eval("a[href*='/p/'], a[href*='pid=']", (links) =>
        links
          .slice(0, 12)
          .map((a) => ({
            title: (a.textContent ?? "").trim(),
            href: a.getAttribute("href") ?? ""
          }))
          .filter((x) => x.href)
      );
      const best = candidates.map((c) => ({ ...c, score: scoreTitle(c.title) })).sort((a, b) => b.score - a.score)[0];
      return best?.href ? new URL(best.href, input.searchUrl).toString() : null;
    }

    if (input.platform === "noon") {
      const candidates = await page.$$eval("a[href*='/p-']", (links) =>
        links
          .slice(0, 8)
          .map((a) => ({
            title: (a.textContent ?? "").trim(),
            href: a.getAttribute("href") ?? ""
          }))
          .filter((x) => x.href)
      );
      const best = candidates.map((c) => ({ ...c, score: scoreTitle(c.title) })).sort((a, b) => b.score - a.score)[0];
      return best?.href ? new URL(best.href, input.searchUrl).toString() : null;
    }

    if (input.platform === "coupang") {
      const candidates = await page.$$eval("a.search-product-link", (links) =>
        links
          .slice(0, 8)
          .map((a) => ({
            title: (a.querySelector('.name')?.textContent ?? "").trim(),
            href: a.getAttribute("href") ?? ""
          }))
          .filter((x) => x.href)
      );
      const best = candidates.map((c) => ({ ...c, score: scoreTitle(c.title) })).sort((a, b) => b.score - a.score)[0];
      return best?.href ? new URL(best.href, input.searchUrl).toString() : null;
    }

    if (input.platform === "ozon") {
      const candidates = await page.$$eval("a[href*='-']", (links) =>
        links
          .slice(0, 8)
          .map((a) => ({
            title: (a.textContent ?? "").trim(),
            href: a.getAttribute("href") ?? ""
          }))
          .filter((x) => x.href && !x.href.includes('category'))
      );
      const best = candidates.map((c) => ({ ...c, score: scoreTitle(c.title) })).sort((a, b) => b.score - a.score)[0];
      return best?.href ? new URL(best.href, input.searchUrl).toString() : null;
    }

    return null;
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}
