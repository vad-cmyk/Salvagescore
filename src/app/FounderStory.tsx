'use client';
import { useRef, useEffect } from 'react';

export function FounderStory({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled]);

  if (!enabled) return null;

  return (
    <section className="max-w-4xl mx-auto px-6 py-24">
      <div ref={ref} className="reveal">
        <p className="font-mono text-xs text-[var(--amber)] uppercase tracking-[0.2em] mb-10">Why we built this</p>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-10 items-start">
          {/* Photo column */}
          <div className="shrink-0">
            <div className="w-[160px] aspect-square rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col items-center justify-center gap-2">
              <div className="w-14 h-14 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center">
                <span className="font-display font-[700] text-2xl text-[var(--text-muted)]">V</span>
              </div>
              <span className="font-mono text-[0.55rem] text-[var(--text-muted)] px-3 text-center leading-snug">
                Photo coming soon
              </span>
            </div>
            <p className="font-display font-[700] text-base mt-4 text-[var(--text-primary)]">Vadim</p>
            <p className="font-mono text-[0.65rem] text-[var(--text-muted)] mt-0.5">Founder · SalvageScore</p>
          </div>

          {/* Story column */}
          <div>
            <blockquote className="border-l-2 border-[var(--amber)] pl-6 mb-8">
              <p className="font-display font-[600] text-[clamp(1.25rem,2.8vw,1.75rem)] leading-snug text-[var(--text-primary)] tracking-[-0.01em]">
                &ldquo;I lost money on a salvage car because I didn&apos;t know what I didn&apos;t know.&rdquo;
              </p>
            </blockquote>
            <div className="space-y-4 font-mono text-[0.8rem] text-[var(--text-muted)] leading-[1.85]">
              <p>
                I bought a Cat&nbsp;N at auction that looked like a bargain. Hammer was £4,200.
                The bodyshop quote came back at £6,400 — three times what I expected.
                I sold it for less than I paid.
              </p>
              <p>
                The information existed. It just wasn&apos;t in one place, formatted for a quick
                decision at 11pm before a 9am auction. So I built the tool I wish I&apos;d had.
              </p>
              <p>
                SalvageScore takes 90 seconds. It won&apos;t replace an inspection or an HPI check —
                but it will tell you whether either is even worth booking.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
