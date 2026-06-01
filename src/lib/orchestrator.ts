import { nanoid } from 'nanoid';
import { scrapeListing as scrapeCopartUs } from './scrapers/copart-us';
import { scrapeListing as scrapeCopartUk } from './scrapers/copart-uk';
import { scrapeListing as scrapeABetterBid } from './scrapers/abetterbid';
import { analyzePhotos } from './ai/analyze-photos';
import { fetchKnownIssues } from './ai/known-issues';
import { buildCostBreakdown } from './cost-model';
import { estimateResale } from './resale-model';
import { synthesizeReport } from './ai/synthesize-report';
import { fetchSimilarLots } from './scrapers/copart-uk-search';
import { fetchSoldComps } from './scrapers/copart-uk-sold';
import { fetchNhtsaRecalls } from './recalls/nhtsa';
import { estimateOwnershipCosts } from './ownership-costs';
import { saveReport } from './supabase';
import type { BuyerLocation, Listing, Report } from '@/types';

function getExchangeRate() {
  return {
    rate: parseFloat(process.env.USD_TO_GBP_RATE || '1.27'),
    date: process.env.USD_TO_GBP_DATE || new Date().toISOString().split('T')[0],
  };
}

function getScraper(url: string): (url: string) => Promise<Listing> {
  if (url.includes('abetter.bid')) return scrapeABetterBid;
  if (url.includes('copart.co.uk')) return scrapeCopartUk;
  // Copart US is behind Incapsula — use A Better Bid mirror (same lots, no bot protection)
  // ABB scraper detects copart.com URLs and redirects internally to abetter.bid/en/lot/{id}
  return async (copartUrl: string) => {
    const listing = await scrapeABetterBid(copartUrl);
    return { ...listing, source: 'copart-us' as const };
  };
}

/** Run the full analysis pipeline for a given listing URL. Returns the report slug. */
export async function runAnalysis(url: string, buyerLocation: BuyerLocation = 'uk', userId?: string): Promise<{ slug: string; report: Report }> {
  // 1. Scrape
  const scrape = getScraper(url);
  const listing = await scrape(url);

  const isUkSource = listing.source === 'copart-uk';

  const { rate, date } = getExchangeRate();

  // 2. Photo analysis + resale + known issues + NHTSA recalls — all in parallel.
  // Each is wrapped with .catch() so a single failure doesn't abort the others
  // (Node.js 24 terminates on unhandled rejections from Promise.all race conditions).
  const [damage, resale, knownIssues, recalls] = await Promise.all([
    analyzePhotos(listing.photos, url).catch(() => ({
      photos: [], criticalFlags: { deployedAirbag: false, frameDamage: false, floodWaterline: false, fireDamage: false, theftStrip: false },
      overallSeverity: 'cosmetic' as const, damagedPanels: [],
    })),
    estimateResale(listing, rate),
    fetchKnownIssues(listing.make, listing.model, listing.year).catch(() => []),
    isUkSource
      ? Promise.resolve([])
      : fetchNhtsaRecalls(listing.make, listing.model, listing.year).catch(() => []),
  ]);

  // 3. Cost model + ownership costs (deterministic, instant)
  const cost = buildCostBreakdown({ listing, damage, exchangeRate: rate, exchangeRateDate: date });
  const ownershipCosts = estimateOwnershipCosts(listing, resale.ceilingGbp);

  // 4. AI synthesis first, then optional Browserbase comps sequentially to avoid
  // concurrent session limits on Browserbase free tier.
  const synthesis = await synthesizeReport(listing, damage, cost, resale);

  const similarLots = isUkSource
    ? await fetchSimilarLots(listing.make, listing.model, listing.lotNumber).catch(() => [])
    : [];
  const soldComps = isUkSource
    ? await fetchSoldComps(listing.make, listing.model, listing.lotNumber).catch(() => [])
    : [];

  // 5. Persist
  const slug = nanoid(10);
  const report: Report = {
    id: '',
    slug,
    createdAt: new Date().toISOString(),
    buyerLocation,
    listing,
    damage,
    cost,
    resale,
    verdict: synthesis.verdict,
    summary: synthesis.summary,
    sections: synthesis.sections,
    verdictConfidence: synthesis.verdictConfidence,
    knownIssues: knownIssues.length > 0 ? knownIssues : undefined,
    similarLots: similarLots.length > 0 ? similarLots : undefined,
    soldComps: soldComps.length > 0 ? soldComps : undefined,
    recalls: recalls.length > 0 ? recalls : undefined,
    ownershipCosts,
    userId: userId || undefined,
  };

  await saveReport(report);
  return { slug, report };
}
