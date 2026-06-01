import { NextRequest, NextResponse } from 'next/server';
import { runAnalysis } from '@/lib/orchestrator';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  console.log('[analyze] POST entered, env:', {
    bb: !!process.env.BROWSERBASE_API_KEY,
    ai: !!process.env.ANTHROPIC_API_KEY,
    sb: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    sr: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  try {
    const body = await req.json().catch(() => ({}));
    const { url, buyerLocation } = body as { url?: string; buyerLocation?: string };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const allowed = ['copart.com', 'abetter.bid', 'copart.co.uk'];
    if (!allowed.some((domain) => url.includes(domain))) {
      return NextResponse.json(
        { error: 'URL must be from copart.com, copart.co.uk, or abetter.bid' },
        { status: 400 }
      );
    }

    const location = buyerLocation === 'us' ? 'us' : 'uk';
    console.log('[analyze] url:', url, 'location:', location);

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    console.log('[analyze] auth done, userId:', user?.id ?? 'anon');

    console.log('[analyze] starting runAnalysis');
    const { slug } = await runAnalysis(url, location, user?.id);
    console.log('[analyze] done, slug:', slug);
    return NextResponse.json({ slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[analyze] caught error:', message);
    if (stack) console.error('[analyze] stack:', stack);
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
