'use client';
import { useReportAdjustment } from './ReportAdjustmentContext';

export function DealScoreGauge() {
  const { adjustedDealScore: score } = useReportAdjustment();
  const isGood = score >= 70;
  const isMid  = score >= 45;
  const labelText   = isGood ? 'Good deal' : isMid ? 'Caution'   : 'Poor deal';
  const labelColor  = isGood ? 'text-[#22C55E]' : isMid ? 'text-[#EAB308]' : 'text-[#EF4444]';
  const strokeColor = isGood ? '#22C55E'   : isMid ? '#EAB308'   : '#EF4444';
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="shrink-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
          <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <circle cx="24" cy="24" r={r} fill="none" stroke={strokeColor} strokeWidth="4"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.3s ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono font-[700] text-sm text-white">
          {score}
        </span>
      </div>
      <span className={`font-mono text-[0.6rem] mt-1 font-[600] ${labelColor}`}>{labelText}</span>
    </div>
  );
}
