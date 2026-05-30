'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STEPS = [
  { label: 'Scraping listing data',    detail: 'Fetching lot, photos & specs' },
  { label: 'Analysing photos with AI', detail: 'Vision model scanning damage' },
  { label: 'Running UK cost model',    detail: 'Duty, VAT, freight & repairs' },
  { label: 'Synthesising report',      detail: 'Writing verdict & narrative' },
];

const TICKER: string[] = [
  'Fetching lot details and auction photos…',
  'Checking for deployed airbags…',
  'Scanning flood waterline indicators…',
  'Identifying damaged body panels…',
  'Analysing frame and structural integrity…',
  'Detecting fire and smoke damage…',
  'Checking for theft strip signs…',
  'Pricing panel repairs by make…',
  'Applying luxury vehicle cost multiplier…',
  'Fetching live GBP / USD exchange rate…',
  'Calculating UK customs duty at 6.5%…',
  'Adding UK VAT at 20%…',
  'Estimating RORO ocean freight cost…',
  'Estimating IVA test and LHD mods…',
  'Looking up AutoTrader live comparables…',
  'Checking CAP Clean valuation…',
  'Applying salvage title penalty…',
  'Calculating LHD market discount…',
  'Factoring in mileage adjustment…',
  'Synthesising go / no-go verdict…',
];

export default function CheckPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [buyerLocation, setBuyerLocation] = useState<'uk' | 'us'>('uk');
  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [tickerIdx, setTickerIdx] = useState(0);

  const isValidUrl =
    url.includes('copart.com/lot/') ||
    url.includes('copart.co.uk/lot/') ||
    url.includes('abetter.bid/');

  useEffect(() => {
    if (!loading) { setElapsed(0); setTickerIdx(0); return; }
    const timer  = setInterval(() => setElapsed((s) => s + 1), 1000);
    const ticker = setInterval(() => setTickerIdx((i) => (i + 1) % TICKER.length), 2800);
    return () => { clearInterval(timer); clearInterval(ticker); };
  }, [loading]);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!url.trim()) return;
    setError('');
    setLoading(true);
    setStepIdx(0);

    const interval = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }, 20000);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), buyerLocation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      router.push(`/r/${data.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    } finally {
      clearInterval(interval);
    }
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const elapsedStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <main className="min-h-screen flex flex-col px-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_50%_at_50%_60%,rgba(217,119,6,0.06)_0%,transparent_70%)]" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.025] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:48px_48px]" />

      {/* Top nav */}
      <nav className="relative z-10 flex items-center justify-between py-5 max-w-xl mx-auto w-full">
        <Link href="/" className="group flex items-center gap-2">
          <div className="bg-white rounded-lg px-1.5 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="SalvageScore" className="h-7 w-auto" />
          </div>
          <span className="font-mono text-[0.65rem] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
            ← Home
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] live-dot" />
          <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">
            Copart US · Copart UK · A Better Bid
          </span>
        </div>
      </nav>

      {/* Centred form */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-12">
        <div className="w-full max-w-xl">

          <div className="animate-fade-up stagger-1 mb-8 text-center">
            <h1 className="font-display font-[800] text-[clamp(2rem,6vw,3rem)] leading-tight tracking-[-0.015em] mb-3">
              Analyse a lot
            </h1>
            <p className="font-mono text-[0.85rem] text-[var(--text-secondary)] leading-[1.7]">
              Paste a lot URL below. AI scans the photos, runs the cost model,<br className="hidden sm:block" />
              and delivers a full report in about 90 seconds.
            </p>
          </div>

          {/* Buyer location toggle */}
          {!loading && (
            <div className="animate-fade-up stagger-2 mb-4">
              <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider mb-2 text-center">
                Where are you buying from?
              </p>
              <div className="flex gap-2 p-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
                {([
                  { id: 'uk', flag: '🇬🇧', label: 'UK Buyer', desc: 'Import costs · UK resale' },
                  { id: 'us', flag: '🇺🇸', label: 'US Buyer', desc: 'Damage · Repair · Deal score' },
                ] as const).map(({ id, flag, label, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBuyerLocation(id)}
                    className={[
                      'flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-md transition-colors',
                      buyerLocation === id
                        ? 'bg-[var(--amber)] text-[#0A0B0E]'
                        : 'hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
                    ].join(' ')}
                  >
                    <span className="text-base leading-none">{flag}</span>
                    <div className="text-left">
                      <p className={`font-mono text-[0.75rem] font-semibold leading-none ${buyerLocation === id ? 'text-[#0A0B0E]' : ''}`}>
                        {label}
                      </p>
                      <p className={`font-mono text-[0.6rem] mt-0.5 leading-none ${buyerLocation === id ? 'text-[#0A0B0E]/70' : 'text-[var(--text-muted)]'}`}>
                        {desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="animate-fade-up stagger-3">
            <div className={`flex flex-col sm:flex-row gap-2 p-2 rounded-xl bg-[var(--bg-surface)] border transition-colors ${
              url && isValidUrl
                ? 'border-[rgba(34,197,94,0.4)]'
                : url && !isValidUrl
                ? 'border-[rgba(245,158,11,0.3)]'
                : 'border-[var(--border)]'
            }`}>
              <div className="flex-1 relative flex items-center">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.copart.com/lot/…"
                  disabled={loading}
                  autoFocus
                  className="w-full bg-transparent px-4 py-3 outline-none font-mono text-[0.8125rem] text-[var(--text-primary)] placeholder:opacity-30 disabled:opacity-40"
                />
                {url && (
                  <div className="absolute right-3 shrink-0">
                    {isValidUrl ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="1.3"/>
                        <path d="M4 7l2 2 4-4" stroke="#22C55E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" fill="rgba(245,158,11,0.1)" stroke="#F59E0B" strokeWidth="1.3"/>
                        <path d="M7 4v4M7 9.5v.5" stroke="#F59E0B" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className={[
                  'px-6 py-3 rounded-lg font-display font-[700] text-base uppercase tracking-[0.08em] transition-opacity disabled:opacity-40 min-w-[120px]',
                  loading
                    ? 'bg-transparent text-[var(--amber)] border border-[var(--amber)]'
                    : 'bg-[var(--amber)] text-[#0A0B0E] border-0',
                ].join(' ')}
              >
                {loading ? 'Running…' : 'Analyse →'}
              </button>
            </div>

            {/* Accepted URL formats */}
            {!loading && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {[
                  'copart.com/lot/…',
                  'copart.co.uk/lot/…',
                  'abetter.bid/…',
                ].map((fmt) => (
                  <span key={fmt} className="font-mono text-[0.65rem] text-[var(--text-muted)]">
                    {isValidUrl && url.includes(fmt.split('/')[0]) ? (
                      <span className="text-[#22C55E]">✓ </span>
                    ) : (
                      <span className="opacity-50">· </span>
                    )}
                    {fmt}
                  </span>
                ))}
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm font-mono text-[#EF4444]">{error}</p>
            )}
          </form>

          {/* Loading panel */}
          {loading && (
            <div className="animate-fade-up mt-8 space-y-5">
              <div className="relative h-[3px] w-full rounded-full bg-[var(--border)] overflow-hidden">
                <div className="progress-fill absolute inset-0 origin-left rounded-full bg-[var(--amber)]" />
                <div className="progress-shimmer absolute inset-0 rounded-full" />
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-3">
                {STEPS.map((step, i) => {
                  const done   = i < stepIdx;
                  const active = i === stepIdx;
                  return (
                    <div key={step.label} className={`flex items-center gap-3 ${done || active ? 'opacity-100' : 'opacity-[0.22]'}`}>
                      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                        {done ? (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="1.5"/>
                            <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : active ? (
                          <svg className="step-spinner" width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="6.5" stroke="var(--border)" strokeWidth="1.5"/>
                            <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="2.5" fill="var(--text-muted)"/>
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-mono text-xs leading-none ${active ? 'text-[var(--amber-bright)]' : done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
                          {step.label}
                        </p>
                        {active && (
                          <p className="mt-0.5 font-mono text-[0.65rem] text-[var(--text-muted)] leading-none">
                            {step.detail}
                          </p>
                        )}
                      </div>
                      {active && (
                        <div className="flex gap-[3px] items-end shrink-0">
                          {([0, 1, 2, 3] as const).map((d) => (
                            <div key={d} className={`step-bar step-bar-${d}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="h-[22px] overflow-hidden">
                <p key={tickerIdx} className="ticker-enter font-mono text-[0.7rem] text-[var(--text-muted)] leading-[22px]">
                  <span className="text-[var(--amber)] mr-1.5">›</span>{TICKER[tickerIdx]}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="font-mono text-[0.7rem] text-[var(--text-muted)]">Don&apos;t close this tab</p>
                <p className={`font-mono text-[0.7rem] tabular-nums ${elapsed > 60 ? 'text-[var(--amber-bright)]' : 'text-[var(--text-muted)]'}`}>
                  {elapsedStr}
                </p>
              </div>
            </div>
          )}

          {/* What you get — subtle reminder */}
          {!loading && (
            <div className="animate-fade-up stagger-5 mt-10 pt-8 border-t border-[var(--border)]">
              <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider mb-4 text-center">
                What&apos;s in the report
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  'AI photo analysis',
                  'UK landed cost',
                  'Resale ceiling',
                  'Bid calculator',
                  'Known issues',
                  'NHTSA recalls',
                  'Bodyshop spec',
                  'Running costs',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"
                  >
                    <span className="w-1 h-1 rounded-full bg-[var(--amber)] shrink-0" />
                    <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer footer */}
      <div className="relative z-10 max-w-xl mx-auto w-full pb-6 text-center">
        <p className="font-mono text-[0.6rem] text-[var(--text-muted)]">
          AI-generated analysis for informational purposes only · Not financial advice · Always inspect before bidding
        </p>
      </div>
    </main>
  );
}
