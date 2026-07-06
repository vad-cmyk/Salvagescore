import type { DamageFindings, ReportVerdict } from '@/types';

/** Compute the 0–100 deal score from margin, damage, and resale confidence. */
export function computeDealScore(marginPct: number, damage: DamageFindings, confidence: string): number {
  let score = 50;
  score += Math.min(25, Math.max(-25, marginPct * 0.83));
  if (damage.overallSeverity === 'cosmetic')        score += 15;
  else if (damage.overallSeverity === 'panel')      score +=  5;
  else if (damage.overallSeverity === 'structural') score -= 10;
  else if (damage.overallSeverity === 'frame')      score -= 20;
  const flagCount = Object.values(damage.criticalFlags).filter(Boolean).length;
  score -= flagCount * 10;
  if (damage.criticalFlags.nonRunner) score -= 20;
  if (confidence === 'high') score +=  5;
  else if (confidence === 'low') score -= 10;
  return Math.round(Math.min(100, Math.max(0, score)));
}

/** Map a deal score to the three-tier verdict. */
export function scoreToVerdict(score: number): ReportVerdict {
  if (score >= 65) return 'pass';
  if (score >= 40) return 'caution';
  return 'avoid';
}
