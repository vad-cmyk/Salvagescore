'use client';

import { useContext } from 'react';
import { ReportAdjustmentContext } from './ReportAdjustmentContext';
import type { VehicleCategory } from '@/lib/resale-model/vehicle';

const WHOLESALE_RATIO: Record<VehicleCategory, number> = {
  car: 0.78,
  truck_suv: 0.75,
  van: 0.72,
};

const OVERBID_STEPS = [0, 500, 1000, 2000];

function calcMarginPct(ceiling: number, bid: number, fixed: number): number {
  return ceiling > 0 ? Math.round(((ceiling - bid - fixed) / ceiling) * 100) : -100;
}

function pctColor(pct: number): string {
  if (pct >= 15) return 'text-[#22C55E]';
  if (pct >= 5)  return 'text-[#EAB308]';
  if (pct >= 0)  return 'text-[#F97316]';
  return 'text-[#EF4444]';
}

type Props = {
  resaleCeilingGbp: number;
  fixedCostsGbp: number;
  currentHammerGbp: number;
  exchangeRateUsed: number;
  isUkSource: boolean;
  isUsBuyer?: boolean;
  vehicleCategory: VehicleCategory;
};

export function OverbidWarning({
  resaleCeilingGbp,
  fixedCostsGbp,
  currentHammerGbp,
  exchangeRateUsed,
  isUkSource,
  isUsBuyer = false,
  vehicleCategory,
}: Props) {
  const adjustmentCtx = useContext(ReportAdjustmentContext);

  if (adjustmentCtx?.isPartsOnly) return null;

  const retailCeiling = adjustmentCtx
    ? adjustmentCtx.adjustedCeilingGbp
    : resaleCeilingGbp;

  const wholesaleCeiling = Math.round(retailCeiling * WHOLESALE_RATIO[vehicleCategory]);
  const retailBreakEven  = Math.max(0, Math.round(retailCeiling - fixedCostsGbp));
  const tradeBreakEven   = Math.max(0, Math.round(wholesaleCeiling - fixedCostsGbp));

  const rate = exchangeRateUsed;
  const fmtPrimary = (gbp: number) => isUsBuyer
    ? `$${Math.max(0, Math.round(gbp * rate)).toLocaleString('en-US')}`
    : `£${Math.max(0, Math.round(gbp)).toLocaleString('en-GB')}`;
  const fmtDiff = (gbp: number) => isUsBuyer
    ? `+$${Math.round(gbp * rate).toLocaleString('en-US')}`
    : `+£${Math.round(gbp).toLocaleString('en-GB')}`;

  const rows = OVERBID_STEPS.map((step) => {
    const bid = currentHammerGbp + step;
    return {
      step,
      bid,
      retailPct: calcMarginPct(retailCeiling, bid, fixedCostsGbp),
      tradePct:  calcMarginPct(wholesaleCeiling, bid, fixedCostsGbp),
    };
  });

  const breakEvenRetailPct = 0;
  const breakEvenTradePct  = calcMarginPct(wholesaleCeiling, retailBreakEven, fixedCostsGbp);

  return (
    <div className="mt-3 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-mono text-xs font-[600] uppercase tracking-wider text-[var(--text-muted)]">
            Overbid Warning
          </p>
          <p className="font-mono text-[0.58rem] text-[var(--text-muted)] mt-0.5">
            How margin erodes as the price climbs
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-[0.58rem] text-[var(--text-muted)]">Break-even</p>
          <p className="font-mono text-[0.62rem] font-[600] text-[var(--text-secondary)]">
            Private {fmtPrimary(retailBreakEven)} · Trade {fmtPrimary(tradeBreakEven)}
          </p>
        </div>
      </div>

      {/* Ladder table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-4 px-4 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border)]">
          <span className="font-mono text-[0.55rem] text-[var(--text-muted)] uppercase tracking-wider">Bid</span>
          <span className="font-mono text-[0.55rem] text-[var(--text-muted)] uppercase tracking-wider">vs now</span>
          <span className="font-mono text-[0.55rem] text-[var(--text-muted)] uppercase tracking-wider">Private</span>
          <span className="font-mono text-[0.55rem] text-[var(--text-muted)] uppercase tracking-wider">Trade</span>
        </div>

        {/* Overbid rows */}
        <div className="divide-y divide-[var(--border)]">
          {rows.map(({ step, bid, retailPct, tradePct }) => {
            const isBase = step === 0;
            return (
              <div
                key={step}
                className={`grid grid-cols-4 px-4 py-2.5 items-center ${isBase ? 'bg-[rgba(255,255,255,0.025)]' : ''}`}
              >
                <span className={`font-mono text-xs ${isBase ? 'font-[700] text-[var(--text-primary)]' : 'font-[500] text-[var(--text-secondary)]'}`}>
                  {fmtPrimary(bid)}
                </span>
                <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">
                  {isBase ? 'now ←' : fmtDiff(step)}
                </span>
                <span className={`font-mono text-xs font-[700] ${pctColor(retailPct)}`}>
                  {retailPct}%
                </span>
                <span className={`font-mono text-xs font-[700] ${pctColor(tradePct)}`}>
                  {tradePct}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Break-even floor row */}
        <div className="grid grid-cols-4 px-4 py-2.5 items-center border-t border-dashed border-[#EF4444]/40 bg-[rgba(239,68,68,0.04)]">
          <span className="font-mono text-xs font-[700] text-[#EF4444]">
            {fmtPrimary(retailBreakEven)}
          </span>
          <span className="font-mono text-[0.58rem] font-[600] text-[#EF4444]/70 uppercase tracking-wider">
            floor
          </span>
          <span className={`font-mono text-xs font-[700] ${pctColor(breakEvenRetailPct)}`}>
            {breakEvenRetailPct}%
          </span>
          <span className={`font-mono text-xs font-[700] ${pctColor(breakEvenTradePct)}`}>
            {breakEvenTradePct}%
          </span>
        </div>
      </div>

      <p className="mt-2 font-mono text-[0.58rem] text-[var(--text-muted)] leading-[1.5]">
        Floor = private break-even — above this price you lose money on a retail exit.
        {(!isUkSource || isUsBuyer) && ' Values shown in primary currency; all estimates.'}
      </p>
    </div>
  );
}
