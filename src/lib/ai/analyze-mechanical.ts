import Anthropic from '@anthropic-ai/sdk';
import type { Listing, MechanicalScenario } from '@/types';

function engineNote(listing: Listing): string {
  const desc = [listing.trim ?? '', listing.model].join(' ').toLowerCase();
  if (/p400e|phev|plug.?in|hybrid/i.test(desc))
    return 'This is a PHEV (plug-in hybrid). Include conventional ICE causes AND hybrid-specific causes (12V battery, HV battery, inverter, hybrid control module, charging system). HV battery replacement is the worst-case scenario and costs £5,000–£15,000+.';
  if (/electric|ev|i-pace|e-tron|leaf|model [s3xy]/i.test(desc))
    return 'This is a battery-electric vehicle. Non-starter causes are: 12V auxiliary battery (most common), HV battery failure, inverter/motor failure, BMS fault, contactor failure.';
  if (/diesel|tdi|cdi|hdi|dci|2\.0d|3\.0d/i.test(desc))
    return 'This is a diesel engine. Common non-starter causes include glow plug failure, injector failure, HPFP failure, EGR blockage, DPF ash loading, air leak, timing chain/belt failure.';
  return 'Standard petrol engine. Consider battery, starter motor, alternator, fuel pump, spark plugs, immobiliser, and internal engine failure in that order of probability.';
}

const NON_STARTER_PROMPT = (listing: Listing) => `You are a UK automotive technician diagnosing a non-starting vehicle being sold at salvage auction.

Vehicle: ${listing.year} ${listing.make} ${listing.model}${listing.trim ? ` ${listing.trim}` : ''}
Declared damage: "${listing.primaryDamage}"${listing.secondaryDamage ? ` / "${listing.secondaryDamage}"` : ''}
Odometer: ${listing.odometerMiles.toLocaleString()} miles
Note: ${engineNote(listing)}

This vehicle does not start or cannot be driven. List the most probable causes in descending order of likelihood.

Respond ONLY with a valid JSON array — no markdown, no explanation:
[
  {
    "cause": "concise cause name (e.g. 'Dead 12V battery')",
    "probability": "high | medium | low",
    "description": "1–2 sentences: what failed, how to confirm before buying",
    "costGbp": { "min": 150, "max": 400 },
    "partOptions": [
      { "label": "New OEM", "minGbp": 100, "maxGbp": 200, "note": "optional short note" },
      { "label": "Used/salvage", "minGbp": 40, "maxGbp": 80 }
    ]
  }
]

Rules:
- List exactly 4–6 scenarios, highest probability first
- costGbp = total all-in cost (diagnosis + parts + labour) at a UK independent garage
- Include both cheap/simple scenarios AND catastrophic ones
- probability "high" = most vehicles presenting this way have this cause
- Do NOT include scenarios with no realistic connection to this make/model/mileage
- partOptions = realistic UK market prices for the key replacement part only (not labour). Include:
  * "New OEM" — main dealer / OEM supplier price for a brand-new part
  * "Reconditioned" — only if a reconditioned unit is realistically available for this part (e.g. engines, gearboxes, HV batteries)
  * "Used/salvage" — typical eBay UK / breakers yard price for a good used example
  * For consumables (battery, spark plugs, filters) omit "Used/salvage" and just show "New OEM" and optionally "Aftermarket"
  * Omit "note" unless there is something genuinely important (e.g. "Dealer-only, long lead time", "High warranty risk on used units")
- partOptions MUST reflect this specific make/model/year — give realistic prices, not generic ranges
- Return only the JSON array`;

const IMMOBILE_PROMPT = (listing: Listing) => `You are a UK automotive technician inspecting a salvage-auction vehicle whose engine CONFIRMED STARTS (Copart "Engine Start Program") but is marked as IMMOBILE — it cannot be driven away under its own power.

Vehicle: ${listing.year} ${listing.make} ${listing.model}${listing.trim ? ` ${listing.trim}` : ''}
Declared damage: "${listing.primaryDamage}"${listing.secondaryDamage ? ` / "${listing.secondaryDamage}"` : ''}
Odometer: ${listing.odometerMiles.toLocaleString()} miles
Title status: ${listing.titleStatus}

Because the engine STARTS, you MUST exclude all engine-failure causes (no "seized engine", "blown head gasket", "dead battery", "fuel pump", "starter motor", etc.). The engine and its starting circuit are known-working.

Instead, list the most probable reasons this car cannot be driven — focus on drivetrain, chassis, brake, suspension, steering, safety-system, and electronic causes that prevent SAFE driving (not engine starting). Examples:
- Transmission/gearbox failure or fluid loss (no drive)
- Driveshaft, propshaft, or differential damage
- Wheel/hub/bearing damage — wheel won't turn
- Brake system failure (no brakes, seized callipers, ABS module fault)
- Suspension/steering structural damage (broken control arm, snapped strut, bent subframe)
- Undercarriage / sump / floor-pan damage from impact or grounding
- Airbag deployment with locked-out drivetrain (post-crash safety mode)
- Immobiliser/ECU fault or key/security lockout
- Cat S/N structural damage requiring chassis straightening before MOT
- Disabled / theft-recovery lockdown by auction yard

Respond ONLY with a valid JSON array — no markdown, no explanation:
[
  {
    "cause": "concise cause name (e.g. 'Gearbox failure — no drive')",
    "probability": "high | medium | low",
    "description": "1–2 sentences: what's likely wrong, how to confirm before buying",
    "costGbp": { "min": 400, "max": 1800 },
    "partOptions": [
      { "label": "New OEM", "minGbp": 800, "maxGbp": 1600, "note": "optional short note" },
      { "label": "Reconditioned", "minGbp": 500, "maxGbp": 1000 },
      { "label": "Used/salvage", "minGbp": 200, "maxGbp": 500 }
    ]
  }
]

Rules:
- List exactly 4–6 NON-ENGINE scenarios, highest probability first
- Weight scenarios toward what the declared damage / title status suggests (e.g. "UNDERCARRIAGE" damage → chassis/subframe/propshaft causes ranked highest)
- costGbp = total all-in cost (diagnosis + parts + labour) at a UK independent garage
- Include both cheap fixes (sensor/module replacement) AND catastrophic ones (chassis straightening, gearbox replacement)
- partOptions = realistic UK market prices for this specific make/model/year
- Do NOT include any engine-internal scenarios (engine, head gasket, timing belt, pistons, starter, battery, fuel system) — the engine is confirmed running
- Return only the JSON array`;

/** Generate mechanical failure scenarios for a non-runner listing. */
export async function analyzeMechanicalFailure(listing: Listing): Promise<MechanicalScenario[]> {
  const client = new Anthropic();
  const prompt = listing.engineStarts === true ? IMMOBILE_PROMPT(listing) : NON_STARTER_PROMPT(listing);
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as MechanicalScenario[];
  } catch {
    return [];
  }
}

const NON_RUNNER_PATTERNS = [
  'mechanical',
  'non-runner',
  'non runner',
  'not run',
  'does not run',
  'engine failure',
  'engine seized',
  'engine blown',
  'no start',
  'not start',
  'does not start',
  'will not start',
  'starts/drives - no',
  'starts & drives - no',
  'mechanical loss',
];

/** Detect whether a listing is a non-runner from the damage/title text or driveStatus flag. */
export function detectNonRunner(listing: Listing): boolean {
  // Copart UK sets driveStatus=false when the vehicle cannot start or be driven
  if (listing.driveStatus === false) return true;

  const text = [
    listing.primaryDamage,
    listing.secondaryDamage ?? '',
  ].join(' ').toLowerCase();
  return NON_RUNNER_PATTERNS.some((p) => text.includes(p));
}
