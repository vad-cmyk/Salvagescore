import Anthropic from '@anthropic-ai/sdk';
import type { DamageFindings, PhotoAnalysis, CriticalFlags, DamageSeverity } from '@/types';

const SEVERITY_ORDER: DamageSeverity[] = ['cosmetic', 'panel', 'structural', 'frame'];

function maxSeverity(a: DamageSeverity, b: DamageSeverity): DamageSeverity {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

type AllowedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
const ALLOWED_MIMES = new Set<string>(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function normaliseMime(raw: string | null): AllowedMime {
  const ct = (raw ?? '').split(';')[0].trim().toLowerCase();
  if (ALLOWED_MIMES.has(ct)) return ct as AllowedMime;
  return 'image/jpeg';
}

async function fetchImageBlock(
  url: string,
  referer: string
): Promise<Anthropic.ImageBlockParam | null> {
  try {
    const res = await fetch(url, {
      headers: { Referer: referer, 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 4096) return null;
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = normaliseMime(res.headers.get('content-type'));
    return {
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: mimeType, data: base64 },
    };
  } catch {
    return null;
  }
}

type ParsedPhoto = {
  zone: string;
  damageType: string;
  severity: DamageSeverity;
  findings: string[];
  damagedPanels: string[];
  criticalFlags: {
    deployedAirbag: boolean;
    frameDamage: boolean;
    floodWaterline: boolean;
    fireDamage: boolean;
    theftStrip: boolean;
  };
};

const PANEL_VOCAB = [
  // Exterior body
  'bonnet','front-bumper','rear-bumper','front-wing','rear-quarter',
  'front-door','rear-door','tailgate','trunk-lid','roof','sill',
  'spoiler','running-board','wheel-arch-liner','inner-wing',
  // Glass
  'windscreen','rear-screen','side-glass','sunroof-glass',
  // Lighting / exterior trim
  'headlight','taillight','fog-light','indicator','grille','mirror',
  // Structural
  'floor-pan','firewall','a-pillar','b-pillar','c-pillar','frame-rail','subframe',
  // Mechanical (visible in photos)
  'radiator','condenser','exhaust','suspension-component',
  // Interior
  'dashboard','seat-driver','seat-passenger','carpet','headliner','steering-wheel','airbag-module',
].join(' | ');

const PROMPT = `You are a vehicle damage assessor reviewing salvage auction photos. Be accurate and conservative.

Analyze each photo in order and return a JSON array with one object per photo.

Each object must have exactly these fields:

"zone": one of: front | rear | side-lh | side-rh | roof | undercarriage | interior | engine-bay
"damageType": one of: collision | hail | fire | flood | theft | mechanical | none
"severity": one of: cosmetic | panel | structural | frame
"findings": array of 1–5 short, specific observations about visible damage only. Describe what you SEE, not what you assume. If undamaged, use ["no visible damage"].
"damagedPanels": panels visibly damaged in THIS photo only. Use exact values from: ${PANEL_VOCAB}. Use [] if none.
"criticalFlags": object with five booleans — set true ONLY when you see clear, unambiguous physical evidence in THIS photo:
  {
    "deployedAirbag": true only if an airbag module is visibly deployed (fabric bag hanging out, or empty housing with torn cover),
    "frameDamage": true only if a structural chassis rail or unibody member is visibly bent, cracked, or kinked,
    "floodWaterline": true only if a tide/waterline stain is visible on interior trim, door cards, or carpet,
    "fireDamage": true only if charring, melted plastic, or blackened fire-burned surfaces are visible,
    "theftStrip": true only if the engine, catalytic converter, or all wheels are clearly missing
  }

Severity guide:
  cosmetic — scratches, dents under 5cm, paint chips, minor scuffs
  panel — significant dents requiring panel replacement, no structural concern
  structural — pillars, sills, firewall, suspension mounting or wheel arch visibly affected
  frame — chassis rail, unibody rail, or subframe visibly bent or cracked

Rules:
- If you CANNOT clearly see the indicator for a critical flag, set it to false. Do not infer from context.
- Do not set a flag true because the car is a salvage title — only flag what is visible in the photo.
- "airbag" in findings text does NOT set deployedAirbag — only the boolean field matters.
- One JSON object per photo, same order as photos provided.

Return ONLY the JSON array, no explanation, no markdown.`;

/** Analyze up to 6 listing photos and return structured damage findings. */
export async function analyzePhotos(
  photos: { url: string; caption?: string }[],
  sourceUrl?: string
): Promise<DamageFindings> {
  const client = new Anthropic();
  const empty: DamageFindings = {
    photos: [],
    criticalFlags: {
      deployedAirbag: false,
      frameDamage: false,
      floodWaterline: false,
      fireDamage: false,
      theftStrip: false,
      nonRunner: false,
    },
    overallSeverity: 'cosmetic',
    damagedPanels: [],
  };

  if (!photos.length) return empty;

  const referer = sourceUrl ?? 'https://abetter.bid/';
  const batch = photos.slice(0, 6);

  const results = await Promise.all(batch.map((p) => fetchImageBlock(p.url, referer)));
  const validPairs = batch
    .map((p, i) => ({ photo: p, block: results[i] }))
    .filter((x): x is { photo: typeof batch[0]; block: Anthropic.ImageBlockParam } => x.block !== null);

  if (!validPairs.length) {
    console.warn('[analyzePhotos] No photos could be fetched — returning empty findings');
    return empty;
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: [
          ...validPairs.map((x) => x.block),
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]';
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  let parsed: ParsedPhoto[] = [];
  try {
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    console.warn('[analyzePhotos] Failed to parse AI response as JSON');
  }

  const VALID_ZONES = new Set<string>(['front','rear','side-lh','side-rh','roof','undercarriage','interior','engine-bay']);
  const VALID_TYPES = new Set<string>(['collision','hail','fire','flood','theft','mechanical','none']);

  const photoResults: PhotoAnalysis[] = validPairs.map(({ photo }, i) => ({
    url: photo.url,
    zone: (VALID_ZONES.has(parsed[i]?.zone) ? parsed[i].zone : 'front') as PhotoAnalysis['zone'],
    damageType: (VALID_TYPES.has(parsed[i]?.damageType) ? parsed[i].damageType : 'none') as PhotoAnalysis['damageType'],
    severity: parsed[i]?.severity ?? 'cosmetic',
    findings: parsed[i]?.findings ?? [],
  }));

  // Collect + deduplicate panels across all photos
  const damagedPanels = [
    ...new Set(parsed.flatMap((p) => Array.isArray(p?.damagedPanels) ? p.damagedPanels : [])),
  ];

  // Use explicit booleans from the AI — NOT keyword matching on freetext
  const criticalFlags: CriticalFlags = {
    deployedAirbag: parsed.some((p) => p?.criticalFlags?.deployedAirbag === true),
    frameDamage:    parsed.some((p) => p?.criticalFlags?.frameDamage === true),
    floodWaterline: parsed.some((p) => p?.criticalFlags?.floodWaterline === true),
    fireDamage:     parsed.some((p) => p?.criticalFlags?.fireDamage === true),
    theftStrip:     parsed.some((p) => p?.criticalFlags?.theftStrip === true),
    nonRunner:      false,  // Set by orchestrator from listing data, not photo analysis
  };

  const overallSeverity = photoResults.reduce<DamageSeverity>(
    (acc, p) => maxSeverity(acc, p.severity),
    'cosmetic'
  );

  return { photos: photoResults, criticalFlags, overallSeverity, damagedPanels };
}
