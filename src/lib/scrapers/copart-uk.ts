import { chromium } from 'playwright';
import type { Listing } from '@/types';

const API_BASE = 'https://www.copart.co.uk/public/data/lotdetails/solr';

type CopartUkSolrLot = {
  ld: string;      // "2022 LAND ROVER RANGE ROVER SPORT 2.0 P400E HSE DYNAMIC BLACK 5DR AUTO"
  mkn: string;     // "LAND ROVER"
  lcy: number;     // model year
  la: number;      // CAP Clean / estimated retail GBP
  hb: number;      // current bid GBP
  orr: number;     // odometer miles
  fv?: string;     // VIN (masked for unauthenticated)
  dd: string;      // primary damage
  sdd?: string;    // secondary damage
  td: string;      // title description
  yn: string;      // yard / location
  sad?: number;    // sale/auction date — Unix timestamp in milliseconds
  lotNumberStr: string;
  dynamicLotDetails?: { currentBid: number };
};

type CopartUkImageEntry = {
  fullUrl: string;
  imageLabelCode?: string;
};

/**
 * Scrape a Copart UK lot via their backend JSON APIs.
 *
 * Incapsula now blocks all direct API calls (even with correct headers) until a JS
 * challenge cookie is set. We use Playwright to:
 *   1. Navigate the lot page → browser executes the challenge JS and sets incap_ses_* cookies
 *   2. Call both JSON API endpoints via context.request, which shares the cookie jar
 *
 * Prices are in GBP; stored in USD fields for pipeline compatibility (cost model checks
 * listing.source === 'copart-uk' and skips USD conversion).
 */
export async function scrapeListing(url: string): Promise<Listing> {
  const lotMatch = url.match(/\/lot\/(\d+)/i);
  if (!lotMatch) throw new Error(`Cannot extract lot number from URL: ${url}`);
  const lotNumber = lotMatch[1];

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-GB',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  });
  const page = await context.newPage();

  // Remove webdriver fingerprint before any navigation
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    // Step 1 — visit lot page to trigger Incapsula JS challenge and set session cookies.
    await page.goto(`https://www.copart.co.uk/lot/${lotNumber}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for Angular to render (title will contain year or pipe separator)
    await page
      .waitForFunction(
        () =>
          document.title.includes('|') ||
          /\b20\d{2}\b/.test(document.title) ||
          document.title.toLowerCase().includes('copart'),
        { timeout: 15000 }
      )
      .catch(() => {});

    // Step 2 — call JSON APIs from within the browser page so Incapsula sees the same
    // fingerprint as the page visit (cookies, JS environment, headers all match).
    type FetchResult = { ok: boolean; status: number; body: unknown };
    const [lotResult, imgResult] = await page.evaluate(
      async ([lotUrl, imgUrl]: [string, string]): Promise<[FetchResult, FetchResult]> => {
        const headers = { Accept: 'application/json, text/plain, */*', Referer: 'https://www.copart.co.uk/' };
        const [lotRes, imgRes] = await Promise.all([
          fetch(lotUrl, { headers }),
          fetch(imgUrl, { headers }).catch(() => null),
        ]);
        const lotBody = lotRes.ok ? await lotRes.json() : null;
        const imgBody = imgRes && imgRes.ok ? await imgRes.json() : null;
        return [
          { ok: lotRes.ok, status: lotRes.status, body: lotBody },
          { ok: imgRes ? imgRes.ok : false, status: imgRes ? imgRes.status : 0, body: imgBody },
        ];
      },
      [
        `${API_BASE}/${lotNumber}`,
        `${API_BASE}/lotImages/${lotNumber}`,
      ] as [string, string]
    );

    if (!lotResult.ok) {
      throw new Error(`Copart UK lot API returned ${lotResult.status} for lot ${lotNumber}`);
    }

    const lotJson = lotResult.body as { data?: { lotDetails?: CopartUkSolrLot } };
    const imgJson = imgResult.ok
      ? (imgResult.body as { data?: { imagesList?: { content?: CopartUkImageEntry[] } } })
      : null;

    const lot = lotJson.data?.lotDetails;
    if (!lot) throw new Error(`No lot data in Copart UK API response for lot ${lotNumber}`);

    // ── Parse make / model / trim ──────────────────────────────────────────────────────────
    // ld format: "2022 LAND ROVER RANGE ROVER SPORT 2.0 P400E HSE DYNAMIC BLACK 5DR AUTO"
    const titleMatch = lot.ld.match(/^(\d{4})\s+(.+)$/);
    const year = titleMatch ? parseInt(titleMatch[1]) : lot.lcy;
    const vehicleName = titleMatch ? titleMatch[2] : lot.ld;

    let make = lot.mkn || 'Unknown';
    let model = 'Unknown';
    let trim: string | undefined;

    // Strip make prefix to isolate model+trim
    let modelAndTrim = vehicleName;
    if (lot.mkn && vehicleName.toUpperCase().startsWith(lot.mkn.toUpperCase())) {
      modelAndTrim = vehicleName.slice(lot.mkn.length).trimStart();
    }

    // Split at the first numeric token (engine size, e.g. "2.0") → model | trim
    const tokens = modelAndTrim.split(/\s+/);
    const firstNumericIdx = tokens.findIndex((t) => /^\d/.test(t));
    if (firstNumericIdx > 0) {
      model = tokens.slice(0, firstNumericIdx).join(' ') || 'Unknown';
      trim = tokens.slice(firstNumericIdx).join(' ') || undefined;
    } else if (firstNumericIdx === 0) {
      model = tokens[0] ?? 'Unknown';
      trim = tokens.slice(1).join(' ') || undefined;
    } else {
      model = modelAndTrim || 'Unknown';
    }

    // ── Photos ─────────────────────────────────────────────────────────────────────────────
    const imgContent = imgJson?.data?.imagesList?.content ?? [];
    const photos = imgContent
      .slice(0, 12)
      .map((img) => ({ url: img.fullUrl, caption: img.imageLabelCode ?? '' }))
      .filter((p) => p.url.startsWith('http'));

    const currentBid = lot.dynamicLotDetails?.currentBid ?? lot.hb;

    return {
      source: 'copart-uk',
      lotNumber,
      vin: lot.fv && !lot.fv.includes('*') ? lot.fv : undefined,
      year,
      make,
      model,
      trim,
      odometerMiles: lot.orr ?? 0,
      primaryDamage: lot.dd || 'Unknown',
      secondaryDamage: lot.sdd || undefined,
      titleStatus: lot.td || 'Unknown',
      currentBidUsd: currentBid || undefined,
      estRetailUsd: lot.la || undefined,
      photos,
      location: lot.yn || 'UK',
      auctionDate: lot.sad ? new Date(lot.sad).toISOString() : undefined,
    };
  } finally {
    await browser.close();
  }
}
