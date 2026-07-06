'use client';
import { useReportAdjustment } from './ReportAdjustmentContext';
import { ALL_TOGGLE_IDS, CONDITION_ADJUSTMENTS, type ConditionToggleId } from '@/lib/resale-model/condition-adjustments';

function fmt(n: number) {
  return `£${n.toLocaleString('en-GB')}`;
}

function AdjPct({ id, accidentCount }: { id: ConditionToggleId; accidentCount: number }) {
  const def = CONDITION_ADJUSTMENTS[id];
  if (id === 'cat_b') return <span className="font-mono text-[0.6rem] font-[700] text-[#EF4444]">Parts only</span>;
  if (id === 'high_mileage') return <span className="font-mono text-[0.6rem] text-[var(--text-muted)]">dynamic</span>;
  if (id === 'prior_accident') {
    const n = accidentCount;
    const compounded = n > 0 ? Math.round((1 - Math.pow(1 - def.adjustmentPct, n)) * 100) : Math.round(def.adjustmentPct * 100);
    return <span className="font-mono text-[0.6rem] font-[600] text-[#EF4444]">−{compounded}%</span>;
  }
  return <span className="font-mono text-[0.6rem] font-[600] text-[#EF4444]">−{Math.round(def.adjustmentPct * 100)}%</span>;
}

export function ConditionAdjuster({
  baseValueGbp,
  priceSource,
  accidentCount,
}: {
  baseValueGbp: number;
  priceSource: string;
  accidentCount: number;
}) {
  const {
    toggles, setToggle, clearAll,
    adjustedCeilingGbp, isPartsOnly,
    adjustedMarginGbp, adjustedMarginPct,
  } = useReportAdjustment();

  const activeCount = ALL_TOGGLE_IDS.filter((id) => toggles[id]).length;

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
        <div>
          <p className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider">
            Condition &amp; Valuation
          </p>
          <p className="font-mono text-[0.62rem] text-[var(--text-muted)] mt-0.5 leading-[1.4]">
            Pre-selected from AI analysis — adjust if you know more.
          </p>
        </div>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="font-mono text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--amber)] transition-colors shrink-0 ml-4"
          >
            No issues — clean
          </button>
        )}
      </div>

      {/* Base value row */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-[rgba(255,255,255,0.02)]">
        <span className="font-mono text-[0.72rem] text-[var(--text-muted)]">
          Clean market value
          {priceSource === 'cap-clean' && (
            <span className="ml-1.5 px-1 py-0.5 rounded text-[0.55rem] border border-[#3B82F6]/40 text-[#3B82F6] bg-[rgba(59,130,246,0.08)]">
              CAP Clean
            </span>
          )}
          {priceSource === 'autotrader-live' && (
            <span className="ml-1.5 px-1 py-0.5 rounded text-[0.55rem] border border-[#22C55E]/40 text-[#22C55E] bg-[rgba(34,197,94,0.08)]">
              AutoTrader
            </span>
          )}
        </span>
        <span className="font-mono text-[0.72rem] font-[600] text-[var(--text-secondary)]">{fmt(baseValueGbp)}</span>
      </div>

      {/* Toggle list */}
      <div className="px-5 py-3 space-y-1">
        {ALL_TOGGLE_IDS.map((id) => {
          const def = CONDITION_ADJUSTMENTS[id];
          const checked = toggles[id];
          return (
            <label
              key={id}
              className={[
                'flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors select-none',
                checked
                  ? 'bg-[rgba(239,68,68,0.07)] border border-[rgba(239,68,68,0.25)]'
                  : 'border border-transparent hover:bg-[var(--bg-elevated)]',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setToggle(id, e.target.checked)}
                className="mt-0.5 shrink-0 w-3.5 h-3.5 accent-[#EF4444] cursor-pointer"
                aria-label={def.label}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-mono text-[0.72rem] ${checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    {def.label}
                  </span>
                  <AdjPct id={id} accidentCount={accidentCount} />
                </div>
                <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-0.5 leading-[1.4]">
                  {def.note}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      {/* Result */}
      <div className="px-5 pb-5">
        {isPartsOnly ? (
          <div className="p-4 rounded-xl border-2 border-[#EF4444]/40 bg-[rgba(239,68,68,0.06)]">
            <p className="font-mono text-xs font-[700] text-[#EF4444] uppercase tracking-wider mb-1">
              Parts Only — No Resale Value
            </p>
            <p className="font-mono text-[0.68rem] text-[var(--text-muted)] leading-[1.55]">
              Cat B vehicles cannot be returned to the road. The cost breakdown below still applies for buying decisions,
              but resale figures are suppressed. Parts value varies significantly by vehicle.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-[var(--amber)]/30 bg-[rgba(217,119,6,0.05)]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">
                Adjusted ceiling
              </span>
              <span
                className="font-display font-[800] text-2xl text-[var(--text-primary)]"
                style={{ transition: 'all 0.25s ease' }}
              >
                {fmt(adjustedCeilingGbp)}
              </span>
            </div>
            <div
              className={`mt-1 font-mono text-sm font-[600] text-right ${adjustedMarginGbp >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}
              style={{ transition: 'color 0.25s ease' }}
            >
              {adjustedMarginGbp >= 0
                ? `+${fmt(adjustedMarginGbp)}`
                : `−${fmt(Math.abs(adjustedMarginGbp))}`
              } margin ({adjustedMarginPct}%)
            </div>
            <p className="mt-2 font-mono text-[0.6rem] text-[var(--text-muted)] leading-[1.5]">
              All estimates — verify with HPI check, independent inspection, and bodyshop quotes before bidding.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
