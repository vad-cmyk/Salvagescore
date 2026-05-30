'use client';

import { useState } from 'react';

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
};

const PRESETS = [10, 15, 20, 25];

function calcMaxBid(resale: number, fixed: number, marginPct: number) {
  return Math.max(0, Math.round(resale * (1 - marginPct / 100) - fixed));
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

export function BidCalculator({
  resaleCeilingGbp,
  fixedCostsGbp,
  repairEstimateGbp,
  currentHammerGbp,
  exchangeRateUsed,
  isUkSource,
  isUsBuyer = false,
}: Props) {
  const [targetPct, setTargetPct] = useState(15);
  const [customVal, setCustomVal] = useState('');

  const isCustom = !PRESETS.includes(targetPct);
  const rate = exchangeRateUsed;

  // Currency helpers — primary is USD for US buyers, GBP for UK buyers
  const fmtPrimary = (gbp: number) => isUsBuyer
    ? `$${Math.max(0, Math.round(gbp * rate)).toLocaleString('en-US')}`
    : `£${Math.max(0, Math.round(gbp)).toLocaleString('en-GB')}`;
  const fmtSecondary = (gbp: number) => isUsBuyer
    ? `≈ £${Math.max(0, Math.round(gbp)).toLocaleString('en-GB')}`
    : `≈ $${Math.max(0, Math.round(gbp * rate)).toLocaleString('en-US')}`;

  const maxBidGbp = calcMaxBid(resaleCeilingGbp, fixedCostsGbp, targetPct);
  const diffGbp = maxBidGbp - currentHammerGbp;
  const isViable = maxBidGbp > 0;

  const actualMarginPct = Math.round(
    ((resaleCeilingGbp - currentHammerGbp - fixedCostsGbp) / resaleCeilingGbp) * 100
  );

  function handleCustomChange(raw: string) {
    setCustomVal(raw);
    const v = parseInt(raw, 10);
    if (!isNaN(v) && v >= 1 && v <= 60) setTargetPct(v);
  }

  function handlePreset(p: number) {
    setTargetPct(p);
    setCustomVal('');
  }

  const ceilingLabel = isUsBuyer ? 'US market ref.' : 'Resale ceiling';
  const fixedLabel = isUsBuyer
    ? 'buyer fees + repair'
    : isUkSource
      ? 'buyer fees + repair'
      : 'import + repair + compliance';

  return (
    <div className="mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider">
          Max Bid Calculator
        </p>
        <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">
          {ceilingLabel}&nbsp;·&nbsp;{fmtPrimary(resaleCeilingGbp)}
        </p>
      </div>

      {/* Profit target picker */}
      <div className="mb-5">
        <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Your profit target
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p}
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

      {/* Main result */}
      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
        <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Max bid to achieve {targetPct}% margin
        </p>

        {isViable ? (
          <>
            <div className="flex items-end gap-3 mb-2">
              <span className="font-display font-[800] text-[clamp(2rem,6vw,3rem)] leading-none tracking-[-0.01em] text-[var(--text-primary)]">
                {fmtPrimary(maxBidGbp)}
              </span>
              {(!isUkSource || isUsBuyer) && (
                <span className="font-mono text-sm text-[var(--text-muted)] mb-1">
                  {fmtSecondary(maxBidGbp)}
                </span>
              )}
            </div>

            {diffGbp >= 0 ? (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[#22C55E]">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="1.5" />
                    <path d="M4 7l2 2 4-4" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className="font-mono text-xs text-[#22C55E]">
                  {fmtPrimary(diffGbp)} room above current price
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 mt-3">
                <span className="text-[#EF4444] shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" fill="rgba(239,68,68,0.12)" stroke="#EF4444" strokeWidth="1.5" />
                    <path d="M7 4v3.5M7 9.5v.5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <p className="font-mono text-xs text-[#EF4444]">
                  Current price is {fmtPrimary(Math.abs(diffGbp))} over budget for {targetPct}% margin
                </p>
              </div>
            )}

            <p className="mt-1.5 font-mono text-[0.65rem] text-[var(--text-muted)]">
              At current hammer · actual margin is&nbsp;
              <span className={actualMarginPct >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                {actualMarginPct}%
              </span>
            </p>
          </>
        ) : (
          <p className="font-mono text-sm text-[#EF4444]">
            Deal doesn&apos;t work at {targetPct}% — fixed costs alone exceed the market value at that margin.
          </p>
        )}
      </div>

      {/* Reference grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PRESETS.map((p) => {
          const bid = calcMaxBid(resaleCeilingGbp, fixedCostsGbp, p);
          const active = targetPct === p && !isCustom;
          return (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className={[
                'p-3 rounded-lg text-left border cursor-pointer transition-colors',
                active
                  ? 'border-[var(--amber)] bg-[rgba(217,119,6,0.08)]'
                  : 'border-[var(--border)] hover:border-[var(--text-muted)]',
              ].join(' ')}
            >
              <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                {p}% margin
              </p>
              <p className={`font-mono text-xs font-[600] ${active ? 'text-[var(--amber)]' : 'text-[var(--text-secondary)]'}`}>
                {fmtPrimary(bid)}
              </p>
              {(!isUkSource || isUsBuyer) && bid > 0 && (
                <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-0.5">
                  {fmtSecondary(bid)}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 font-mono text-[0.6rem] text-[var(--text-muted)] leading-[1.6]">
        Formula: ({ceilingLabel} × (1 − margin%)) − fixed costs&nbsp;·&nbsp;
        Fixed costs = {fmtPrimary(fixedCostsGbp)} ({fixedLabel})
      </p>

      {/* Sensitivity matrix */}
      {repairEstimateGbp > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--border)]">
          <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Profit sensitivity — at current bid of {fmtPrimary(currentHammerGbp)}
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
                        const adjResale = resaleCeilingGbp * col.mult;
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
          <p className="mt-2 font-mono text-[0.6rem] text-[var(--text-muted)]">
            Green ≥15% · Amber ≥5% · Orange ≥0% · Red = loss
          </p>
        </div>
      )}
    </div>
  );
}
