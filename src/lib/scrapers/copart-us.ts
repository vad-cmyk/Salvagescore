import { chromium } from 'playwright';
import type { Listing } from '@/types';

const API_BASE = 'https://www.copart.com/public/data/lotdetails/solr';

type CopartUsLot = {
  ld?: string;     // "2025 GMC SIERRA K1500 DENALI ULTIMATE"
  tl?: string;
  mkn?: string;    // make name
  lcy?: number;    // lot year
  yn?: number;
  la?: number;     // estimated retail USD
  hb?: number;     // current bid USD
  orr?: number;    // odometer miles
  fv?: string;     // VIN
  dd?: string;     // primary damage
  sdd?: string;    // secondary damage
  td?: string;     // title document type
  tdn?: string;
  lnm?: string;    // location
  sy?: string;
  lotNumberStr?: string;
  dynamicLotDetails?: { currentBid?: number };
};

type CopartUsImageEntry = {
  fullUrl?: string;
  url?: string;
  imageLabelCode?: string;
};

/**
 * Parse year/make/model from the URL slug as a reliable fallback.
 * e.g. ".../clean-title-2025-gmc-sierra-k1500-denali-ultimate-tx-houston-east"
 */
function parseSlug(url: string): { year: number; make: string; model: string; titleHint: string } {
  const slug = (url.match(/\/lot\/\d+\/([^?#]+)/)?.[1] ?? '').toLowerCase();

  const yearMatch = slug.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 0;

  const titleHint = slug.includes('clean') ? 'Clean Title'
    : slug.includes('salvage') ? 'Salvage'
    : 'Unknown';

  if (!year) return { year: 0, make: '', model: '', titleHint };

  const afterYear = slug.slice(slug.indexOf(String(year)) + 5);
  const parts = afterYear.split('-').filter(Boolean);

  const US_STATES = new Set([
    'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
    'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
    'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
    'va','wa','wv','wi','wy',
  ]);
  const stateIdx = parts.findIndex((p) => US_STATES.has(p));
  const trimmedParts = stateIdx > 0 ? parts.slice(0, stateIdx) : parts;

  const make = trimmedParts[0] ?? '';
  const model = trimmedParts.slice(1).join(' ').toUpperCase();

  return { year, make: make.toUpperCase(), model, titleHint };
}

/**
 * Scrape a Copart US lot via their backend JSON APIs.
 *
 * Copart.com (US) is behind Incapsula — direct API calls fail until a JS-challenge
 * cookie is set. Same approach as Copart UK:
 *   1. Navigate the lot page → Chromium executes the challenge JS and sets incap_ses_* cookies
 *   2. Call the JSON API endpoints via context.request, which shares the same cookie jar
 *   3. Fall back to URL slug parsing if API is unavailable
 */
export async function scrapeListing(url: string): Promise<Listing> {
  const lotMatch = url.match(/\/lot\/(\d+)/i);
  if (!lotMatch) throw new Error(`Cannot extract lot number from URL: ${url}`);
  const lotNumber = lotMatch[1];

  const slugInfo = parseSlug(url);

  const browser = process.env.BROWSERBASE_API_KEY
    ? await chromium.connectOverCDP(
        `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}`
      )
    : await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const page = await context.newPage();

  try {
    // Step 1 — visit the lot page. Incapsula JS challenge fires, Chromium executes it,
    // incap_ses_* cookies get set, then Copart redirects back to the real lot page.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });

    // Wait for the Incapsula redirect to complete. Same signal as UK scraper:
    // title will include a year or a pipe when the real lot page loads.
    await page
      .waitForFunction(
        () =>
          document.title.includes('|') ||
          /\b20\d{2}\b/.test(document.title) ||
          document.title.toLowerCase().includes('copart'),
        { timeout: 15000 }
      )
      .catch(() => {});

    // Extra pause so the Angular app can fire its XHR calls
    await page.waitForTimeout(1500);

    // Step 2 — call Copart US JSON APIs from within the browser page so the
    // Incapsula-authenticated cookie jar is shared (same approach as Copart UK).
    type FetchResult = { ok: boolean; status: number; body: unknown };
    const [lotResult, imgResult] = await page.evaluate(
      async ([lotUrl, imgUrl]: [string, string]): Promise<[FetchResult, FetchResult]> => {
        const headers = { Accept: 'application/json, text/plain, */*', Referer: 'https://www.copart.com/' };
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
      [`${API_BASE}/${lotNumber}`, `${API_BASE}/lotImages/${lotNumber}`] as [string, string]
    );

    // Parse lot details
    let lot: CopartUsLot | undefined;
    if (lotResult.ok) {
      const json = lotResult.body as { data?: { lotDetails?: CopartUsLot }; lotDetails?: CopartUsLot } | null;
      lot = json?.data?.lotDetails ?? (json?.lotDetails as CopartUsLot | undefined);
    }

    // Parse images
    let images: CopartUsImageEntry[] = [];
    if (imgResult.ok) {
      const imgJson = imgResult.body as { data?: { imagesList?: { content?: CopartUsImageEntry[] } } } | null;
      images = imgJson?.data?.imagesList?.content ?? [];
    }

    // ── Fallback: extract from DOM if API was blocked ─────────────────────────────────────
    if (!lot) {
      // Wait for Angular to populate [data-uname] elements
      await page
        .waitForFunction(
          () => {
            const el = document.querySelector('[data-uname="lotdetailLotnum"]');
            return el && (el.textContent ?? '').trim().length > 0;
          },
          { timeout: 12000 }
        )
        .catch(() => {});

      lot = await page.evaluate((): CopartUsLot => {
        const getUname = (name: string) =>
          (document.querySelector(`[data-uname="${name}"]`) as HTMLElement | null)?.textContent?.trim() ?? '';
        return {
          ld: (document.querySelector('h1.lot-title, h1') as HTMLElement | null)?.textContent?.trim() ?? '',
          hb: parseFloat(getUname('lotdetailCurbid').replace(/[^0-9.]/g, '')) || undefined,
          la: parseFloat(getUname('lotdetailEsimatedretailvalue').replace(/[^0-9.]/g, '')) || undefined,
          orr: parseInt(getUname('lotdetailOdometerreading').replace(/[^0-9]/g, '')) || undefined,
          fv: getUname('lotdetailVinnumber') || undefined,
          dd: getUname('lotdetailPrimarydamage') || undefined,
          sdd: getUname('lotdetailSecondarydamage') || undefined,
          td: getUname('lotdetailDocumenttype') || undefined,
          lnm: getUname('lotdetailSaleinformation') || undefined,
        };
      });
    }

    // ── Fallback: extract CDN images from fully-rendered DOM ─────────────────────────────
    if (!images.length) {
      await page
        .waitForSelector('img[src*="cs.copart.com"], img[src*="vis.copart.com"]', { timeout: 10000 })
        .catch(() => {});

      images = await page.evaluate((): CopartUsImageEntry[] => {
        const seen = new Set<string>();
        const result: CopartUsImageEntry[] = [];
        for (const img of Array.from(document.querySelectorAll('img'))) {
          const src =
            (img as HTMLImageElement).src ||
            img.getAttribute('data-src') ||
            img.getAttribute('data-lazy-src') ||
            img.getAttribute('data-original') || '';
          if (
            src &&
            src.startsWith('http') &&
            (src.includes('cs.copart.com') || src.includes('vis.copart.com')) &&
            !src.includes('placeholder') &&
            !src.includes('logo') &&
            !seen.has(src)
          ) {
            seen.add(src);
            result.push({ fullUrl: src, imageLabelCode: (img as HTMLImageElement).alt || '' });
          }
        }
        return result;
      });
    }

    // ── Normalise lot fields ──────────────────────────────────────────────────────────────
    const rawTitle = lot?.ld || lot?.tl || '';
    const titleRegex = rawTitle.match(/^(\d{4})\s+(\S+)\s+(.+)$/);

    const year = titleRegex
      ? parseInt(titleRegex[1])
      : (lot?.lcy ?? lot?.yn ?? slugInfo.year ?? 0);

    const makeFromApi = lot?.mkn ?? '';
    const makeFromTitle = titleRegex ? titleRegex[2] : '';
    const make = (makeFromApi || makeFromTitle || slugInfo.make || 'Unknown').toUpperCase();

    const modelFromTitle = titleRegex ? titleRegex[3] : rawTitle;
    let model = modelFromTitle || slugInfo.model || 'Unknown';
    if (model.toUpperCase().startsWith(make)) model = model.slice(make.length).trim();
    if (!model || model.toUpperCase() === make) model = slugInfo.model || 'Unknown';

    const titleStatus =
      lot?.td || lot?.tdn ||
      slugInfo.titleHint ||
      (rawTitle.toLowerCase().includes('clean') ? 'Clean Title' : 'Unknown');

    const parseUsd = (v: number | undefined): number | undefined =>
      v && v > 0 ? Math.round(v) : undefined;

    const currentBid = lot?.dynamicLotDetails?.currentBid ?? lot?.hb;

    const photos = images
      .slice(0, 12)
      .map((img) => ({
        url: (img.fullUrl || img.url || '').replace(/_thb\./, '_ful.'),
        caption: img.imageLabelCode ?? '',
      }))
      .filter((p) => p.url.startsWith('http'));

    return {
      source: 'copart-us',
      lotNumber,
      vin: lot?.fv && !lot.fv.includes('*') ? lot.fv : undefined,
      year,
      make,
      model: model.toUpperCase(),
      odometerMiles: lot?.orr ?? 0,
      primaryDamage: lot?.dd || (slugInfo.titleHint.includes('Clean') ? 'NONE' : 'Unknown'),
      secondaryDamage: lot?.sdd || undefined,
      titleStatus,
      estRetailUsd: parseUsd(lot?.la),
      currentBidUsd: parseUsd(currentBid),
      photos,
      location: lot?.lnm || lot?.sy || 'USA',
    };
  } finally {
    await browser.close();
  }
}
