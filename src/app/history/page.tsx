import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getReportsByUser } from '@/lib/supabase';
import ClaimReportForm from './ClaimReportForm';

export const metadata: Metadata = { title: 'My Reports — CopartCheck' };

const VERDICT_STYLE: Record<string, { label: string; color: string }> = {
  pass:    { label: 'PASS',    color: 'text-[#22C55E]' },
  caution: { label: 'CAUTION', color: 'text-[#F59E0B]' },
  avoid:   { label: 'AVOID',   color: 'text-[#EF4444]' },
};

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin?next=/history');

  const reports = await getReportsByUser(user.id);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10 md:px-8">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <h1 className="font-display text-4xl font-[700] text-[var(--text-primary)] tracking-tight mb-1">
            My Reports
          </h1>
          <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">{user.email ?? user.id}</p>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-xl">
            <p className="font-mono text-sm text-[var(--text-muted)] mb-4">No reports yet.</p>
            <Link
              href="/check"
              className="font-mono text-[0.75rem] text-[var(--amber)] hover:text-[var(--amber-bright)] transition-colors"
            >
              Run your first check →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const v = VERDICT_STYLE[r.verdict] ?? { label: r.verdict.toUpperCase(), color: 'text-[var(--text-secondary)]' };
              return (
                <Link
                  key={r.slug}
                  href={`/r/${r.slug}`}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--text-muted)] transition-colors group"
                >
                  <div>
                    <p className="font-mono text-sm text-[var(--text-primary)] group-hover:text-white transition-colors">
                      {r.listing?.year} {r.listing?.make} {r.listing?.model}
                    </p>
                    <p className="font-mono text-[0.65rem] text-[var(--text-muted)] mt-0.5">
                      {new Date(r.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className={`shrink-0 font-mono text-[0.65rem] font-[700] ${v.color}`}>
                    {v.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-[var(--border)]">
          <p className="font-mono text-[0.65rem] text-[var(--text-muted)] uppercase tracking-widest mb-1">
            Claim a report
          </p>
          <p className="font-mono text-[0.65rem] text-[var(--text-muted)] mb-3">
            Ran a check before signing in? Paste the report URL or slug.
          </p>
          <ClaimReportForm />
        </div>

      </div>
    </div>
  );
}
