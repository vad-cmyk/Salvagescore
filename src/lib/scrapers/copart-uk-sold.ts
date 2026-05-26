import { chromium } from 'playwright';
import type { SoldLot } from '@/types';

type SolrSoldLot = {
  lotNumberStr?: string;
  ld?: string;       // lot description e.g. "2020 BMW 3 SERIES 2.0 320D M SPORT"
  hb?: number;       // hammer / final bid GBP
  orr?: number;      // odometer miles
  dd?: string;       // primary damage
  sad?: number;      // sale date — Unix timestamp milliseconds
};

/**
 * Fetch up to 5 recently sold Copart UK lots matching make/model.
 * Uses Playwright to acquire the Incapsula session cookie, then hits
 * the Solr full-text search API with a SOLD status filter.
 * Returns [] on any failure — never throws.
 */
export async function fetchSoldComps(
  make: string,
  model: string,
  currentLotNumber: string
): Promise<SoldLot[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-GB',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  });
  const page = await context.newPage();

  try {
    // Step 1 — acquire Incapsula session cookie by visiting the search page
    await page.goto('https://www.copart.co.uk/search', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page
      .waitForFunction(
        () => document.title.toLowerCase().includes('copart'),
        { timeout: 10000 }
      )
      .catch(() => {});

    // Step 2 — call Solr with SOLD status filter using the authenticated cookie jar
    const query = `${make} ${model}`.toUpperCase();
    const searchCriteria = encodeURIComponent(JSON.stringify({ SY_BNF: ['SOLD'] }));
    const apiUrl =
      `https://www.copart.co.uk/public/data/lotdetails/search/fullText/` +
      `${encodeURIComponent(query)}?page=0&size=8&searchCriteria=${searchCriteria}`;

    const resp = await context.request.get(apiUrl, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://www.copart.co.uk/',
      },
    });

    if (!resp.ok()) return [];

    const json = (await resp.json()) as {
      data?: { results?: { content?: SolrSoldLot[] } };
    };

    const items = json.data?.results?.content ?? [];

    return items
      .filter(
        (item) =>
          item.lotNumberStr &&
          item.lotNumberStr !== currentLotNumber &&
          (item.hb ?? 0) > 0
      )
      .slice(0, 5)
      .map((item) => ({
        lotNumber: item.lotNumberStr!,
        title: item.ld ?? '',
        hammerGbp: item.hb ?? 0,
        odometerMiles: item.orr ?? undefined,
        primaryDamage: item.dd ?? 'Unknown',
        saleDate: item.sad ? new Date(item.sad).toISOString() : undefined,
        url: `https://www.copart.co.uk/lot/${item.lotNumberStr}`,
      }))
      .sort((a, b) => {
        if (!a.saleDate && !b.saleDate) return 0;
        if (!a.saleDate) return 1;
        if (!b.saleDate) return -1;
        return new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
      });
  } catch {
    return [];
  } finally {
    await browser.close();
  }
}
