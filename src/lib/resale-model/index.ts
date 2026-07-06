import type { Listing, ResaleEstimate } from '@/types';
import { LHD_PENALTIES, TITLE_PENALTIES, ACCIDENT_PENALTY } from '@/lib/cost-model/defaults';
import { fetchAutotraderMedian } from './autotrader';

/**
 * Fallback UK resale base values (GBP) for common Copart imports.
 * Used when AutoTrader returns no results. Clean-title, RHD-equivalent averages.
 */
const BASE_VALUES: Record<string, number> = {
  'ford mustang': 28000,
  'ford f-150': 35000,
  'ford f-250': 42000,
  'ford explorer': 22000,
  'ford edge': 18000,
  'ford escape': 14000,
  'chevrolet corvette': 55000,
  'chevrolet camaro': 24000,
  'chevrolet silverado': 32000,
  'chevrolet tahoe': 30000,
  'chevrolet suburban': 32000,
  'dodge challenger': 26000,
  'dodge charger': 22000,
  'dodge ram': 30000,
  'dodge durango': 24000,
  'jeep wrangler': 32000,
  'jeep grand cherokee': 22000,
  'ram 1500': 30000,
  'ram 2500': 38000,
  'tesla model 3': 26000,
  'tesla model s': 38000,
  'tesla model x': 55000,
  'tesla model y': 32000,
  'bmw m3': 48000,
  'bmw m4': 52000,
  'porsche 911': 80000,
  'porsche cayenne': 45000,
  'land rover defender': 55000,
  'land rover discovery': 32000,
  'gmc sierra': 30000,
  'gmc yukon': 32000,
};

const DEFAULT_BASE = 15000;

export type VehicleCategory = 'car' | 'truck_suv' | 'van';

export function categorise(listing: Listing): VehicleCategory {
  const m = listing.model.toLowerCase();
  const truckKeywords = [
    'f-150', 'f-250', 'f-350', 'silverado', 'ram', 'tundra', 'tahoe',
    'suburban', 'yukon', 'expedition', 'navigator', 'wrangler', 'cherokee',
    'explorer', 'bronco', 'escalade', 'sierra', 'canyon', 'tacoma', 'ranger',
  ];
  if (truckKeywords.some((k) => m.includes(k))) return 'truck_suv';
  return 'car';
}

function lookupFallback(listing: Listing): number {
  const key = `${listing.make} ${listing.model}`.toLowerCase();
  if (BASE_VALUES[key]) return BASE_VALUES[key];
  for (const [k, v] of Object.entries(BASE_VALUES)) {
    if (key.includes(k) || k.includes(key.split(' ').slice(0, 2).join(' '))) return v;
  }
  return DEFAULT_BASE;
}

function applyPenalties(
  baseValueGbp: number,
  listing: Listing,
  category: VehicleCategory,
  skipLhd = false
): { value: number; penalties: ResaleEstimate['penalties'] } {
  const penalties: ResaleEstimate['penalties'] = [];
  let value = baseValueGbp;

  // LHD penalty (all US imports; skip for UK-sourced RHD vehicles)
  if (!skipLhd) {
    const lhdPenalty = LHD_PENALTIES[category];
    penalties.push({ label: `LHD (${category})`, multiplier: lhdPenalty });
    value *= 1 - lhdPenalty;
  }

  // Title brand penalty
  const title = listing.titleStatus.toLowerCase();
  if (title.includes('salvage') || title.includes('rebuilt')) {
    penalties.push({ label: 'Salvage/rebuilt title', multiplier: TITLE_PENALTIES.salvage });
    value *= 1 - TITLE_PENALTIES.salvage;
  } else if (title.includes('cat s')) {
    penalties.push({ label: 'Cat S', multiplier: TITLE_PENALTIES.catS });
    value *= 1 - TITLE_PENALTIES.catS;
  } else if (title.includes('cat n') || title.includes('n repairable')) {
    penalties.push({ label: 'Cat N', multiplier: TITLE_PENALTIES.catN });
    value *= 1 - TITLE_PENALTIES.catN;
  }

  // Accident history (compounding)
  const accidents = listing.history?.accidents ?? 0;
  if (accidents > 0) {
    const compounded = 1 - Math.pow(1 - ACCIDENT_PENALTY, accidents);
    penalties.push({ label: `${accidents} recorded accident(s)`, multiplier: compounded });
    value *= 1 - compounded;
  }

  // Mileage adjustment: -1% per 10k miles over 50k, capped at -30%
  const excessMiles = Math.max(0, listing.odometerMiles - 50000);
  const mileagePenalty = Math.min(0.30, Math.floor(excessMiles / 10000) * 0.01);
  if (mileagePenalty > 0) {
    penalties.push({ label: `High mileage (${listing.odometerMiles.toLocaleString()} mi)`, multiplier: mileagePenalty });
    value *= 1 - mileagePenalty;
  }

  return { value: Math.round(value), penalties };
}

/**
 * For US imports: derive a UK retail estimate from Copart's USD estimated retail.
 * Copart's `la` is roughly equivalent to Manheim MMR (auction wholesale), which is
 * ~80–85% of US retail MSRP. UK grey import retail tracks US retail at ~70–80%
 * depending on desirability. We use a conservative 0.72 conversion factor.
 * Rate is EXCLUDED from this calculation — caller divides by exchange rate separately.
 */
function estimateUkBaseFromUsRetail(estRetailUsd: number, exchangeRate: number): number {
  return Math.round((estRetailUsd * 0.72) / exchangeRate);
}

/** Predict UK resale ceiling. */
export async function estimateResale(listing: Listing, exchangeRate = 1.27): Promise<ResaleEstimate> {
  const category = categorise(listing);
  const isUkSource = listing.source === 'copart-uk';

  // For UK-sourced lots: Copart's estRetailUsd IS the CAP Clean value for this specific
  // year/mileage/spec — more accurate than AutoTrader which searches across all years.
  if (isUkSource && listing.estRetailUsd) {
    const capCleanGbp = listing.estRetailUsd; // stored in GBP for UK lots
    const { value, penalties } = applyPenalties(capCleanGbp, listing, category, true);
    return {
      ceilingGbp: value,
      baseValueGbp: capCleanGbp,
      penalties,
      confidence: 'high',
      priceSource: 'cap-clean',
      capCleanGbp,
    };
  }

  // For non-UK lots: try AutoTrader live prices (8s timeout — Vercel Hobby limit is 60s total)
  const live = await Promise.race([
    fetchAutotraderMedian(listing.make, listing.model, listing.year),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);

  if (live) {
    const { value, penalties } = applyPenalties(live.medianGbp, listing, category, isUkSource);
    return {
      ceilingGbp: value,
      baseValueGbp: live.medianGbp,
      penalties,
      confidence: live.sampleSize >= 10 ? 'high' : 'medium',
      priceSource: 'autotrader-live',
      autotraderSampleSize: live.sampleSize,
      comparables: live.comparables.length > 0 ? live.comparables : undefined,
      autotraderSearchUrl: live.searchUrl,
    };
  }

  // Second fallback: derive from Copart's US retail estimate if available
  // More accurate than hardcoded table for high-value or unusual trims
  if (listing.estRetailUsd && listing.estRetailUsd > 5000) {
    const baseValueGbp = estimateUkBaseFromUsRetail(listing.estRetailUsd, exchangeRate);
    const { value, penalties } = applyPenalties(baseValueGbp, listing, category, isUkSource);
    return {
      ceilingGbp: value,
      baseValueGbp,
      penalties,
      confidence: 'medium',
      priceSource: 'estimated',
    };
  }

  // Final fallback: hardcoded table
  const baseValueGbp = lookupFallback(listing);
  const { value, penalties } = applyPenalties(baseValueGbp, listing, category, isUkSource);
  const hasExactMatch = !!BASE_VALUES[`${listing.make} ${listing.model}`.toLowerCase()];

  return {
    ceilingGbp: value,
    baseValueGbp,
    penalties,
    confidence: hasExactMatch ? 'medium' : 'low',
    priceSource: 'estimated',
  };
}
