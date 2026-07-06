'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ReportDemo } from './ReportDemo';
import { FounderStory } from './FounderStory';
import { BeforeAfterSlider } from './BeforeAfterSlider';

// ── Scroll reveal hook ─────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ── Counter hook ──────────────────────────────────────────────────────────
function useCounter(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(target * ease));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return { value, ref };
}

// ── Data ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 4a7 7 0 100 14A7 7 0 0011 4z" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="11" cy="11" r="2.5" fill="currentColor"/>
        <path d="M2 11h2M18 11h2M11 2v2M11 18v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    category: 'Damage Analysis',
    title: 'AI Photo Analysis',
    desc: 'Every photo scanned by Claude Vision. Zones, severity, and specific findings identified per panel.',
    preview: (
      <div className="space-y-1.5">
        {[
          { zone: 'Front', sev: 'PANEL', color: 'text-[#EAB308] bg-[rgba(234,179,8,0.1)] border-[rgba(234,179,8,0.25)]' },
          { zone: 'Right Side', sev: 'COSMETIC', color: 'text-[#22C55E] bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.25)]' },
          { zone: 'Interior', sev: 'NONE', color: 'text-[#4A4F64] bg-[rgba(74,79,100,0.1)] border-[rgba(74,79,100,0.25)]' },
        ].map((r) => (
          <div key={r.zone} className="flex items-center justify-between">
            <span className="font-mono text-[0.6rem] text-[#5A6080]">{r.zone}</span>
            <span className={`font-mono text-[0.55rem] font-[600] px-1.5 py-0.5 rounded border ${r.color}`}>{r.sev}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M7 9h8M7 12h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M14 15l2-2-2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    category: 'Cost Model',
    title: 'Full Cost Breakdown',
    desc: 'Every fee itemised. Buyer fees, repair estimate, and import costs for UK buyers. Adapts automatically to your location.',
    preview: (
      <div className="space-y-1">
        {[
          { l: 'Hammer price', v: '£3,200' },
          { l: 'Buyer fee (~12%)', v: '£380' },
          { l: 'Repair estimate', v: '£1,620' },
        ].map((r) => (
          <div key={r.l} className="flex justify-between">
            <span className="font-mono text-[0.6rem] text-[#5A6080]">{r.l}</span>
            <span className="font-mono text-[0.6rem] text-[#9BA3C2]">{r.v}</span>
          </div>
        ))}
        <div className="pt-1 border-t border-[#2A2D38] flex justify-between">
          <span className="font-mono text-[0.6rem] text-[#9BA3C2] font-[600]">UK total</span>
          <span className="font-mono text-[0.6rem] text-[#F0EDE8] font-[600]">£5,200</span>
        </div>
      </div>
    ),
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 16l5-5 4 3 6-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 6h3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    category: 'Valuation',
    title: 'Resale & Market Value',
    desc: 'US buyers get Copart estimated retail + live market reference. UK buyers get live AutoTrader comparables and CAP Clean.',
    preview: (
      <div>
        <p className="font-mono text-2xl font-[700] text-[#F0EDE8] leading-none">$34,500</p>
        <p className="font-mono text-[0.6rem] text-[#22C55E] mt-1">+$26,470 margin after all costs</p>
        <p className="font-mono text-[0.6rem] text-[#5A6080] mt-1">Copart est. retail · US market ref.</p>
      </div>
    ),
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="12" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="3" y="12" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="12" y="12" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
    category: 'Calculator',
    title: 'Bid Sensitivity Matrix',
    desc: 'A 4×4 table showing P&L at every bid level and repair scenario. Know your max bid before the auction.',
    preview: (
      <div className="grid grid-cols-4 gap-0.5">
        {[
          '#22C55E','#22C55E','#22C55E','#EAB308',
          '#22C55E','#22C55E','#EAB308','#F97316',
          '#22C55E','#EAB308','#F97316','#EF4444',
          '#EAB308','#F97316','#EF4444','#EF4444',
        ].map((c, i) => (
          <div key={i} className="h-4 rounded-sm" style={{ background: c + '25', border: `1px solid ${c}40` }} />
        ))}
      </div>
    ),
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 3l1.8 5.5H19l-4.9 3.5 1.8 5.5L11 14l-4.9 3.5 1.8-5.5L3 8.5h6.2L11 3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    ),
    category: 'Safety',
    title: 'NHTSA Recall Check',
    desc: 'Open safety recalls auto-queried from the US NHTSA database. Know before you bid.',
    preview: (
      <div className="space-y-1.5">
        <div className="p-2 rounded border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.05)]">
          <p className="font-mono text-[0.6rem] text-[#EF4444] font-[600]">AIR BAGS · FRONTAL</p>
          <p className="font-mono text-[0.55rem] text-[#5A6080] mt-0.5">Campaign #21V123000</p>
        </div>
        <p className="font-mono text-[0.55rem] text-[#5A6080]">US lots only · Free NHTSA API</p>
      </div>
    ),
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M8 6h8M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <rect x="3" y="3" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
    category: 'Intelligence',
    title: 'Known Issues',
    desc: "AI-suggested list of likely reliability problems for this make, model, and year. Verify with a specialist before bidding.",
    preview: (
      <div className="space-y-1">
        {[
          { t: 'Timing chain rattle', c: 'text-[#EF4444] border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)]', s: 'major' },
          { t: 'Turbo oil seal failure', c: 'text-[#F97316] border-[rgba(249,115,22,0.3)] bg-[rgba(249,115,22,0.06)]', s: 'moderate' },
          { t: 'DSG service interval', c: 'text-[#EAB308] border-[rgba(234,179,8,0.3)] bg-[rgba(234,179,8,0.06)]', s: 'minor' },
        ].map((r) => (
          <div key={r.t} className={`px-2 py-1 rounded border font-mono text-[0.6rem] ${r.c}`}>{r.t}</div>
        ))}
      </div>
    ),
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M6 4h10a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M8 8h6M8 11h6M8 14h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M15 1v4M7 1v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    category: 'Tools',
    title: 'Bodyshop Spec',
    desc: 'Email-ready repair specification document. Send to 3 garages and get competing quotes.',
    preview: (
      <div className="space-y-0.5">
        <p className="font-mono text-[0.55rem] text-[#5A6080]">REPAIR SPECIFICATION — RFQ</p>
        <p className="font-mono text-[0.55rem] text-[#5A6080]">═══════════════════════════</p>
        <p className="font-mono text-[0.55rem] text-[#9BA3C2]">Front bumper — supply & fit    £480</p>
        <p className="font-mono text-[0.55rem] text-[#9BA3C2]">Right wing — dent repair       £620</p>
        <p className="font-mono text-[0.55rem] text-[#5A6080]">…</p>
        <button className="mt-1 font-mono text-[0.55rem] px-2 py-0.5 rounded border border-[#2A2D38] text-[#5A6080]">
          Copy spec →
        </button>
      </div>
    ),
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M11 7v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    category: 'Ownership',
    title: 'Annual Running Costs',
    desc: 'US buyers get fuel, registration, and insurance estimates. UK buyers get VED band, insurance group, and fuel cost.',
    preview: (
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { l: 'Registration', v: '~$300' },
          { l: 'Insurance', v: '~$2,800' },
          { l: 'Fuel / yr', v: '~$2,200' },
          { l: 'Total / yr', v: '~$5,300' },
        ].map((r) => (
          <div key={r.l} className="p-1.5 rounded border border-[#2A2D38] bg-[#111318]">
            <p className="font-mono text-[0.55rem] text-[#5A6080]">{r.l}</p>
            <p className="font-mono text-[0.65rem] text-[#9BA3C2] font-[600]">{r.v}</p>
          </div>
        ))}
      </div>
    ),
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Paste the lot URL',
    desc: 'Copy the URL from Copart US, Copart UK, or A Better Bid. Any lot works — active, sold, or ended.',
    detail: 'copart.com/lot/… · copart.co.uk/lot/… · abetter.bid/…',
  },
  {
    n: '02',
    title: 'AI runs the pipeline',
    desc: 'Photos get scanned by Claude Vision. Costs are modelled for your market. Market comparables are fetched. The whole thing takes about 90 seconds.',
    detail: 'Scrape → Vision → Cost model → Resale → Synthesis',
  },
  {
    n: '03',
    title: 'Get your verdict',
    desc: 'A full report with PASS / CAUTION / AVOID, deal score, every cost itemised, and a bid calculator. Share it or print it.',
    detail: 'PASS · CAUTION · AVOID · Deal score 0–100',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Which auction platforms are supported?',
    a: 'Copart US, Copart UK, and A Better Bid (which covers IAAI listings too). If your lot is on any of those three, paste the URL and it will work.',
  },
  {
    q: 'How is this different from US auction calculators?',
    a: 'Most auction tools are built for the US market only — US fees, US pricing, US dollars. SalvageScore is the only one built for UK Cat N/S buyers and for importing salvage cars from the US to the UK, with full duty, VAT, IVA, DVLA and left-hand-drive resale maths in pounds. We also support US domestic buying. If you\'re in the UK or importing here, that difference is the whole point.',
  },
  {
    q: 'How accurate are the repair cost estimates?',
    a: 'Estimates are panel-level using real labour and parts benchmarks, weighted by damage severity and a make-specific multiplier (a BMW costs more to repair than a Ford). They are guides — always get independent bodyshop quotes before bidding.',
  },
  {
    q: 'How long does the analysis take?',
    a: 'Typically 60–120 seconds. Listings with many photos or flood/fire damage take longer as the AI does more work. Don\'t close the tab while it runs.',
  },
  {
    q: 'Which buyer types does it support?',
    a: 'Select your buyer type before running the analysis. US buyers get a domestic cost breakdown (hammer + buyer fee + repair), Copart estimated retail value, NHTSA recall data, US running costs, and a US-specific timeline. UK importers get the full landed cost including ocean freight, 6.5% import duty, 20% VAT, IVA compliance, CAP Clean resale, and AutoTrader comparables. UK domestic buyers get a GBP-only breakdown against UK resale benchmarks.',
  },
  {
    q: 'What is the Deal Score?',
    a: 'A 0–100 composite score based on the margin between total landed cost and resale ceiling, damage severity, critical flags (airbag, flood, fire, theft), and AI confidence. 70+ is a good deal, 45–69 is caution, below 45 is poor value.',
  },
  {
    q: 'Is this financial advice?',
    a: 'No. This is an AI-generated analysis tool for research purposes. All figures are estimates. Auction bids are legally binding. Always inspect in person, get professional quotes, and carry out an HPI check before committing to any purchase.',
  },
  {
    q: 'What does it cost?',
    a: 'Free right now — no card required, no paywall. We\'re in early launch mode and want to prove the tool is genuinely useful before adding a subscription. Enjoy it while it lasts.',
  },
  {
    q: 'How is this different from a history check?',
    a: 'An HPI or Carfax check tells you about the car\'s past — finance, theft, write-offs. SalvageScore tells you about its future — what the repairs will cost, what the car is worth once fixed, and whether the numbers make sense at today\'s bid price. You still need both.',
  },
  {
    q: 'What if the analysis is wrong?',
    a: 'AI estimates carry margins of error. Repair costs can vary ±30% depending on your region and bodyshop. Treat everything as a research starting point — not a final figure. Always get an independent inspection and at least two bodyshop quotes before placing a bid.',
  },
  {
    q: 'Do you store my data?',
    a: 'We store your email address to give you account access and to keep your report history. We don\'t sell data or share it with third parties. You can delete your account and all associated data at any time. We comply with GDPR.',
  },
  {
    q: 'Can I use this for IAAI or Manheim?',
    a: 'IAAI listings appear on A Better Bid, so those work — paste the A Better Bid URL. Direct IAAI and Manheim URLs aren\'t supported yet, but they\'re on the roadmap.',
  },
];

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { value: count, ref } = useCounter(value, 1200);
  return (
    <div ref={ref} className="text-center px-6 py-8">
      <p className="font-display font-[800] text-[clamp(2.5rem,6vw,3.5rem)] leading-none tracking-[-0.02em] text-[var(--text-primary)]">
        {count}{suffix}
      </p>
      <p className="font-mono text-xs text-[var(--text-muted)] mt-2 uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────
function FeatureCard({ feature }: { feature: typeof FEATURES[0] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="feature-card relative p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover glow */}
      <div className={`absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_110%,rgba(217,119,6,0.07),transparent)] pointer-events-none transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`} />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`text-[var(--amber)] transition-transform duration-300 ${hovered ? 'scale-110' : 'scale-100'}`}>
            {feature.icon}
          </div>
          <span className="font-mono text-[0.55rem] text-[var(--text-muted)] uppercase tracking-widest border border-[var(--border)] px-1.5 py-0.5 rounded">
            {feature.category}
          </span>
        </div>

        <h3 className="font-display font-[700] text-lg leading-tight mb-1 text-[var(--text-primary)]">
          {feature.title}
        </h3>
        <p className="font-mono text-[0.7rem] text-[var(--text-muted)] leading-[1.6] mb-4">
          {feature.desc}
        </p>

        {/* Preview panel */}
        <div className={`transition-all duration-300 overflow-hidden ${hovered ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
            {feature.preview}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────
export function HomeMarketingSections() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const statsRef = useReveal();
  const featuresRef = useReveal();
  const stepsRef = useReveal();
  const faqRef = useReveal();

  const toggleFaq = useCallback((i: number) => {
    setOpenFaq((prev) => (prev === i ? null : i));
  }, []);

  return (
    <>
      {/* Hero — stacked layout: text on top, landscape iPhone below */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-4">
        <div className="animate-fade-up stagger-1 flex flex-col gap-10">

          {/* Text row */}
          <div className="max-w-2xl">
            <p className="font-mono text-xs text-[var(--amber)] uppercase tracking-[0.2em] mb-4">AI-powered auction analysis</p>
            <h1 className="font-display font-[800] text-[clamp(2.4rem,6vw,4rem)] leading-tight tracking-[-0.015em] mb-5">
              Should you buy it?
            </h1>
            <p className="font-mono text-[0.9rem] text-[var(--text-secondary)] leading-[1.8] mb-8">
              Paste a Copart UK, Copart US, or A Better Bid lot. AI scans the damage, models every cost, and gives you a go&nbsp;/&nbsp;no-go verdict in about 90 seconds — the only tool built for UK Cat&nbsp;N/S buyers and US-to-UK importers, with US domestic supported too.
            </p>
            <a
              href="/check"
              className="inline-flex items-center gap-3 px-7 py-4 rounded-xl bg-[var(--amber)] text-[#0A0B0E] font-display font-[700] text-lg uppercase tracking-[0.08em] hover:opacity-90 active:opacity-80 transition-opacity shadow-[0_8px_24px_rgba(217,119,6,0.3)]"
            >
              Get a free report
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <div className="flex flex-wrap gap-2 mt-5">
              {(['🇬🇧 UK Cat N/S buyers', '🌍 US-to-UK importers', '🇺🇸 US domestic buyers'] as const).map((label) => (
                <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] font-mono text-[0.7rem] text-[var(--text-muted)]">
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Landscape iPhone frame — full width */}
          <div className="relative">
            {/* Ambient glow */}
            <div className="absolute -inset-4 rounded-[2.8rem] bg-[radial-gradient(ellipse_at_50%_80%,rgba(217,119,6,0.18),transparent_65%)] blur-3xl pointer-events-none" />

            {/* iPhone landscape shell */}
            <div className="relative rounded-[2.2rem] border-2 border-[rgba(255,255,255,0.1)] bg-[#0A0B0E] shadow-[0_40px_100px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden flex items-stretch">

              {/* Left edge: camera + sensors */}
              <div className="shrink-0 w-10 flex flex-col items-center justify-center gap-2 bg-[#0A0B0E] px-2">
                {/* Front camera */}
                <div className="w-2.5 h-2.5 rounded-full bg-[rgba(255,255,255,0.15)] ring-1 ring-[rgba(255,255,255,0.06)]" />
                {/* Speaker dot */}
                <div className="w-1 h-1 rounded-full bg-[rgba(255,255,255,0.08)]" />
              </div>

              {/* Video */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src="https://xjugdyb7ivqd1ig6.public.blob.vercel-storage.com/1779749303026-o5rcujxp1gq.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="flex-1 block min-w-0 h-[280px] sm:h-[360px] lg:h-[420px] object-contain bg-[#0A0B0E]"
              />

              {/* Right edge: power button area */}
              <div className="shrink-0 w-8 bg-[#0A0B0E]" />
            </div>

            {/* Home indicator */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full bg-[rgba(255,255,255,0.2)]" />

            {/* Side buttons (top edge) */}
            <div className="absolute -top-px left-[20%] w-12 h-0.5 rounded-b-sm bg-[rgba(255,255,255,0.12)]" />
            <div className="absolute -top-px left-[30%] w-8 h-0.5 rounded-b-sm bg-[rgba(255,255,255,0.12)]" />
            <div className="absolute -top-px right-[25%] w-10 h-0.5 rounded-b-sm bg-[rgba(255,255,255,0.12)]" />
          </div>

        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-[var(--border)] bg-[var(--bg-surface)]">
        <div ref={statsRef} className="reveal max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[var(--border)]">
          <StatCard value={40}  suffix="+"  label="Data points per report" />
          <StatCard value={90}  suffix="s"  label="Avg. analysis time" />
          <StatCard value={3}   suffix=""   label="Auction platforms" />
          <StatCard value={8}   suffix=""   label="Report sections" />
        </div>
      </section>

      {/* Animated report demo */}
      <ReportDemo enabled={true} />

      {/* What's in the report */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div ref={featuresRef} className="reveal">
          <div className="mb-12 text-center">
            <p className="font-mono text-xs text-[var(--amber)] uppercase tracking-[0.2em] mb-3">What you get</p>
            <h2 className="font-display font-[800] text-[clamp(2rem,5vw,3.2rem)] leading-tight tracking-[-0.01em]">
              Every number you need.<br />
              <span className="text-[var(--text-secondary)]">Nothing you don&apos;t.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} />
            ))}
          </div>
        </div>
      </section>

      {/* Why SalvageScore is different */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
          {/* Amber left accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--amber)]" />
          {/* Ambient glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_0%_50%,rgba(217,119,6,0.04),transparent)] pointer-events-none" />

          <div className="relative p-8 md:p-12 pl-10 md:pl-14">
            <p className="font-mono text-xs text-[var(--amber)] uppercase tracking-[0.2em] mb-4">Why it&apos;s different</p>
            <h2 className="font-display font-[800] text-[clamp(1.6rem,4vw,2.4rem)] leading-tight tracking-[-0.01em] mb-6">
              Built in the UK, for the way Britain buys salvage.
            </h2>
            <div className="max-w-2xl space-y-4 font-mono text-[0.8rem] text-[var(--text-muted)] leading-[1.8]">
              <p>
                Most auction tools are US-only. SalvageScore is built from the ground up for UK reality — Cat N and Cat S categories, Copart UK fees, import duty and VAT, IVA and DVLA costs, the left-hand-drive resale hit, and real UK market comps in pounds.
              </p>
              <p>
                Whether you&apos;re rebuilding a Cat N locally or importing a salvage car from the US, you get the true number — not a US estimate that doesn&apos;t apply here.
              </p>
              <p className="text-[var(--text-secondary)]">
                And if you&apos;re buying US domestic, that&apos;s covered too.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-8">
              {[
                'Cat N / Cat S categories',
                'Copart UK fees',
                'Import duty + VAT',
                'IVA & DVLA costs',
                'LHD resale penalty',
                'AutoTrader & CAP comps in £',
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] font-mono text-[0.65rem] text-[var(--text-muted)]">
                  <span className="w-1 h-1 rounded-full bg-[var(--amber)] shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-[var(--border)]" />
      </div>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div ref={stepsRef} className="reveal">
          <div className="mb-12 text-center">
            <p className="font-mono text-xs text-[var(--amber)] uppercase tracking-[0.2em] mb-3">How it works</p>
            <h2 className="font-display font-[800] text-[clamp(2rem,5vw,3.2rem)] leading-tight tracking-[-0.01em]">
              Paste. Wait 90 seconds. Decide.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)] rounded-2xl overflow-hidden">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative bg-[var(--bg-surface)] p-8">
                {/* Step number — large background */}
                <span className="absolute top-4 right-6 font-display font-[800] text-[5rem] leading-none text-[var(--border)] select-none pointer-events-none">
                  {step.n}
                </span>
                <div className="relative">
                  <h3 className="font-display font-[700] text-xl leading-tight mb-3">{step.title}</h3>
                  <p className="font-mono text-[0.75rem] text-[var(--text-muted)] leading-[1.7] mb-4">{step.desc}</p>
                  <p className="font-mono text-[0.65rem] text-[var(--amber)]/70 border border-[var(--amber)]/20 bg-[rgba(217,119,6,0.05)] rounded px-3 py-2 leading-[1.5]">
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before/After slider — disabled until real images are ready */}
      <BeforeAfterSlider enabled={false} beforeLabel="Cat N collision damage" afterLabel="Fully repaired" />

      {/* Sample verdict banner */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)] p-8 md:p-12">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-[0.025] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_100%,rgba(34,197,94,0.05),transparent)]" />

          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex-1">
              <p className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-[0.2em] mb-3">Sample output</p>
              <h2 className="font-display font-[800] text-[clamp(1.8rem,4vw,2.8rem)] leading-tight tracking-[-0.01em] mb-4">
                2022 BMW 330i xDrive<br />
                <span className="text-[var(--text-secondary)]">Front-end collision, Salvage</span>
              </h2>
              <div className="flex flex-wrap gap-3 font-mono text-xs">
                <span className="px-3 py-1.5 rounded-lg border border-[#22C55E]/30 text-[#22C55E] bg-[rgba(34,197,94,0.06)]">All-in $8,030</span>
                <span className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)]">Market ref. $15,500</span>
                <span className="px-3 py-1.5 rounded-lg border border-[#22C55E]/30 text-[#22C55E] bg-[rgba(34,197,94,0.06)]">+$7,470 margin</span>
                <span className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)]">Score 71/100</span>
              </div>
              <Link
                href="/sample"
                className="mt-5 inline-flex items-center gap-2 font-mono text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                See full sample reports →
              </Link>
            </div>

            <div className="shrink-0 flex items-center gap-4">
              <div className="text-center">
                {/* Deal score gauge */}
                <div className="relative w-20 h-20 mx-auto mb-1">
                  <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#22C55E" strokeWidth="6"
                      strokeDasharray={`${(71 / 100) * 201} 201`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-display font-[800] text-xl text-[var(--text-primary)]">71</span>
                </div>
                <p className="font-mono text-[0.6rem] text-[#22C55E] uppercase tracking-wider">Deal score</p>
              </div>

              <div className="border border-[#22C55E]/40 bg-[rgba(34,197,94,0.08)] rounded-xl px-6 py-5 text-center">
                <p className="font-display font-[800] text-3xl tracking-wider text-[#22C55E]">PASS</p>
                <p className="font-mono text-[0.6rem] text-[#22C55E]/60 mt-1">Verdict</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder story */}
      <FounderStory enabled={true} />

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-[var(--border)]" />
      </div>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-24">
        <div ref={faqRef} className="reveal">
          <div className="mb-12 text-center">
            <p className="font-mono text-xs text-[var(--amber)] uppercase tracking-[0.2em] mb-3">Questions</p>
            <h2 className="font-display font-[800] text-[clamp(2rem,5vw,3rem)] leading-tight tracking-[-0.01em]">
              Common questions
            </h2>
          </div>

          <div className="space-y-0 border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {FAQ.map((item, i) => (
              <div key={i} className="bg-[var(--bg-surface)]">
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                >
                  <span className="font-display font-[600] text-[1.0625rem] text-[var(--text-primary)] pr-4">
                    {item.q}
                  </span>
                  <span className={`shrink-0 w-6 h-6 rounded-full border border-[var(--border)] flex items-center justify-center transition-transform duration-200 text-[var(--text-muted)] ${openFaq === i ? 'rotate-45' : ''}`}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </span>
                </button>
                <div className={`faq-body ${openFaq === i ? 'open' : ''}`}>
                  <p className="font-mono text-[0.8rem] text-[var(--text-muted)] leading-[1.75] px-6 pb-5">
                    {item.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 mb-6">
            <p className="font-mono text-xs text-[var(--text-muted)]">
              SalvageScore — AI-powered auction analysis for US &amp; UK buyers
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href="/privacy" className="font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Privacy</Link>
              <Link href="/terms" className="font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Terms</Link>
              <a href="mailto:vad@salvagescore.com" className="font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Contact</a>
              <Link href="/signin" className="font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Sign in</Link>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <p className="font-mono text-xs text-[var(--text-muted)]">
              For informational purposes only · Not financial advice · Always inspect before bidding
            </p>
            <p className="font-mono text-xs text-[var(--text-muted)]">Built in London</p>
          </div>
        </div>
      </footer>
    </>
  );
}
