import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { claimReport } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const rawSlug: string = body.slug ?? '';
  if (!rawSlug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  // Accept full URLs — strip to the last non-empty path segment
  const cleanSlug = rawSlug.split('/').filter(Boolean).pop() ?? rawSlug;

  const claimed = await claimReport(cleanSlug, user.id, supabase);
  if (!claimed) {
    return NextResponse.json({ ok: false, reason: 'already_owned' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
