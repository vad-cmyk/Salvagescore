/**
 * UK-calibrated condition adjustments for the live condition adjuster.
 * All percentages are tunable — update as market data changes.
 */

export type ConditionToggleId =
  | 'cat_b'
  | 'cat_s'
  | 'cat_n'
  | 'flood_damage'
  | 'fire_damage'
  | 'structural_damage'
  | 'airbags_deployed'
  | 'mechanical_fault'
  | 'theft_recovery'
  | 'prior_accident'
  | 'high_mileage';

export type ToggleState = Record<ConditionToggleId, boolean>;

export type ConditionAdjustmentDef = {
  label: string;
  /** Fractional reduction, e.g. 0.05 = −5% from resale ceiling */
  adjustmentPct: number;
  note: string;
  /** Cat B only — vehicle is parts-only, no resale value */
  partsOnly?: boolean;
};

// ── Constants — update as market data changes ─────────────────────────────────

export const CONDITION_ADJUSTMENTS: Record<ConditionToggleId, ConditionAdjustmentDef> = {
  // Title-based (most impactful first)
  cat_b:             { label: 'Cat B write-off',               adjustmentPct: 1.00, note: 'Cannot be returned to road — parts use only', partsOnly: true },
  cat_s:             { label: 'Cat S title',                   adjustmentPct: 0.25, note: 'Structural repair + insurer inspection required — see cost breakdown' },
  cat_n:             { label: 'Cat N title',                   adjustmentPct: 0.15, note: 'Non-structural damage — cosmetic repair + insurer notification required' },
  // Damage-based
  flood_damage:      { label: 'Flood / water damage',          adjustmentPct: 0.20, note: 'Delayed ECU and wiring harness failure risk significantly impacts value' },
  fire_damage:       { label: 'Fire damage',                   adjustmentPct: 0.25, note: 'Significant remediation typically required; stigma suppresses resale' },
  structural_damage: { label: 'Structural / chassis damage',   adjustmentPct: 0.10, note: 'Applies on top of Cat S penalty when both are present' },
  airbags_deployed:  { label: 'Airbags deployed',              adjustmentPct: 0.05, note: 'Modules, trim & clock-spring replacement required' },
  mechanical_fault:  { label: 'Engine / mechanical fault',     adjustmentPct: 0.12, note: 'Reduces resale ceiling — repair cost is modelled separately in the cost breakdown' },
  theft_recovery:    { label: 'Theft recovery marker',         adjustmentPct: 0.10, note: 'Affects insurance costs and future saleability on HPI-aware buyers' },
  // History-based
  prior_accident:    { label: 'Recorded prior accident(s)',    adjustmentPct: 0.08, note: 'Compounding −8% per recorded accident on HPI report' },
  high_mileage:      { label: 'High mileage vs model average', adjustmentPct: 0,    note: 'Dynamic — uses exact mileage from listing (−1% per 10k miles over 50k, max −30%)' },
};

/** Ordered list for display — most severe first. */
export const ALL_TOGGLE_IDS: ConditionToggleId[] = [
  'cat_b', 'cat_s', 'cat_n',
  'flood_damage', 'fire_damage', 'structural_damage', 'airbags_deployed',
  'mechanical_fault', 'theft_recovery',
  'prior_accident', 'high_mileage',
];

// ── Pure logic ────────────────────────────────────────────────────────────────

/** Compute the mileage penalty fraction (mirrors resale model logic). */
export function computeMileagePenalty(odometerMiles: number): number {
  const excessMiles = Math.max(0, odometerMiles - 50000);
  return Math.min(0.30, Math.floor(excessMiles / 10000) * 0.01);
}

/**
 * Apply active condition toggles multiplicatively to the clean base value.
 * Returns 0 if Cat B is selected (parts-only).
 *
 * @param baseGbp       — clean market base value (resale.baseValueGbp), before any penalties
 * @param toggles       — which condition toggles are active
 * @param accidentCount — recorded accident count (for prior_accident compounding)
 * @param mileagePenalty — fractional mileage penalty (0–0.30)
 */
export function applyConditionAdjustments(
  baseGbp: number,
  toggles: ToggleState,
  accidentCount: number,
  mileagePenalty: number,
): number {
  if (toggles.cat_b) return 0;
  let value = baseGbp;
  for (const id of ALL_TOGGLE_IDS) {
    if (!toggles[id] || id === 'cat_b') continue;
    if (id === 'prior_accident') {
      const compounded = 1 - Math.pow(1 - CONDITION_ADJUSTMENTS.prior_accident.adjustmentPct, accidentCount);
      value *= (1 - compounded);
    } else if (id === 'high_mileage') {
      value *= (1 - mileagePenalty);
    } else {
      value *= (1 - CONDITION_ADJUSTMENTS[id].adjustmentPct);
    }
  }
  return Math.round(value);
}

/**
 * Build the default toggle state from AI damage flags and listing data.
 * Pre-selects the conditions that are already detected/known.
 */
export function buildDefaultToggles(
  titleStatus: string,
  criticalFlags: {
    deployedAirbag: boolean;
    frameDamage: boolean;
    floodWaterline: boolean;
    fireDamage: boolean;
    theftStrip: boolean;
    nonRunner?: boolean;
  },
  accidents: number,
  mileagePenalty: number,
  isMileageAlreadyInBase: boolean, // true for CAP Clean sources — mileage baked in
): ToggleState {
  const title = titleStatus.toLowerCase();
  return {
    cat_b:             title.includes('cat b') || title.includes('category b'),
    cat_s:             title.includes('cat s') || title.includes('category s'),
    cat_n:             title.includes('cat n') || title.includes('category n') || title.includes('n repairable'),
    flood_damage:      criticalFlags.floodWaterline,
    fire_damage:       criticalFlags.fireDamage,
    structural_damage: criticalFlags.frameDamage,
    airbags_deployed:  criticalFlags.deployedAirbag,
    mechanical_fault:  criticalFlags.nonRunner === true,
    theft_recovery:    criticalFlags.theftStrip,
    prior_accident:    accidents > 0,
    high_mileage:      !isMileageAlreadyInBase && mileagePenalty > 0,
  };
}
