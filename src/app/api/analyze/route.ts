import { NextRequest, NextResponse } from 'next/server';
import { runAnalysis } from '@/lib/orchestrator';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { url, buyerLocation } = await req.json();

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

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { slug } = await runAnalysis(url, location, user?.id);
    return NextResponse.json({ slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[analyze] error:', message);
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
