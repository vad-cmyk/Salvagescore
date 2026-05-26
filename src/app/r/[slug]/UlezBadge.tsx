type UlezStatus = 'compliant' | 'non-compliant' | 'check-required';

function detectDiesel(primaryDamage: string, model: string): boolean {
  const text = `${primaryDamage} ${model}`.toLowerCase();
  return /\b(diesel|tdi|cdi|hdi|dci|crdi|jtd|sdv|tdv|bluemotion|blue.?tec)\b/.test(text);
}

function getEuroStandard(year: number, diesel: boolean): number {
  if (diesel) {
    if (year >= 2016) return 6;
    if (year >= 2011) return 5;
    if (year >= 2006) return 4;
    if (year >= 2001) return 3;
    return 2;
  } else {
    if (year >= 2015) return 6;
    if (year >= 2011) return 5;
    if (year >= 2006) return 4;
    if (year >= 2001) return 4;
    return 3;
  }
}

function getUlezStatus(year: number, diesel: boolean): UlezStatus {
  if (diesel) {
    if (year >= 2016) return 'compliant';
    return 'non-compliant';
  } else {
    if (year >= 2015) return 'compliant';
    if (year >= 2006) return 'compliant';
    if (year >= 2001) return 'check-required';
    return 'non-compliant';
  }
}

const TFL_CHECKER = 'https://tfl.gov.uk/modes/driving/check-your-vehicle-35332';

export default function UlezBadge({
  year,
  primaryDamage,
  model,
}: {
  year: number;
  primaryDamage: string;
  model: string;
}) {
  const diesel = detectDiesel(primaryDamage, model);
  const euroStandard = getEuroStandard(year, diesel);
  const status = getUlezStatus(year, diesel);
  const fuelLabel = diesel ? 'Diesel' : 'Petrol';

  return (
    <div className={`rounded-xl border p-5 ${
      status === 'compliant'
        ? 'border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.05)]'
        : status === 'non-compliant'
        ? 'border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.06)]'
        : 'border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.05)]'
    }`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-mono text-[0.65rem] font-[700] uppercase tracking-widest px-2 py-0.5 rounded border ${
              status === 'compliant'
                ? 'text-[#22C55E] border-[#22C55E]/40 bg-[rgba(34,197,94,0.1)]'
                : status === 'non-compliant'
                ? 'text-[#EF4444] border-[#EF4444]/40 bg-[rgba(239,68,68,0.1)]'
                : 'text-[#F59E0B] border-[#F59E0B]/40 bg-[rgba(245,158,11,0.1)]'
            }`}>
              {status === 'compliant'
                ? 'ULEZ Compliant'
                : status === 'non-compliant'
                ? 'ULEZ Non-Compliant'
                : 'Verify ULEZ Status'}
            </span>
          </div>
          <p className="font-mono text-[0.65rem] text-[rgba(255,255,255,0.35)]">
            London ULEZ · {fuelLabel} · Euro {euroStandard} (estimated) · {year} model year
          </p>
        </div>

        <a
          href={TFL_CHECKER}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-mono text-[0.65rem] px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.5)] hover:text-[rgba(255,255,255,0.8)] hover:border-[rgba(255,255,255,0.25)] transition-colors"
        >
          TfL checker ↗
        </a>
      </div>

      {status === 'non-compliant' && (
        <p className="mt-3 font-mono text-[0.75rem] text-[#EF4444]/80 leading-[1.6]">
          This vehicle does not meet ULEZ standards. Driving it in the London ULEZ zone incurs a{' '}
          <span className="font-[600]">£12.50/day charge</span>. Factor this into your running cost estimate.
        </p>
      )}

      {status === 'check-required' && (
        <p className="mt-3 font-mono text-[0.75rem] text-[#F59E0B]/80 leading-[1.6]">
          Borderline year — this vehicle may or may not comply depending on its specific engine variant.
          Use the TfL checker with the registration plate to confirm before bidding.
        </p>
      )}

      <p className="mt-3 font-mono text-[0.6rem] text-[rgba(255,255,255,0.25)] leading-[1.5]">
        Heuristic estimate only — based on vehicle year and fuel type. Verify with TfL for a definitive answer.
      </p>
    </div>
  );
}
