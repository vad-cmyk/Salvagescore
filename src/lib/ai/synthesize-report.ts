import Anthropic from '@anthropic-ai/sdk';
import type {
  Listing,
  DamageFindings,
  CostBreakdown,
  ResaleEstimate,
  ReportVerdict,
  VerdictConfidence,
} from '@/types';

export type SynthesisOutput = {
  verdict: ReportVerdict;
  summary: string;
  sections: {
    damageNarrative: string;
    costNarrative: string;
    resaleNarrative: string;
    verdictRationale: string;
  };
  verdictConfidence: VerdictConfidence;
};

/** Synthesize structured inputs into a human-readable report using Claude. */
export async function synthesizeReport(
  listing: Listing,
  damage: DamageFindings,
  cost: CostBreakdown,
  resale: ResaleEstimate,
  isNonRunner = false
): Promise<SynthesisOutput> {
  const client = new Anthropic();
  const margin = resale.ceilingGbp - cost.totalGbp;
  const marginPct = Math.round((margin / resale.ceilingGbp) * 100);

  const isCleanTitle = /clean/i.test(listing.titleStatus || '');
  const isNoDamage = /^(none|n\/a|clean|no damage)/i.test((listing.primaryDamage || '').trim());
  const cleanTitleNote = isCleanTitle && isNoDamage && !isNonRunner
    ? '\n\nIMPORTANT: This is a CLEAN-TITLE vehicle with no declared damage. It may be at auction for financial reasons, fleet disposal, or insurance buyback — not necessarily because it is damaged. Treat it as a straightforward import opportunity and focus your analysis on import costs, UK market viability, and value vs. cost.\n'
    : '';

  const engineConfirmedStarts = listing.engineStarts === true;
  const nonRunnerNote = isNonRunner
    ? (engineConfirmedStarts
        ? '\n\nCRITICAL — IMMOBILE (engine confirmed starting): Copart UK\'s "Engine Start Program" confirms the engine starts, but this lot is flagged as Immobile Vehicle (IV) — it cannot be driven away. The cause is NOT engine failure — it is drivetrain, brake, suspension, steering, or chassis damage (consistent with the declared damage / title status). The repair cost shown does NOT include the cost to make it drivable. You MUST:\n1. NEVER suggest the engine is the problem — Copart has verified it runs\n2. Frame the unknown cost as a drivability / structural repair, not a mechanical failure\n3. Treat the repair estimate as incomplete — add a drivability-repair contingency (£400–£3,000 typical, higher for Cat S structural)\n4. Default to "caution" unless margin remains positive at worst-case drivability cost\n5. Your summary MUST start with "IMMOBILE — engine starts but " to flag this immediately\n'
        : '\n\nCRITICAL — NON-RUNNER: This vehicle does not start or cannot be driven. The photo analysis reflects body condition only and CANNOT assess the mechanical failure. The repair cost shown does NOT include drivetrain/mechanical repair — that cost is unknown and could range from £200 (dead battery) to £15,000+ (seized engine or HV battery replacement). You MUST:\n1. Treat the repair estimate as incomplete — add a realistic mechanical contingency\n2. Default to "caution" unless the margin is so large it works even at worst-case mechanical cost\n3. Explicitly state in every section that this is a non-runner and mechanical inspection is required before bidding\n4. Your summary MUST start with "NON-RUNNER — " to flag this immediately\n')
    : '';

  const prompt = `You are a UK vehicle importer advising a buyer on a car from Copart.${cleanTitleNote}${nonRunnerNote}

Here is the structured data for this lot:

LISTING:
${JSON.stringify({ year: listing.year, make: listing.make, model: listing.model, trim: listing.trim, odometerMiles: listing.odometerMiles, primaryDamage: listing.primaryDamage, secondaryDamage: listing.secondaryDamage, titleStatus: listing.titleStatus, location: listing.location }, null, 2)}

DAMAGE FINDINGS:
- Overall severity: ${damage.overallSeverity}
- Critical flags: ${JSON.stringify(damage.criticalFlags)}
- Photo-by-photo findings: ${damage.photos.map((p) => `[${p.zone}] ${p.severity}: ${p.findings.join(', ')}`).join(' | ')}

COST BREAKDOWN (UK landed):
- Hammer: £${cost.hammerGbp.toLocaleString()}
- Total to road-legal: £${cost.totalGbp.toLocaleString()}
- Line items: ${cost.lineItems.map((l) => `${l.label} £${l.amountGbp.toLocaleString()}`).join(', ')}

RESALE ESTIMATE:
- UK resale ceiling: £${resale.ceilingGbp.toLocaleString()}
- Estimated margin: £${margin.toLocaleString()} (${marginPct}%)
- Penalties applied: ${resale.penalties.map((p) => p.label).join(', ') || 'none'}

Respond with a JSON object matching this exact schema:
{
  "verdict": "pass" | "caution" | "avoid",
  "summary": "2-3 sentence plain-English summary a buyer can read in 10 seconds",
  "sections": {
    "damageNarrative": "2-4 sentences on the damage. Be specific. Call out every critical flag.",
    "costNarrative": "2-3 sentences explaining the cost estimate and its assumptions.",
    "resaleNarrative": "2-3 sentences on the UK resale ceiling and whether the margin makes sense.",
    "verdictRationale": "2-4 sentences explaining the verdict. Be direct. If it's avoid, say why clearly."
  },
  "verdictConfidence": {
    "score": <integer 0-100>,
    "level": "low" | "medium" | "high",
    "limitingFactors": ["up to 3 short strings explaining what reduces confidence, e.g. 'Engine bay not photographed', 'Only 3 photos available', 'Resale estimate based on fallback table'"]
  }
}

Confidence scoring guide:
- Start at 100. Deduct for each limitation:
  - Engine bay not visible in photos: -20
  - Fewer than 5 photos analysed: -15
  - Undercarriage not photographed: -10
  - Resale estimate is 'estimated' (not live AutoTrader or CAP Clean): -15
  - Resale confidence is 'low': -10
  - VIN masked / unknown: -5
  - Secondary damage unknown: -5
- level: score ≥ 75 = "high", 50–74 = "medium", < 50 = "low"
- limitingFactors: only list factors that actually apply — omit ones that don't reduce confidence

Verdict guide:
- pass: margin ≥ 15% AND no frame damage AND no fire/flood AND total cost is realistic; non-runners require margin ≥ 35% to earn pass
- caution: margin 5–14% OR one significant risk factor (airbag, structural, high mileage) OR clean-title vehicle with thin UK resale market; default for non-runners with margin 15–34%
- avoid: margin < 5% OR frame damage OR flood/fire OR theft strip OR total cost exceeds resale ceiling; non-runners with margin < 15% should be avoid

Be honest. A "pass" should feel earned. Return ONLY the JSON object.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Synthesizer returned no valid JSON');

  return JSON.parse(jsonMatch[0]) as SynthesisOutput;
}
