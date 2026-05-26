export type ListingSource = 'copart-us' | 'copart-uk' | 'abetterbid' | 'iaai';

export type Listing = {
  source: ListingSource;
  lotNumber: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
  odometerMiles: number;
  primaryDamage: string;
  secondaryDamage?: string;
  titleStatus: string;
  estRetailUsd?: number;
  currentBidUsd?: number;
  buyItNowUsd?: number;
  photos: { url: string; caption?: string }[];
  history?: { accidents?: number; previousSales?: number; recalls?: number };
  location: string;
  auctionDate?: string;
};

export type DamageZone =
  | 'front' | 'rear' | 'side-lh' | 'side-rh'
  | 'roof' | 'undercarriage' | 'interior' | 'engine-bay';

export type DamageType =
  | 'collision' | 'hail' | 'fire' | 'flood'
  | 'theft' | 'mechanical' | 'none';

export type DamageSeverity = 'cosmetic' | 'panel' | 'structural' | 'frame';

export type PhotoAnalysis = {
  url: string;
  zone: DamageZone;
  damageType: DamageType;
  severity: DamageSeverity;
  findings: string[];
};

export type CriticalFlags = {
  deployedAirbag: boolean;
  frameDamage: boolean;
  floodWaterline: boolean;
  fireDamage: boolean;
  theftStrip: boolean;
};

export type DamageFindings = {
  photos: PhotoAnalysis[];
  criticalFlags: CriticalFlags;
  overallSeverity: DamageSeverity;
  /** Deduplicated list of specific panels identified as damaged across all photos. */
  damagedPanels: string[];
};

export type CostLineItem = {
  label: string;
  amountGbp: number;
  note?: string;
};

/** One itemised repair task with a fixed estimated cost (visible damage). */
export type RepairLineItem = {
  label: string;
  amountGbp: number;
};

/** A probable hidden repair item — cost shown as a range because not directly visible. */
export type HiddenRepairItem = {
  label: string;
  minGbp: number;
  maxGbp: number;
  likelihood: 'likely' | 'possible';
  reason: string;
};

export type CostBreakdown = {
  hammerGbp: number;
  /** Import + compliance costs. The "Repair estimate" entry here = subtotal + contingency. */
  lineItems: CostLineItem[];
  /** Itemised visible repair tasks (each panel / critical-flag surcharge). */
  repairLineItems: RepairLineItem[];
  /** Probable items not visible in photos — shown as ranges. */
  hiddenRepairItems: HiddenRepairItem[];
  /** Sum of repairLineItems only (before contingency). */
  repairSubtotalGbp: number;
  /** Contingency fraction applied to repairSubtotalGbp (e.g. 0.125). */
  hiddenDamageContingencyPct: number;
  /** Rounded GBP value of the contingency. */
  hiddenDamageContingencyGbp: number;
  totalGbp: number;
  exchangeRateUsed: number;
  exchangeRateDate: string;
  assumptions: string[];
};

export type ResaleComparable = {
  title: string;
  priceGbp: number;
  mileage?: number;
  url: string;
};

export type ResaleEstimate = {
  ceilingGbp: number;
  baseValueGbp: number;
  penalties: { label: string; multiplier: number }[];
  confidence: 'low' | 'medium' | 'high';
  priceSource: 'autotrader-live' | 'cap-clean' | 'estimated';
  autotraderSampleSize?: number;
  /** CAP Clean retail value for this specific vehicle (from Copart UK data). */
  capCleanGbp?: number;
  /** Sample AutoTrader listings used to derive the resale ceiling. */
  comparables?: ResaleComparable[];
  /** AutoTrader search URL so users can see all current listings. */
  autotraderSearchUrl?: string;
};

export type ReportVerdict = 'pass' | 'caution' | 'avoid';

/** A documented known issue for a specific make/model/year from Claude's knowledge. */
export type KnownIssue = {
  category: string;
  issue: string;
  severity: 'minor' | 'moderate' | 'major';
  typicalCostGbp?: { min: number; max: number };
};

/** How confident the AI is in its verdict, and what limits that confidence. */
export type VerdictConfidence = {
  score: number;
  level: 'low' | 'medium' | 'high';
  limitingFactors: string[];
};

/** A similar vehicle currently active on Copart UK. */
export type SimilarLot = {
  lotNumber: string;
  title: string;
  currentBidGbp: number;
  odometerMiles?: number;
  primaryDamage: string;
  url: string;
};

/** A completed Copart UK auction result — actual hammer price. */
export type SoldLot = {
  lotNumber: string;
  title: string;
  hammerGbp: number;
  odometerMiles?: number;
  primaryDamage: string;
  saleDate?: string;  // ISO 8601
  url: string;
};

/** Lightweight summary for the history page — no full sections payload. */
export type ReportSummary = {
  slug: string;
  createdAt: string;
  verdict: string;
  listing: {
    year: number;
    make: string;
    model: string;
  };
};

/** An open NHTSA safety recall for the vehicle's make/model/year. */
export type NhtsaRecall = {
  campaignNumber: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  recallDate: string;
};

/** Estimated annual UK running costs for the vehicle. */
export type OwnershipCosts = {
  annualVedGbp: number;
  vedBand: string;
  insuranceGroupEstimate: number;
  annualInsuranceEstimateGbp: number;
  annualFuelGbp: number;
  annualTotalGbp: number;
  fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric';
  assumedMilesPerYear: number;
};

export type BuyerLocation = 'uk' | 'us';

export type Report = {
  id: string;
  slug: string;
  createdAt: string;
  buyerLocation: BuyerLocation;
  listing: Listing;
  damage: DamageFindings;
  cost: CostBreakdown;
  resale: ResaleEstimate;
  verdict: ReportVerdict;
  summary: string;
  sections: {
    damageNarrative: string;
    costNarrative: string;
    resaleNarrative: string;
    verdictRationale: string;
  };
  knownIssues?: KnownIssue[];
  verdictConfidence?: VerdictConfidence;
  similarLots?: SimilarLot[];
  soldComps?: SoldLot[];
  recalls?: NhtsaRecall[];
  ownershipCosts?: OwnershipCosts;
  userId?: string;
};
