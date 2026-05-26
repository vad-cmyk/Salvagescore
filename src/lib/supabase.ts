import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Report, ReportSummary, Listing } from '@/types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Browser-safe client — read-only via RLS public policy. */
export const supabase = createClient(url, anonKey);

/** Server-only client — bypasses RLS for report inserts. */
export const supabaseAdmin = createClient(url, serviceKey);

/** Save a completed report and return its slug. */
export async function saveReport(report: Omit<Report, 'id' | 'createdAt'>): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .insert({
      slug: report.slug,
      listing: report.listing,
      damage: report.damage,
      cost: report.cost,
      resale: report.resale,
      verdict: report.verdict,
      summary: report.summary,
      sections: report.sections,
      buyer_location: report.buyerLocation ?? 'uk',
      known_issues: report.knownIssues ?? null,
      similar_lots: report.similarLots ?? null,
      recalls: report.recalls ?? null,
      ownership_costs: report.ownershipCosts ?? null,
      verdict_confidence: report.verdictConfidence ?? null,
      sold_comps: report.soldComps ?? null,
      user_id: report.userId ?? null,
    })
    .select('slug')
    .single();

  if (error) throw new Error(`Failed to save report: ${error.message}`);
  return data.slug;
}

/** Fetch a report by slug for the report page. */
export async function getReportBySlug(slug: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    slug: data.slug,
    createdAt: data.created_at,
    listing: data.listing,
    damage: data.damage,
    cost: data.cost,
    resale: data.resale,
    verdict: data.verdict,
    summary: data.summary,
    sections: data.sections,
    buyerLocation: (data.buyer_location as 'uk' | 'us') ?? 'uk',
    knownIssues: data.known_issues ?? undefined,
    similarLots: data.similar_lots ?? undefined,
    recalls: data.recalls ?? undefined,
    ownershipCosts: data.ownership_costs ?? undefined,
    verdictConfidence: data.verdict_confidence ?? undefined,
    soldComps: data.sold_comps ?? undefined,
    userId: data.user_id ?? undefined,
  } as Report;
}

/**
 * Claim an unclaimed report for a user.
 * Must use the caller's authenticated client so the RLS policy is enforced.
 * Returns true if the report was claimed, false if already owned.
 */
export async function claimReport(
  slug: string,
  userId: string,
  client: SupabaseClient
): Promise<boolean> {
  const { data } = await client
    .from('reports')
    .update({ user_id: userId })
    .eq('slug', slug)
    .is('user_id', null)
    .select('slug');
  return Array.isArray(data) && data.length > 0;
}

/** Fetch all report summaries for a user, newest first. */
export async function getReportsByUser(userId: string): Promise<ReportSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('slug, created_at, verdict, listing')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row) => ({
    slug: row.slug,
    createdAt: row.created_at,
    verdict: row.verdict,
    listing: {
      year: (row.listing as Listing).year,
      make: (row.listing as Listing).make,
      model: (row.listing as Listing).model,
    },
  }));
}
