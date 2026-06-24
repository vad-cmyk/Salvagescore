import { notFound } from 'next/navigation';
import { getReportBySlug } from '@/lib/supabase';
import type { Report, ReportVerdict, Listing, DamageFindings } from '@/types';
import { BidCalculator } from './BidCalculator';
import { BodyshopSpec } from './BodyshopSpec';
import { CopyVin } from './CopyVin';
import { ShareButton, PrintButton, WhatsAppButton } from './ReportActions';
import { PANEL_LABELS } from '@/lib/cost-model/defaults';
import { generateBodyshopSpec } from '@/lib/bodyshop-spec';
import AuctionCountdown from './AuctionCountdown';
import UlezBadge from './UlezBadge';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import ClaimPrompt from './ClaimPrompt';

export const revalidate = 0;

const VERDICT_CONFIG: Record<ReportVerdict, { label: string; className: string; bgClass: string }> = {
  pass:    { label: 'PASS',    className: 'verdict-pass',    bgClass: 'verdict-pass-bg' },
  caution: { label: 'CAUTION', className: 'verdict-caution', bgClass: 'verdict-caution-bg' },
  avoid:   { label: 'AVOID',   className: 'verdict-avoid',   bgClass: 'verdict-avoid-bg' },
};

const ZONE_LABELS: Record<string, string> = {
  'front':         'Front',
  'rear':          'Rear',
  'side-lh':       'Left Side',
  'side-rh':       'Right Side',
  'roof':          'Roof',
  'undercarriage': 'Undercarriage',
  'interior':      'Interior',
  'engine-bay':    'Engine Bay',
};

const SEVERITY_BADGE: Record<string, string> = {
  cosmetic:   'bg-[rgba(34,197,94,0.85)]  text-white',
  panel:      'bg-[rgba(234,179,8,0.85)]  text-black',
  structural: 'bg-[rgba(249,115,22,0.85)] text-white',
  frame:      'bg-[rgba(239,68,68,0.85)]  text-white',
};

const SEVERITY_DOT: Record<string, string> = {
  cosmetic:   'bg-[#22C55E]',
  panel:      'bg-[#EAB308]',
  structural: 'bg-[#F97316]',
  frame:      'bg-[#EF4444]',
};

function fmt(n: number) {
  return `£${n.toLocaleString('en-GB')}`;
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report: Report | null = await getReportBySlug(slug);
  if (!report) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;
  const isOwned = !!user && !!report.userId && report.userId === user.id;

  const verdict = VERDICT_CONFIG[report.verdict];
  const { listing, damage, cost, resale, sections } = report;
  const isUsBuyer = (report.buyerLocation ?? 'uk') === 'us';
  const isUkImport = listing.source === 'copart-uk';

  // For US buyers: use hammer + repair only (no import costs) as the "total"
  const repairLineGbp = cost.lineItems.find((l) => l.label === 'Repair estimate')?.amountGbp
    ?? (cost.repairSubtotalGbp + cost.hiddenDamageContingencyGbp);
  const usTotalGbp = cost.hammerGbp + repairLineGbp;
  const usMarketGbp = listing.estRetailUsd
    ? Math.round(listing.estRetailUsd / cost.exchangeRateUsed)
    : null;
  const usMarginGbp = usMarketGbp !== null ? usMarketGbp - usTotalGbp : null;

  const effectiveTotalGbp  = isUsBuyer ? usTotalGbp  : cost.totalGbp;
  const effectiveCeilingGbp = isUsBuyer && usMarketGbp !== null ? usMarketGbp : resale.ceilingGbp;
  const margin    = effectiveCeilingGbp - effectiveTotalGbp;
  const marginPct = Math.round((margin / effectiveCeilingGbp) * 100);

  const dealScore = computeDealScore(marginPct, damage, resale.confidence);
  const isNonRunner = damage.criticalFlags.nonRunner === true;
  // When Copart UK's "Engine Start Program" confirms the engine starts but the car is still marked
  // immobile (driveStatus=false / IV code), the issue isn't the engine — it's drivetrain/structural.
  const isImmobileButEngineRuns = isNonRunner && listing.engineStarts === true;

  // Mechanical scenario cost range (best / worst across all scenarios)
  const mechScenarios = report.mechanicalScenarios ?? [];
  const mechBestGbp  = mechScenarios.length > 0 ? Math.min(...mechScenarios.map((s) => s.costGbp.min)) : null;
  const mechWorstGbp = mechScenarios.length > 0 ? Math.max(...mechScenarios.map((s) => s.costGbp.max)) : null;
  // Probability-weighted expected cost
  const probWeights: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const mechExpectedGbp = mechScenarios.length > 0
    ? Math.round(
        mechScenarios.reduce((sum, s) => sum + ((s.costGbp.min + s.costGbp.max) / 2) * probWeights[s.probability], 0) /
        mechScenarios.reduce((sum, s) => sum + probWeights[s.probability], 0)
      )
    : null;

  const insuranceInfo = getInsuranceInfo(listing.titleStatus, listing.source);
  const heroPhoto = listing.photos[0]?.url;
  const bodyshopSpec = generateBodyshopSpec(listing, damage, cost);

  const fmtUsd = (gbp: number) => `$${Math.round(gbp * cost.exchangeRateUsed).toLocaleString('en-US')}`;
  const fmtMoney = (gbp: number) => isUsBuyer
    ? `$${Math.max(0, Math.round(gbp * cost.exchangeRateUsed)).toLocaleString('en-US')}`
    : `£${Math.max(0, Math.round(gbp)).toLocaleString('en-GB')}`;

  // US domestic timeline (no import steps)
  const timeline = isUsBuyer ? computeUsTimeline(damage) : computeTimeline(listing, damage);

  // US estimated annual running costs
  const usOwnership = isUsBuyer ? computeUsOwnershipCosts(listing, cost.exchangeRateUsed) : null;

  // Copart US search URL for similar lots
  const copartUsSearchUrl = `https://www.copart.com/vehicleFinder/results/?q[q]=${encodeURIComponent(listing.make + ' ' + listing.model.split(' ')[0])}&q[year]=${listing.year}`;

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10 md:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Hero */}
        <div className="animate-fade-up stagger-1 mb-6 relative rounded-2xl overflow-hidden hero-card">
          {heroPhoto ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroPhoto}
                alt={`${listing.year} ${listing.make} ${listing.model}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/20" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[var(--bg-surface)]" />
          )}

          {/* Top bar: nav + actions + scores */}
          <div className="relative flex items-start justify-between p-5 gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <a href="/check" className="inline-flex items-center gap-3 group">
                <div className="bg-white rounded-lg px-2 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="SalvageScore" className="h-7 w-auto" />
                </div>
                <span className="font-mono text-xs text-white/55 group-hover:text-white/90 transition-colors">
                  ← New analysis
                </span>
              </a>
              <div className="no-print flex items-center gap-2">
                <WhatsAppButton
                  vehicleTitle={`${listing.year} ${listing.make} ${listing.model}`}
                  verdict={report.verdict}
                  marginGbp={margin}
                />
                <ShareButton />
                <PrintButton />
              </div>
            </div>
            <div className="flex items-start gap-2 shrink-0">
              <DealScoreGauge score={dealScore} />
              <div className={`shrink-0 border rounded-xl px-5 py-3 text-center backdrop-blur-sm bg-black/25 ${verdict.className} ${verdict.bgClass}`}>
                <div className="font-display font-[800] text-2xl leading-none tracking-wider">{verdict.label}</div>
                <div className="font-mono text-[0.65rem] mt-1 opacity-70">Verdict</div>
              </div>
            </div>
          </div>

          {/* Bottom: vehicle name */}
          <div className="relative px-5 pb-5 pt-10">
            <h1 className="font-display font-[800] text-[clamp(1.6rem,5vw,2.8rem)] leading-tight tracking-[-0.01em] text-white">
              {listing.year} {listing.make} {listing.model}
              {listing.trim && <span className="text-white/45"> {listing.trim}</span>}
            </h1>
            <p className="font-mono text-sm text-white/40 mt-1">
              {listing.source.toUpperCase()} · Lot #{listing.lotNumber}
              {listing.vin && <span> · VIN {listing.vin}</span>}
            </p>
          </div>
        </div>

        {/* Claim prompt — save to history */}
        <ClaimPrompt slug={slug} isLoggedIn={isLoggedIn} isOwned={isOwned} />

        {/* Summary */}
        <div className="animate-fade-up stagger-2 mt-6 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <p className="font-body text-[0.9375rem] leading-[1.7] text-[var(--text-secondary)]">{report.summary}</p>
        </div>

        {/* Auction countdown */}
        {listing.auctionDate && (
          <div className="no-print animate-fade-up stagger-2 mt-3">
            <AuctionCountdown auctionDate={listing.auctionDate} />
          </div>
        )}

        {/* Due diligence disclaimer */}
        <div className="animate-fade-up stagger-2 mt-3 flex items-start gap-3 px-4 py-3 rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.05)]">
          <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5l5.5 10h-11L7 1.5z" stroke="#D97706" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M7 5.5v3M7 9.5v.5" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <p className="font-mono text-[0.7rem] text-[var(--text-muted)] leading-[1.65]">
            <span className="font-[600] text-[#D97706]">AI-generated report — for informational purposes only.</span>{' '}
            All costs are estimates. Always inspect the vehicle in person, obtain independent bodyshop quotes, and carry out a full history check before bidding. This report does not constitute financial, legal, or professional advice.
          </p>
        </div>

        {/* NON-RUNNER / IMMOBILE critical warning */}
        {isNonRunner && (
          <div className="animate-fade-up stagger-2 mt-3 rounded-xl border-2 border-[#F97316]/50 bg-[rgba(249,115,22,0.07)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[rgba(249,115,22,0.15)] border-b border-[#F97316]/30">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5l5.5 10h-11L7 1.5z" stroke="#F97316" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M7 5.5v2.5M7 9.5v.5" stroke="#F97316" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <p className="font-mono text-xs font-[700] text-[#F97316] uppercase tracking-widest">
                {isImmobileButEngineRuns
                  ? 'Immobile — Engine starts, but cannot be driven'
                  : 'Non-Runner — Mechanical cause unknown'}
              </p>
            </div>
            <div className="px-4 py-3 space-y-2">
              {isImmobileButEngineRuns ? (
                <>
                  <p className="font-mono text-[0.75rem] text-[var(--text-secondary)] leading-[1.7]">
                    Copart UK&apos;s <strong className="text-[#F97316]">Engine Start Program</strong> confirms the engine starts, but the lot is flagged as <strong className="text-[#F97316]">Immobile Vehicle (IV)</strong> — it cannot be driven away under its own power. This usually means damage to the drivetrain, brakes, suspension, steering, or chassis — not the engine.
                  </p>
                  <p className="font-mono text-[0.75rem] text-[var(--text-muted)] leading-[1.7]">
                    The repair estimate above <strong>does not include the cost to make it drivable</strong>.
                    {mechBestGbp !== null && mechWorstGbp !== null && (
                      <> Likely cost range: <strong className="text-[#22C55E]">{fmt(mechBestGbp)}</strong> (sensor/module) to <strong className="text-[#EF4444]">{fmt(mechWorstGbp)}+</strong> (chassis straightening or gearbox replacement). See scenarios below.</>
                    )}
                    {' '}A pre-purchase inspection focused on the undercarriage and drivetrain is essential.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-mono text-[0.75rem] text-[var(--text-secondary)] leading-[1.7]">
                    This vehicle <strong className="text-[#F97316]">does not start or cannot be driven</strong>. The damage analysis above reflects visible body condition only — it cannot assess any mechanical failure.
                  </p>
                  <p className="font-mono text-[0.75rem] text-[var(--text-muted)] leading-[1.7]">
                    The repair estimate in this report <strong>does not include drivetrain costs</strong>.
                    {mechBestGbp !== null && mechWorstGbp !== null && (
                      <> Mechanical repair could add anywhere from <strong className="text-[#22C55E]">{fmt(mechBestGbp)}</strong> (simple fix) to <strong className="text-[#EF4444]">{fmt(mechWorstGbp)}+</strong> (engine/HV battery). See the scenario breakdown below.</>
                    )}
                    {' '}A pre-purchase diagnostic inspection is essential before bidding.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Vehicle History Checks */}
        <div className="animate-fade-up stagger-2 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider mb-2">VIN</p>
              {listing.vin ? (
                <CopyVin vin={listing.vin} />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-[var(--text-muted)] italic">
                    {isUkImport ? 'Masked until purchase — register on Copart UK' : 'Not available'}
                  </span>
                  <a
                    href={`https://www.copart.co.uk/lot/${listing.lotNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[0.65rem] px-2 py-1 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    View lot ↗
                  </a>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider mb-2">
                History checks
              </p>
              <div className="flex flex-wrap gap-2">
                {isUkImport ? (
                  <>
                    <HistoryLink href="https://www.check-mot.service.gov.uk/" label="MOT History" note="gov.uk" />
                    <HistoryLink href="https://vehicleenquiry.service.gov.uk/" label="DVLA Enquiry" note="gov.uk" />
                    <HistoryLink href="https://www.hpi.co.uk/products/car-check/" label="HPI Check" note="paid" />
                  </>
                ) : (
                  <>
                    {listing.vin && <HistoryLink href={`https://www.nhtsa.gov/vehicle/vin/${listing.vin}`} label="NHTSA Recalls" note="free" />}
                    {listing.vin && <HistoryLink href={`https://www.carfax.com/VehicleHistory/p/Report.cfx?partner=DEA_0&vin=${listing.vin}`} label="Carfax" note="paid" />}
                    {listing.vin && <HistoryLink href={`https://www.autocheck.com/vehiclehistory/?vin=${listing.vin}`} label="AutoCheck" note="paid" />}
                  </>
                )}
              </div>
              <p className="mt-2 font-mono text-[0.6rem] text-[var(--text-muted)]">
                {isUkImport
                  ? 'MOT history and DVLA checks require the registration plate — find it via the lot page or HPI check'
                  : 'Enter the VIN on any of the above services to check US title history, accidents and recalls'}
              </p>
            </div>
          </div>
        </div>

        {/* Critical flags */}
        {Object.values(damage.criticalFlags).some(Boolean) && (
          <div className="animate-fade-up stagger-2 mt-4 p-4 rounded-xl border border-[#EF4444]/40 bg-[rgba(239,68,68,0.05)]">
            <p className="font-mono text-xs text-[#EF4444] font-[600] uppercase tracking-wider mb-2">Critical flags</p>
            <div className="flex flex-wrap gap-2">
              {damage.criticalFlags.deployedAirbag  && <Flag label="Deployed airbag" />}
              {damage.criticalFlags.frameDamage      && <Flag label="Frame damage" />}
              {damage.criticalFlags.floodWaterline   && <Flag label="Flood waterline" />}
              {damage.criticalFlags.fireDamage       && <Flag label="Fire damage" />}
              {damage.criticalFlags.theftStrip       && <Flag label="Theft strip" />}
            </div>
          </div>
        )}

        {/* Damage Photo Analysis */}
        {damage.photos.filter((p) => p.url).length > 0 && (
          <div className="animate-fade-up stagger-3 mt-6">
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Damage Photo Analysis</SectionLabel>
              <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">
                {damage.photos.length} photos analysed by AI
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {damage.photos.filter((p) => p.url).map((photo, i) => {
                const zoneName = ZONE_LABELS[photo.zone] ?? photo.zone;
                const sevBadge = SEVERITY_BADGE[photo.severity] ?? 'bg-[rgba(148,163,184,0.85)] text-white';
                const sevDot   = SEVERITY_DOT[photo.severity]   ?? 'bg-[#94A3B8]';
                const hasDamage = photo.damageType !== 'none' || photo.findings.length > 0;
                return (
                  <div
                    key={i}
                    className="photo-card relative rounded-xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`${zoneName} – ${photo.severity} ${photo.damageType}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Top row: zone + severity */}
                    <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-2 gap-2">
                      <span className="font-mono text-[0.6rem] font-[700] uppercase tracking-wider px-2 py-1 rounded-md bg-black/70 text-white backdrop-blur-sm leading-none">
                        {zoneName}
                      </span>
                      {hasDamage && (
                        <span className={`font-mono text-[0.6rem] font-[700] uppercase tracking-wider px-2 py-1 rounded-md backdrop-blur-sm leading-none ${sevBadge}`}>
                          {photo.severity}
                        </span>
                      )}
                    </div>

                    {/* Bottom gradient + findings */}
                    {photo.findings.length > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-8 pb-3 px-3">
                        <ul className="space-y-1">
                          {photo.findings.slice(0, 3).map((finding, j) => (
                            <li key={j} className="flex items-start gap-1.5">
                              <span className={`mt-[3px] shrink-0 w-1.5 h-1.5 rounded-full ${sevDot}`} />
                              <span className="font-mono text-[0.6rem] text-white/90 leading-tight">{finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* "No damage" label for clean photos */}
                    {!hasDamage && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pb-2 px-3">
                        <span className="font-mono text-[0.6rem] text-[#22C55E] font-[600]">No damage detected</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 font-mono text-[0.6rem] text-[var(--text-muted)] leading-[1.6]">
              Zones and findings identified by Claude Vision · Severity: <span className="text-[#22C55E]">Cosmetic</span> · <span className="text-[#EAB308]">Panel</span> · <span className="text-[#F97316]">Structural</span> · <span className="text-[#EF4444]">Frame</span>
            </p>
          </div>
        )}

        {/* Three columns */}
        <div className="animate-fade-up stagger-3 mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Damage */}
          <div className="md:col-span-1 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <SectionLabel>Damage</SectionLabel>
            <div className="mt-3 space-y-2">
              <DataRow label="Primary" value={listing.primaryDamage} />
              {listing.secondaryDamage && <DataRow label="Secondary" value={listing.secondaryDamage} />}
              <DataRow label="Severity" value={damage.overallSeverity.toUpperCase()} />
              <DataRow label="Title" value={listing.titleStatus} />
              <DataRow label="Odometer" value={`${listing.odometerMiles.toLocaleString()} mi`} />
            </div>
            {damage.damagedPanels?.length > 0 && (
              <div className="mt-3">
                <p className="font-mono text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Panels</p>
                <div className="flex flex-wrap gap-1">
                  {damage.damagedPanels.map((p) => (
                    <span key={p} className="font-mono text-[0.7rem] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 font-mono text-[0.8125rem] text-[var(--text-secondary)] leading-[1.65]">
              {sections.damageNarrative}
            </div>
          </div>

          {/* Cost */}
          <div className="md:col-span-1 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <SectionLabel>{isUsBuyer ? 'Cost Estimate' : listing.source === 'copart-uk' ? 'UK Cost' : 'UK Landed Cost'}</SectionLabel>
            {isUsBuyer ? (
              /* US buyer: show bid + repair only, no import costs */
              <div className="mt-3 space-y-1.5">
                <DataRow label="Current bid" value={`${fmt(cost.hammerGbp)} (${fmtUsd(cost.hammerGbp)})`} highlight />
                <DataRow label="Copart US buyer fees (~12%)" value={`~${fmt(Math.round(cost.hammerGbp * 0.12))}`} />
                <DataRow label="Repair estimate" value={fmt(repairLineGbp)} />
                <div className="border-t border-[var(--border)] pt-2 mt-2">
                  <DataRow label="Total (bid + repair)" value={`${fmt(usTotalGbp)} (~${fmtUsd(usTotalGbp)})`} highlight />
                </div>
                <p className="mt-3 font-mono text-[0.7rem] text-[var(--text-muted)]">
                  Rate: 1 GBP = {cost.exchangeRateUsed} USD · Import costs not included
                </p>
              </div>
            ) : (
              /* UK buyer: full cost breakdown */
              <>
                <div className="mt-3 space-y-1.5">
                  <DataRow label="Hammer" value={fmt(cost.hammerGbp)} highlight />
                  {cost.lineItems.map((item) => (
                    <DataRow key={item.label} label={item.label} value={fmt(item.amountGbp)} />
                  ))}
                  <div className="border-t border-[var(--border)] pt-2 mt-2">
                    <DataRow label={listing.source === 'copart-uk' ? 'Total UK cost' : 'Total to road-legal'} value={fmt(cost.totalGbp)} highlight />
                  </div>
                </div>
                {listing.source !== 'copart-uk' && (
                  <p className="mt-3 font-mono text-[0.7rem] text-[var(--text-muted)]">
                    Rate: 1 GBP = {cost.exchangeRateUsed} USD ({cost.exchangeRateDate})
                  </p>
                )}

                {/* Non-runner / immobile mechanical cost row — shown inline in the cost panel */}
                {isNonRunner && (
                  <div className="mt-3 pt-3 border-t border-[#F97316]/30">
                    <p className="font-mono text-[0.6rem] text-[#F97316]/80 uppercase tracking-wider mb-2">
                      {isImmobileButEngineRuns ? 'Not included — drivability repair' : 'Not included — mechanical repair'}
                    </p>
                    <div className="space-y-1">
                      {mechBestGbp !== null && (
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-mono text-xs text-[var(--text-muted)]">
                            {isImmobileButEngineRuns ? 'Best case (sensor / module)' : 'Best case (e.g. battery)'}
                          </span>
                          <span className="font-mono text-xs font-[600] text-[#22C55E] tabular-nums">{fmt(mechBestGbp)}</span>
                        </div>
                      )}
                      {mechExpectedGbp !== null && (
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-mono text-xs text-[var(--text-muted)]">Expected (probability-weighted)</span>
                          <span className="font-mono text-xs font-[600] text-[#F97316] tabular-nums">{fmt(mechExpectedGbp)}</span>
                        </div>
                      )}
                      {mechWorstGbp !== null && (
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-mono text-xs text-[var(--text-muted)]">
                            {isImmobileButEngineRuns ? 'Worst case (chassis / gearbox)' : 'Worst case (engine / HV battery)'}
                          </span>
                          <span className="font-mono text-xs font-[600] text-[#EF4444] tabular-nums">{fmt(mechWorstGbp)}+</span>
                        </div>
                      )}
                      {mechScenarios.length === 0 && (
                        <p className="font-mono text-xs text-[#F97316]">Unknown — see scenarios below</p>
                      )}
                    </div>
                  </div>
                )}

                {/* AI cost narrative */}
                {sections.costNarrative && (
                  <div className="mt-3 font-mono text-[0.8125rem] text-[var(--text-secondary)] leading-[1.65]">
                    {sections.costNarrative}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Resale / Market Value */}
          <div className="md:col-span-1 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            {isUsBuyer ? (
              /* US buyer: show US market reference */
              <>
                <SectionLabel>US Market Reference</SectionLabel>
                <div className="mt-3">
                  <div className="font-display font-[700] text-4xl leading-none">
                    {usMarketGbp !== null ? fmtUsd(usMarketGbp) : 'N/A'}
                  </div>
                  {usMarketGbp !== null && listing.estRetailUsd && (
                    <p className="font-mono text-xs text-[var(--text-muted)] mt-1">
                      ≈ {fmt(usMarketGbp)} · Copart est. retail ${listing.estRetailUsd.toLocaleString()}
                    </p>
                  )}
                  {usMarginGbp !== null && (
                    <div className={`mt-2 font-mono text-sm font-[600] ${usMarginGbp >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                      {usMarginGbp >= 0 ? `+${fmtUsd(usMarginGbp)}` : fmtUsd(usMarginGbp)} margin ({marginPct}%)
                    </div>
                  )}
                </div>
                <div className="mt-4 font-mono text-[0.8125rem] text-[var(--text-secondary)] leading-[1.65]">
                  {sections.resaleNarrative}
                </div>
                <p className="mt-3 font-mono text-[0.65rem] text-[var(--text-muted)] leading-[1.5]">
                  Based on Copart&apos;s estimated retail value · Verify with KBB, Manheim MMR, or CarGurus before bidding
                </p>
              </>
            ) : (
              /* UK buyer: full UK resale section */
              <>
                <div className="flex items-center justify-between">
                  <SectionLabel>UK Resale Ceiling</SectionLabel>
                  {resale.priceSource === 'autotrader-live' ? (
                    <span className="font-mono text-[0.65rem] px-1.5 py-0.5 rounded border border-[#22C55E]/40 text-[#22C55E] bg-[rgba(34,197,94,0.08)]">
                      AutoTrader live · {resale.autotraderSampleSize} listings
                    </span>
                  ) : resale.priceSource === 'cap-clean' ? (
                    <span className="font-mono text-[0.65rem] px-1.5 py-0.5 rounded border border-[#3B82F6]/40 text-[#3B82F6] bg-[rgba(59,130,246,0.08)]">
                      CAP Clean
                    </span>
                  ) : (
                    <span className="font-mono text-[0.65rem] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
                      Estimated
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <div className="font-display font-[700] text-4xl leading-none">
                    {fmt(resale.ceilingGbp)}
                  </div>
                  <div className={`mt-1 font-mono text-sm font-[600] ${margin >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {margin >= 0 ? `+${fmt(margin)}` : fmt(margin)} margin ({marginPct}%)
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  {resale.capCleanGbp && resale.priceSource !== 'cap-clean' && (
                    <DataRow label="CAP Clean" value={fmt(resale.capCleanGbp)} />
                  )}
                  <DataRow label={resale.priceSource === 'cap-clean' ? 'CAP Clean (base)' : 'Base value'} value={fmt(resale.baseValueGbp)} />
                  {resale.penalties.map((p) => (
                    <DataRow key={p.label} label={p.label} value={`-${Math.round(p.multiplier * 100)}%`} />
                  ))}
                  <DataRow label="Confidence" value={resale.confidence.toUpperCase()} />
                </div>
                <div className="mt-4 font-mono text-[0.8125rem] text-[var(--text-secondary)] leading-[1.65]">
                  {sections.resaleNarrative}
                </div>

                {resale.comparables && resale.comparables.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider mb-2">
                      Comparable listings
                    </p>
                    <div className="space-y-2">
                      {resale.comparables.map((c) => (
                        <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-2 group">
                          <div className="min-w-0">
                            <p className="font-mono text-[0.7rem] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] truncate leading-snug transition-colors">{c.title}</p>
                            {c.mileage && <p className="font-mono text-[0.6rem] text-[var(--text-muted)]">{c.mileage.toLocaleString('en-GB')} mi</p>}
                          </div>
                          <span className="font-mono text-[0.7rem] font-[600] text-[var(--text-primary)] shrink-0 tabular-nums">{fmt(c.priceGbp)}</span>
                        </a>
                      ))}
                    </div>
                    {resale.autotraderSearchUrl && (
                      <a href={resale.autotraderSearchUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-mono text-[0.6rem] text-[var(--amber)] hover:text-[var(--amber-bright)] transition-colors">
                        View all on AutoTrader →
                      </a>
                    )}
                  </div>
                )}
                {!resale.comparables && resale.autotraderSearchUrl && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <a href={resale.autotraderSearchUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-[0.7rem] text-[var(--amber)] hover:text-[var(--amber-bright)] transition-colors">
                      See comparable listings on AutoTrader →
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bid calculator */}
        <div className="animate-fade-up stagger-4">
          <BidCalculator
            resaleCeilingGbp={effectiveCeilingGbp}
            fixedCostsGbp={isUsBuyer
              ? repairLineGbp + Math.round(cost.hammerGbp * 0.12)
              : cost.totalGbp - cost.hammerGbp}
            repairEstimateGbp={cost.repairSubtotalGbp + cost.hiddenDamageContingencyGbp}
            currentHammerGbp={cost.hammerGbp}
            exchangeRateUsed={cost.exchangeRateUsed}
            isUkSource={listing.source === 'copart-uk'}
            isUsBuyer={isUsBuyer}
          />
        </div>

        {/* Timeline */}
        <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>
              {isUsBuyer ? 'Estimated Timeline (US Domestic)' : 'Estimated Timeline to Road-Legal'}
            </SectionLabel>
            <span className="font-mono text-sm font-[700] text-[var(--text-primary)]">
              {timeline.minWeeks}–{timeline.maxWeeks} weeks
            </span>
          </div>
          <ol className="relative border-l border-[var(--border)] ml-2 space-y-4">
            {timeline.steps.map((step, i) => (
              <li key={i} className="pl-5 relative">
                <div className="absolute -left-[7px] top-[3px] w-3.5 h-3.5 rounded-full border-2 border-[var(--border)] bg-[var(--bg)]" />
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-[0.8125rem] text-[var(--text-secondary)]">{step.label}</span>
                  {step.note && (
                    <span className="font-mono text-[0.65rem] text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 rounded shrink-0">{step.note}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 font-mono text-[0.6rem] text-[var(--text-muted)] leading-[1.6]">
            {isUsBuyer
              ? 'Estimates only · Varies by bodyshop availability, parts lead times, and state DMV processing times'
              : 'Estimates only · Varies by bodyshop availability, parts lead times, and DVSA test booking slots'}
          </p>
        </div>

        {/* Insurance category explainer */}
        {insuranceInfo && (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-3">
              <SectionLabel>Title Status &amp; Insurance</SectionLabel>
              <span className={`font-mono text-[0.65rem] font-[700] px-2 py-0.5 rounded border border-current ${insuranceInfo.colour}`}>
                {insuranceInfo.category}
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">What it means</p>
                <p className="font-mono text-[0.8125rem] text-[var(--text-secondary)] leading-[1.6]">{insuranceInfo.whatItMeans}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                  <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">Insurance impact</p>
                  <p className="font-mono text-[0.8rem] text-[var(--text-secondary)] leading-[1.5]">{insuranceInfo.insuranceImpact}</p>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                  <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">Resale impact</p>
                  <p className="font-mono text-[0.8rem] text-[var(--text-secondary)] leading-[1.5]">{insuranceInfo.resaleImpact}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ULEZ badge — UK buyers only */}
        {!isUsBuyer && (
          <div className="animate-fade-up stagger-5 mt-4">
            <UlezBadge year={listing.year} primaryDamage={listing.primaryDamage} model={listing.model} />
          </div>
        )}

        {/* Checklist — different content for US vs UK buyers */}
        <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <SectionLabel>
            {isUsBuyer
              ? 'US Buyer Checklist'
              : isUkImport
                ? 'Road-Legal Checklist (UK)'
                : 'Import & Road-Legal Checklist (US → UK)'}
          </SectionLabel>
          <ol className="mt-4 space-y-2">
            {(isUsBuyer
              ? US_BUYER_CHECKLIST
              : isUkImport
                ? UK_CHECKLIST
                : US_IMPORT_CHECKLIST
            ).map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center mt-0.5">
                  <span className="font-mono text-[0.6rem] text-[var(--text-muted)]">{i + 1}</span>
                </span>
                <div>
                  <span className="font-mono text-[0.8125rem] text-[var(--text-secondary)]">{item.label}</span>
                  {item.note && (
                    <span className="block font-mono text-[0.7rem] text-[var(--text-muted)] mt-0.5">{item.note}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Repair breakdown */}
        <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Repair Estimate Breakdown</SectionLabel>
            <span className="font-mono text-[0.65rem] text-[var(--text-muted)] border border-[var(--border)] px-2 py-0.5 rounded">
              Get quotes before bidding
            </span>
          </div>

          {/* Visible repairs */}
          <div className="mb-3">
            <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider mb-2">Visible damage</p>
            <div className="space-y-1.5">
              {cost.repairLineItems.map((item) => (
                <div key={item.label} className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-xs text-[var(--text-secondary)]">{item.label}</span>
                  <span className="font-mono text-xs text-[var(--text-primary)] shrink-0 tabular-nums">{fmtMoney(item.amountGbp)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-[var(--border)] flex justify-between">
              <span className="font-mono text-xs text-[var(--text-muted)]">Repair subtotal</span>
              <span className="font-mono text-xs font-[600] text-[var(--text-primary)] tabular-nums">{fmtMoney(cost.repairSubtotalGbp)}</span>
            </div>
          </div>

          {/* Probable hidden damage */}
          {cost.hiddenRepairItems.length > 0 && (
            <div className="mt-4 mb-3">
              <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider mb-2">Probable hidden damage</p>
              <div className="space-y-2">
                {cost.hiddenRepairItems.map((item) => (
                  <div key={item.label} className="flex gap-2">
                    <span className={`shrink-0 font-mono text-[0.6rem] uppercase tracking-wider px-1.5 py-0.5 rounded self-start mt-0.5 ${
                      item.likelihood === 'likely'
                        ? 'bg-[rgba(245,158,11,0.12)] text-[var(--amber-bright)] border border-[rgba(245,158,11,0.3)]'
                        : 'bg-[rgba(74,79,100,0.3)] text-[var(--text-muted)] border border-[var(--border)]'
                    }`}>
                      {item.likelihood}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs text-[var(--text-secondary)]">{item.label}</span>
                        <span className="font-mono text-xs text-[var(--text-muted)] shrink-0 tabular-nums">
                          {fmtMoney(item.minGbp)}–{fmtMoney(item.maxGbp)}
                        </span>
                      </div>
                      <p className="font-mono text-[0.6rem] text-[var(--text-muted)] leading-[1.5] mt-0.5">{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contingency box */}
          <div className="mt-4 p-3 rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)]">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xs text-[var(--amber-bright)] font-[600]">
                Hidden damage contingency (+{Math.round(cost.hiddenDamageContingencyPct * 100)}%)
              </span>
              <span className="font-mono text-xs text-[var(--amber-bright)] font-[600] tabular-nums">+{fmtMoney(cost.hiddenDamageContingencyGbp)}</span>
            </div>
            <p className="mt-1 font-mono text-[0.6rem] text-[var(--text-muted)] leading-[1.5]">
              Applied to repair subtotal · Covers damage behind panels, corrosion, and electrical faults not visible in auction photos
            </p>
          </div>

          {/* Total repair */}
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex justify-between">
            <span className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider">Total repair estimate</span>
            <span className="font-mono text-sm font-[700] text-[var(--text-primary)] tabular-nums">
              {fmtMoney(cost.repairSubtotalGbp + cost.hiddenDamageContingencyGbp)}
            </span>
          </div>
        </div>

        {/* Parts sourcing */}
        {damage.damagedPanels.length > 0 && (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Parts Sourcing</SectionLabel>
              <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">
                {listing.year} {listing.make} {listing.model}
              </span>
            </div>
            <div className="space-y-4">
              {damage.damagedPanels.map((panel) => {
                const label = PANEL_LABELS[panel] ?? panel;
                const makeLower = listing.make.toLowerCase();
                const modelLower = listing.model.toLowerCase();
                const labelLower = label.toLowerCase();
                // eBay: include year for used OEM fitment accuracy; category 9801 = Vehicle Parts & Accessories
                const ebayQ = encodeURIComponent(`${listing.year} ${makeLower} ${modelLower} ${labelLower}`);
                // Catalog sites: make + model + part (no year — they index by fitment range)
                const catalogQ = encodeURIComponent(`${makeLower} ${modelLower} ${labelLower}`);
                const sources = isUsBuyer ? [
                  {
                    name: 'eBay US',
                    tag: 'Used OEM',
                    tagColor: 'text-[#22C55E] border-[#22C55E]/40 bg-[rgba(34,197,94,0.08)]',
                    url: `https://www.ebay.com/sch/i.html?_nkw=${ebayQ}&LH_ItemCondition=4&_sacat=6028`,
                    btnColor: 'border-[#F5A623]/40 text-[#F5A623] hover:bg-[rgba(245,166,35,0.08)]',
                  },
                  {
                    name: 'RockAuto',
                    tag: 'New',
                    tagColor: 'text-[#3B82F6] border-[#3B82F6]/40 bg-[rgba(59,130,246,0.08)]',
                    url: `https://www.rockauto.com/en/catalog/${makeLower}/${listing.year}/${modelLower.split(' ')[0]}`,
                    btnColor: 'border-[#3B82F6]/40 text-[#3B82F6] hover:bg-[rgba(59,130,246,0.08)]',
                  },
                  {
                    name: 'AutoZone',
                    tag: 'New',
                    tagColor: 'text-[#3B82F6] border-[#3B82F6]/40 bg-[rgba(59,130,246,0.08)]',
                    url: `https://www.autozone.com/parts/${labelLower.replace(/\s+/g, '-')}`,
                    btnColor: 'border-[#3B82F6]/40 text-[#3B82F6] hover:bg-[rgba(59,130,246,0.08)]',
                  },
                  {
                    name: 'Amazon US',
                    tag: 'New',
                    tagColor: 'text-[#8B5CF6] border-[#8B5CF6]/40 bg-[rgba(139,92,246,0.08)]',
                    url: `https://www.amazon.com/s?k=${catalogQ}&i=automotive`,
                    btnColor: 'border-[#8B5CF6]/40 text-[#8B5CF6] hover:bg-[rgba(139,92,246,0.08)]',
                  },
                ] : [
                  {
                    name: 'eBay UK',
                    tag: 'Used OEM',
                    tagColor: 'text-[#22C55E] border-[#22C55E]/40 bg-[rgba(34,197,94,0.08)]',
                    url: `https://www.ebay.co.uk/sch/i.html?_nkw=${ebayQ}&LH_ItemCondition=4&_sacat=9801`,
                    btnColor: 'border-[#F5A623]/40 text-[#F5A623] hover:bg-[rgba(245,166,35,0.08)]',
                  },
                  {
                    name: 'Euro Car Parts',
                    tag: 'New',
                    tagColor: 'text-[#3B82F6] border-[#3B82F6]/40 bg-[rgba(59,130,246,0.08)]',
                    url: `https://www.eurocarparts.com/search?q=${catalogQ}`,
                    btnColor: 'border-[#3B82F6]/40 text-[#3B82F6] hover:bg-[rgba(59,130,246,0.08)]',
                  },
                  {
                    name: 'GSF Car Parts',
                    tag: 'New',
                    tagColor: 'text-[#3B82F6] border-[#3B82F6]/40 bg-[rgba(59,130,246,0.08)]',
                    url: `https://www.gsfcarparts.com/search?q=${catalogQ}`,
                    btnColor: 'border-[#3B82F6]/40 text-[#3B82F6] hover:bg-[rgba(59,130,246,0.08)]',
                  },
                  {
                    name: 'Amazon UK',
                    tag: 'New',
                    tagColor: 'text-[#8B5CF6] border-[#8B5CF6]/40 bg-[rgba(139,92,246,0.08)]',
                    url: `https://www.amazon.co.uk/s?k=${catalogQ}&i=automotive`,
                    btnColor: 'border-[#8B5CF6]/40 text-[#8B5CF6] hover:bg-[rgba(139,92,246,0.08)]',
                  },
                ];
                return (
                  <div key={panel}>
                    <p className="font-mono text-xs text-[var(--text-secondary)] font-[600] mb-2">{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {sources.map((src) => (
                        <a
                          key={src.name}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-[0.7rem] font-[500] transition-colors ${src.btnColor}`}
                        >
                          {src.name}
                          <span className={`text-[0.55rem] px-1 py-0.5 rounded border font-[600] uppercase tracking-wide ${src.tagColor}`}>
                            {src.tag}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 font-mono text-[0.6rem] text-[var(--text-muted)] leading-[1.6]">
              {isUsBuyer
                ? 'eBay US filtered to used auto parts · RockAuto and AutoZone for new parts · Always verify OEM part numbers for fitment'
                : 'eBay UK filtered to used parts (Vehicle Parts & Accessories) · Catalog links search by make, model & part name · Always verify OEM part numbers for fitment'}
            </p>
          </div>
        )}

        {/* Known issues */}
        {report.knownIssues && report.knownIssues.length > 0 && (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Known Issues — {listing.year} {listing.make} {listing.model}</SectionLabel>
              <span className="font-mono text-[0.65rem] text-[var(--amber)]/70 border border-[var(--amber)]/20 bg-[rgba(217,119,6,0.05)] rounded px-2 py-0.5">AI-suggested — verify before bidding</span>
            </div>
            <div className="space-y-3">
              {report.knownIssues.map((issue, i) => {
                const sevColor = issue.severity === 'major'
                  ? 'text-[#EF4444] border-[#EF4444]/30 bg-[rgba(239,68,68,0.06)]'
                  : issue.severity === 'moderate'
                  ? 'text-[#F97316] border-[#F97316]/30 bg-[rgba(249,115,22,0.06)]'
                  : 'text-[#EAB308] border-[#EAB308]/30 bg-[rgba(234,179,8,0.06)]';
                return (
                  <div key={i} className={`p-3 rounded-lg border ${sevColor}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1">
                        <span className="font-mono text-[0.65rem] font-[700] uppercase tracking-wider opacity-70">{issue.category}</span>
                        <p className="font-mono text-[0.8rem] font-[500] mt-0.5">{issue.issue}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {issue.typicalCostGbp && (
                          <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">
                            £{issue.typicalCostGbp.min.toLocaleString()}–£{issue.typicalCostGbp.max.toLocaleString()}
                          </span>
                        )}
                        <span className={`font-mono text-[0.6rem] font-[700] uppercase tracking-wide px-1.5 py-0.5 rounded border ${sevColor}`}>
                          {issue.severity}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 font-mono text-[0.6rem] text-[var(--text-muted)]">
              Based on likely patterns for this make/model · AI-suggested — always verify with a specialist before bidding
            </p>
          </div>
        )}

        {/* Mechanical failure scenarios */}
        {isNonRunner && mechScenarios.length > 0 && (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl border border-[rgba(249,115,22,0.35)] bg-[rgba(249,115,22,0.04)]">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                  <circle cx="7" cy="7" r="6" stroke="#F97316" strokeWidth="1.3"/>
                  <path d="M5 5c.3-1 1.2-1.5 2-1.5s1.7.5 1.7 1.5c0 1-1 1.5-1.7 1.8V8.5" stroke="#F97316" strokeWidth="1.3" strokeLinecap="round"/>
                  <circle cx="7" cy="10.5" r=".7" fill="#F97316"/>
                </svg>
                <SectionLabel>{isImmobileButEngineRuns ? 'Drivability Repair Scenarios' : 'Mechanical Failure Scenarios'}</SectionLabel>
              </div>
              <span className="font-mono text-[0.65rem] text-[#F97316]/80 border border-[#F97316]/25 bg-[rgba(249,115,22,0.06)] rounded px-2 py-0.5">
                {isImmobileButEngineRuns ? 'Engine starts · car immobile' : 'Non-runner — repair cost unknown'}
              </span>
            </div>

            {/* Cost summary boxes */}
            {mechBestGbp !== null && mechWorstGbp !== null && mechExpectedGbp !== null && (
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="p-3 rounded-lg border border-[#22C55E]/25 bg-[rgba(34,197,94,0.05)]">
                  <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">Best case</p>
                  <p className="font-mono text-lg font-[700] leading-none text-[#22C55E]">£{mechBestGbp.toLocaleString()}</p>
                  <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-1">Simple fix (e.g. battery)</p>
                </div>
                <div className="p-3 rounded-lg border border-[#F97316]/25 bg-[rgba(249,115,22,0.06)]">
                  <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">Expected</p>
                  <p className="font-mono text-lg font-[700] leading-none text-[#F97316]">£{mechExpectedGbp.toLocaleString()}</p>
                  <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-1">Probability-weighted</p>
                </div>
                <div className="p-3 rounded-lg border border-[#EF4444]/25 bg-[rgba(239,68,68,0.05)]">
                  <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">Worst case</p>
                  <p className="font-mono text-lg font-[700] leading-none text-[#EF4444]">£{mechWorstGbp.toLocaleString()}<span className="text-sm">+</span></p>
                  <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-1">Engine / HV battery — could exceed this</p>
                </div>
              </div>
            )}

            {/* Diagnostic scenarios */}
            <div className="space-y-2.5">
              {mechScenarios.map((s, i) => {
                const probColor = s.probability === 'high'
                  ? 'text-[#EF4444] border-[#EF4444]/30 bg-[rgba(239,68,68,0.07)]'
                  : s.probability === 'medium'
                  ? 'text-[#F97316] border-[#F97316]/30 bg-[rgba(249,115,22,0.07)]'
                  : 'text-[#EAB308] border-[#EAB308]/30 bg-[rgba(234,179,8,0.07)]';
                return (
                  <div key={i} className="p-3 rounded-lg border border-[rgba(249,115,22,0.2)] bg-[var(--bg-surface)]">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono text-[0.6rem] font-[700] uppercase tracking-wide px-1.5 py-0.5 rounded border ${probColor}`}>
                          {s.probability}
                        </span>
                        <p className="font-mono text-[0.8rem] font-[600] text-[var(--text-primary)]">{s.cause}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-[0.58rem] text-[var(--text-muted)] uppercase tracking-wider block">All-in cost</span>
                        <span className="font-mono text-[0.75rem] font-[600] text-[var(--text-primary)] tabular-nums">
                          £{s.costGbp.min.toLocaleString()}–£{s.costGbp.max.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="font-mono text-[0.72rem] text-[var(--text-secondary)] leading-[1.5]">{s.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Possible repair costs — part prices by new / used / reconditioned */}
            {mechScenarios.some((s) => s.partOptions && s.partOptions.length > 0) && (
              <div className="mt-4 pt-4 border-t border-[rgba(249,115,22,0.2)]">
                <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  Possible repair costs — parts only, excl. labour (UK market)
                </p>
                <div className="space-y-3">
                  {mechScenarios.filter((s) => s.partOptions && s.partOptions.length > 0).map((s, i) => (
                    <div key={i} className="rounded-xl border border-[rgba(249,115,22,0.25)] bg-[rgba(0,0,0,0.12)] overflow-hidden">
                      <div className="px-4 py-2.5 bg-[rgba(249,115,22,0.08)] border-b border-[rgba(249,115,22,0.15)]">
                        <p className="font-mono text-[0.75rem] font-[600] text-[var(--text-primary)]">{s.cause}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[rgba(249,115,22,0.12)]">
                        {s.partOptions!.map((opt, j) => (
                          <div key={j} className="px-4 py-3">
                            <p className="font-mono text-[0.58rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">{opt.label}</p>
                            <p className="font-mono text-[1.15rem] font-[700] leading-none text-[var(--text-primary)] tabular-nums">
                              £{opt.minGbp.toLocaleString()}
                            </p>
                            <p className="font-mono text-[0.7rem] text-[var(--text-muted)] tabular-nums mt-0.5">
                              up to £{opt.maxGbp.toLocaleString()}
                            </p>
                            {opt.note && (
                              <p className="font-mono text-[0.58rem] text-[var(--amber)]/70 mt-1 leading-[1.4]">{opt.note}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-3 font-mono text-[0.6rem] text-[var(--text-muted)]">
              All-in costs include diagnosis + parts + labour at a UK independent garage · Part costs are estimates — actual cost unknown until inspected · Major repairs (engine, HV battery, gearbox) can easily exceed these figures · Do not bid without a pre-purchase diagnostic inspection
            </p>
          </div>
        )}

        {/* NHTSA open recalls */}
        {report.recalls && report.recalls.length > 0 && (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl border border-[#EF4444]/30 bg-[rgba(239,68,68,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[#EF4444]">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M7.5 1.5l6 11h-12l6-11z" stroke="#EF4444" strokeWidth="1.3" strokeLinejoin="round"/>
                    <path d="M7.5 6v3M7.5 10.5v.5" stroke="#EF4444" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </span>
                <SectionLabel>NHTSA Open Safety Recalls</SectionLabel>
              </div>
              <span className="font-mono text-[0.65rem] font-[700] px-2 py-0.5 rounded border border-[#EF4444]/40 text-[#EF4444] bg-[rgba(239,68,68,0.08)]">
                {report.recalls.length} recall{report.recalls.length !== 1 ? 's' : ''} found
              </span>
            </div>
            <div className="space-y-3">
              {report.recalls.map((recall, i) => (
                <div key={i} className="p-3 rounded-lg border border-[#EF4444]/20 bg-[rgba(239,68,68,0.04)]">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-mono text-[0.8rem] font-[600] text-[var(--text-primary)]">{recall.component}</p>
                    <span className="font-mono text-[0.6rem] text-[var(--text-muted)] shrink-0 tabular-nums">{recall.campaignNumber}</span>
                  </div>
                  <p className="font-mono text-[0.75rem] text-[var(--text-secondary)] leading-[1.5] mb-2">{recall.summary}</p>
                  {recall.consequence && (
                    <div className="mb-1.5">
                      <span className="font-mono text-[0.6rem] text-[#EF4444] uppercase tracking-wider font-[600]">Consequence: </span>
                      <span className="font-mono text-[0.7rem] text-[var(--text-muted)]">{recall.consequence}</span>
                    </div>
                  )}
                  {recall.remedy && (
                    <div>
                      <span className="font-mono text-[0.6rem] text-[#22C55E] uppercase tracking-wider font-[600]">Remedy: </span>
                      <span className="font-mono text-[0.7rem] text-[var(--text-muted)]">{recall.remedy}</span>
                    </div>
                  )}
                  {recall.recallDate && (
                    <p className="mt-1.5 font-mono text-[0.6rem] text-[var(--text-muted)]">Reported: {recall.recallDate}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[0.6rem] text-[var(--text-muted)]">
              Source: NHTSA public recall database · Check with a US dealer whether recall work was completed before this vehicle was sold
            </p>
          </div>
        )}

        {/* Annual ownership costs */}
        {isUsBuyer && usOwnership ? (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Estimated Annual US Running Costs</SectionLabel>
              <span className="font-mono text-[0.65rem] text-[var(--text-muted)] border border-[var(--border)] px-2 py-0.5 rounded">
                {usOwnership.milesPerYear.toLocaleString()} mi/year assumed
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">Registration</p>
                <p className="font-mono text-lg font-[700] leading-none text-[var(--text-primary)]">${usOwnership.registrationUsd.toLocaleString('en-US')}</p>
                <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-1">Est. avg. all states</p>
              </div>
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">Insurance</p>
                <p className="font-mono text-lg font-[700] leading-none text-[var(--text-primary)]">${usOwnership.insuranceUsd.toLocaleString('en-US')}</p>
                <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-1">Rebuilt title (est.)</p>
              </div>
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">Fuel</p>
                <p className="font-mono text-lg font-[700] leading-none text-[var(--text-primary)]">${usOwnership.fuelUsd.toLocaleString('en-US')}</p>
                <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-1">~{usOwnership.mpg} mpg · Gasoline</p>
              </div>
              <div className="p-3 rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)]">
                <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">Estimated annual essentials</p>
                <p className="font-mono text-lg font-[700] leading-none text-[var(--amber-bright)]">${usOwnership.totalUsd.toLocaleString('en-US')}</p>
                <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-1">${Math.round(usOwnership.totalUsd / 12).toLocaleString('en-US')}/mo</p>
              </div>
            </div>
            <p className="font-mono text-[0.6rem] text-[var(--text-muted)] leading-[1.6]">
              Includes: registration, insurance (rebuilt title est.), fuel at ~$3.30/gal · Excludes: servicing, tyres, maintenance, parking · Registration varies widely by state
            </p>
          </div>
        ) : !isUsBuyer && report.ownershipCosts && (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Estimated Annual UK Running Costs</SectionLabel>
              <span className="font-mono text-[0.65rem] text-[var(--text-muted)] border border-[var(--border)] px-2 py-0.5 rounded">
                {report.ownershipCosts.assumedMilesPerYear.toLocaleString()} mi/year assumed
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <CostPill
                label="Road Tax (VED)"
                valueGbp={report.ownershipCosts.annualVedGbp}
                note={report.ownershipCosts.vedBand}
              />
              <CostPill
                label="Insurance"
                valueGbp={report.ownershipCosts.annualInsuranceEstimateGbp}
                note={`Group ${report.ownershipCosts.insuranceGroupEstimate} (est.)`}
              />
              <CostPill
                label="Fuel"
                valueGbp={report.ownershipCosts.annualFuelGbp}
                note={report.ownershipCosts.fuelType}
              />
              <CostPill
                label="Estimated annual essentials"
                valueGbp={report.ownershipCosts.annualTotalGbp}
                note={`${fmt(Math.round(report.ownershipCosts.annualTotalGbp / 12))}/mo`}
                highlight
              />
            </div>
            <p className="font-mono text-[0.6rem] text-[var(--text-muted)] leading-[1.6]">
              Includes: road tax (VED), insurance (est. group), fuel at UK pump prices · Excludes: servicing, tyres, MOT, parking
            </p>
          </div>
        )}

        {/* Best / Expected / Worst case scenarios */}
        {(() => {
          const scenarios = computeCostScenarios(cost, resale, effectiveCeilingGbp);
          return (
            <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
              <div className="flex items-center justify-between mb-4">
                <SectionLabel>Cost Scenario Analysis</SectionLabel>
                <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">
                  vs {fmtMoney(effectiveCeilingGbp)} {isUsBuyer ? 'US market ref.' : 'resale ceiling'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left pb-2 text-[var(--text-muted)] font-[600] uppercase tracking-wider text-[0.6rem] pr-3">Scenario</th>
                      <th className="text-right pb-2 text-[var(--text-muted)] font-[600] uppercase tracking-wider text-[0.6rem] pr-3">Repair</th>
                      <th className="text-right pb-2 text-[var(--text-muted)] font-[600] uppercase tracking-wider text-[0.6rem] pr-3">All-in total</th>
                      <th className="text-right pb-2 text-[var(--text-muted)] font-[600] uppercase tracking-wider text-[0.6rem]">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    <ScenarioRow
                      label="Best case"
                      description="Repairs come in under estimate, no hidden damage"
                      repair={scenarios.best.repairGbp}
                      total={scenarios.best.totalGbp}
                      margin={scenarios.best.marginGbp}
                      formatter={fmtMoney}
                    />
                    <ScenarioRow
                      label="Expected"
                      description="Current estimate + hidden damage contingency"
                      repair={scenarios.expected.repairGbp}
                      total={scenarios.expected.totalGbp}
                      margin={scenarios.expected.marginGbp}
                      isActive
                      formatter={fmtMoney}
                    />
                    <ScenarioRow
                      label="Worst case"
                      description="Repairs 60% over estimate + all hidden items at max"
                      repair={scenarios.worst.repairGbp}
                      total={scenarios.worst.totalGbp}
                      margin={scenarios.worst.marginGbp}
                      formatter={fmtMoney}
                    />
                  </tbody>
                </table>
              </div>
              <p className="mt-3 font-mono text-[0.6rem] text-[var(--text-muted)] leading-[1.6]">
                Best case: 35% under repair estimate · Worst case: 60% over estimate + all probable hidden items at maximum · Fixed costs unchanged across scenarios
              </p>
            </div>
          );
        })()}

        {/* Similar lots */}
        {isUsBuyer ? (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Similar Lots on Copart US</SectionLabel>
              <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">search live auctions</span>
            </div>
            <p className="font-mono text-[0.8rem] text-[var(--text-secondary)] leading-[1.6] mb-4">
              Browse current {listing.year} {listing.make} {listing.model.split(' ')[0]} listings on Copart to compare auction prices and damage levels before bidding.
            </p>
            <a
              href={copartUsSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--amber)]/40 text-[var(--amber)] hover:bg-[rgba(217,119,6,0.08)] transition-colors font-mono text-[0.75rem] font-[600]"
            >
              Search {listing.make} {listing.model.split(' ')[0]} on Copart US →
            </a>
            <p className="mt-3 font-mono text-[0.6rem] text-[var(--text-muted)]">
              Compare lot condition, damage type, and current bids · Live prices only available on Copart
            </p>
          </div>
        ) : report.similarLots && report.similarLots.length > 0 && (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Similar Lots Active on Copart UK</SectionLabel>
              <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">live at report time</span>
            </div>
            <div className="space-y-2">
              {report.similarLots.map((lot) => (
                <a
                  key={lot.lotNumber}
                  href={lot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--text-muted)] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[0.8rem] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] truncate">{lot.title}</p>
                    <p className="font-mono text-[0.65rem] text-[var(--text-muted)] mt-0.5">
                      {lot.primaryDamage}
                      {lot.odometerMiles ? ` · ${lot.odometerMiles.toLocaleString()} mi` : ''}
                      {' · '}Lot #{lot.lotNumber}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-[700] text-[var(--text-primary)]">
                      £{lot.currentBidGbp.toLocaleString()}
                    </p>
                    <p className="font-mono text-[0.6rem] text-[var(--text-muted)]">current bid</p>
                  </div>
                </a>
              ))}
            </div>
            <p className="mt-3 font-mono text-[0.6rem] text-[var(--text-muted)]">
              Bids shown at time of report generation · Check Copart for current prices
            </p>
          </div>
        )}

        {/* Sold auction comps — UK buyers only */}
        {!isUsBuyer && report.soldComps && report.soldComps.length > 0 && (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Sold Auction Comps</SectionLabel>
              <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">
                recent completed auctions · Copart UK
              </span>
            </div>
            <div className="space-y-2">
              {report.soldComps.map((comp) => (
                <a
                  key={comp.lotNumber}
                  href={comp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--text-muted)] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[0.8rem] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] truncate">
                      {comp.title}
                    </p>
                    <p className="font-mono text-[0.65rem] text-[var(--text-muted)] mt-0.5">
                      {comp.primaryDamage}
                      {comp.odometerMiles
                        ? ` · ${comp.odometerMiles.toLocaleString()} mi`
                        : ''}
                      {comp.saleDate
                        ? ` · ${new Date(comp.saleDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}`
                        : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-[700] text-[var(--text-primary)]">
                      £{comp.hammerGbp.toLocaleString()}
                    </p>
                    <p className="font-mono text-[0.6rem] text-[var(--text-muted)]">hammer</p>
                  </div>
                </a>
              ))}
            </div>
            <p className="mt-3 font-mono text-[0.6rem] text-[var(--text-muted)]">
              Final hammer prices at time of auction · Source: Copart UK · Check lot pages for full details
            </p>
          </div>
        )}

        {/* Bodyshop repair spec */}
        <BodyshopSpec spec={bodyshopSpec} />

        {/* Verdict confidence */}
        {report.verdictConfidence && (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>AI Verdict Confidence</SectionLabel>
              <div className="flex items-center gap-2">
                <div className="relative w-10 h-10">
                  <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
                    <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
                    <circle cx="20" cy="20" r="16" fill="none"
                      stroke={report.verdictConfidence.score >= 75 ? '#22C55E' : report.verdictConfidence.score >= 50 ? '#EAB308' : '#EF4444'}
                      strokeWidth="3.5"
                      strokeDasharray={`${(report.verdictConfidence.score / 100) * 100.5} 100.5`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[0.65rem] font-[700] text-[var(--text-primary)]">
                    {report.verdictConfidence.score}
                  </span>
                </div>
                <span className={`font-mono text-xs font-[700] uppercase tracking-wider ${
                  report.verdictConfidence.level === 'high' ? 'text-[#22C55E]'
                  : report.verdictConfidence.level === 'medium' ? 'text-[#EAB308]'
                  : 'text-[#EF4444]'
                }`}>
                  {report.verdictConfidence.level} confidence
                </span>
              </div>
            </div>
            {report.verdictConfidence.limitingFactors.length > 0 && (
              <ul className="space-y-1">
                {report.verdictConfidence.limitingFactors.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#EAB308] mt-0.5 shrink-0">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 2v4M6 8.5v.5" stroke="#EAB308" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="6" cy="6" r="5" stroke="#EAB308" strokeWidth="1.2" />
                      </svg>
                    </span>
                    <span className="font-mono text-[0.75rem] text-[var(--text-muted)]">{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Verdict rationale */}
        <div className={`animate-fade-up stagger-5 mt-4 p-5 rounded-xl border ${verdict.className} ${verdict.bgClass}`}>
          <SectionLabel>Why {verdict.label}</SectionLabel>
          <p className="mt-2 font-body text-[0.9375rem] leading-[1.7] text-[var(--text-secondary)]">
            {sections.verdictRationale}
          </p>
        </div>

        {/* Assumptions */}
        <div className="animate-fade-up stagger-5 mt-4 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <p className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider mb-2">Assumptions</p>
          <ul className="space-y-1">
            {cost.assumptions.map((a) => (
              <li key={a} className="font-mono text-xs text-[var(--text-muted)]">· {a}</li>
            ))}
          </ul>
        </div>

        {/* Legal disclaimer footer */}
        <div className="mt-8 pt-6 border-t border-[var(--border)]">
          <p className="font-mono text-[0.65rem] font-[700] text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Important — Please Read
          </p>
          <div className="space-y-1.5 font-mono text-[0.65rem] text-[var(--text-muted)] leading-[1.7]">
            <p>This report is generated automatically using AI and publicly available data. It is provided for informational and research purposes only and does not constitute financial, legal, mechanical, or professional advice of any kind.</p>
            <p>All cost estimates (repair, import, resale, running costs) are approximations based on statistical models and market data at the time of report generation. Actual costs may differ materially. Resale values are ceiling estimates for a fully repaired vehicle and are not guaranteed.</p>
            <p>SalvageScore accepts no liability for any loss, damage, or expense arising from reliance on this report. You should always: (1) inspect the vehicle in person or arrange a pre-purchase inspection; (2) obtain independent quotes from qualified bodyshops; (3) carry out a full HPI, Carfax, or equivalent history check; and (4) seek professional advice before committing to any purchase.</p>
            <p>Auction bidding is legally binding. Once placed, bids cannot be withdrawn. Ensure you have adequate finance and a clear exit plan before bidding on any salvage vehicle.</p>
          </div>
          <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
            <p className="font-mono text-[0.6rem] text-[var(--text-muted)]">
              Report generated {new Date(report.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · SalvageScore
            </p>
            <a href="/check" className="font-mono text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              ← Run another analysis
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper functions ────────────────────────────────────────────────────────

function computeDealScore(marginPct: number, damage: DamageFindings, confidence: string): number {
  let score = 50;
  score += Math.min(25, Math.max(-25, marginPct * 0.83));
  if (damage.overallSeverity === 'cosmetic')   score += 15;
  else if (damage.overallSeverity === 'panel') score += 5;
  else if (damage.overallSeverity === 'structural') score -= 10;
  else if (damage.overallSeverity === 'frame') score -= 20;
  const flagCount = Object.values(damage.criticalFlags).filter(Boolean).length;
  score -= flagCount * 10;
  // Non-runner carries unknown mechanical cost — additional penalty on top of the flag hit above
  if (damage.criticalFlags.nonRunner) score -= 20;
  if (confidence === 'high') score += 5;
  else if (confidence === 'low') score -= 10;
  return Math.round(Math.min(100, Math.max(0, score)));
}

type TimelineStep = { label: string; note?: string };
type Timeline = { minWeeks: number; maxWeeks: number; steps: TimelineStep[] };

function computeTimeline(listing: Listing, damage: DamageFindings): Timeline {
  const isUK = listing.source === 'copart-uk';
  const steps: TimelineStep[] = [];
  let min = 0;
  let max = 0;

  if (!isUK) {
    steps.push({ label: 'Pay auction & arrange UK shipping broker' });
    steps.push({ label: 'Sea freight to UK port', note: '4–6 weeks' });
    min += 4; max += 6;
    steps.push({ label: 'Customs clearance & import duty payment', note: '1–2 weeks' });
    min += 1; max += 2;
  } else {
    steps.push({ label: 'Collect from Copart UK yard', note: 'Same week' });
    max += 1;
  }

  const sev = damage.overallSeverity;
  if (sev === 'cosmetic') {
    steps.push({ label: 'Cosmetic repairs (paintwork, minor dents)', note: '1–2 weeks' });
    min += 1; max += 2;
  } else if (sev === 'panel') {
    steps.push({ label: 'Panel repairs & respray at bodyshop', note: '2–4 weeks' });
    min += 2; max += 4;
  } else if (sev === 'structural') {
    steps.push({ label: 'Structural repairs at specialist bodyshop', note: '4–8 weeks' });
    min += 4; max += 8;
  } else {
    steps.push({ label: 'Frame straightening & structural rebuild', note: '6–12 weeks' });
    min += 6; max += 12;
  }

  if (damage.criticalFlags.deployedAirbag) {
    steps.push({ label: 'Airbag modules & seatbelt pre-tensioner replacement', note: '+1–2 weeks' });
    min += 1; max += 2;
  }
  if (damage.criticalFlags.floodWaterline) {
    steps.push({ label: 'Flood remediation & electrical dry-out', note: '+2–4 weeks' });
    min += 2; max += 4;
  }
  if (damage.criticalFlags.fireDamage) {
    steps.push({ label: 'Fire damage assessment & repair', note: '+2–4 weeks' });
    min += 2; max += 4;
  }

  if (!isUK) {
    steps.push({ label: 'IVA / MSVA compliance test & DVLA registration', note: '1–3 weeks' });
    min += 1; max += 3;
  } else {
    const t = listing.titleStatus.toLowerCase();
    if (t.includes('cat s') || t.includes('cat n')) {
      steps.push({ label: 'DVLA Cat S/N re-registration & notification', note: '1–2 weeks' });
      min += 1; max += 2;
    }
  }

  steps.push({ label: 'MOT test & fix any advisories', note: '1 week' });
  max += 1;
  steps.push({ label: 'Declare damage history to insurer & arrange road tax' });

  return { minWeeks: min, maxWeeks: max, steps };
}

function computeUsTimeline(damage: DamageFindings): Timeline {
  const steps: TimelineStep[] = [];
  let min = 0;
  let max = 1;

  steps.push({ label: 'Win auction & arrange towing to your shop', note: 'Same day / next day' });

  const sev = damage.overallSeverity;
  if (sev === 'cosmetic') {
    steps.push({ label: 'Cosmetic repairs (paintwork, minor dents)', note: '1–2 weeks' });
    min += 1; max += 2;
  } else if (sev === 'panel') {
    steps.push({ label: 'Panel repairs & respray at bodyshop', note: '2–4 weeks' });
    min += 2; max += 4;
  } else if (sev === 'structural') {
    steps.push({ label: 'Structural repairs at specialist bodyshop', note: '4–8 weeks' });
    min += 4; max += 8;
  } else {
    steps.push({ label: 'Frame straightening & structural rebuild', note: '6–12 weeks' });
    min += 6; max += 12;
  }

  if (damage.criticalFlags.deployedAirbag) {
    steps.push({ label: 'Airbag modules & seatbelt pre-tensioner replacement', note: '+1–2 weeks' });
    min += 1; max += 2;
  }
  if (damage.criticalFlags.floodWaterline) {
    steps.push({ label: 'Flood remediation & electrical dry-out', note: '+2–4 weeks' });
    min += 2; max += 4;
  }
  if (damage.criticalFlags.fireDamage) {
    steps.push({ label: 'Fire damage assessment & repair', note: '+2–4 weeks' });
    min += 2; max += 4;
  }

  steps.push({ label: 'Post-repair inspection & documentation' });
  steps.push({ label: 'Apply for rebuilt title at your state DMV', note: '1–3 weeks' });
  min += 1; max += 3;
  steps.push({ label: 'Arrange insurance for rebuilt title coverage' });
  steps.push({ label: 'Register & plate the vehicle' });

  return { minWeeks: min, maxWeeks: max, steps };
}

function computeUsOwnershipCosts(listing: Listing, exchangeRate: number) {
  const makeModel = listing.model.toUpperCase();
  const isLargeVehicle = ['SIERRA', 'SILVERADO', 'F-150', 'F150', 'RAM', 'TUNDRA', 'TAHOE', 'SUBURBAN', 'YUKON', 'NAVIGATOR', 'EXPEDITION', 'ESCALADE', 'SEQUOIA', 'ARMADA'].some((t) => makeModel.includes(t));
  const mpg = isLargeVehicle ? 18 : 27;
  const milesPerYear = 12000;
  const gasPriceUsd = 3.30;
  const annualFuelUsd = Math.round((milesPerYear / mpg) * gasPriceUsd);
  const annualRegistrationUsd = 300;
  const isSalvage = /salvage|rebuilt/i.test(listing.titleStatus || '');
  const annualInsuranceUsd = isSalvage ? 2800 : 1900;
  return {
    fuelUsd: annualFuelUsd,
    registrationUsd: annualRegistrationUsd,
    insuranceUsd: annualInsuranceUsd,
    totalUsd: annualFuelUsd + annualRegistrationUsd + annualInsuranceUsd,
    mpg,
    milesPerYear,
  };
}

type InsuranceInfo = { category: string; colour: string; whatItMeans: string; insuranceImpact: string; resaleImpact: string };

function getInsuranceInfo(titleStatus: string, source: string): InsuranceInfo | null {
  const t = titleStatus.toLowerCase();
  if (t.includes('cat s')) return {
    category: 'Category S',
    colour: 'text-[#F97316]',
    whatItMeans: "The car's structure (chassis, crumple zones) was damaged but assessed as repairable. A Cat S marker stays on the vehicle history permanently.",
    insuranceImpact: 'Must be declared to all future insurers. Expect 15–30% premium increase; some mainstream insurers decline Cat S vehicles. Specialists: Adrian Flux, Footman James.',
    resaleImpact: 'Typically 20–30% below an equivalent clean-title car even after full repair.',
  };
  if (t.includes('cat n') || t.includes('n repairable')) return {
    category: 'Category N',
    colour: 'text-[#EAB308]',
    whatItMeans: 'Non-structural damage — electrics, cosmetics, or mechanical. The chassis and load-bearing structure are undamaged. Easiest category to insure and resell.',
    insuranceImpact: 'Must be declared. Most standard insurers will cover Cat N; expect 5–20% premium increase depending on the extent of damage.',
    resaleImpact: 'Typically 10–20% below an equivalent clean-title car once repaired.',
  };
  if (t.includes('salvage') || t.includes('rebuilt')) return {
    category: 'Salvage / Rebuilt (US)',
    colour: 'text-[#EF4444]',
    whatItMeans: 'US total-loss write-off. A rebuilt title means it passed a US state inspection after repair, but the damage history is permanently recorded on the title.',
    insuranceImpact: 'UK specialist insurers only (Adrian Flux, Footman James, etc.). Standard insurers typically refuse. Expect significant premium increase.',
    resaleImpact: 'Typically 30–50% below clean-title equivalent in the UK due to insurance and perception barriers.',
  };
  if (t.includes('clean') && source === 'copart-uk') return {
    category: 'Clean Title',
    colour: 'text-[#22C55E]',
    whatItMeans: 'No recorded write-off or damage category. Standard vehicle history — the best possible title status.',
    insuranceImpact: 'Standard insurance rates apply. No damage declaration required beyond any mechanical defects found.',
    resaleImpact: 'No title penalty on resale. Market value applies.',
  };
  return null;
}

const UK_CHECKLIST: TimelineStep[] = [
  { label: 'Win auction & pay Copart fees', note: 'Hammer + buyer\'s premium + VAT' },
  { label: 'Arrange recovery to your bodyshop', note: 'Cat S/N may not be driveable' },
  { label: 'Complete all repairs to a roadworthy standard' },
  { label: 'Get post-repair structural report (Cat S only)', note: 'Required for DVLA re-registration' },
  { label: 'Notify DVLA & update V5C with damage category' },
  { label: 'Book and pass MOT test' },
  { label: 'Declare full damage history to insurer when arranging cover' },
  { label: 'Apply for road tax' },
];

const US_BUYER_CHECKLIST: TimelineStep[] = [
  { label: 'Win auction & pay Copart fees', note: 'Hammer + buyer\'s premium (~12–15%)' },
  { label: 'Arrange towing or transport to your shop', note: 'Most salvage titles are not driveable' },
  { label: 'Get 3 independent bodyshop quotes before authorising any work' },
  { label: 'Run a full VIN history check', note: 'Carfax or AutoCheck — check for flood, theft, frame damage' },
  { label: 'Inspect in person or arrange a pre-purchase inspection (PPI)' },
  { label: 'Complete all repairs and get a post-repair inspection' },
  { label: 'File for rebuilt title with your state DMV', note: 'Required after repairing a salvage title vehicle' },
  { label: 'Get insurance quotes before buying', note: 'Salvage/rebuilt titles have limited coverage options' },
];

const US_IMPORT_CHECKLIST: TimelineStep[] = [
  { label: 'Pay auction fees', note: 'Hammer + buyer\'s premium' },
  { label: 'Arrange US-to-UK sea freight via shipping broker', note: 'Get quotes from 3+ brokers' },
  { label: 'Customs clearance at UK port', note: '6.5% import duty + 20% VAT on (value + duty + freight)' },
  { label: 'Notify DVLA you are importing a vehicle' },
  { label: 'Book IVA (Individual Vehicle Approval) test with DVSA', note: 'Waiting list can be 4–8 weeks' },
  { label: 'Pass IVA — may need mph speedo, UK lighting, number-plate lights' },
  { label: 'Register with DVLA to get a UK registration number' },
  { label: 'Complete all bodywork & mechanical repairs' },
  { label: 'Book and pass MOT test' },
  { label: 'Arrange specialist UK insurance', note: 'Declare salvage/rebuilt title' },
  { label: 'Apply for road tax' },
];

// ── UI components ────────────────────────────────────────────────────────────

function DealScoreGauge({ score }: { score: number }) {
  const isGood = score >= 70;
  const isMid  = score >= 45;
  const labelText  = isGood ? 'Good deal'  : isMid ? 'Caution'   : 'Poor deal';
  const labelColor = isGood ? 'text-[#22C55E]' : isMid ? 'text-[#EAB308]' : 'text-[#EF4444]';
  const strokeColor = isGood ? '#22C55E' : isMid ? '#EAB308' : '#EF4444';
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="shrink-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
          <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <circle cx="24" cy="24" r={r} fill="none" stroke={strokeColor} strokeWidth="4"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono font-[700] text-sm text-white">
          {score}
        </span>
      </div>
      <span className={`font-mono text-[0.6rem] mt-1 font-[600] ${labelColor}`}>{labelText}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider">
      {children}
    </p>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-mono text-xs text-[var(--text-muted)] shrink-0">{label}</span>
      <span className={`font-mono text-xs text-right ${highlight ? 'text-[var(--text-primary)] font-[600]' : 'text-[var(--text-secondary)]'}`}>
        {value}
      </span>
    </div>
  );
}

function Flag({ label }: { label: string }) {
  return (
    <span className="inline-block font-mono text-xs px-2 py-1 rounded border border-[#EF4444]/40 text-[#EF4444] bg-[rgba(239,68,68,0.08)]">
      {label}
    </span>
  );
}

type CostScenarios = {
  best:     { repairGbp: number; totalGbp: number; marginGbp: number };
  expected: { repairGbp: number; totalGbp: number; marginGbp: number };
  worst:    { repairGbp: number; totalGbp: number; marginGbp: number };
};

function computeCostScenarios(cost: CostBreakdown, resale: ResaleEstimate, ceilingGbp?: number): CostScenarios {
  const ceiling = ceilingGbp ?? resale.ceilingGbp;
  const fixedCosts =
    cost.totalGbp - cost.hammerGbp - cost.repairSubtotalGbp - cost.hiddenDamageContingencyGbp;

  const bestRepair = Math.round(cost.repairSubtotalGbp * 0.65);
  const bestTotal  = cost.hammerGbp + fixedCosts + bestRepair;

  const expectedRepair = cost.repairSubtotalGbp + cost.hiddenDamageContingencyGbp;
  const expectedTotal  = cost.totalGbp;

  const hiddenMax = cost.hiddenRepairItems.reduce((s, i) => s + i.maxGbp, 0);
  const worstRepair = Math.round(cost.repairSubtotalGbp * 1.6) + hiddenMax;
  const worstTotal  = cost.hammerGbp + fixedCosts + worstRepair;

  return {
    best:     { repairGbp: bestRepair,     totalGbp: bestTotal,     marginGbp: ceiling - bestTotal },
    expected: { repairGbp: expectedRepair, totalGbp: expectedTotal, marginGbp: ceiling - expectedTotal },
    worst:    { repairGbp: worstRepair,    totalGbp: worstTotal,    marginGbp: ceiling - worstTotal },
  };
}

type CostBreakdown = import('@/types').CostBreakdown;
type ResaleEstimate = import('@/types').ResaleEstimate;

function CostPill({
  label, valueGbp, note, highlight,
}: {
  label: string; valueGbp: number; note?: string; highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? 'border-[var(--amber)]/30 bg-[rgba(245,158,11,0.06)]' : 'border-[var(--border)] bg-[var(--bg)]'}`}>
      <p className="font-mono text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-mono text-lg font-[700] leading-none ${highlight ? 'text-[var(--amber-bright)]' : 'text-[var(--text-primary)]'}`}>
        {fmt(valueGbp)}
      </p>
      {note && <p className="font-mono text-[0.6rem] text-[var(--text-muted)] mt-1 capitalize">{note}</p>}
    </div>
  );
}

function ScenarioRow({
  label, description, repair, total, margin, isActive, formatter = fmt,
}: {
  label: string; description: string; repair: number; total: number; margin: number; isActive?: boolean;
  formatter?: (gbp: number) => string;
}) {
  const isPositive = margin >= 0;
  const marginColor = isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]';
  return (
    <tr className={`${isActive ? 'bg-[rgba(255,255,255,0.03)]' : ''}`}>
      <td className="py-2.5 pr-3">
        <p className={`font-[600] ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
          {label}
          {isActive && <span className="ml-1.5 text-[0.55rem] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)] font-[400] uppercase tracking-wide">current</span>}
        </p>
        <p className="text-[0.65rem] text-[var(--text-muted)] mt-0.5 leading-tight">{description}</p>
      </td>
      <td className="py-2.5 pr-3 text-right text-[var(--text-secondary)] tabular-nums">{formatter(repair)}</td>
      <td className="py-2.5 pr-3 text-right text-[var(--text-secondary)] tabular-nums">{formatter(total)}</td>
      <td className={`py-2.5 text-right font-[700] tabular-nums ${marginColor}`}>
        {isPositive ? '+' : ''}{formatter(Math.abs(margin))}
      </td>
    </tr>
  );
}

function HistoryLink({ href, label, note }: { href: string; label: string; note: string }) {
  const isPaid = note === 'paid';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] font-[500] px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
    >
      {label}
      <span className={`text-[0.55rem] font-[600] uppercase tracking-wide px-1 py-0.5 rounded border ${
        isPaid
          ? 'border-[var(--border)] text-[var(--text-muted)]'
          : 'border-[#22C55E]/40 text-[#22C55E] bg-[rgba(34,197,94,0.08)]'
      }`}>
        {note}
      </span>
    </a>
  );
}
