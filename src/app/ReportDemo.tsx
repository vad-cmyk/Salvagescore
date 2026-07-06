'use client';
import { useState, useEffect, useRef } from 'react';

const VERDICT_COLOR = '#EAB308';

const DEMO = {
  url: 'copart.co.uk/lot/56557906',
  vehicle: '2020 Land Rover Range Rover Sport',
  badge: 'Cat S · Copart UK · Lot 56557906',
  photos: [
    'https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/0626/4f39da6172ec473f88f5c2613f410734_thb.jpg',
    'https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/0626/4f084de238704889952dffac89e054b3_thb.jpg',
    'https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/0626/da72dced76ab4e3fbcde7fc03477c424_thb.jpg',
    'https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/0626/5591c26123204a838de5f1edf029f16f_thb.jpg',
    'https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/0626/421f68281f8e48da877b96391bb4d02f_thb.jpg',
    'https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/0626/08539e088834499bbe4230e769007ac0_thb.jpg',
    'https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/0626/e250a20dd41440b8aecc6fa0174d606c_thb.jpg',
    'https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/0626/e1192771817f438794d582dfb684be80_thb.jpg',
  ] as string[],
  photoFindings: ['STRUCT', 'PANEL', 'MECH', 'PANEL', 'COSMETIC', 'MECH', 'NONE', 'PANEL'] as string[],
  damageSummary: 'Front end structural · Undercarriage · Right side — 23 photos scanned',
  costs: [
    { l: 'Hammer price', v: '£11,500' },
    { l: 'Buyer fee (~12%)', v: '£1,380' },
    { l: 'Repair estimate', v: '£5,800' },
  ],
  total: '£18,680',
  resale: '£27,200',
  margin: '+£8,520 (46%)',
  score: 67,
};

export function ReportDemo({ enabled = true }: { enabled?: boolean }) {
  const [animKey, setAnimKey] = useState(0);
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [costCount, setCostCount] = useState(0);
  const [score, setScore] = useState(0);
  const [showVerdict, setShowVerdict] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setActive(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const el = headRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!active || !enabled) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setPhase(0); setPhotoCount(0); setCostCount(0); setScore(0); setShowVerdict(false);

    if (reduced) {
      setPhase(6); setPhotoCount(8); setCostCount(3); setScore(DEMO.score); setShowVerdict(true);
      return;
    }

    const ts: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => { ts.push(setTimeout(fn, ms)); };

    at(300,  () => setPhase(1));
    at(1000, () => setPhase(2));
    at(1800, () => setPhase(3));
    at(2400, () => setPhase(4));
    for (let i = 1; i <= 8; i++) at(2400 + i * 280, () => setPhotoCount(i));
    at(4850, () => { setPhase(5); setCostCount(1); });
    at(5450, () => setCostCount(2));
    at(6050, () => setCostCount(3));
    at(6900, () => {
      setPhase(6);
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const t = Math.min(elapsed / 1200, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        setScore(Math.round(DEMO.score * ease));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    at(7600, () => setShowVerdict(true));
    at(11200, () => setPhase(0));
    at(11900, () => setAnimKey(k => k + 1));

    return () => ts.forEach(clearTimeout);
  }, [animKey, active, enabled]);

  if (!enabled) return null;

  const statusMsg =
    phase === 2 ? 'Scraping lot data...' :
    phase === 3 || phase === 4 ? `Scanning photos — ${photoCount}/8 analysed` :
    phase === 5 ? 'Modelling repair costs...' :
    phase === 6 ? 'Fetching AutoTrader comparables...' : '';

  const CIRCUM = 2 * Math.PI * 32;

  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <div ref={headRef} className="reveal mb-10 text-center">
        <p className="font-mono text-xs text-[var(--amber)] uppercase tracking-[0.2em] mb-3">Live demo</p>
        <h2 className="font-display font-[800] text-[clamp(1.8rem,4vw,2.8rem)] leading-tight tracking-[-0.01em]">
          Watch the AI work
        </h2>
        <p className="font-mono text-sm text-[var(--text-muted)] mt-3">
          Runs every 12 seconds — no interaction needed.
        </p>
      </div>

      {/* Browser chrome frame */}
      <div
        ref={containerRef}
        className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        style={{
          background: 'var(--bg-surface)',
          opacity: phase === 0 ? 0.35 : 1,
          transition: 'opacity 0.6s ease',
        }}
      >
        {/* Chrome bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[#0D0E13]">
          <div className="flex gap-1.5 shrink-0">
            {(['rgba(239,68,68,0.4)', 'rgba(234,179,8,0.4)', 'rgba(34,197,94,0.4)'] as string[]).map((c, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div className="flex-1 min-w-0 mx-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="shrink-0 text-[var(--text-muted)]">
                <path d="M4.5 1a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" stroke="currentColor" strokeWidth="0.8"/>
                <path d="M4.5 4.5h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span className="font-mono text-[0.6rem] text-[var(--text-muted)] truncate min-w-0">
                {phase >= 1 ? `salvagescore.com/check → ${DEMO.url}` : 'salvagescore.com'}
              </span>
              {(phase === 2 || phase === 3) && (
                <span className="shrink-0 ml-auto flex gap-0.5 items-end">
                  {[0, 0.2, 0.4].map((d, i) => (
                    <span key={i} className="w-1 h-1 rounded-full bg-[var(--amber)] live-dot" style={{ animationDelay: `${d}s` }} />
                  ))}
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-[0.12em] px-2 py-0.5 rounded border border-[rgba(217,119,6,0.3)] text-[rgba(217,119,6,0.7)] bg-[rgba(217,119,6,0.06)]">
            demo
          </span>
        </div>

        {/* Report content */}
        <div className="p-6 min-h-[290px]">
          {/* Status line */}
          {statusMsg && (
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] shrink-0 live-dot" />
              <span className="font-mono text-[0.72rem] text-[var(--text-muted)]">{statusMsg}</span>
            </div>
          )}

          {/* Vehicle header */}
          {phase >= 3 && (
            <div className="mb-5 pb-4 border-b border-[var(--border)] animate-fade-up">
              <p className="font-mono text-[0.58rem] text-[var(--amber)] uppercase tracking-[0.18em] mb-0.5">{DEMO.badge}</p>
              <p className="font-display font-[700] text-[1.3rem] text-[var(--text-primary)]">{DEMO.vehicle}</p>
            </div>
          )}

          {/* Photos */}
          {phase >= 4 && (
            <div className="mb-5 animate-fade-up">
              <p className="font-mono text-[0.55rem] text-[var(--text-muted)] uppercase tracking-[0.18em] mb-2">Damage photos — 23 scanned</p>
              <div className="grid grid-cols-8 gap-1.5">
                {DEMO.photos.map((src, i) => {
                  const finding = DEMO.photoFindings[i];
                  const findingColor =
                    finding === 'STRUCT'   ? '#EF4444' :
                    finding === 'MECH'     ? '#F97316' :
                    finding === 'PANEL'    ? '#EAB308' :
                    finding === 'COSMETIC' ? '#22C55E' : '#4A4F64';
                  return (
                    <div
                      key={i}
                      className="aspect-square rounded-sm border border-[var(--border)] overflow-hidden relative"
                      style={{
                        opacity: i < photoCount ? 1 : 0,
                        transform: i < photoCount ? 'scale(1)' : 'scale(0.6)',
                        transition: 'opacity 0.22s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      {i < photoCount && (
                        <div
                          className="absolute bottom-0 left-0 right-0 px-0.5 py-0.5 font-mono text-[0.42rem] font-[700] text-center leading-none"
                          style={{ background: findingColor + '99', color: '#fff' }}
                        >
                          {finding}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {photoCount === 8 && (
                <p className="font-mono text-[0.55rem] text-[var(--text-muted)] mt-2 animate-fade-up">
                  {DEMO.damageSummary}
                </p>
              )}
            </div>
          )}

          {/* Cost breakdown */}
          {phase >= 5 && (
            <div className="mb-5 animate-fade-up">
              <p className="font-mono text-[0.55rem] text-[var(--text-muted)] uppercase tracking-[0.18em] mb-2">UK cost breakdown</p>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 space-y-1.5">
                {DEMO.costs.slice(0, costCount).map((c, i) => (
                  <div key={i} className="flex justify-between items-center animate-fade-up">
                    <span className="font-mono text-[0.68rem] text-[var(--text-muted)]">{c.l}</span>
                    <span className="font-mono text-[0.68rem] text-[var(--text-secondary)]">{c.v}</span>
                  </div>
                ))}
                {costCount >= 3 && (
                  <div className="flex justify-between items-center pt-1.5 mt-0.5 border-t border-[var(--border)] animate-fade-up">
                    <span className="font-mono text-[0.68rem] text-[var(--text-secondary)] font-[600]">UK total</span>
                    <span className="font-mono text-sm text-[var(--text-primary)] font-[700]">{DEMO.total}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Verdict */}
          {phase >= 6 && (
            <div className="flex items-center gap-4 pt-4 border-t border-[var(--border)] animate-fade-up">
              {/* Gauge */}
              <div className="relative w-14 h-14 shrink-0">
                <svg viewBox="0 0 80 80" className="w-14 h-14 -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke={VERDICT_COLOR} strokeWidth="8"
                    strokeDasharray={`${(score / 100) * CIRCUM} ${CIRCUM}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-display font-[800] text-base text-[var(--text-primary)]">
                  {score}
                </span>
              </div>

              {/* Stats */}
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">Resale ceiling</span>
                  <span className="font-mono text-[0.65rem] text-[var(--text-secondary)]">{DEMO.resale}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">Margin</span>
                  <span className="font-mono text-[0.65rem]" style={{ color: VERDICT_COLOR }}>{DEMO.margin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">Deal score</span>
                  <span className="font-mono text-[0.65rem]" style={{ color: VERDICT_COLOR }}>{score}/100</span>
                </div>
              </div>

              {/* Verdict badge */}
              {showVerdict && (
                <div
                  className="shrink-0 rounded-xl px-5 py-3 text-center"
                  style={{
                    border: `1px solid ${VERDICT_COLOR}40`,
                    background: `${VERDICT_COLOR}14`,
                    animation: 'fade-up 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
                  }}
                >
                  <p className="font-display font-[800] text-2xl tracking-[0.1em]" style={{ color: VERDICT_COLOR }}>CAUTION</p>
                  <p className="font-mono text-[0.5rem] mt-0.5 uppercase tracking-wider" style={{ color: VERDICT_COLOR + '99' }}>Verdict</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
