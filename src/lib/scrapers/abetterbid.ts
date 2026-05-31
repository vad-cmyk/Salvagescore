import { chromium } from 'playwright';
import type { Listing } from '@/types';

/**
 * Scrape an A Better Bid lot page (abetter.bid).
 *
 * Accepts either:
 *   - abetter.bid URLs:  https://abetter.bid/en/lot/91489975
 *   - copart.com URLs:  https://www.copart.com/lot/91489975/...
 *     → automatically redirected to the ABB mirror
 *
 * ABB mirrors all Copart US lots without Incapsula bot protection.
 */
export async function scrapeListing(url: string): Promise<Listing> {
  // For copart.com URLs, extract lot number and redirect to ABB mirror
  let targetUrl = url;
  if (url.includes('copart.com')) {
    const lotMatch = url.match(/\/lot\/(\d+)/i);
    if (!lotMatch) throw new Error(`Cannot extract lot number from copart.com URL: ${url}`);
    targetUrl = `https://abetter.bid/en/lot/${lotMatch[1]}`;
  }

  const browser = process.env.BROWSERBASE_API_KEY
    ? await chromium.connectOverCDP(
        `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}`
      )
    : await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Scroll down a bit to trigger lazy-loaded carousel images
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);

    const data = await page.evaluate(() => {
      // --- JSON-LD Car schema (primary source when available) ---
      let carSchema: Record<string, unknown> = {};
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try {
          const json = JSON.parse(s.textContent || '');
          if (json['@type'] === 'Car') carSchema = json;
        } catch {}
      });

      // --- Photos from img.big_images-img ---
      // ABB proxies Copart CDN images through img.abetter.bid; decode the original URL
      const decodeAbbProxy = (src: string): string => {
        const cdnMatch = src.match(/cs\.copart\.com[^"')&\s]+/);
        if (cdnMatch) {
          const decoded = decodeURIComponent(cdnMatch[0]);
          // Prefer high-res (_hrs) or full (_ful) over thumbnail
          return 'https://' + decoded.replace(/_thb\./, '_ful.');
        }
        return src;
      };
      const photos = Array.from(document.querySelectorAll('img.big_images-img, [class*="gallery"] img, [class*="carousel"] img, .thumbnail img'))
        .map((img) => {
          const raw = (img as HTMLImageElement).src || (img as HTMLImageElement).dataset.src || '';
          return { url: decodeAbbProxy(raw), caption: (img as HTMLImageElement).alt || '' };
        })
        .filter((p) => p.url && !p.url.includes('no-photo') && p.url.startsWith('http'));

      // --- Full body text for text-based extraction ---
      const bodyText = document.body.innerText;

      // --- Structured detail extraction ---
      const getDetailFromText = (label: string): string => {
        const regex = new RegExp(label + '[:\\s]*([^\\n]+)', 'i');
        const m = bodyText.match(regex);
        return m ? m[1].trim().replace(/\s+/g, ' ') : '';
      };

      // Odometer
      const odoMatch = bodyText.match(/(\d[\d,]+)\s*mi\.\s*(?:Actual|Exempt|Not Actual)?/i);
      const odometer = odoMatch ? odoMatch[1] : '';

      // Estimated retail value: "Est. Retail Value $73,416 USD"
      const retailMatch = bodyText.match(/Est\.?\s*Retail\s*Value\s*\$?([\d,]+)/i);
      const estRetailUsd = retailMatch ? parseInt(retailMatch[1].replace(/,/g, '')) : undefined;

      // Current bid: "Current Bid: $X" or "Current Bid $X"
      const bidMatch = bodyText.match(/Current Bid[:\s]*\$?([\d,]+)/i);
      const currentBidUsd = bidMatch ? parseInt(bidMatch[1].replace(/,/g, '')) : undefined;

      // Lot number from URL
      const lotMatch = window.location.pathname.match(/\/(\d{7,12})/);

      // Location from Event JSON-LD
      let location = '';
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try {
          const json = JSON.parse(s.textContent || '');
          if (json['@type'] === 'Event' && json.location?.address) {
            const a = json.location.address;
            location = `${a.addressLocality}, ${a.addressRegion}`;
          }
        } catch {}
      });

      // Auction / sale date: "Sale Date: 05/28/2026" or "Auction Date: ..."
      const saleDateMatch = bodyText.match(/(?:Sale|Auction)\s+Date[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      const auctionDateRaw = saleDateMatch ? saleDateMatch[1] : '';

      return {
        carSchema,
        photos,
        odometer,
        lotNumber: lotMatch?.[1] ?? '',
        location,
        estRetailUsd,
        currentBidUsd,
        primaryDamage: getDetailFromText('Primary Damage'),
        secondaryDamage: getDetailFromText('Secondary Damage'),
        titleCode: getDetailFromText('Title Code'),
        pageTitle: document.title,
        bodyText: bodyText.slice(0, 2000),
        auctionDateRaw,
      };
    });

    // ── Parse year / make / model ──────────────────────────────────────────────────────────
    // Primary: JSON-LD Car schema name — "2025 GMC SIERRA K1500 DENALI ULTIMATE"
    // Fallback: page title — "2025 GMC Sierra 6.2L 8 for Sale in Houston (TX)"
    const rawName = (data.carSchema.name as string) || '';
    let nameParts = rawName.match(/^(\d{4})\s+(\S+)\s+(.+)$/i);
    if (!nameParts) {
      // Try page title: "2025 GMC Sierra 6.2L 8 for Sale..."
      const titleWithoutSuffix = (data.pageTitle as string || '').replace(/\s*for Sale.*/i, '').trim();
      nameParts = titleWithoutSuffix.match(/^(\d{4})\s+(\S+)\s+(.+)$/i);
    }

    const year = nameParts ? parseInt(nameParts[1]) : 0;
    const make = nameParts ? nameParts[2].toUpperCase() : 'Unknown';
    const modelFull = nameParts ? nameParts[3].toUpperCase() : 'Unknown';

    // Strip engine size suffix from model: "SIERRA 6.2L 8" → model=SIERRA
    const modelWords = modelFull.split(/\s+/);
    const firstEngineIdx = modelWords.findIndex((w) => /^\d+\.\d/.test(w));
    const trimStart = firstEngineIdx > 0 ? firstEngineIdx : modelWords.length;
    const model = modelWords.slice(0, trimStart).join(' ') || modelWords[0] || 'Unknown';
    const trim = modelWords.slice(trimStart).join(' ') || undefined;

    const vin = (data.carSchema.vehicleIdentificationNumber as string) || undefined;
    const parseMiles = (s: string) => (s ? parseInt(s.replace(/[^0-9]/g, '')) || 0 : 0);

    // Use JSON-LD images (full resolution) if available, else fall back to DOM photos
    const schemaImages = (data.carSchema.image as string[] | undefined) ?? [];
    const photos =
      schemaImages.length > 0
        ? schemaImages.slice(0, 12).map((u) => ({ url: u, caption: '' }))
        : (data.photos as { url: string; caption: string }[]).slice(0, 12);

    // Auction date: MM/DD/YYYY → ISO 8601
    let auctionDate: string | undefined;
    const rawDate = data.auctionDateRaw as string;
    if (rawDate) {
      const [mm, dd, yyyy] = rawDate.split('/');
      const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
      if (!isNaN(parsed.getTime())) auctionDate = parsed.toISOString();
    }

    // Clean up damage / title fields
    const primaryDamage = (data.primaryDamage as string || 'Unknown').replace(/\s*[-–]\s*$/, '').trim() || 'Unknown';
    const secondaryDamage = data.secondaryDamage && (data.secondaryDamage as string) !== '-' ? data.secondaryDamage as string : undefined;

    // Title code may be masked ("*****") when user isn't logged in — use URL slug as fallback
    const rawTitleCode = (data.titleCode as string || '').replace(/\s*\*+\s*$/, '').trim();
    let titleStatus = rawTitleCode || '';
    if (!titleStatus || /^\*+$/.test(rawTitleCode)) {
      // Parse from original URL slug (works for copart.com URLs like "clean-title-2025-...")
      const slug = url.toLowerCase();
      if (slug.includes('clean-title') || slug.includes('clean title')) titleStatus = 'Clean Title';
      else if (slug.includes('salvage')) titleStatus = 'Salvage';
      else titleStatus = 'Salvage'; // safe default for US lots
    }

    return {
      source: 'abetterbid',
      lotNumber: (data.lotNumber as string) || targetUrl.match(/\/(\d{7,12})/)?.[1] || 'unknown',
      vin,
      year,
      make,
      model,
      trim,
      odometerMiles: parseMiles(data.odometer as string),
      primaryDamage,
      secondaryDamage,
      titleStatus,
      estRetailUsd: data.estRetailUsd as number | undefined,
      currentBidUsd: data.currentBidUsd as number | undefined,
      photos,
      location: (data.location as string) || 'Unknown',
      auctionDate,
    };
  } finally {
    await browser.close();
  }
}
