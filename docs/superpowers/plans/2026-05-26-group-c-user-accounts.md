# Group C — User Accounts & Saved Report History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Supabase Auth (magic link) so logged-in users get a saved history of every report they run, with the ability to claim reports they ran before signing up.

**Architecture:** `@supabase/ssr` provides cookie-based session management across server components, route handlers, and middleware. Reports get a nullable `user_id` column — `null` means anonymous, set means owned. Auth is entirely optional: anonymous generation is unchanged. A `/signin` page sends magic links, `/auth/callback` exchanges the code, and `/history` shows the user's reports. A `ClaimPrompt` component on each report page lets logged-in users save unclaimed reports to their account.

**Tech Stack:** Next.js 16.2.6 App Router, TypeScript, `@supabase/ssr`, `@supabase/supabase-js` (already installed), Supabase Auth + Postgres, Tailwind v4.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/types/index.ts` | Modify | Add `ReportSummary` type; add `userId?` to `Report` |
| Supabase (via MCP) | Migration | Add `user_id uuid` column + RLS UPDATE policy |
| `src/lib/supabase.ts` | Modify | Add `user_id` to saveReport insert; add `claimReport`; add `getReportsByUser`; map `userId` in `getReportBySlug` |
| `src/lib/supabase-server.ts` | Create | `createSupabaseServerClient()` — cookie-aware server client |
| `src/middleware.ts` | Create | Session-refresh middleware (required by `@supabase/ssr`) |
| `src/lib/orchestrator.ts` | Modify | Accept `userId?` param; pass to `saveReport` via report object |
| `src/app/api/analyze/route.ts` | Modify | Read session; pass `user?.id` to `runAnalysis` |
| `src/app/api/auth/signin/route.ts` | Create | Send magic link OTP |
| `src/app/api/auth/signout/route.ts` | Create | Sign out + redirect to `/` |
| `src/app/auth/callback/route.ts` | Create | Exchange code for session; redirect to `next` param or `/history` |
| `src/app/signin/SignInForm.tsx` | Create | Client component: email form → "Check your inbox" state |
| `src/app/signin/page.tsx` | Create | Server page: redirect if logged in; render `SignInForm` |
| `src/app/api/claim/route.ts` | Create | POST: read session, call `claimReport`, return ok/409 |
| `src/app/history/ClaimReportForm.tsx` | Create | Client component: slug/URL input → POST `/api/claim` |
| `src/app/history/page.tsx` | Create | Server page: redirect if not logged in; list reports; render `ClaimReportForm` |
| `src/app/r/[slug]/ClaimPrompt.tsx` | Create | Client component: "Save to history" or "Sign in to save" |
| `src/app/r/[slug]/page.tsx` | Modify | Read session; pass `isLoggedIn`/`isOwned` to `ClaimPrompt`; render it after hero |
| `src/app/layout.tsx` | Modify | Make async; read session; render auth nav links |

---

## Task 1: Install `@supabase/ssr` and update types

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/types/index.ts`

- [ ] **Step 1: Install `@supabase/ssr`**

```bash
cd "$(git rev-parse --show-toplevel)" && npm install @supabase/ssr
```

Expected: resolves and installs without errors.

- [ ] **Step 2: Add `ReportSummary` type to `src/types/index.ts`**

After the closing `};` of the `SoldLot` type (line 158), insert:

```typescript
/** Lightweight summary for the history page — no full sections payload. */
export type ReportSummary = {
  slug: string;
  createdAt: string;
  verdict: string;
  listing: {
    year: number;
    make: string;
    model: string;
  };
};
```

- [ ] **Step 3: Add `userId?` to the `Report` type**

In the `Report` type (starts at line 184), after `ownershipCosts?: OwnershipCosts;` (the last field, currently line 206), add:

```typescript
  userId?: string;
```

The end of the `Report` type should now be:

```typescript
  recalls?: NhtsaRecall[];
  ownershipCosts?: OwnershipCosts;
  userId?: string;
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts package.json package-lock.json
git commit -m "feat(group-c): install @supabase/ssr, add ReportSummary type and userId to Report"
```

---

## Task 2: Database migration — add `user_id` column + RLS policy

**Files:**
- Supabase `reports` table (via MCP `execute_sql`)

- [ ] **Step 1: Add `user_id` column**

Using Supabase MCP `execute_sql`:

```sql
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Add UPDATE RLS policy**

```sql
CREATE POLICY "users can claim unclaimed reports"
  ON reports
  FOR UPDATE
  TO authenticated
  USING (user_id IS NULL)
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 3: Verify the column and policy exist**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reports' AND column_name = 'user_id';
```

Expected: one row — `user_id | uuid`.

```sql
SELECT policyname FROM pg_policies
WHERE tablename = 'reports' AND policyname = 'users can claim unclaimed reports';
```

Expected: one row.

- [ ] **Step 4: Commit a note (no code change needed)**

```bash
git commit --allow-empty -m "chore(group-c): add user_id column and RLS claim policy to reports table"
```

---

## Task 3: Update `src/lib/supabase.ts`

**Files:**
- Modify: `src/lib/supabase.ts`

Context: `supabase.ts` currently exports `supabase` (anon client), `supabaseAdmin` (service-role), `saveReport`, and `getReportBySlug`.

- [ ] **Step 1: Update the import to include new types**

Change line 2 from:

```typescript
import type { Report } from '@/types';
```

to:

```typescript
import type { Report, ReportSummary, Listing } from '@/types';
```

Also add the SupabaseClient type import after line 1:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
```

The top of the file should now be:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Report, ReportSummary, Listing } from '@/types';
```

- [ ] **Step 2: Add `user_id` to the `saveReport` insert**

In `saveReport`, after `sold_comps: report.soldComps ?? null,` (currently the last field in the insert), add:

```typescript
      user_id: report.userId ?? null,
```

The full insert block should now end with:

```typescript
      verdict_confidence: report.verdictConfidence ?? null,
      sold_comps: report.soldComps ?? null,
      user_id: report.userId ?? null,
    })
```

- [ ] **Step 3: Add `userId` to `getReportBySlug` return**

In `getReportBySlug`, after `soldComps: data.sold_comps ?? undefined,` (currently the last field in the return), add:

```typescript
    userId: data.user_id ?? undefined,
```

The return object should now end with:

```typescript
    soldComps: data.sold_comps ?? undefined,
    userId: data.user_id ?? undefined,
  } as Report;
```

- [ ] **Step 4: Add `claimReport` function**

After the `getReportBySlug` function, add:

```typescript
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
```

- [ ] **Step 5: Add `getReportsByUser` function**

After `claimReport`, add:

```typescript
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
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat(group-c): update supabase.ts — userId in saveReport/getReportBySlug, claimReport, getReportsByUser"
```

---

## Task 4: Create `src/lib/supabase-server.ts` and `src/middleware.ts`

**Files:**
- Create: `src/lib/supabase-server.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Create `src/lib/supabase-server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client that reads/writes session cookies.
 * Use in Server Components, Route Handlers, and Server Actions.
 * In Next.js 16, cookies() is async — must be awaited.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware handles token refresh.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 2: Create `src/middleware.ts`**

This file must be at the project root of the `src` directory (not inside `app`). The middleware intercepts every request and refreshes the Supabase session so access tokens stay valid. It uses `request`/`response` cookies directly (not `next/headers`).

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not add logic between createServerClient and getUser().
  // A bug here could make it hard to debug session refresh issues.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase-server.ts src/middleware.ts
git commit -m "feat(group-c): add createSupabaseServerClient and session-refresh middleware"
```

---

## Task 5: Update orchestrator and analyze route

**Files:**
- Modify: `src/lib/orchestrator.ts`
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Add `userId?` to `runAnalysis` in `src/lib/orchestrator.ts`**

Change the `runAnalysis` signature at line 36 from:

```typescript
export async function runAnalysis(url: string, buyerLocation: BuyerLocation = 'uk'): Promise<{ slug: string; report: Report }> {
```

to:

```typescript
export async function runAnalysis(url: string, buyerLocation: BuyerLocation = 'uk', userId?: string): Promise<{ slug: string; report: Report }> {
```

- [ ] **Step 2: Add `userId` to the `report` object in orchestrator**

In the `report` object (step 5, around line 72), after `ownershipCosts,`, add:

```typescript
    userId: userId || undefined,
```

The report object should now end with:

```typescript
    knownIssues: knownIssues.length > 0 ? knownIssues : undefined,
    similarLots: similarLots.length > 0 ? similarLots : undefined,
    soldComps: soldComps.length > 0 ? soldComps : undefined,
    recalls: recalls.length > 0 ? recalls : undefined,
    ownershipCosts,
    userId: userId || undefined,
  };
```

- [ ] **Step 3: Update `src/app/api/analyze/route.ts` to read session and pass userId**

Replace the entire file content with:

```typescript
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
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add src/lib/orchestrator.ts src/app/api/analyze/route.ts
git commit -m "feat(group-c): pass userId through orchestrator to saveReport"
```

---

## Task 6: Auth API routes

**Files:**
- Create: `src/app/api/auth/signin/route.ts`
- Create: `src/app/api/auth/signout/route.ts`
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Create `src/app/api/auth/signin/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const { email, next } = await req.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const origin = req.headers.get('origin') ?? `https://${req.headers.get('host')}`;
  const callbackUrl = new URL('/auth/callback', origin);
  if (next) callbackUrl.searchParams.set('next', next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl.toString() },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create `src/app/api/auth/signout/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', req.url));
}
```

- [ ] **Step 3: Create `src/app/auth/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/history';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL('/signin?error=invalid_link', origin));
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/signin/route.ts src/app/api/auth/signout/route.ts src/app/auth/callback/route.ts
git commit -m "feat(group-c): add magic link signin, signout, and auth callback routes"
```

---

## Task 7: Sign-in page

**Files:**
- Create: `src/app/signin/SignInForm.tsx`
- Create: `src/app/signin/page.tsx`

- [ ] **Step 1: Create `src/app/signin/SignInForm.tsx`**

This is a `'use client'` component. It uses `useSearchParams()` to read the `?next=` param and passes it to the signin API so users return to their intended page after auth.

```typescript
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.');
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center space-y-2">
        <p className="font-mono text-sm text-[var(--text-secondary)]">
          Magic link sent to{' '}
          <span className="text-[var(--text-primary)]">{email}</span>.
        </p>
        <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">
          Check your inbox — link expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block font-mono text-[0.65rem] text-[var(--text-muted)] mb-2 uppercase tracking-widest">
          Email address
        </label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--amber)] transition-colors"
        />
      </div>
      {error && (
        <p className="font-mono text-[0.65rem] text-[#DC2626]">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[var(--amber)] text-[#0A0B0E] font-mono font-[700] text-sm py-3 rounded-lg hover:bg-[var(--amber-bright)] transition-colors disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Send magic link'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create `src/app/signin/page.tsx`**

`SignInForm` uses `useSearchParams()`, which requires a `<Suspense>` boundary in the page component (Next.js requirement for static optimization).

```typescript
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import SignInForm from './SignInForm';

export const metadata: Metadata = { title: 'Sign in — CopartCheck' };

export default async function SignInPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/history');

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-[700] text-[var(--text-primary)] tracking-tight mb-2">
            Sign in
          </h1>
          <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">
            We&apos;ll email you a magic link — no password needed.
          </p>
        </div>
        <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <Suspense>
            <SignInForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add src/app/signin/SignInForm.tsx src/app/signin/page.tsx
git commit -m "feat(group-c): add /signin page with magic link form"
```

---

## Task 8: Claim API route

**Files:**
- Create: `src/app/api/claim/route.ts`

- [ ] **Step 1: Create `src/app/api/claim/route.ts`**

The route strips full URLs to a slug (in case the user pastes `https://copartcheck.com/r/abc123def`), reads the authenticated session, and delegates to `claimReport`. The authenticated Supabase client (not admin) is passed to `claimReport` so the RLS policy applies.

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/claim/route.ts
git commit -m "feat(group-c): add /api/claim route"
```

---

## Task 9: History page + ClaimReportForm

**Files:**
- Create: `src/app/history/ClaimReportForm.tsx`
- Create: `src/app/history/page.tsx`

- [ ] **Step 1: Create `src/app/history/ClaimReportForm.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClaimReportForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: value.trim() }),
    });
    const data = await res.json();

    if (res.ok) {
      setMessage({ text: 'Report added to your history.', ok: true });
      setValue('');
      router.refresh();
    } else if (data.reason === 'already_owned') {
      setMessage({ text: 'This report is already saved to an account.', ok: false });
    } else {
      setMessage({ text: data.error ?? 'Could not claim this report. Check the slug and try again.', ok: false });
    }
    setLoading(false);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a report URL or slug…"
          className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--amber)] transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="shrink-0 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg font-mono text-[0.7rem] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Claim'}
        </button>
      </form>
      {message && (
        <p className={`mt-2 font-mono text-[0.65rem] ${message.ok ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/history/page.tsx`**

```typescript
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
          <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">{user.email}</p>
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
                      {r.listing.year} {r.listing.make} {r.listing.model}
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add src/app/history/ClaimReportForm.tsx src/app/history/page.tsx
git commit -m "feat(group-c): add /history page with report list and ClaimReportForm"
```

---

## Task 10: `ClaimPrompt` + update report page

**Files:**
- Create: `src/app/r/[slug]/ClaimPrompt.tsx`
- Modify: `src/app/r/[slug]/page.tsx`

- [ ] **Step 1: Create `src/app/r/[slug]/ClaimPrompt.tsx`**

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ClaimPrompt({
  slug,
  isLoggedIn,
  isOwned,
}: {
  slug: string;
  isLoggedIn: boolean;
  isOwned: boolean;
}) {
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isOwned || claimed) return null;

  if (!isLoggedIn) {
    return (
      <div className="mb-4 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between gap-3">
        <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">
          Sign in to save this report to your history.
        </p>
        <Link
          href={`/signin?next=/r/${slug}`}
          className="shrink-0 font-mono text-[0.65rem] text-[var(--amber)] hover:text-[var(--amber-bright)] transition-colors"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  async function handleClaim() {
    setLoading(true);
    await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    setClaimed(true);
    setLoading(false);
  }

  return (
    <div className="mb-4 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between gap-3">
      <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">
        Add this report to your history.
      </p>
      <button
        onClick={handleClaim}
        disabled={loading}
        className="shrink-0 font-mono text-[0.65rem] text-[var(--amber)] hover:text-[var(--amber-bright)] transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save to history →'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add imports to `src/app/r/[slug]/page.tsx`**

After the existing imports (after line 11: `import UlezBadge from './UlezBadge';`), add:

```typescript
import { createSupabaseServerClient } from '@/lib/supabase-server';
import ClaimPrompt from './ClaimPrompt';
```

- [ ] **Step 3: Add session read to `ReportPage` in `src/app/r/[slug]/page.tsx`**

In `ReportPage`, after line 53 (`if (!report) notFound();`), add:

```typescript
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;
  const isOwned = !!user && !!report.userId && report.userId === user.id;
```

- [ ] **Step 4: Insert `<ClaimPrompt>` in the JSX**

After line 155 (the closing `</div>` of the hero section, the line that reads `        </div>`), and before line 157 (`        {/* Summary */}`), insert:

```tsx
        {/* Claim prompt — save to history */}
        <ClaimPrompt slug={slug} isLoggedIn={isLoggedIn} isOwned={isOwned} />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/app/r/[slug]/ClaimPrompt.tsx 'src/app/r/[slug]/page.tsx'
git commit -m "feat(group-c): add ClaimPrompt to report page"
```

---

## Task 11: Auth nav in layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `src/app/layout.tsx` with the auth-aware version**

The layout becomes `async` to read the session. The header is `position: fixed; top-right` so it overlays all pages without shifting content. Sign-out uses a native `<form method="POST">` so no client JS is needed.

```typescript
import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'CopartCheck — Auction Analysis for US & UK Buyers',
  description:
    'Paste a Copart or A Better Bid URL. Get AI damage analysis, full cost breakdown, and a go/no-go verdict in 90 seconds. Built for US and UK buyers.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0A0B0E] text-[#F0EDE8] antialiased min-h-screen">
        <header className="no-print fixed top-0 right-0 z-50 p-4 flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/history"
                className="font-mono text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                History
              </Link>
              <span className="hidden sm:block font-mono text-[0.6rem] text-[var(--text-muted)] max-w-[140px] truncate">
                {user.email}
              </span>
              <form method="POST" action="/api/auth/signout">
                <button
                  type="submit"
                  className="font-mono text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/signin"
              className="font-mono text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Sign in
            </Link>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(group-c): add auth nav links to layout"
```

---

## Task 12: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 2: Verify all pieces are in place**

```bash
# Types
grep -n "ReportSummary\|userId" src/types/index.ts

# Supabase helpers
grep -n "claimReport\|getReportsByUser\|user_id" src/lib/supabase.ts

# Middleware exists
ls src/middleware.ts src/lib/supabase-server.ts

# Auth routes
ls src/app/api/auth/signin/route.ts src/app/api/auth/signout/route.ts src/app/auth/callback/route.ts

# Claim route
ls src/app/api/claim/route.ts

# Pages
ls src/app/signin/page.tsx src/app/history/page.tsx

# ClaimPrompt on report page
grep -n "ClaimPrompt\|isLoggedIn\|isOwned" 'src/app/r/[slug]/page.tsx'

# Nav in layout
grep -n "history\|signout\|Sign" src/app/layout.tsx
```

Expected: each command returns at least one matching line or file.
