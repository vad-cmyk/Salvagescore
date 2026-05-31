import { chromium } from 'playwright';

export type AutotraderComparable = {
  title: string;
  priceGbp: number;
  mileage?: number;
  url: string;
};

export type AutotraderResult = {
  medianGbp: number;
  sampleSize: number;
  source: 'autotrader-live';
  comparables: AutotraderComparable[];
  searchUrl: string;
};

/**
 * Fetch the median UK asking price for a given make/model from AutoTrader,
 * plus up to 4 sample listing cards for the comparables section of the report.
 * Returns null if no results found (rare import, network issue, blocked).
 */
export async function fetchAutotraderMedian(
  make: string,
  model: string,
  year: number
): Promise<AutotraderResult | null> {
  const browser = process.env.BROWSERBASE_API_KEY
    ? await chromium.connectOverCDP(
        `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}`
      )
    : await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-GB',
  });
  const page = await context.newPage();

  const yearFrom = year - 1;
  const yearTo = year + 1;
  const makeEnc = encodeURIComponent(make.toUpperCase());
  // Use only the first 1–2 tokens of the model name to avoid over-specific queries
  // e.g. "SIERRA K1500 DENALI ULTIMATE" → "SIERRA" for broader AutoTrader matching
  const baseModel = model.trim().split(/\s+/).slice(0, 2).join(' ');
  const modelEnc = encodeURIComponent(baseModel.toUpperCase());
  const searchUrl = `https://www.autotrader.co.uk/car-search?make=${makeEnc}&model=${modelEnc}&year-from=${yearFrom}&year-to=${yearTo}&postcode=SW1A+1AA&radius=1500&sort=relevance`;

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    const extracted = await page.evaluate(() => {
      const prices: number[] = [];
      const comparables: Array<{ title: string; price: number; mileage: number | null; url: string }> = [];

      // Gather all price elements
      const priceEls = Array.from(
        document.querySelectorAll(
          '[data-testid="search-listing-price"], .product-card-pricing__price, [class*="vehicle-price"], [class*="listing-price"]'
        )
      );

      for (const priceEl of priceEls) {
        const match = (priceEl.textContent ?? '').match(/£([\d,]+)/);
        if (!match) continue;
        const price = parseInt(match[1].replace(/,/g, ''));
        if (price < 500 || price > 1_000_000) continue;
        prices.push(price);

        // Try to find the card this price belongs to
        if (comparables.length >= 4) continue;

        let card: Element | null = priceEl;
        for (let i = 0; i < 10; i++) {
          const parent: Element | null = card?.parentElement ?? null;
          if (!parent || parent.tagName === 'BODY') break;
          if (parent.querySelector?.('a[href*="/car-details/"]')) { card = parent; break; }
          card = parent;
        }
        if (!card) continue;

        const link = card.querySelector<HTMLAnchorElement>('a[href*="/car-details/"]');
        const href = link?.getAttribute('href');
        if (!href || comparables.some((c) => c.url === href)) continue;

        const heading = card.querySelector('h2, h3, h4, [class*="title"], [class*="heading"]');
        const title = (heading?.textContent ?? link?.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (!title || title.length < 4) continue;

        const mileMatch = (card.textContent ?? '').match(/([\d,]+)\s*miles/i);
        const mileage = mileMatch ? parseInt(mileMatch[1].replace(/,/g, '')) : null;

        comparables.push({
          title,
          price,
          mileage,
          url: 'https://www.autotrader.co.uk' + href,
        });
      }

      return { prices, comparables };
    });

    if (extracted.prices.length < 3) return null;

    extracted.prices.sort((a, b) => a - b);
    const mid = Math.floor(extracted.prices.length / 2);
    const median =
      extracted.prices.length % 2 === 0
        ? Math.round((extracted.prices[mid - 1] + extracted.prices[mid]) / 2)
        : extracted.prices[mid];

    return {
      medianGbp: median,
      sampleSize: extracted.prices.length,
      source: 'autotrader-live',
      comparables: extracted.comparables.map((c) => ({
        title: c.title,
        priceGbp: c.price,
        mileage: c.mileage ?? undefined,
        url: c.url,
      })),
      searchUrl,
    };
  } catch (err) {
    console.warn('[autotrader] fetch failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    await browser.close();
  }
}
