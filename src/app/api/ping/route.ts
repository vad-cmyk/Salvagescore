import { NextResponse } from 'next/server';

export const maxDuration = 10;

/** Diagnostic endpoint — returns env var presence (never values) and confirms route loading works. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      BROWSERBASE_API_KEY: !!process.env.BROWSERBASE_API_KEY,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    node: process.version,
    ts: new Date().toISOString(),
  });
}
