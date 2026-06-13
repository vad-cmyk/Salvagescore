'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  enabled?: boolean;
  beforeSrc?: string;
  afterSrc?: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function BeforeAfterSlider({
  enabled = false,
  beforeLabel = 'Before repair',
  afterLabel = 'After repair',
}: Props) {
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    updatePosition(e.clientX);
  }, [updatePosition]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setDragging(true);
    updatePosition(e.touches[0].clientX);
  }, [updatePosition]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => updatePosition(e.clientX);
    const onTouchMove = (e: TouchEvent) => updatePosition(e.touches[0].clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, updatePosition]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPosition(p => Math.max(0, p - 2));
    if (e.key === 'ArrowRight') setPosition(p => Math.min(100, p + 2));
  }, []);

  if (!enabled) return null;

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <div className="mb-8 text-center">
        <p className="font-mono text-xs text-[var(--amber)] uppercase tracking-[0.2em] mb-3">Before / After</p>
        <h2 className="font-display font-[800] text-[clamp(1.8rem,4vw,2.6rem)] leading-tight tracking-[-0.01em]">
          What a repair looks like
        </h2>
      </div>

      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-2xl border border-[var(--border)] cursor-ew-resize"
        style={{ aspectRatio: '16/7' }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="slider"
        aria-label="Before and after comparison"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Before (full width) */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A1D26] to-[#0A0B0E] flex items-center justify-center">
          <div className="text-center opacity-60">
            <div className="w-20 h-14 rounded-lg border border-[var(--border)] bg-[var(--bg)] mx-auto mb-2 flex items-center justify-center">
              <svg width="28" height="20" viewBox="0 0 28 20" fill="none" className="text-[var(--text-muted)]">
                <rect x="1" y="1" width="26" height="18" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M6 7l5 4 4-3 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="font-mono text-[0.6rem] text-[var(--text-muted)]">{beforeLabel}</p>
          </div>
        </div>

        {/* After (clipped by slider position) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(34,197,94,0.08)] to-[#0A0B0E] flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-14 rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] mx-auto mb-2 flex items-center justify-center">
                <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
                  <rect x="1" y="1" width="26" height="18" rx="2" stroke="#22C55E" strokeWidth="1.2" strokeOpacity="0.7"/>
                  <path d="M6 7l5 4 4-3 5 4" stroke="#22C55E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.7"/>
                  <path d="M19 12l2.5 2.5" stroke="#22C55E" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M20.5 10.5l2 2 3-3.5" stroke="#22C55E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="font-mono text-[0.6rem] text-[#22C55E]">{afterLabel}</p>
            </div>
          </div>
        </div>

        {/* Divider + handle */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/25"
          style={{ left: `${position}%`, transform: 'translateX(-50%)', touchAction: 'none' }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-grab active:cursor-grabbing">
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <path d="M5 1L1 5l4 4M9 1l4 4-4 4" stroke="#0A0B0E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute bottom-3 left-4 pointer-events-none">
          <span className="font-mono text-[0.58rem] text-[var(--text-muted)] bg-[rgba(0,0,0,0.65)] px-2 py-0.5 rounded">{beforeLabel}</span>
        </div>
        <div className="absolute bottom-3 right-4 pointer-events-none">
          <span className="font-mono text-[0.58rem] text-[#22C55E] bg-[rgba(0,0,0,0.65)] px-2 py-0.5 rounded">{afterLabel}</span>
        </div>
      </div>

      <p className="font-mono text-[0.62rem] text-[var(--text-muted)] text-center mt-3">
        Drag to compare · Keyboard: ← →
      </p>
    </section>
  );
}
