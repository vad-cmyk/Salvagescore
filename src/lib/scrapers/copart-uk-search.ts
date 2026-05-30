import { chromium, type BrowserContext } from 'playwright';
import type { SimilarLot } from '@/types';

/**
 * Find similar active lots on Copart UK for the same make/model.
 * Uses Playwright to bypass Incapsula, waits for Angular to render search results,
 * then extracts lot cards from the DOM.
 * Returns up to 4 lots excluding the current one. Returns [] on any failure.
 */
export async function fetchSimilarLots(
  make: string,
  model: string,
  currentLotNumber: string
): Promise<SimilarLot[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-GB',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  });
  const page = await context.newPage();

  try {
    const query = `${make} ${model}`;
    const searchUrl = `https://www.copart.co.uk/search#?query=${encodeURIComponent(query.toUpperCase())}&searchCriteria={}`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for Incapsula challenge + Angular to render lot cards
    await page
      .waitForSelector('a[href*="/lot/"]', { timeout: 20000 })
      .catch(() => {});

    // Extra settle time for Angular data binding
    await page.waitForTimeout(2000);

    // Extract lot data from rendered DOM
    const lots = await page.evaluate((currentLot: string) => {
      const results: Array<{
        lotNumber: string;
        title: string;
        currentBidGbp: number;
        odometerMiles: number | undefined;
        primaryDamage: string;
        url: string;
      }> = [];

      // Lot cards are <a href="/lot/{lotNumber}/..."> elements
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/lot/"]'));

      for (const anchor of anchors) {
        const href = anchor.getAttribute('href') ?? '';
        const lotMatch = href.match(/\/lot\/(\d+)/);
        if (!lotMatch) continue;

        const lotNumber = lotMatch[1];
        if (lotNumber === currentLot) continue;
        if (results.some((r) => r.lotNumber === lotNumber)) continue;

        // Title: look for the lot description text within the card
        const titleEl =
          anchor.querySelector('[class*="lot-title"]') ??
          anchor.querySelector('[class*="title"]') ??
          anchor.querySelector('h3') ??
          anchor.querySelector('h2') ??
          anchor.querySelector('strong');
        const title = titleEl?.textContent?.trim() ?? anchor.textContent?.trim() ?? '';

        if (!title || title.length < 4) continue;

        // Current bid
        const bidEl = anchor.querySelector('[class*="bid"]') ?? anchor.querySelector('[class*="price"]');
        const bidText = bidEl?.textContent?.replace(/[^0-9]/g, '') ?? '0';
        const currentBidGbp = parseInt(bidText, 10) || 0;

        // Odometer
        const odoEl = anchor.querySelector('[class*="odometer"]') ?? anchor.querySelector('[class*="miles"]');
        const odoText = odoEl?.textContent?.replace(/[^0-9]/g, '') ?? '';
        const odometerMiles = odoText ? parseInt(odoText, 10) : undefined;

        // Damage
        const damageEl =
          anchor.querySelector('[class*="damage"]') ??
          anchor.querySelector('[class*="loss"]');
        const primaryDamage = damageEl?.textContent?.trim() || 'Unknown';

        results.push({
          lotNumber,
          title,
          currentBidGbp,
          odometerMiles,
          primaryDamage,
          url: `https://www.copart.co.uk/lot/${lotNumber}`,
        });

        if (results.length >= 4) break;
      }

      return results;
    }, currentLotNumber);

    // If DOM extraction yielded nothing, try the Solr search API as fallback
    if (lots.length === 0) {
      return await fetchViaSolr(context, query, currentLotNumber);
    }

    return lots;
  } catch {
    return [];
  } finally {
    await browser.close();
  }
}

/** Fallback: hit Copart UK's Solr search endpoint with the authenticated cookie jar */
async function fetchViaSolr(
  context: BrowserContext,
  query: string,
  currentLotNumber: string
): Promise<SimilarLot[]> {
  try {
    const resp = await context.request.get(
      `https://www.copart.co.uk/public/data/lotdetails/search/fullText/${encodeURIComponent(query.toUpperCase())}?page=0&size=8`,
      {
        headers: {
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://www.copart.co.uk/',
        },
      }
    );

    if (!resp.ok()) return [];

    const json = (await resp.json()) as {
      data?: {
        results?: {
          content?: Array<{
            lotNumberStr?: string;
            ld?: string;
            hb?: number;
            orr?: number;
            dd?: string;
          }>;
        };
      };
    };

    const items = json.data?.results?.content ?? [];

    return items
      .filter((item) => item.lotNumberStr && item.lotNumberStr !== currentLotNumber)
      .slice(0, 4)
      .map((item) => ({
        lotNumber: item.lotNumberStr!,
        title: item.ld ?? '',
        currentBidGbp: item.hb ?? 0,
        odometerMiles: item.orr ?? undefined,
        primaryDamage: item.dd ?? 'Unknown',
        url: `https://www.copart.co.uk/lot/${item.lotNumberStr}`,
      }));
  } catch {
    return [];
  }
}
