import Anthropic from '@anthropic-ai/sdk';
import type { KnownIssue } from '@/types';

/**
 * Ask Claude for documented known issues on a specific make/model/year.
 * Returns an empty array for models with no notable issues or if the call fails.
 */
export async function fetchKnownIssues(
  make: string,
  model: string,
  year: number
): Promise<KnownIssue[]> {
  const client = new Anthropic();
  const prompt = `You are a UK automotive technician with 20 years of experience diagnosing and repairing cars.

List the most important DOCUMENTED known issues for a ${year} ${make} ${model} that a buyer at salvage auction should know about. Focus on:
- Expensive recurring failures (gearbox, engine, hybrid battery, suspension)
- Issues that commonly hide behind accident damage
- Problems that affect MOT, insurance, or long-term reliability
- Generation-specific recalls or technical service bulletins

Respond ONLY with a valid JSON array — no markdown, no explanation:
[
  {
    "category": "e.g. Drivetrain / Electrical / Engine / Suspension / Hybrid System",
    "issue": "concise plain-English description of the known problem",
    "severity": "minor | moderate | major",
    "typicalCostGbp": { "min": 500, "max": 2000 }
  }
]

Rules:
- Include 3–6 issues maximum. Only real, documented problems — never speculate.
- If the model has no notable known issues, return exactly: []
- severity "major" = repair cost > £2,000 or renders car unroadworthy
- severity "moderate" = £500–£2,000 or significant reliability risk
- severity "minor" = cosmetic or < £500, easy to fix
- typicalCostGbp is optional — omit if cost is highly variable or unknown`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as KnownIssue[];
  } catch {
    return [];
  }
}
