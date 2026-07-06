'use client';
import { useReportAdjustment } from './ReportAdjustmentContext';
import type { ReportVerdict } from '@/types';

const VERDICT_CONFIG: Record<ReportVerdict, { label: string; className: string; bgClass: string }> = {
  pass:    { label: 'PASS',    className: 'verdict-pass',    bgClass: 'verdict-pass-bg' },
  caution: { label: 'CAUTION', className: 'verdict-caution', bgClass: 'verdict-caution-bg' },
  avoid:   { label: 'AVOID',   className: 'verdict-avoid',   bgClass: 'verdict-avoid-bg' },
};

export function VerdictBadge() {
  const { adjustedVerdict } = useReportAdjustment();
  const config = VERDICT_CONFIG[adjustedVerdict];
  return (
    <div
      className={`shrink-0 border rounded-xl px-5 py-3 text-center backdrop-blur-sm bg-black/25 ${config.className} ${config.bgClass}`}
      style={{ transition: 'all 0.3s ease' }}
    >
      <div className="font-display font-[800] text-2xl leading-none tracking-wider">{config.label}</div>
      <div className="font-mono text-[0.65rem] mt-1 opacity-70">Verdict</div>
    </div>
  );
}
