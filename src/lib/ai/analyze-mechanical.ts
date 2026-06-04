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

const PROMPT_TEMPLATE = (listing: Listing) => `You are a UK automotive technician diagnosing a non-starting vehicle being sold at salvage auction.

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
    "costGbp": { "min": 150, "max": 400 }
  }
]

Rules:
- List exactly 4–6 scenarios, highest probability first
- costGbp = total diagnosis + parts + labour at a UK independent garage
- Include both cheap/simple scenarios AND catastrophic ones
- probability "high" = most vehicles presenting this way have this cause
- Do NOT include scenarios with no realistic connection to this make/model/mileage
- Return only the JSON array`;

/** Generate mechanical failure scenarios for a non-runner listing. */
export async function analyzeMechanicalFailure(listing: Listing): Promise<MechanicalScenario[]> {
  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: PROMPT_TEMPLATE(listing) }],
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

/** Detect whether a listing is a non-runner from the damage/title text. */
export function detectNonRunner(listing: Listing): boolean {
  const text = [
    listing.primaryDamage,
    listing.secondaryDamage ?? '',
  ].join(' ').toLowerCase();
  return NON_RUNNER_PATTERNS.some((p) => text.includes(p));
}
