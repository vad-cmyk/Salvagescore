'use client';

import { useState, useContext } from 'react';
import { ReportAdjustmentContext } from './ReportAdjustmentContext';
import type { VehicleCategory } from '@/lib/resale-model';

type Props = {
  resaleCeilingGbp: number;
  /** All costs except the hammer price */
  fixedCostsGbp: number;
  /** Repair portion of fixedCostsGbp — used to build sensitivity matrix. */
  repairEstimateGbp: number;
  currentHammerGbp: number;
  exchangeRateUsed: number;
  isUkSource: boolean;
  isUsBuyer?: boolean;
  vehicleCategory: VehicleCategory;
};

const ROI_RUNGS = [20, 30, 40, 50];

const WHOLESALE_RATIO: Record<VehicleCategory, number> = {
  car: 0.78,
  truck_suv: 0.75,
  van: 0.72,
};

function calcMaxBid(exit: number, fixed: number, marginPct: number) {
  return Math.max(0, Math.round(exit * (1 - marginPct / 100) - fixed));
}

function calcActualMarginPct(exit: number, hammer: number, fixed: number): number {
  return exit > 0 ? Math.round(((exit - hammer - fixed) / exit) * 100) : -100;
}

const REPAIR_ROWS = [
  { label: '−25%', mult: 0.75 },
  { label: '0%',   mult: 1.00 },
  { label: '+25%', mult: 1.25 },
  { label: '+50%', mult: 1.50 },
];
const RESALE_COLS = [
  { label: '−20%', mult: 0.80 },
  { label: '−10%', mult: 0.90 },
  { label: '0%',   mult: 1.00 },
  { label: '+10%', mult: 1.10 },
];

function cellColor(marginPct: number): string {
  if (marginPct >= 15) return 'bg-[rgba(34,197,94,0.15)] text-[#22C55E] border-[rgba(34,197,94,0.25)]';
  if (marginPct >= 5)  return 'bg-[rgba(234,179,8,0.12)] text-[#EAB308] border-[rgba(234,179,8,0.25)]';
  if (marginPct >= 0)  return 'bg-[rgba(249,115,22,0.10)] text-[#F97316] border-[rgba(249,115,22,0.25)]';
  return 'bg-[rgba(239,68,68,0.10)] text-[#EF4444] border-[rgba(239,68,68,0.20)]';
}

function marginColor(pct: number): string {
  if (pct >= 15) return 'text-[#22C55E]';
  if (pct >= 5)  return 'text-[#EAB308]';
  if (pct >= 0)  return 'text-[#F97316]';
  return 'text-[#EF4444]';
}

function ExitColumn({
  label,
  sublabel,
  ceilingGbp,
  maxBidGbp,
  diffGbp,
  actualPct,
  targetPct,
  fmtPrimary,
  fmtSecondary,
  isUkSource,
  isUsBuyer,
  highlight = false,
}: {
  label: string;
  sublabel: string;
  ceilingGbp: number;
  maxBidGbp: number;
  diffGbp: number;
  actualPct: number;
  targetPct: number;
  fmtPrimary: (gbp: number) => string;
  fmtSecondary: (gbp: number) => string;
  isUkSource: boolean;
  isUsBuyer: boolean;
  highlight?: boolean;
}) {
  const isViable = maxBidGbp > 0;
  const borderClass = highlight
    ? 'border-[var(--amber)]/30 bg-[rgba(217,119,6,0.04)]'
    : 'border-[var(--border)] bg-[var(--bg)]';

  return (
    <div className={`p-4 rounded-xl border ${borderClass}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-mono text-[0.6rem] font-[600] uppercase tracking-wider text-[var(--text-muted)]">
            {label}
          </p>
          <p className="font-mono text-[0.55rem] text-[var(--text-muted)] mt-0.5">{sublabel}</p>
        </div>
        <span className="font-mono text-[0.62rem] text-[var(--text-muted)] shrink-0 mt-0.5">
          {fmtPrimary(ceilingGbp)}
        </span>
      </div>

      {isViable ? (
        <>
          <p className="font-mono text-[0.62rem] text-[var(--text-muted)] mb-1">
            Max bid @ {targetPct}%
          </p>
          <div className="flex items-end gap-2 mb-2">
            <span className="font-display font-[800] text-[clamp(1.5rem,4vw,2rem)] leading-none tracking-[-0.01em] text-[var(--text-primary)]">
              {fmtPrimary(maxBidGbp)}
            </span>
            {(!isUkSource || isUsBuyer) && (
              <span className="font-mono text-xs text-[var(--text-muted)] mb-0.5">
                {fmtSecondary(maxBidGbp)}
              </span>
            )}
          </div>

          {diffGbp >= 0 ? (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="1.5" />
                <path d="M4 7l2 2 4-4" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="font-mono text-[0.62rem] text-[#22C55E]">
                {fmtPrimary(diffGbp)} headroom
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" fill="rgba(239,68,68,0.12)" stroke="#EF4444" strokeWidth="1.5" />
                <path d="M7 4v3.5M7 9.5v.5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="font-mono text-[0.62rem] text-[#EF4444]">
                {fmtPrimary(Math.abs(diffGbp))} over budget
              </p>
            </div>
          )}

          <p className="mt-1.5 font-mono text-[0.58rem] text-[var(--text-muted)]">
            At current hammer ·{' '}
            <span className={marginColor(actualPct)}>{actualPct}%</span> actual margin
          </p>
        </>
      ) : (
        <p className="font-mono text-xs text-[#EF4444]">
          Doesn&apos;t work at {targetPct}%
        </p>
      )}
    </div>
  );
}

export function BidCalculator({
  resaleCeilingGbp,
  fixedCostsGbp,
  repairEstimateGbp,
  currentHammerGbp,
  exchangeRateUsed,
  isUkSource,
  isUsBuyer = false,
  vehicleCategory,
}: Props) {
  const [targetPct, setTargetPct] = useState(30);
  const [customVal, setCustomVal] = useState('');

  const adjustmentCtx = useContext(ReportAdjustmentContext);
  const retailCeiling = adjustmentCtx && !adjustmentCtx.isPartsOnly
    ? adjustmentCtx.adjustedCeilingGbp
    : resaleCeilingGbp;
  const wholesaleRatio = WHOLESALE_RATIO[vehicleCategory];
  const wholesaleCeiling = Math.round(retailCeiling * wholesaleRatio);

  const isCustom = !ROI_RUNGS.includes(targetPct);
  const rate = exchangeRateUsed;

  const fmtPrimary = (gbp: number) => isUsBuyer
    ? `$${Math.max(0, Math.round(gbp * rate)).toLocaleString('en-US')}`
    : `£${Math.max(0, Math.round(gbp)).toLocaleString('en-GB')}`;
  const fmtSecondary = (gbp: number) => isUsBuyer
    ? `≈ £${Math.max(0, Math.round(gbp)).toLocaleString('en-GB')}`
    : `≈ $${Math.max(0, Math.round(gbp * rate)).toLocaleString('en-US')}`;

  const retailMaxBid = calcMaxBid(retailCeiling, fixedCostsGbp, targetPct);
  const tradeMaxBid  = calcMaxBid(wholesaleCeiling, fixedCostsGbp, targetPct);

  const retailActualPct = calcActualMarginPct(retailCeiling, currentHammerGbp, fixedCostsGbp);
  const tradeActualPct  = calcActualMarginPct(wholesaleCeiling, currentHammerGbp, fixedCostsGbp);

  function handleCustomChange(raw: string) {
    setCustomVal(raw);
    const v = parseInt(raw, 10);
    if (!isNaN(v) && v >= 1 && v <= 60) setTargetPct(v);
  }

  function handlePreset(p: number) {
    setTargetPct(p);
    setCustomVal('');
  }

  const categoryLabel = vehicleCategory === 'truck_suv' ? 'truck/suv' : vehicleCategory;

  return (
    <div className="mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider">
          Max Bid Calculator
        </p>
        <p className="font-mono text-[0.62rem] text-[var(--text-muted)]">
          {categoryLabel} · wholesale @ {Math.round(wholesaleRatio * 100)}%
        </p>
      </div>

      {/* ROI target picker */}
      <div className="mb-5">
        <p className="font-mono text-[0.62rem] text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Your profit target
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {ROI_RUNGS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePreset(p)}
              className={[
                'px-4 py-1.5 rounded-lg font-mono text-xs font-[600] transition-colors cursor-pointer',
                targetPct === p && !isCustom
                  ? 'bg-[var(--amber)] text-[#0A0B0E]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--amber)] hover:text-[var(--amber-bright)]',
              ].join(' ')}
            >
              {p}%
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={60}
              value={customVal}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="—"
              className={[
                'w-16 rounded-lg px-2 py-1.5 font-mono text-xs text-center outline-none bg-[var(--bg-elevated)] border',
                isCustom
                  ? 'border-[var(--amber)] text-[var(--amber-bright)]'
                  : 'border-[var(--border)] text-[var(--text-muted)]',
              ].join(' ')}
            />
            <span className="font-mono text-xs text-[var(--text-muted)]">%</span>
          </div>
        </div>
      </div>

      {/* Two-column exit scenarios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <ExitColumn
          label="Private Sale"
          sublabel="retail exit · full market value"
          ceilingGbp={retailCeiling}
          maxBidGbp={retailMaxBid}
          diffGbp={retailMaxBid - currentHammerGbp}
          actualPct={retailActualPct}
          targetPct={targetPct}
          fmtPrimary={fmtPrimary}
          fmtSecondary={fmtSecondary}
          isUkSource={isUkSource}
          isUsBuyer={isUsBuyer}
          highlight
        />
        <ExitColumn
          label="Trade / Quick Sale"
          sublabel={`auction / dealer exit · ${Math.round(wholesaleRatio * 100)}% of retail`}
          ceilingGbp={wholesaleCeiling}
          maxBidGbp={tradeMaxBid}
          diffGbp={tradeMaxBid - currentHammerGbp}
          actualPct={tradeActualPct}
          targetPct={targetPct}
          fmtPrimary={fmtPrimary}
          fmtSecondary={fmtSecondary}
          isUkSource={isUkSource}
          isUsBuyer={isUsBuyer}
        />
      </div>

      {/* ROI ladder */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="grid grid-cols-3 px-4 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border)]">
          <span className="font-mono text-[0.55rem] text-[var(--text-muted)] uppercase tracking-wider">ROI target</span>
          <span className="font-mono text-[0.55rem] text-[var(--text-muted)] uppercase tracking-wider">Private</span>
          <span className="font-mono text-[0.55rem] text-[var(--text-muted)] uppercase tracking-wider">Trade</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {ROI_RUNGS.map((p) => {
            const rb = calcMaxBid(retailCeiling, fixedCostsGbp, p);
            const tb = calcMaxBid(wholesaleCeiling, fixedCostsGbp, p);
            const active = targetPct === p && !isCustom;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePreset(p)}
                className={[
                  'w-full grid grid-cols-3 px-4 py-2.5 text-left transition-colors cursor-pointer',
                  active ? 'bg-[rgba(217,119,6,0.08)]' : 'hover:bg-[var(--bg-elevated)]',
                ].join(' ')}
              >
                <span className={`font-mono text-xs font-[700] ${active ? 'text-[var(--amber)]' : 'text-[var(--text-muted)]'}`}>
                  {p}%
                </span>
                <span className={`font-mono text-xs font-[600] ${active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                  {fmtPrimary(rb)}
                </span>
                <span className={`font-mono text-xs ${active ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
                  {fmtPrimary(tb)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 font-mono text-[0.58rem] text-[var(--text-muted)] leading-[1.6]">
        Formula: exit × (1 − ROI%) − fixed costs&nbsp;·&nbsp;
        Fixed costs = {fmtPrimary(fixedCostsGbp)}
      </p>

      {/* Sensitivity matrix (private sale exit) */}
      {repairEstimateGbp > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--border)]">
          <p className="font-mono text-[0.62rem] text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Profit sensitivity — at current bid of {fmtPrimary(currentHammerGbp)} · private sale exit
          </p>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full border-collapse text-[0.65rem] font-mono">
              <thead>
                <tr>
                  <th className="text-left text-[var(--text-muted)] font-[500] pb-2 pr-2 whitespace-nowrap">
                    Repair vs estimate
                  </th>
                  {RESALE_COLS.map((c) => (
                    <th key={c.label} className="text-center text-[var(--text-muted)] font-[500] pb-2 px-1 whitespace-nowrap">
                      {isUsBuyer ? 'US mkt' : 'Resale'} {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {REPAIR_ROWS.map((row) => {
                  const nonRepair = fixedCostsGbp - repairEstimateGbp;
                  return (
                    <tr key={row.label}>
                      <td className="pr-2 py-1 text-[var(--text-secondary)] font-[600] whitespace-nowrap">
                        {row.label}
                      </td>
                      {RESALE_COLS.map((col) => {
                        const adjRepair = repairEstimateGbp * row.mult;
                        const adjResale = retailCeiling * col.mult;
                        const totalCost = currentHammerGbp + nonRepair + adjRepair;
                        const margin = adjResale - totalCost;
                        const pct = Math.round((margin / adjResale) * 100);
                        const color = cellColor(pct);
                        return (
                          <td key={col.label} className="px-1 py-1">
                            <div className={`text-center rounded border px-1.5 py-1.5 leading-tight ${color}`}>
                              <div className="font-[700]">{pct}%</div>
                              <div className="opacity-75 text-[0.6rem]">{margin >= 0 ? '+' : ''}{fmtPrimary(Math.abs(margin))}{margin < 0 ? '−' : ''}</div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 font-mono text-[0.58rem] text-[var(--text-muted)]">
            Green ≥15% · Amber ≥5% · Orange ≥0% · Red = loss
          </p>
        </div>
      )}
    </div>
  );
}
