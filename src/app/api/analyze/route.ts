import { NextRequest, NextResponse } from 'next/server';
import { runAnalysis } from '@/lib/orchestrator';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
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

  try {
    const { slug } = await runAnalysis(url, location, user?.id);
    return NextResponse.json({ slug });
  } catch (err) {
    console.error('[analyze]', err);
    return NextResponse.json(
      { error: 'Analysis failed. The listing may be unavailable or the page blocked scraping.' },
      { status: 500 }
    );
  }
}
