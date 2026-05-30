/** All adjustable constants for the UK landed cost model. Update as rates drift. */
export const COST_DEFAULTS = {
  brokerAndCopartFeesGbp: 1200,
  usTransportAndOceanGbp: 3000,
  ivaAndLhdAndDvlaGbp: 1700,
  dutyRate: 0.065,   // UK MFN tariff on US passenger cars (HS 8703) — was incorrectly 10%
  vatRate: 0.20,
} as const;

/**
 * Copart UK buyer fee tiers (gate fee, exc. VAT).
 * Format: [minHammer, gateFeeExcVat]
 * Source: copart.co.uk fee schedule (approximate — verify before bidding).
 */
export const COPART_UK_GATE_FEES: [number, number][] = [
  [0,      25],
  [100,    55],
  [500,    75],
  [1000,  145],
  [2500,  200],
  [5000,  255],
  [7500,  300],
  [10000, 360],
  [15000, 420],
  [20000, 480],
  [25000, 535],
];

/** Internet bid fee rate (charged on top of gate fee, exc. VAT). */
export const COPART_UK_INTERNET_BID_PCT = 0.05;

/** Copart UK administration / title processing fee (exc. VAT). */
export const COPART_UK_ADMIN_FEE_GBP = 120;

/**
 * Fraction of base panel cost to apply depending on the worst damage severity
 * observed for that panel's zone. Avoids charging full replace+paint for cosmetic dents.
 */
export const SEVERITY_COST_FRACTION: Record<string, number> = {
  cosmetic:   0.35,  // repair/blend — no replacement
  panel:      0.70,  // dent work + partial respray
  structural: 1.00,  // full replace + paint
  frame:      1.00,  // full replace + paint
};

/** LHD resale penalty multipliers */
export const LHD_PENALTIES: Record<'car' | 'truck_suv' | 'van', number> = {
  car: 0.15,
  truck_suv: 0.30,
  van: 0.25,
};

/** Title brand resale penalty multipliers */
export const TITLE_PENALTIES = {
  salvage: 0.35,
  catS: 0.30,
  catN: 0.20,
} as const;

/** Per-accident resale penalty (compounding) */
export const ACCIDENT_PENALTY = 0.20;

/** Contingency added to the visible repair subtotal for undetected hidden damage. */
export const HIDDEN_DAMAGE_CONTINGENCY_PCT = 0.125; // midpoint of 10–15%

/**
 * Base UK repair cost per panel (professional bodyshop, parts + labour + paint, 2024/25 rates).
 * Economy-car baseline — multiply by make multiplier for premium/specialist vehicles.
 */
export const PANEL_BASE_COST_GBP: Record<string, number> = {
  // Exterior body
  'bonnet':              650,
  'front-bumper':        420,
  'rear-bumper':         320,
  'front-wing':          520,
  'rear-quarter':       1200,
  'front-door':          620,
  'rear-door':           560,
  'tailgate':            580,
  'trunk-lid':           520,
  'roof':               1500,
  'sill':                580,
  'spoiler':             350,
  'running-board':       280,
  'wheel-arch-liner':    150,
  'inner-wing':          480,
  // Glass
  'windscreen':          380,
  'rear-screen':         450,
  'side-glass':          280,
  'sunroof-glass':       600,
  // Lighting / exterior trim
  'headlight':           280,
  'taillight':           180,
  'fog-light':           120,
  'indicator':            80,
  'grille':              220,
  'mirror':              160,
  // Structural
  'floor-pan':          1800,
  'firewall':           2000,
  'a-pillar':           2200,
  'b-pillar':           2000,
  'c-pillar':           1800,
  'frame-rail':         2800,
  'subframe':           2200,
  // Mechanical (visible damage, rough labour estimates)
  'radiator':            350,
  'condenser':           280,
  'exhaust':             400,
  'suspension-component': 600,
  // Interior
  'dashboard':           800,
  'seat-driver':         600,
  'seat-passenger':      500,
  'carpet':              350,
  'headliner':           450,
  'steering-wheel':      380,
  'airbag-module':       600,
};

/** Default cost for any panel Claude identifies that is not in PANEL_BASE_COST_GBP */
export const PANEL_UNKNOWN_COST_GBP = 500;

/**
 * Human-readable label for each panel slug (used in repair line item descriptions).
 */
export const PANEL_LABELS: Record<string, string> = {
  'bonnet':               'Bonnet',
  'front-bumper':         'Front bumper',
  'rear-bumper':          'Rear bumper',
  'front-wing':           'Front wing',
  'rear-quarter':         'Rear quarter panel',
  'front-door':           'Front door',
  'rear-door':            'Rear door',
  'tailgate':             'Tailgate',
  'trunk-lid':            'Boot / trunk lid',
  'roof':                 'Roof panel',
  'sill':                 'Sill panel',
  'spoiler':              'Spoiler / diffuser',
  'running-board':        'Running board / side step',
  'wheel-arch-liner':     'Wheel arch liner',
  'inner-wing':           'Inner wing / slam panel',
  'windscreen':           'Windscreen',
  'rear-screen':          'Rear screen',
  'side-glass':           'Side window glass',
  'sunroof-glass':        'Sunroof glass',
  'headlight':            'Headlight assembly',
  'taillight':            'Taillight assembly',
  'fog-light':            'Fog light',
  'indicator':            'Indicator / turn signal',
  'grille':               'Front grille',
  'mirror':               'Door mirror',
  'floor-pan':            'Floor pan',
  'firewall':             'Firewall / bulkhead',
  'a-pillar':             'A-pillar',
  'b-pillar':             'B-pillar',
  'c-pillar':             'C-pillar',
  'frame-rail':           'Frame rail',
  'subframe':             'Subframe',
  'radiator':             'Radiator',
  'condenser':            'A/C condenser',
  'exhaust':              'Exhaust system',
  'suspension-component': 'Suspension component',
  'dashboard':            'Dashboard / instrument panel',
  'seat-driver':          "Driver's seat",
  'seat-passenger':       'Passenger seat',
  'carpet':               'Interior carpets',
  'headliner':            'Headliner',
  'steering-wheel':       'Steering wheel',
  'airbag-module':        'Airbag module (supply + fit)',
};

/**
 * Labour + parts cost multiplier by make tier.
 * Luxury and aluminium-chassis cars cost significantly more to repair.
 */
export const REPAIR_MULTIPLIERS: { makes: string[]; multiplier: number }[] = [
  {
    makes: ['bentley', 'rolls royce', 'rolls-royce', 'ferrari', 'lamborghini', 'maserati', 'aston martin'],
    multiplier: 2.8,
  },
  {
    makes: ['land rover', 'jaguar', 'porsche'],
    multiplier: 2.2,
  },
  {
    makes: ['tesla'],
    multiplier: 2.0,
  },
  {
    makes: ['bmw', 'mercedes', 'mercedes-benz', 'audi', 'lexus'],
    multiplier: 1.5,
  },
  {
    makes: ['volvo', 'alfa romeo', 'infiniti', 'acura'],
    multiplier: 1.3,
  },
];
// Any make not listed above gets multiplier 1.0 (mainstream economy baseline)
