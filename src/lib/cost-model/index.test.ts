import { usdToGbp, computeDuty, computeVat, estimateRepairGbp, getRepairMultiplier, buildCostBreakdown, buildRepairLineItems, buildHiddenRepairItems } from './index';
import { COST_DEFAULTS, HIDDEN_DAMAGE_CONTINGENCY_PCT } from './defaults';
import type { DamageFindings, Listing } from '@/types';

const cleanDamage: DamageFindings = {
  photos: [],
  criticalFlags: {
    deployedAirbag: false,
    frameDamage: false,
    floodWaterline: false,
    fireDamage: false,
    theftStrip: false,
  },
  overallSeverity: 'cosmetic',
  damagedPanels: [],
};

const baseListing: Listing = {
  source: 'copart-us',
  lotNumber: '12345678',
  year: 2020,
  make: 'Ford',
  model: 'Mustang',
  odometerMiles: 45000,
  primaryDamage: 'Front End',
  titleStatus: 'Salvage',
  currentBidUsd: 32000,
  photos: [],
  location: 'TX - Dallas',
};

describe('usdToGbp', () => {
  it('converts using the provided rate', () => {
    expect(usdToGbp(32000, 1.27)).toBe(25197);
  });

  it('rounds to nearest whole pound', () => {
    expect(usdToGbp(1000, 1.3)).toBe(769);
  });
});

describe('computeDuty', () => {
  it(`applies ${COST_DEFAULTS.dutyRate * 100}% to CIF value`, () => {
    expect(computeDuty(28500)).toBe(2850);
  });
});

describe('computeVat', () => {
  it(`applies ${COST_DEFAULTS.vatRate * 100}% to CIF + duty`, () => {
    expect(computeVat(28500, 2850)).toBe(6270);
  });
});

describe('getRepairMultiplier', () => {
  it('returns 1.0 for mainstream makes', () => {
    expect(getRepairMultiplier('Ford')).toBe(1.0);
    expect(getRepairMultiplier('Toyota')).toBe(1.0);
    expect(getRepairMultiplier('Chevrolet')).toBe(1.0);
  });

  it('returns 2.2 for Land Rover', () => {
    expect(getRepairMultiplier('Land Rover')).toBe(2.2);
  });

  it('returns 1.5 for BMW', () => {
    expect(getRepairMultiplier('BMW')).toBe(1.5);
  });
});

describe('estimateRepairGbp', () => {
  it('returns base cost for cosmetic damage with no critical flags (Ford = 1.0x)', () => {
    expect(estimateRepairGbp(cleanDamage, baseListing)).toBe(800);
  });

  it('adds £2000 for deployed airbag (Ford = 1.0x)', () => {
    const damage = { ...cleanDamage, criticalFlags: { ...cleanDamage.criticalFlags, deployedAirbag: true } };
    expect(estimateRepairGbp(damage, baseListing)).toBe(2800);
  });

  it('adds £3500 for flood waterline', () => {
    const damage = { ...cleanDamage, criticalFlags: { ...cleanDamage.criticalFlags, floodWaterline: true } };
    expect(estimateRepairGbp(damage, baseListing)).toBe(4300);
  });

  it('adds £5000 for fire damage', () => {
    const damage = { ...cleanDamage, criticalFlags: { ...cleanDamage.criticalFlags, fireDamage: true } };
    expect(estimateRepairGbp(damage, baseListing)).toBe(5800);
  });

  it('compounds multiple critical flags', () => {
    const damage = {
      ...cleanDamage,
      overallSeverity: 'structural' as const,
      criticalFlags: { ...cleanDamage.criticalFlags, deployedAirbag: true, floodWaterline: true },
    };
    expect(estimateRepairGbp(damage, baseListing)).toBe(6000 + 2000 + 3500);
  });

  it('uses panel-level pricing when panels are identified', () => {
    const damage = { ...cleanDamage, damagedPanels: ['bonnet', 'front-bumper'] };
    // Ford (1.0x): bonnet £650 + front-bumper £420 = £1070
    expect(estimateRepairGbp(damage, baseListing)).toBe(1070);
  });

  it('applies make multiplier to panel costs', () => {
    const rrListing = { ...baseListing, make: 'Land Rover', model: 'Range Rover Sport' };
    const damage = { ...cleanDamage, damagedPanels: ['bonnet'] };
    // Land Rover (2.2x): bonnet £650 × 2.2 = £1430
    expect(estimateRepairGbp(damage, rrListing)).toBe(1430);
  });

  it('applies make multiplier to airbag surcharge', () => {
    const rrListing = { ...baseListing, make: 'Land Rover', model: 'Range Rover Sport' };
    const damage = { ...cleanDamage, criticalFlags: { ...cleanDamage.criticalFlags, deployedAirbag: true } };
    // Land Rover (2.2x): cosmetic 800×2.2=1760 + airbag 2000×2.2=4400 = 6160
    expect(estimateRepairGbp(damage, rrListing)).toBe(6160);
  });
});

describe('buildRepairLineItems', () => {
  it('returns one item for cosmetic bucket (no panels)', () => {
    const items = buildRepairLineItems(cleanDamage, baseListing);
    expect(items).toHaveLength(1);
    expect(items[0].amountGbp).toBe(800);
  });

  it('returns one item per panel', () => {
    const damage = { ...cleanDamage, damagedPanels: ['bonnet', 'front-bumper', 'headlight'] };
    const items = buildRepairLineItems(damage, baseListing);
    expect(items).toHaveLength(3);
    expect(items.reduce((s, i) => s + i.amountGbp, 0)).toBe(1070 + 280); // bonnet+bumper+headlight
  });

  it('sums match estimateRepairGbp', () => {
    const damage = { ...cleanDamage, damagedPanels: ['bonnet', 'rear-quarter'] };
    const lineSum = buildRepairLineItems(damage, baseListing).reduce((s, i) => s + i.amountGbp, 0);
    expect(lineSum).toBe(estimateRepairGbp(damage, baseListing));
  });

  it('includes critical flag items when flags are set', () => {
    const damage = {
      ...cleanDamage,
      criticalFlags: { ...cleanDamage.criticalFlags, deployedAirbag: true, floodWaterline: true },
    };
    const items = buildRepairLineItems(damage, baseListing);
    // 1 bucket + airbag + flood
    expect(items).toHaveLength(3);
  });
});

describe('buildHiddenRepairItems', () => {
  it('returns no items for clean cosmetic damage with no photos', () => {
    const items = buildHiddenRepairItems(cleanDamage);
    expect(items).toHaveLength(0);
  });

  it('returns hidden items for flood damage', () => {
    const damage = {
      ...cleanDamage,
      criticalFlags: { ...cleanDamage.criticalFlags, floodWaterline: true },
    };
    const items = buildHiddenRepairItems(damage);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => typeof i.minGbp === 'number')).toBe(true);
  });

  it('includes diagnostic scan for any non-cosmetic damage', () => {
    const damage = { ...cleanDamage, overallSeverity: 'panel' as const };
    const items = buildHiddenRepairItems(damage);
    expect(items.some((i) => i.label.toLowerCase().includes('diagnostic'))).toBe(true);
  });
});

describe('buildCostBreakdown', () => {
  it('matches the Sierra import example within 5%', () => {
    const breakdown = buildCostBreakdown({
      listing: { ...baseListing, currentBidUsd: 32000 },
      damage: { ...cleanDamage, overallSeverity: 'panel' },
      exchangeRate: 1.255,
      exchangeRateDate: '2026-05-21',
    });

    expect(breakdown.hammerGbp).toBeCloseTo(25498, -2);
    expect(breakdown.totalGbp).toBeGreaterThan(40000);
    expect(breakdown.totalGbp).toBeLessThan(50000);
  });

  it('uses buyItNowUsd when currentBidUsd is absent', () => {
    const listing = { ...baseListing, currentBidUsd: undefined, buyItNowUsd: 20000 };
    const result = buildCostBreakdown({
      listing,
      damage: cleanDamage,
      exchangeRate: 1.27,
      exchangeRateDate: '2026-05-21',
    });
    expect(result.hammerGbp).toBe(usdToGbp(20000, 1.27));
  });

  it('includes all 6 line items for US source', () => {
    const result = buildCostBreakdown({
      listing: baseListing,
      damage: cleanDamage,
      exchangeRate: 1.27,
      exchangeRateDate: '2026-05-21',
    });
    expect(result.lineItems).toHaveLength(6);
  });

  it('totalGbp equals hammerGbp plus all line items', () => {
    const result = buildCostBreakdown({
      listing: baseListing,
      damage: cleanDamage,
      exchangeRate: 1.27,
      exchangeRateDate: '2026-05-21',
    });
    const lineSum = result.lineItems.reduce((s, i) => s + i.amountGbp, 0);
    expect(result.totalGbp).toBe(result.hammerGbp + lineSum);
  });

  it('includes exchange rate in assumptions', () => {
    const result = buildCostBreakdown({
      listing: baseListing,
      damage: cleanDamage,
      exchangeRate: 1.27,
      exchangeRateDate: '2026-05-21',
    });
    expect(result.assumptions[0]).toContain('1.27');
  });

  it('repair estimate in lineItems equals subtotal + contingency', () => {
    const result = buildCostBreakdown({
      listing: baseListing,
      damage: cleanDamage,
      exchangeRate: 1.27,
      exchangeRateDate: '2026-05-21',
    });
    const repairLine = result.lineItems.find((i) => i.label === 'Repair estimate')!;
    expect(repairLine.amountGbp).toBe(result.repairSubtotalGbp + result.hiddenDamageContingencyGbp);
  });

  it('contingency is correct percentage of repair subtotal', () => {
    const result = buildCostBreakdown({
      listing: baseListing,
      damage: cleanDamage,
      exchangeRate: 1.27,
      exchangeRateDate: '2026-05-21',
    });
    expect(result.hiddenDamageContingencyGbp).toBe(
      Math.round(result.repairSubtotalGbp * HIDDEN_DAMAGE_CONTINGENCY_PCT)
    );
  });

  it('UK source: only 2 line items, no import costs', () => {
    const ukListing: Listing = {
      ...baseListing,
      source: 'copart-uk',
      currentBidUsd: 5000,
      titleStatus: 'N REPAIRABLE NON STRUCTURAL',
    };
    const result = buildCostBreakdown({
      listing: ukListing,
      damage: cleanDamage,
      exchangeRate: 1.27,
      exchangeRateDate: '2026-05-21',
    });
    expect(result.lineItems).toHaveLength(2);
    expect(result.hammerGbp).toBe(5000);
  });
});
