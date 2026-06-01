import { NextResponse } from 'next/server';
// Static import of orchestrator — same as the real /api/analyze route does it.
// If the orchestrator module crashes on load, this route will return HTML 500.
// If this returns JSON 200, the module loads fine and the crash is in execution.
import '@/lib/orchestrator';

export const maxDuration = 10;

export async function GET() {
  return NextResponse.json({ ok: true, msg: 'orchestrator module loaded', ts: new Date().toISOString() });
}
