import type { Listing, OwnershipCosts } from '@/types';

type FuelType = OwnershipCosts['fuelType'];

function detectFuelType(make: string, model: string, engine?: string): FuelType {
  const txt = `${make} ${model} ${engine ?? ''}`.toLowerCase();
  if (
    txt.includes('electric') || txt.includes(' ev') || txt.includes('bev') ||
    txt.includes('ioniq') || txt.includes('leaf') || txt.includes('zoe') ||
    txt.includes('mach-e') || txt.includes('tesla') || txt.includes('i3') ||
    txt.includes('e-tron') || txt.includes('id.') || txt.includes('model 3') ||
    txt.includes('model s') || txt.includes('model x') || txt.includes('model y')
  ) return 'electric';

  if (
    txt.includes('hybrid') || txt.includes('phev') || txt.includes('hev') ||
    txt.includes('prius') || txt.includes('plug-in')
  ) return 'hybrid';

  if (
    txt.includes('tdi') || txt.includes('cdi') || txt.includes('cdti') ||
    txt.includes('hdi') || txt.includes('jtd') || txt.includes('dci') ||
    txt.includes('td ') || txt.includes('diesel') || txt.includes(' d ') ||
    txt.includes(' d5') || txt.includes(' d4') || txt.includes('2.0d') ||
    txt.includes('1.6d') || txt.includes('3.0d')
  ) return 'diesel';

  return 'petrol';
}

/** Estimate UK VED (road tax) band label and annual cost. Year is model year used as first-reg proxy. */
function estimateVed(year: number, fuelType: FuelType): { band: string; annualGbp: number } {
  if (fuelType === 'electric') {
    // From April 2025 EVs pay standard rate; before that they were exempt
    return year >= 2025
      ? { band: 'EV (standard rate from 2025)', annualGbp: 190 }
      : { band: 'EV (exempt pre-2025)', annualGbp: 0 };
  }

  if (year >= 2017) {
    // Post-April 2017: £190/year standard rate for most cars
    // Luxury supplement (>£40k list price) is £410 extra — we don't have list price so ignore
    const extra = fuelType === 'diesel' ? 10 : 0; // diesel surcharge in year 1 only; we show ongoing
    return { band: `Post-2017 standard${extra ? ' (diesel)' : ''}`, annualGbp: 190 + extra };
  }

  if (year >= 2006) {
    // 2006-2017: CO2 bands. Estimate mid-range based on fuel type.
    if (fuelType === 'diesel') return { band: 'Band F–G (est. ~180 g/km CO₂)', annualGbp: 180 };
    return { band: 'Band E–F (est. ~155 g/km CO₂)', annualGbp: 155 };
  }

  if (year >= 2001) {
    // Early CO2 banding — assume higher-emitting
    return { band: 'Band G–H (est. ~210 g/km CO₂)', annualGbp: 265 };
  }

  // Pre-2001: engine-cc based, assume >1549cc
  return { band: 'Pre-2001 (>1549cc est.)', annualGbp: 330 };
}

/** Estimate UK insurance group (1–50) from resale ceiling. */
function estimateInsuranceGroup(resaleCeilingGbp: number): number {
  if (resaleCeilingGbp < 4_000)  return 12;
  if (resaleCeilingGbp < 8_000)  return 18;
  if (resaleCeilingGbp < 15_000) return 25;
  if (resaleCeilingGbp < 25_000) return 33;
  if (resaleCeilingGbp < 40_000) return 40;
  return 46;
}

/** Rough annual insurance premium estimate from group (1–50). */
function insurancePremiumFromGroup(group: number): number {
  // UK average premium ~£627/year (ABI 2024). Group scales it.
  // Group 25 ≈ £650. Roughly £26/group, anchored at group 25.
  return Math.round(650 + (group - 25) * 40);
}

/** Annual UK fuel cost estimate based on fuel type and 10,000 mi/year. */
function estimateFuelCost(fuelType: FuelType): number {
  switch (fuelType) {
    case 'electric': return 800;   // 10k mi ÷ 3.5 mi/kWh × £0.28/kWh
    case 'hybrid':   return 950;   // blended consumption assumption
    case 'diesel':   return 1_480; // 10k mi ÷ 45 mpg × 4.546L/gal × £1.62/L
    case 'petrol':
    default:         return 1_850; // 10k mi ÷ 36 mpg × 4.546L/gal × £1.50/L
  }
}

/**
 * Estimate annual UK running costs for a vehicle based on available listing data.
 * All figures are estimates — shown with appropriate caveats on the report.
 */
export function estimateOwnershipCosts(listing: Listing, resaleCeilingGbp: number): OwnershipCosts {
  const fuelType = detectFuelType(listing.make, listing.model, listing.engine);
  const { band, annualGbp: annualVedGbp } = estimateVed(listing.year, fuelType);
  const insuranceGroup = estimateInsuranceGroup(resaleCeilingGbp);
  const annualInsuranceEstimateGbp = insurancePremiumFromGroup(insuranceGroup);
  const annualFuelGbp = estimateFuelCost(fuelType);
  const assumedMilesPerYear = 10_000;

  return {
    annualVedGbp,
    vedBand: band,
    insuranceGroupEstimate: insuranceGroup,
    annualInsuranceEstimateGbp,
    annualFuelGbp,
    annualTotalGbp: annualVedGbp + annualInsuranceEstimateGbp + annualFuelGbp,
    fuelType,
    assumedMilesPerYear,
  };
}
