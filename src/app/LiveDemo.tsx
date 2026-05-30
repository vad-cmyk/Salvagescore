'use client';

import { useState, useEffect, useRef } from 'react';

type LineType = 'action' | 'finding' | 'good' | 'value' | 'verdict-pass' | 'verdict-avoid' | 'verdict-caution' | 'divider';
type SimLine = { text: string; type: LineType };

const SCRIPTS: SimLine[][] = [
  [
    { text: 'Parsing lot #45821903…', type: 'action' },
    { text: 'Loading 11 auction photos', type: 'action' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: 'Photo 1 · Front bumper', type: 'action' },
    { text: '  → Impact crease, right side ~30cm', type: 'finding' },
    { text: '  → Severity: PANEL   Est: £480', type: 'finding' },
    { text: 'Photo 2 · Right front wing', type: 'action' },
    { text: '  → Deep dent, paint cracked through', type: 'finding' },
    { text: '  → Severity: PANEL   Est: £620', type: 'finding' },
    { text: 'Photo 3 · Engine bay', type: 'action' },
    { text: '  → No structural damage ✓', type: 'good' },
    { text: 'Photo 4 · Interior', type: 'action' },
    { text: '  → Airbags not deployed ✓', type: 'good' },
    { text: '  → No flood waterline ✓', type: 'good' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: 'Running UK cost model…', type: 'action' },
    { text: '  Hammer price         £3,800', type: 'value' },
    { text: '  Import + freight     £1,200', type: 'value' },
    { text: '  Duty (6.5%) + VAT      £890', type: 'value' },
    { text: '  Repair estimate      £2,100', type: 'value' },
    { text: '  Total landed cost    £7,990', type: 'value' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: 'AutoTrader: 17 comparables found', type: 'good' },
    { text: '  Resale ceiling      £11,500', type: 'value' },
    { text: '  Margin              +£3,510', type: 'value' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: '✓  VERDICT: PASS   Score 74/100', type: 'verdict-pass' },
    { text: '──────────────────────────────', type: 'divider' },
  ],
  [
    { text: 'Parsing lot #38944201…', type: 'action' },
    { text: 'Loading 14 auction photos', type: 'action' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: 'Photo 1 · Interior rear', type: 'action' },
    { text: '  → Waterline detected at door sill', type: 'finding' },
    { text: '  → ⚠  FLOOD FLAG RAISED', type: 'finding' },
    { text: 'Photo 2 · Engine bay', type: 'action' },
    { text: '  → Terminal corrosion visible', type: 'finding' },
    { text: '  → Severity: STRUCTURAL', type: 'finding' },
    { text: 'Photo 3 · Boot', type: 'action' },
    { text: '  → Mud residue, carpet lifted', type: 'finding' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: 'Running UK cost model…', type: 'action' },
    { text: '  Hammer price         £2,200', type: 'value' },
    { text: '  Import + freight     £1,200', type: 'value' },
    { text: '  Flood remediation    £3,500', type: 'value' },
    { text: '  ECU replacement      £1,800', type: 'value' },
    { text: '  Total landed cost    £9,700', type: 'value' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: 'AutoTrader: 9 comparables found', type: 'good' },
    { text: '  Resale ceiling       £8,500', type: 'value' },
    { text: '  Margin              -£1,200', type: 'finding' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: '✗  VERDICT: AVOID  Score 18/100', type: 'verdict-avoid' },
    { text: '──────────────────────────────', type: 'divider' },
  ],
  [
    { text: 'Parsing lot #52109876…', type: 'action' },
    { text: 'Loading 9 auction photos', type: 'action' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: 'Photo 1 · Rear bumper', type: 'action' },
    { text: '  → Moderate rear impact', type: 'finding' },
    { text: '  → Severity: PANEL   Est: £950', type: 'finding' },
    { text: 'Photo 2 · Boot lid', type: 'action' },
    { text: '  → Crease, requires replacement', type: 'finding' },
    { text: '  → Severity: PANEL   Est: £720', type: 'finding' },
    { text: 'Photo 3 · Interior', type: 'action' },
    { text: '  → Airbags not deployed ✓', type: 'good' },
    { text: 'Photo 4 · Engine bay', type: 'action' },
    { text: '  → Clean, no damage ✓', type: 'good' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: 'Running UK cost model…', type: 'action' },
    { text: '  Hammer price         £5,400', type: 'value' },
    { text: '  Copart UK buyer fees   £740', type: 'value' },
    { text: '  Repair estimate      £3,100', type: 'value' },
    { text: '  Total all-in         £9,240', type: 'value' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: 'CAP Clean valuation: £12,800', type: 'good' },
    { text: '  Resale ceiling      £11,200', type: 'value' },
    { text: '  Margin              +£1,960', type: 'value' },
    { text: '──────────────────────────────', type: 'divider' },
    { text: '⚠  VERDICT: CAUTION Score 52/100', type: 'verdict-caution' },
    { text: '──────────────────────────────', type: 'divider' },
  ],
];

const LINE_DELAY = 130;
const RESET_DELAY = 4000;

const LINE_COLOR: Record<LineType, string> = {
  action:           'text-[#5A6080]',
  finding:          'text-[#F59E0B]',
  good:             'text-[#22C55E]',
  value:            'text-[#9BA3C2]',
  'verdict-pass':   'text-[#22C55E] font-[600] tracking-wide',
  'verdict-avoid':  'text-[#EF4444] font-[600] tracking-wide',
  'verdict-caution':'text-[#F59E0B] font-[600] tracking-wide',
  divider:          'text-[#2A2D38]',
};

export function LiveDemo() {
  const [scriptIdx, setScriptIdx] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const script = SCRIPTS[scriptIdx];

  useEffect(() => {
    setVisibleCount(0);
    let count = 0;
    const iv = setInterval(() => {
      count++;
      if (count <= script.length) {
        setVisibleCount(count);
      } else {
        clearInterval(iv);
        setTimeout(() => setScriptIdx((i) => (i + 1) % SCRIPTS.length), RESET_DELAY);
      }
    }, LINE_DELAY);
    return () => clearInterval(iv);
  }, [scriptIdx, script.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleCount]);

  return (
    <div className="relative rounded-2xl border border-[#2A2D38] bg-[#0D0F14] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.03)]">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E2028] bg-[#111318]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <p className="flex-1 text-center font-mono text-[0.6rem] text-[#3A3F55]">
          salvagescore — ai analysis pipeline
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] live-dot" />
          <span className="font-mono text-[0.6rem] text-[#22C55E]">running</span>
        </div>
      </div>

      {/* Terminal body */}
      <div className="h-[360px] overflow-y-auto scrollbar-hide p-4 space-y-0 relative">
        {/* Fade at top */}
        <div className="sticky top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#0D0F14] to-transparent pointer-events-none z-10" />

        {script.slice(0, visibleCount).map((line, i) => (
          <p
            key={`${scriptIdx}-${i}`}
            className={`font-mono text-[0.7rem] leading-[1.75] whitespace-pre ${LINE_COLOR[line.type]}`}
          >
            {line.text || ' '}
          </p>
        ))}

        {/* Blinking cursor */}
        {visibleCount < script.length && (
          <span className="inline-block w-[7px] h-[13px] bg-[var(--amber)] opacity-80 cursor-blink" />
        )}
        {visibleCount >= script.length && (
          <span className="inline-block w-[7px] h-[13px] bg-[var(--amber)] opacity-40 cursor-blink" />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Script indicator dots */}
      <div className="flex items-center justify-center gap-2 py-3 border-t border-[#1E2028] bg-[#111318]">
        {SCRIPTS.map((_, i) => (
          <button
            key={i}
            onClick={() => setScriptIdx(i)}
            className={`w-1.5 h-1.5 rounded-full transition-colors cursor-pointer ${i === scriptIdx ? 'bg-[var(--amber)]' : 'bg-[#2A2D38] hover:bg-[#3A3F55]'}`}
          />
        ))}
        <span className="font-mono text-[0.55rem] text-[#3A3F55] ml-2">
          {scriptIdx === 0 ? 'Front-end collision' : scriptIdx === 1 ? 'Flood damage' : 'Rear impact'}
        </span>
      </div>
    </div>
  );
}
