import type { CostBreakdown, CostLineItem, DamageFindings, HiddenRepairItem, Listing, RepairLineItem } from '@/types';
import {
  COPART_UK_ADMIN_FEE_GBP,
  COPART_UK_GATE_FEES,
  COPART_UK_INTERNET_BID_PCT,
  COST_DEFAULTS,
  HIDDEN_DAMAGE_CONTINGENCY_PCT,
  PANEL_BASE_COST_GBP,
  PANEL_LABELS,
  PANEL_UNKNOWN_COST_GBP,
  REPAIR_MULTIPLIERS,
  SEVERITY_COST_FRACTION,
} from './defaults';
import type { DamageSeverity } from '@/types';

/** Convert USD to GBP using the configured static rate. */
export function usdToGbp(usd: number, rate: number): number {
  return Math.round(usd / rate);
}

/** Compute UK customs duty on the CIF value. */
export function computeDuty(cifGbp: number): number {
  return Math.round(cifGbp * COST_DEFAULTS.dutyRate);
}

/** Compute UK VAT on (CIF + duty). */
export function computeVat(cifGbp: number, dutyGbp: number): number {
  return Math.round((cifGbp + dutyGbp) * COST_DEFAULTS.vatRate);
}

/**
 * Calculate real Copart UK buyer fees for a given hammer price.
 * Structure: tiered gate fee + 5% internet bid fee + admin fee, all + 20% VAT.
 */
export function copartUkBuyerFees(hammerGbp: number): number {
  const gateFee = COPART_UK_GATE_FEES.filter(([min]) => hammerGbp >= min).at(-1)?.[1] ?? 25;
  const internetFee = Math.max(50, Math.round(hammerGbp * COPART_UK_INTERNET_BID_PCT));
  const subtotal = gateFee + internetFee + COPART_UK_ADMIN_FEE_GBP;
  return Math.round(subtotal * (1 + COST_DEFAULTS.vatRate));
}

/**
 * Map a panel slug to its primary zone so we can look up the observed severity.
 * Panels not listed default to the overall severity.
 */
const PANEL_TO_ZONE: Record<string, string> = {
  'bonnet': 'front', 'front-bumper': 'front', 'front-wing': 'front',
  'inner-wing': 'front', 'radiator': 'front', 'condenser': 'front',
  'headlight': 'front', 'grille': 'front', 'fog-light': 'front', 'indicator': 'front',
  'rear-bumper': 'rear', 'tailgate': 'rear', 'trunk-lid': 'rear',
  'taillight': 'rear', 'exhaust': 'rear',
  'front-door': 'side-lh', 'rear-door': 'side-lh', 'sill': 'side-lh',
  'mirror': 'side-lh', 'rear-quarter': 'side-lh', 'running-board': 'side-lh',
  'wheel-arch-liner': 'side-lh', 'side-glass': 'side-lh', 'spoiler': 'rear',
  'roof': 'roof', 'sunroof-glass': 'roof',
  'dashboard': 'interior', 'seat-driver': 'interior', 'seat-passenger': 'interior',
  'carpet': 'interior', 'headliner': 'interior', 'steering-wheel': 'interior',
  'airbag-module': 'interior', 'windscreen': 'front', 'rear-screen': 'rear',
  'firewall': 'engine-bay', 'floor-pan': 'undercarriage', 'subframe': 'undercarriage',
  'suspension-component': 'undercarriage', 'frame-rail': 'undercarriage',
  'a-pillar': 'front', 'b-pillar': 'side-lh', 'c-pillar': 'rear',
};

/** Return the worst observed severity for a given zone across all analysed photos. */
function zoneSeverity(damage: DamageFindings, zone: string): DamageSeverity {
  const SEV_ORDER: DamageSeverity[] = ['cosmetic', 'panel', 'structural', 'frame'];
  const photos = damage.photos.filter((p) => p.zone === zone);
  if (photos.length === 0) return damage.overallSeverity;
  return photos.reduce<DamageSeverity>((worst, p) => {
    return SEV_ORDER.indexOf(p.severity) > SEV_ORDER.indexOf(worst) ? p.severity : worst;
  }, 'cosmetic');
}

/** Return the labour+parts cost multiplier for a given make. */
export function getRepairMultiplier(make: string): number {
  const m = make.toLowerCase();
  for (const tier of REPAIR_MULTIPLIERS) {
    if (tier.makes.some((name) => m.includes(name) || name.includes(m))) {
      return tier.multiplier;
    }
  }
  return 1.0;
}

/**
 * Build itemised visible repair line items.
 * Uses panel-level pricing when the AI identified specific panels;
 * falls back to severity buckets otherwise.
 * All costs are multiplied by the make-based repair multiplier.
 */
export function buildRepairLineItems(damage: DamageFindings, listing: Listing): RepairLineItem[] {
  const multiplier = getRepairMultiplier(listing.make);
  const items: RepairLineItem[] = [];

  if (damage.damagedPanels.length > 0) {
    for (const panel of damage.damagedPanels) {
      const base = PANEL_BASE_COST_GBP[panel] ?? PANEL_UNKNOWN_COST_GBP;
      const label = PANEL_LABELS[panel] ?? panel;
      const zone = PANEL_TO_ZONE[panel] ?? '';
      const sev = zoneSeverity(damage, zone);
      const sevFraction = SEVERITY_COST_FRACTION[sev] ?? 1.0;
      const workDesc = sev === 'cosmetic' ? 'repair & blend'
        : sev === 'panel' ? 'dent repair & respray'
        : 'supply, fit & paint';
      items.push({
        label: `${label} — ${workDesc}`,
        amountGbp: Math.round(base * multiplier * sevFraction),
      });
    }
  } else {
    // Detect "effectively no damage": photos analysed and all show damageType=none with no flags
    const noCriticalFlags = !Object.values(damage.criticalFlags).some(Boolean);
    const allPhotosClean =
      damage.photos.length > 0 &&
      damage.photos.every((p) => p.damageType === 'none') &&
      noCriticalFlags;
    const cleanTitleNoDamage =
      listing.primaryDamage &&
      /^(none|n\/a|clean|no damage)/i.test(listing.primaryDamage.trim());

    if (allPhotosClean || (damage.photos.length === 0 && cleanTitleNoDamage && noCriticalFlags)) {
      items.push({
        label: 'Pre-purchase inspection (no visible damage)',
        amountGbp: 200,
      });
    } else {
      const buckets: Record<DamageFindings['overallSeverity'], { label: string; cost: number }> = {
        cosmetic:   { label: 'Cosmetic repairs (scratches, dents, paint)',       cost: 800 },
        panel:      { label: 'Panel repairs and refinish',                        cost: 2500 },
        structural: { label: 'Structural repair (pillars, sills, subframe)',      cost: 6000 },
        frame:      { label: 'Frame / chassis straightening and repair',          cost: 12000 },
      };
      const b = buckets[damage.overallSeverity];
      items.push({ label: b.label, amountGbp: Math.round(b.cost * multiplier) });
    }
  }

  // Critical-flag surcharges
  if (damage.criticalFlags.deployedAirbag) {
    items.push({
      label: 'Deployed airbag(s) — modules, trim & clock-spring',
      amountGbp: Math.round(2000 * multiplier),
    });
  }
  if (damage.criticalFlags.floodWaterline) {
    items.push({
      label: 'Flood remediation — deep clean, electrics, carpets',
      amountGbp: 3500,
    });
  }
  if (damage.criticalFlags.fireDamage) {
    items.push({
      label: 'Fire damage remediation',
      amountGbp: 5000,
    });
  }
  if (damage.criticalFlags.theftStrip) {
    items.push({
      label: 'Theft recovery — missing components',
      amountGbp: 1500,
    });
  }

  return items;
}

/**
 * Estimate total visible repair cost (sum of buildRepairLineItems).
 * Kept for backwards-compatible usage and tests.
 */
export function estimateRepairGbp(damage: DamageFindings, listing: Listing): number {
  return buildRepairLineItems(damage, listing).reduce((s, i) => s + i.amountGbp, 0);
}

/**
 * Build a list of probable hidden damage items based on collision zone, severity, and critical flags.
 * Costs are ranges because these items are not directly visible in auction photos.
 */
export function buildHiddenRepairItems(damage: DamageFindings): HiddenRepairItem[] {
  const items: HiddenRepairItem[] = [];

  const hasFrontImpact = damage.photos.some(
    (p) => p.zone === 'front' && p.damageType === 'collision' && p.severity !== 'cosmetic'
  );
  const hasRearImpact = damage.photos.some(
    (p) => p.zone === 'rear' && p.damageType === 'collision'
  );
  const hasSideImpact = damage.photos.some(
    (p) => (p.zone === 'side-lh' || p.zone === 'side-rh') && p.damageType === 'collision'
  );
  const isStructural = damage.overallSeverity === 'structural' || damage.overallSeverity === 'frame';

  if (hasFrontImpact) {
    items.push({
      label: 'Radiator, condenser or intercooler damage',
      minGbp: 200, maxGbp: 800, likelihood: 'likely',
      reason: 'Front impacts commonly damage cooling system components hidden behind the bumper beam',
    });
    items.push({
      label: 'ADAS / radar sensor recalibration',
      minGbp: 200, maxGbp: 600, likelihood: 'likely',
      reason: 'Required after any front-end work on vehicles fitted with camera or radar systems',
    });
    items.push({
      label: 'Steering rack, tie rod or wheel alignment',
      minGbp: 250, maxGbp: 700, likelihood: 'possible',
      reason: 'Collision forces can transfer to steering geometry even without visible steering damage',
    });
  }

  if (hasRearImpact) {
    items.push({
      label: 'Exhaust system damage (section or full)',
      minGbp: 150, maxGbp: 500, likelihood: 'possible',
      reason: 'Rear impacts can buckle or crack exhaust components not visible in exterior photos',
    });
    items.push({
      label: 'Fuel tank or filler neck inspection',
      minGbp: 100, maxGbp: 400, likelihood: 'possible',
      reason: 'Rear collision energy can damage fuel system components in the boot floor area',
    });
  }

  if (hasSideImpact) {
    items.push({
      label: 'Door frame and impact bar inspection',
      minGbp: 150, maxGbp: 500, likelihood: 'possible',
      reason: 'Side impacts can deform the inner door frame and impact bars behind the outer skin',
    });
  }

  if (isStructural) {
    items.push({
      label: '4-wheel alignment and chassis geometry check',
      minGbp: 200, maxGbp: 500, likelihood: 'likely',
      reason: 'Structural damage requires full chassis measurement and 4-wheel alignment correction',
    });
    items.push({
      label: 'Suspension geometry correction',
      minGbp: 300, maxGbp: 1000, likelihood: 'likely',
      reason: 'Structural deformation can shift suspension pickup points out of specification',
    });
  }

  if (damage.criticalFlags.deployedAirbag) {
    items.push({
      label: 'Airbag deployment control module (DCM) replacement',
      minGbp: 400, maxGbp: 1200, likelihood: 'likely',
      reason: 'DCM records the crash event and typically requires replacement or professional reset',
    });
    items.push({
      label: 'Seat belt pre-tensioners (×2 minimum)',
      minGbp: 300, maxGbp: 600, likelihood: 'likely',
      reason: 'Pre-tensioners fire with airbags and cannot be reused — must be replaced',
    });
    items.push({
      label: 'Crash wiring connectors and harness repair',
      minGbp: 150, maxGbp: 500, likelihood: 'possible',
      reason: 'Harness connectors in airbag zones are often damaged during deployment',
    });
  }

  if (damage.criticalFlags.floodWaterline) {
    items.push({
      label: 'ECU / Body Control Module replacement',
      minGbp: 500, maxGbp: 2000, likelihood: 'likely',
      reason: 'Water ingress causes delayed failure in ECUs and BCMs — often weeks or months later',
    });
    items.push({
      label: 'Wiring harness inspection and repair',
      minGbp: 400, maxGbp: 1500, likelihood: 'likely',
      reason: 'Flood water causes long-term connector corrosion and insulation failure',
    });
    items.push({
      label: 'Wheel bearing replacement (×4)',
      minGbp: 400, maxGbp: 800, likelihood: 'possible',
      reason: 'Water contamination accelerates wheel bearing wear significantly',
    });
    items.push({
      label: 'HVAC system and heater matrix replacement',
      minGbp: 300, maxGbp: 800, likelihood: 'likely',
      reason: 'HVAC systems trap contaminants and develop mould after flood exposure',
    });
  }

  if (damage.criticalFlags.fireDamage) {
    items.push({
      label: 'Underbonnet wiring harness replacement',
      minGbp: 600, maxGbp: 2000, likelihood: 'likely',
      reason: 'Heat damage to engine bay wiring is rarely fully visible in photos',
    });
    items.push({
      label: 'Fuel and brake line inspection / replacement',
      minGbp: 300, maxGbp: 800, likelihood: 'likely',
      reason: 'Heat degrades rubber hoses and brake lines in and around fire zones',
    });
  }

  // Universal: diagnostic scan for any non-cosmetic damage
  if (damage.overallSeverity !== 'cosmetic' || Object.values(damage.criticalFlags).some(Boolean)) {
    items.push({
      label: 'Diagnostic scan and fault code clear',
      minGbp: 80, maxGbp: 200, likelihood: 'likely',
      reason: 'Crash and repair events store fault codes across multiple modules requiring professional clearing',
    });
  }

  return items;
}

function repairNote(damage: DamageFindings, listing: Listing): string {
  const multiplier = getRepairMultiplier(listing.make);
  const flags: string[] = [];
  if (damage.criticalFlags.deployedAirbag) flags.push('deployed airbag');
  if (damage.criticalFlags.floodWaterline) flags.push('flood damage');
  if (damage.criticalFlags.fireDamage)     flags.push('fire damage');
  if (damage.criticalFlags.theftStrip)     flags.push('theft strip');

  const panelPart = damage.damagedPanels.length > 0
    ? `${damage.damagedPanels.length} panels identified`
    : `${damage.overallSeverity} severity`;

  const multiplierNote = multiplier > 1.0 ? ` · ${multiplier}× ${listing.make} uplift` : '';
  const flagPart = flags.length ? ` + ${flags.join(', ')}` : '';

  return `${panelPart}${flagPart}${multiplierNote}`;
}

export type CostModelInputs = {
  listing: Listing;
  damage: DamageFindings;
  exchangeRate: number;
  exchangeRateDate: string;
};

/** Build the full UK landed cost breakdown. */
export function buildCostBreakdown(inputs: CostModelInputs): CostBreakdown {
  const { listing, damage, exchangeRate, exchangeRateDate } = inputs;
  const isUkSource = listing.source === 'copart-uk';

  const hammerGbp = isUkSource
    ? (listing.currentBidUsd ?? listing.buyItNowUsd ?? 0)
    : usdToGbp(listing.currentBidUsd ?? listing.buyItNowUsd ?? 0, exchangeRate);

  const repairLineItems = buildRepairLineItems(damage, listing);
  const hiddenRepairItems = buildHiddenRepairItems(damage);
  const repairSubtotalGbp = repairLineItems.reduce((s, i) => s + i.amountGbp, 0);
  const hiddenDamageContingencyGbp = Math.round(repairSubtotalGbp * HIDDEN_DAMAGE_CONTINGENCY_PCT);
  const repairTotalGbp = repairSubtotalGbp + hiddenDamageContingencyGbp;
  const note = repairNote(damage, listing);

  if (isUkSource) {
    const buyerFeesGbp = copartUkBuyerFees(hammerGbp);
    const lineItems: CostLineItem[] = [
      {
        label: 'Copart UK buyer fees',
        amountGbp: buyerFeesGbp,
        note: 'Gate fee + 5% internet bid fee + admin — all inc. VAT (estimate, verify on copart.co.uk)',
      },
      { label: 'Repair estimate', amountGbp: repairTotalGbp, note },
    ];
    return {
      hammerGbp,
      lineItems,
      repairLineItems,
      hiddenRepairItems,
      repairSubtotalGbp,
      hiddenDamageContingencyPct: HIDDEN_DAMAGE_CONTINGENCY_PCT,
      hiddenDamageContingencyGbp,
      totalGbp: hammerGbp + lineItems.reduce((s, i) => s + i.amountGbp, 0),
      exchangeRateUsed: 1,
      exchangeRateDate,
      assumptions: [
        'UK-sourced vehicle — no import costs applied',
        'Repair estimate is a guide — get quotes before bidding',
        `Hidden damage contingency: +${HIDDEN_DAMAGE_CONTINGENCY_PCT * 100}% of repair subtotal`,
      ],
    };
  }

  const cifGbp = hammerGbp + COST_DEFAULTS.usTransportAndOceanGbp;
  const dutyGbp = computeDuty(cifGbp);
  const vatGbp = computeVat(cifGbp, dutyGbp);

  const lineItems: CostLineItem[] = [
    {
      label: 'Broker + Copart fees',
      amountGbp: COST_DEFAULTS.brokerAndCopartFeesGbp,
      note: 'Typical UK broker + buyer fee bundle',
    },
    {
      label: 'US transport + ocean freight',
      amountGbp: COST_DEFAULTS.usTransportAndOceanGbp,
      note: 'Vehicle to US port + RORO shipping to UK',
    },
    {
      label: `UK duty (${COST_DEFAULTS.dutyRate * 100}%)`,
      amountGbp: dutyGbp,
      note: `${COST_DEFAULTS.dutyRate * 100}% of CIF value (£${cifGbp.toLocaleString()})`,
    },
    {
      label: `UK VAT (${COST_DEFAULTS.vatRate * 100}%)`,
      amountGbp: vatGbp,
      note: `${COST_DEFAULTS.vatRate * 100}% of CIF + duty`,
    },
    {
      label: 'Repair estimate',
      amountGbp: repairTotalGbp,
      note,
    },
    {
      label: 'IVA test + LHD mods + DVLA',
      amountGbp: COST_DEFAULTS.ivaAndLhdAndDvlaGbp,
      note: 'Applies to LHD imports; skip for UK-sourced vehicles',
    },
  ];

  const totalGbp = hammerGbp + lineItems.reduce((sum, item) => sum + item.amountGbp, 0);

  return {
    hammerGbp,
    lineItems,
    repairLineItems,
    hiddenRepairItems,
    repairSubtotalGbp,
    hiddenDamageContingencyPct: HIDDEN_DAMAGE_CONTINGENCY_PCT,
    hiddenDamageContingencyGbp,
    totalGbp,
    exchangeRateUsed: exchangeRate,
    exchangeRateDate,
    assumptions: [
      `Exchange rate: 1 GBP = ${exchangeRate} USD (as of ${exchangeRateDate})`,
      `UK duty rate: ${COST_DEFAULTS.dutyRate * 100}% (passenger cars from USA)`,
      'Shipping estimate assumes US East/Gulf Coast origin',
      'Repair estimate is a guide — get professional quotes before bidding',
      `Hidden damage contingency: +${HIDDEN_DAMAGE_CONTINGENCY_PCT * 100}% of repair subtotal`,
      'IVA/DVLA line assumes LHD import requiring individual vehicle approval',
    ],
  };
}
