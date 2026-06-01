import { NextResponse } from 'next/server';

export const maxDuration = 10;

type ImportResult = { ok: boolean; error?: string };

async function check(fn: () => Promise<unknown>): Promise<ImportResult> {
  try { await fn(); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }; }
}

export async function GET() {
  const results = {
    playwright:        await check(() => import('playwright')),
    anthropic:         await check(() => import('@anthropic-ai/sdk')),
    nanoid:            await check(() => import('nanoid')),
    supabase_js:       await check(() => import('@supabase/supabase-js')),
    abetterbid:        await check(() => import('@/lib/scrapers/abetterbid')),
    copart_us:         await check(() => import('@/lib/scrapers/copart-us')),
    copart_uk:         await check(() => import('@/lib/scrapers/copart-uk')),
    analyze_photos:    await check(() => import('@/lib/ai/analyze-photos')),
    synthesize_report: await check(() => import('@/lib/ai/synthesize-report')),
    resale_model:      await check(() => import('@/lib/resale-model')),
    lib_supabase:      await check(() => import('@/lib/supabase')),
    orchestrator:      await check(() => import('@/lib/orchestrator')),
  };

  const failed = Object.entries(results).filter(([, v]) => !v.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    failed: Object.fromEntries(failed.map(([k, v]) => [k, v.error])),
    passed: Object.keys(results).filter((k) => results[k as keyof typeof results].ok),
    ts: new Date().toISOString(),
  });
}
