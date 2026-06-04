import { nanoid } from 'nanoid';
import { scrapeListing as scrapeCopartUs } from './scrapers/copart-us';
import { scrapeListing as scrapeCopartUk } from './scrapers/copart-uk';
import { scrapeListing as scrapeABetterBid } from './scrapers/abetterbid';
import { analyzePhotos } from './ai/analyze-photos';
import { fetchKnownIssues } from './ai/known-issues';
import { analyzeMechanicalFailure, detectNonRunner } from './ai/analyze-mechanical';
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
  const isNonRunner = detectNonRunner(listing);

  const { rate, date } = getExchangeRate();

  // 2. Photo analysis + resale + known issues + NHTSA recalls + mechanical scenarios — all in parallel.
  // Each is wrapped with .catch() so a single failure doesn't abort the others
  // (Node.js 24 terminates on unhandled rejections from Promise.all race conditions).
  const [damage, resale, knownIssues, recalls, mechanicalScenarios] = await Promise.all([
    analyzePhotos(listing.photos, url).catch(() => ({
      photos: [], criticalFlags: { deployedAirbag: false, frameDamage: false, floodWaterline: false, fireDamage: false, theftStrip: false, nonRunner: false },
      overallSeverity: 'cosmetic' as const, damagedPanels: [],
    })),
    estimateResale(listing, rate),
    fetchKnownIssues(listing.make, listing.model, listing.year).catch(() => []),
    isUkSource
      ? Promise.resolve([])
      : fetchNhtsaRecalls(listing.make, listing.model, listing.year).catch(() => []),
    isNonRunner
      ? analyzeMechanicalFailure(listing).catch(() => [])
      : Promise.resolve([]),
  ]);

  // Flag the non-runner status on the damage object — photos cannot detect this
  if (isNonRunner) damage.criticalFlags.nonRunner = true;

  // 3. Cost model + ownership costs (deterministic, instant)
  const cost = buildCostBreakdown({ listing, damage, exchangeRate: rate, exchangeRateDate: date });
  const ownershipCosts = estimateOwnershipCosts(listing, resale.ceilingGbp);

  // 4. AI synthesis. UK comps (fetchSimilarLots / fetchSoldComps) are disabled:
  // they each require a sequential Browserbase session (~20s each) which pushes
  // the total pipeline past Vercel Hobby's 60s function limit.
  const synthesis = await synthesizeReport(listing, damage, cost, resale, isNonRunner);

  const similarLots: never[] = [];
  const soldComps: never[] = [];

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
    mechanicalScenarios: mechanicalScenarios.length > 0 ? mechanicalScenarios : undefined,
    similarLots: similarLots.length > 0 ? similarLots : undefined,
    soldComps: soldComps.length > 0 ? soldComps : undefined,
    recalls: recalls.length > 0 ? recalls : undefined,
    ownershipCosts,
    userId: userId || undefined,
  };

  await saveReport(report);
  return { slug, report };
}
