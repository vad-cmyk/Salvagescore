'use client';

import { useState } from 'react';
import { BidCalculator } from '@/app/r/[slug]/BidCalculator';

// ── Shared UI ──────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider">
      {children}
    </p>
  );
}

function CostRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 border-b border-[var(--border)] last:border-0 ${highlight ? 'pt-2.5' : ''}`}>
      <span className={`font-mono text-sm ${highlight ? 'text-[var(--text-primary)] font-[600]' : 'text-[var(--text-muted)]'}`}>{label}</span>
      <span className={`font-mono text-sm font-[600] ${highlight ? 'text-[var(--amber-bright)]' : 'text-[var(--text-secondary)]'}`}>{value}</span>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: 'pass' | 'caution' | 'avoid' }) {
  const cfg = {
    pass:    { label: 'PASS',    cls: 'border-[#22C55E]/40 bg-[rgba(34,197,94,0.08)] text-[#22C55E]' },
    caution: { label: 'CAUTION', cls: 'border-[#EAB308]/40 bg-[rgba(234,179,8,0.08)] text-[#EAB308]' },
    avoid:   { label: 'AVOID',   cls: 'border-[#EF4444]/40 bg-[rgba(239,68,68,0.08)] text-[#EF4444]' },
  }[verdict];
  return (
    <div className={`border rounded-xl px-6 py-4 text-center ${cfg.cls}`}>
      <div className="font-display font-[800] text-2xl leading-none tracking-wider">{cfg.label}</div>
      <div className="font-mono text-[0.6rem] mt-1 opacity-60">Verdict</div>
    </div>
  );
}

function DealScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#22C55E' : score >= 45 ? '#EAB308' : '#EF4444';
  const circumference = 201;
  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto mb-1">
        <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${(score / 100) * circumference} ${circumference}`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display font-[800] text-xl text-[var(--text-primary)]">{score}</span>
      </div>
      <p className="font-mono text-[0.6rem] uppercase tracking-wider" style={{ color }}>Deal score</p>
    </div>
  );
}

function IssueCard({ category, issue, severity }: { category: string; issue: string; severity: 'major' | 'moderate' | 'minor' }) {
  const cls = severity === 'major'
    ? 'text-[#EF4444] border-[#EF4444]/30 bg-[rgba(239,68,68,0.06)]'
    : severity === 'moderate'
    ? 'text-[#F97316] border-[#F97316]/30 bg-[rgba(249,115,22,0.06)]'
    : 'text-[#EAB308] border-[#EAB308]/30 bg-[rgba(234,179,8,0.06)]';
  return (
    <div className={`p-3 rounded-lg border ${cls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span className="font-mono text-[0.65rem] font-[700] uppercase tracking-wider opacity-70">{category}</span>
          <p className="font-mono text-[0.8rem] font-[500] mt-0.5">{issue}</p>
        </div>
        <span className={`font-mono text-[0.6rem] font-[700] uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 ${cls}`}>
          {severity}
        </span>
      </div>
    </div>
  );
}

function RunningCostCard({ label, value, note, highlight }: { label: string; value: string; note: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? 'border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)]' : 'border-[var(--border)] bg-[var(--bg)]'}`}>
      <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-mono text-lg font-[700] leading-none ${highlight ? 'text-[var(--amber-bright)]' : 'text-[var(--text-primary)]'}`}>{value}</p>
      <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-1">{note}</p>
    </div>
  );
}

// ── Mock report data ───────────────────────────────────────────────────────

const REPORTS = [
  {
    id: 'uk-domestic',
    tab: 'UK Domestic',
    sub: 'Cat N · GBP only',
    title: '2020 Volkswagen Golf',
    trim: '2.0 TDI SE Nav 5dr',
    source: 'COPART-UK',
    lot: '54321789',
    titleStatus: 'Cat N — Non-structural write-off',
    primaryDamage: 'Front-end collision',
    odometer: '41,200 miles',
    verdict: 'pass' as const,
    dealScore: 74,
    summary: 'Rear-ended while stationary. Front bumper, bonnet, and right headlight cluster are visibly damaged. The engine bay shows cosmetic scuffing to the slam panel but no visible structural deformation to the front chassis rails. No airbag deployment, no flood waterline, no evidence of fire. The repair estimate is conservative and CAP Clean for this spec puts resale comfortably above all-in cost. Deal score 74 — passes at current bid.',
    costLines: [
      { label: 'Hammer price', value: '£3,200' },
      { label: 'Copart UK buyer fee (~12%)', value: '£380' },
      { label: 'Repair estimate', value: '£1,620' },
    ],
    totalLabel: 'All-in (UK domestic)',
    totalValue: '£5,200',
    resale: { label: 'CAP Clean (this spec)', value: '£12,500', source: 'CAP HPI' },
    resaleAfterPenalty: { label: 'Resale ceiling (Cat N −25%)', value: '£9,375' },
    margin: { label: 'Margin', value: '+£4,175 (45%)', color: '#22C55E' },
    bidCalc: {
      resaleCeilingGbp: 9375,
      fixedCostsGbp: 2000,    // buyer fee + repair
      repairEstimateGbp: 1620,
      currentHammerGbp: 3200,
      exchangeRateUsed: 1.27,
      isUkSource: true,
      isUsBuyer: false,
    },
    knownIssues: [
      { category: 'Engine', issue: 'High-pressure fuel pump failure on 2.0 TDI — symptoms: rough running, hard start', severity: 'moderate' as const },
      { category: 'DSG / Gearbox', issue: 'Mechatronic unit faults on DSG gearbox — costly to replace', severity: 'moderate' as const },
      { category: 'DPF', issue: 'Diesel particulate filter blockage on low-mileage city use', severity: 'minor' as const },
    ],
    running: [
      { label: 'Road Tax (VED)', value: '£180', note: 'Band D — 121–130 g/km' },
      { label: 'Insurance', value: '~£850', note: 'Group 13 (Cat N est.)' },
      { label: 'Fuel', value: '~£1,620', note: 'Diesel · 10,000 mi/yr' },
      { label: 'Estimated annual essentials', value: '~£2,650', note: '~£221/mo', highlight: true },
    ],
    runningNote: 'Includes: VED, insurance (Cat N est.), fuel · Excludes: servicing, tyres, MOT',
  },
  {
    id: 'uk-importer',
    tab: 'UK Importer',
    sub: 'US→UK · Full landed cost',
    title: '2022 GMC Sierra 1500',
    trim: 'Denali Ultimate 6.2 V8',
    source: 'COPART-US',
    lot: '72948301',
    titleStatus: 'Salvage — rebuilt required',
    primaryDamage: 'Front-end collision',
    odometer: '28,400 miles',
    verdict: 'pass' as const,
    dealScore: 66,
    summary: 'High-spec Denali Ultimate with 6.2L V8 and multicolour heads-up display. Front impact at 30–40mph — bonnet, both front wings, front bumper, and grille destroyed. Frame rails are straight with no visible kinking. No airbag deployment visible in photos. Landed cost with full UK import compliance is £22,400. UK grey-import market for a Denali Ultimate puts resale at £32,000–36,000 for a repair standard this clean. Margin is solid but not exceptional — strong deal at current bid.',
    costLines: [
      { label: 'Hammer price (at $13,500)', value: '£10,630' },
      { label: 'Copart buyer fee (~12%)', value: '£1,275' },
      { label: 'US transport to port', value: '£320' },
      { label: 'Ocean freight (RoRo)', value: '£1,200' },
      { label: 'UK import duty (6.5%)', value: '£860' },
      { label: 'VAT on landed value (20%)', value: '£2,450' },
      { label: 'IVA compliance + DVLA', value: '£1,700' },
      { label: 'Repair estimate', value: '£3,965' },
    ],
    totalLabel: 'Total landed cost (GBP)',
    totalValue: '£22,400',
    resale: { label: 'UK grey-import market (similar spec)', value: '£34,000', source: 'AutoTrader est.' },
    resaleAfterPenalty: { label: 'Resale ceiling (salvage −35%)', value: '£22,100' },
    margin: { label: 'Margin', value: '+£11,600 (34%)', color: '#22C55E' },
    bidCalc: {
      resaleCeilingGbp: 22100,
      fixedCostsGbp: 11770,   // everything except hammer
      repairEstimateGbp: 3965,
      currentHammerGbp: 10630,
      exchangeRateUsed: 1.27,
      isUkSource: false,
      isUsBuyer: false,
    },
    knownIssues: [
      { category: 'AFM / Cylinder deactivation', issue: 'Active Fuel Management lifter failures on 6.2L V8 — very common, expensive', severity: 'major' as const },
      { category: 'Transmission', issue: '10-speed automatic harsh shift on cold start — TSB issued', severity: 'moderate' as const },
      { category: 'Tailgate', issue: 'Multi-pro tailgate motor failures — common on Denali trim', severity: 'minor' as const },
    ],
    running: [
      { label: 'Road Tax (VED)', value: '£620', note: 'Band M — 220+ g/km V8' },
      { label: 'Insurance', value: '~£2,200', note: 'Group 36 (rebuilt est.)' },
      { label: 'Fuel', value: '~£4,800', note: 'Petrol V8 · 10k mi/yr' },
      { label: 'Estimated annual essentials', value: '~£7,620', note: '~£635/mo', highlight: true },
    ],
    runningNote: 'Includes: VED (Band M), insurance (rebuilt est.), fuel V8 · Excludes: servicing, tyres, ULEZ charges',
  },
  {
    id: 'us-domestic',
    tab: 'US Domestic',
    sub: 'USD only · US buyer',
    title: '2022 BMW 330i xDrive',
    trim: 'Sport Line · Mineral White',
    source: 'COPART-US',
    lot: '63291047',
    titleStatus: 'Salvage — rebuilt required',
    primaryDamage: 'Front-end collision',
    odometer: '19,800 miles',
    verdict: 'pass' as const,
    dealScore: 71,
    summary: 'Low-mileage 330i xDrive. Front-end collision — bonnet, front bumper, right headlight, and right front wing need replacement. No airbag deployment. Interior clean with no flood or fire evidence. Repair estimate is mid-range for a BMW panel job at an independent. All-in cost of $8,030 against a Copart estimated retail of $34,500 ($15,500 adj. for salvage title). Margin above $7,000 and deal score 71 — qualified PASS.',
    costLines: [
      { label: 'Hammer price', value: '$4,800' },
      { label: 'Copart buyer fee (~12%)', value: '$580' },
      { label: 'Repair estimate', value: '$2,650' },
    ],
    totalLabel: 'All-in (US domestic)',
    totalValue: '$8,030',
    resale: { label: 'Copart estimated retail', value: '$34,500', source: 'Copart est.' },
    resaleAfterPenalty: { label: 'Market ref. (salvage adj.)', value: '$15,500' },
    margin: { label: 'Margin', value: '+$7,470 (48%)', color: '#22C55E' },
    bidCalc: {
      resaleCeilingGbp: Math.round(15500 / 1.27),
      fixedCostsGbp: Math.round(3230 / 1.27),
      repairEstimateGbp: Math.round(2650 / 1.27),
      currentHammerGbp: Math.round(4800 / 1.27),
      exchangeRateUsed: 1.27,
      isUkSource: false,
      isUsBuyer: true,
    },
    knownIssues: [
      { category: 'Engine', issue: 'B48 engine coolant leak at expansion tank / hose junction — common on 2019–2022', severity: 'moderate' as const },
      { category: 'Electrical', issue: 'iDrive display delamination on pre-2022 facelift — cosmetic but expensive', severity: 'minor' as const },
      { category: 'Brakes', issue: 'Aggressive brake dust on xDrive models — pads wear faster than AWD competitors', severity: 'minor' as const },
    ],
    running: [
      { label: 'Registration', value: '~$300', note: 'Est. avg. all states' },
      { label: 'Insurance', value: '~$2,800', note: 'Rebuilt title (est.)' },
      { label: 'Fuel', value: '~$2,200', note: '~30 mpg · $3.30/gal' },
      { label: 'Estimated annual essentials', value: '~$5,300', note: '~$442/mo', highlight: true },
    ],
    runningNote: 'Includes: registration, insurance (rebuilt title), fuel · Excludes: servicing, tyres, parking',
  },
];

// ── Component ──────────────────────────────────────────────────────────────
export function SampleReports() {
  const [active, setActive] = useState(0);
  const report = REPORTS[active];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] mb-8 overflow-x-auto">
        {REPORTS.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActive(i)}
            className={[
              'flex-1 min-w-[110px] flex flex-col items-center px-4 py-2.5 rounded-lg transition-colors cursor-pointer',
              active === i
                ? 'bg-[var(--bg-elevated)] border border-[var(--border)]'
                : 'hover:bg-[var(--bg-elevated)]/50',
            ].join(' ')}
          >
            <span className={`font-display font-[700] text-sm leading-tight ${active === i ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
              {r.tab}
            </span>
            <span className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-0.5">{r.sub}</span>
          </button>
        ))}
      </div>

      {/* Report card */}
      <div key={report.id} className="animate-fade-up stagger-1">

        {/* Hero banner */}
        <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)] mb-4">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,rgba(217,119,6,0.06),transparent)]" />
          <div className="relative p-6 md:p-8">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[0.6rem] text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 rounded uppercase tracking-widest">{report.source}</span>
                  <span className="font-mono text-[0.6rem] text-[var(--text-muted)]">Lot #{report.lot}</span>
                </div>
                <h1 className="font-display font-[800] text-[clamp(1.6rem,4vw,2.4rem)] leading-tight tracking-[-0.01em] text-[var(--text-primary)]">
                  {report.title}
                </h1>
                <p className="font-mono text-sm text-[var(--text-secondary)] mt-1">{report.trim}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="font-mono text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)]">{report.primaryDamage}</span>
                  <span className="font-mono text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)]">{report.odometer}</span>
                  <span className="font-mono text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)]">{report.titleStatus}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <DealScoreGauge score={report.dealScore} />
                <VerdictBadge verdict={report.verdict} />
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] mb-4">
          <SectionLabel>AI Summary</SectionLabel>
          <p className="font-mono text-[0.875rem] leading-[1.75] text-[var(--text-secondary)] mt-3">{report.summary}</p>
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.04)]">
            <svg className="shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5l5.5 10h-11L7 1.5z" stroke="#D97706" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M7 5.5v3M7 9.5v.5" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <p className="font-mono text-[0.65rem] text-[var(--text-muted)] leading-[1.65]">
              <span className="font-[600] text-[#D97706]">Sample report — static mock data for illustration.</span>{' '}
              Real reports are generated live from auction listings with actual AI photo analysis, live market data, and your chosen buyer type.
            </p>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] mb-4">
          <SectionLabel>{report.id === 'uk-importer' ? 'UK Landed Cost' : report.id === 'us-domestic' ? 'Cost Estimate' : 'UK Cost Breakdown'}</SectionLabel>
          <div className="mt-3">
            {report.costLines.map((l) => (
              <CostRow key={l.label} label={l.label} value={l.value} />
            ))}
            <CostRow label={report.totalLabel} value={report.totalValue} highlight />
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
              <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">{report.resale.label}</p>
              <p className="font-mono text-base font-[700] text-[var(--text-primary)]">{report.resale.value}</p>
              <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-0.5">{report.resale.source}</p>
            </div>
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
              <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">{report.resaleAfterPenalty.label}</p>
              <p className="font-mono text-base font-[700] text-[var(--text-primary)]">{report.resaleAfterPenalty.value}</p>
            </div>
            <div className="p-3 rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)]">
              <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">{report.margin.label}</p>
              <p className="font-mono text-base font-[700]" style={{ color: report.margin.color }}>{report.margin.value}</p>
            </div>
          </div>
        </div>

        {/* Bid calculator */}
        <BidCalculator {...report.bidCalc} />

        {/* Known issues */}
        <div className="mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Known Issues — {report.title}</SectionLabel>
            <span className="font-mono text-[0.65rem] text-[var(--amber)]/70 border border-[var(--amber)]/20 bg-[rgba(217,119,6,0.05)] rounded px-2 py-0.5">
              AI-suggested — verify before bidding
            </span>
          </div>
          <div className="space-y-3">
            {report.knownIssues.map((issue, i) => (
              <IssueCard key={i} {...issue} />
            ))}
          </div>
          <p className="mt-3 font-mono text-[0.6rem] text-[var(--text-muted)]">
            Based on likely patterns for this make/model · AI-suggested — always verify with a specialist before bidding
          </p>
        </div>

        {/* Annual running costs */}
        <div className="mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <SectionLabel>Estimated Annual Running Costs</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 mb-3">
            {report.running.map((r) => (
              <RunningCostCard key={r.label} label={r.label} value={r.value} note={r.note} highlight={r.highlight} />
            ))}
          </div>
          <p className="font-mono text-[0.6rem] text-[var(--text-muted)] leading-[1.6]">{report.runningNote}</p>
        </div>

      </div>
    </div>
  );
}
