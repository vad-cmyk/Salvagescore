# Group C — User Accounts & Saved Report History Design

Date: 2026-05-26

## Scope

Add optional Supabase Auth (magic link) to CopartCheck. Logged-in users get a saved history of every report they run. Anonymous report generation remains fully supported. Users can claim a report they ran before signing up by pasting its slug.

---

## Decisions

| Decision | Choice |
|---|---|
| Auth requirement | Optional — anonymous generation still works |
| Auth method | Magic link only (email) |
| Report ownership | `user_id` column on `reports` table (nullable) |
| Retroactive claiming | Yes — via slug input on `/history` |
| UI entry points | Dedicated pages: `/signin`, `/history` |

---

## Data Layer

### Migration

```sql
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
```

`user_id IS NULL` → anonymous report. `user_id IS NOT NULL` → owned by that user.

### RLS Policies

Keep the existing public `SELECT` policy unchanged — anyone with a slug can still view any report.

Add an `UPDATE` policy so authenticated users can claim unclaimed reports:

```sql
CREATE POLICY "users can claim unclaimed reports"
  ON reports
  FOR UPDATE
  TO authenticated
  USING (user_id IS NULL)
  WITH CHECK (user_id = auth.uid());
```

No `INSERT` policy needed — inserts still go through the service-role admin client.

### New type — `ReportSummary` (`src/types/index.ts`)

```typescript
export type ReportSummary = {
  slug: string;
  createdAt: string;
  verdict: string;          // 'PASS' | 'CAUTION' | 'AVOID'
  listing: {
    year: number;
    make: string;
    model: string;
  };
};
```

### Updated `src/lib/supabase.ts`

**`saveReport`** — add optional `userId?: string` parameter; include `user_id: userId ?? null` in the insert.

**New `claimReport(slug: string, userId: string, client: SupabaseClient): Promise<boolean>`** — accepts the caller's authenticated Supabase client (created via `createServerClient()`) so RLS is enforced under the user's session rather than the service role:

```typescript
const { count } = await client
  .from('reports')
  .update({ user_id: userId })
  .eq('slug', slug)
  .is('user_id', null)
  .select('slug', { count: 'exact', head: true });
return (count ?? 0) > 0;
```

The `/api/claim` route handler creates a session-aware client via `createServerClient()` and passes it in. The admin client is never used here — RLS must apply.

**New `getReportsByUser(userId: string): Promise<ReportSummary[]>`** — fetch lightweight summaries:

```typescript
const { data } = await supabaseAdmin
  .from('reports')
  .select('slug, created_at, verdict, listing')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

Returns mapped `ReportSummary[]`.

---

## Auth Flow

### New package

```bash
npm install @supabase/ssr
```

### New file — `src/lib/supabase-server.ts`

Exports `createServerClient()` — creates a Supabase client that reads and writes session cookies using `next/headers`. Used in Server Components and Route Handlers.

```typescript
import { createServerClient as _createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerClient() {
  const cookieStore = cookies();
  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (pairs) => pairs.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    }
  );
}
```

### New file — `src/middleware.ts`

Refreshes the Supabase session on every request so access tokens stay valid. Required by `@supabase/ssr`.

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (pairs) => pairs.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        ),
      },
    }
  );
  await supabase.auth.getUser();
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

### Magic link flow

1. User visits `/signin`, enters email, submits form
2. Form POSTs to `/api/auth/signin`
3. Route handler calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } })`
4. Supabase sends magic link email; response returns `{ ok: true }` → page shows "Check your inbox"
5. User clicks link → browser hits `/auth/callback?code=...`
6. `/auth/callback` route handler calls `supabase.auth.exchangeCodeForSession(code)`, sets session cookie, redirects to `next` param or `/history`

### Sign-out

`POST /api/auth/signout` → calls `supabase.auth.signOut()` → redirect to `/`.

---

## Report Association

### At generation time — `src/app/api/analyze/route.ts`

Read session from cookies:

```typescript
const supabase = createServerClient();
const { data: { user } } = await supabase.auth.getUser();
const { slug } = await runAnalysis(url, location, user?.id);
```

Pass `userId` through to `runAnalysis` → `saveReport`. No change to anonymous flow when `user` is `null`.

### `src/lib/orchestrator.ts`

`runAnalysis` signature gains an optional third parameter:

```typescript
export async function runAnalysis(
  url: string,
  buyerLocation: 'uk' | 'us',
  userId?: string
): Promise<{ slug: string }>
```

Passes `userId` to `saveReport`.

---

## Report Page — Claim Prompt

### New client component — `src/app/r/[slug]/ClaimPrompt.tsx`

`'use client'` component. Props: `slug: string`, `isLoggedIn: boolean`, `isOwned: boolean`.

| State | Renders |
|---|---|
| `isOwned` | Nothing |
| `isLoggedIn && !isOwned` | "Add to your history" button — POSTs to `/api/claim`, hides on success |
| `!isLoggedIn` | "Sign in to save this report" link → `/signin?next=/r/{slug}` |

### `src/app/api/claim/route.ts`

```typescript
POST { slug: string }
→ read session → if no user: 401
→ claimReport(slug, user.id)
→ { ok: true } or { ok: false, reason: 'already_owned' }
```

### `src/app/r/[slug]/page.tsx`

Read session in the server component. Pass `isLoggedIn` and `isOwned` (compare `report.userId` with `user?.id`) to `<ClaimPrompt>`. Insert `<ClaimPrompt>` near the top of the report, below the hero section.

Add `userId?: string` to the `Report` type and map `data.user_id` in `getReportBySlug`.

---

## Pages

### `/signin` — `src/app/signin/page.tsx`

Server component. If session exists → redirect to `/history`.

Renders a single-card form (client component `SignInForm`):
- Email input
- "Send magic link" button
- On submit: POST to `/api/auth/signin`
- Two states: form | "Check your inbox — link expires in 1 hour"

### `/auth/callback` — `src/app/auth/callback/route.ts`

Route handler (not a page). Exchanges code for session, redirects.

### `/history` — `src/app/history/page.tsx`

Server component. If no session → redirect to `/signin?next=/history`.

Layout:
1. **Report list** — cards sorted newest-first. Each card: make/model/year, verdict badge, date, "View →" link. Empty state links to `/check`.
2. **Claim section** — `<ClaimReportForm>` client component at the bottom. Input accepts a slug or full report URL (strip to slug). POST to `/api/claim` → refresh the page on success, show error on failure.

### Navbar — `src/app/layout.tsx`

Server component reads session via `createServerClient()`. Adds to the existing nav:
- Logged out: "Sign in" link → `/signin`
- Logged in: "History" link + user email (truncated) + sign-out form (POST to `/api/auth/signout`)

---

## New Files Summary

| File | Action |
|---|---|
| `src/lib/supabase-server.ts` | Create — `createServerClient()` cookie-based helper |
| `src/middleware.ts` | Create — session refresh middleware |
| `src/app/signin/page.tsx` | Create — sign-in page with `SignInForm` client component |
| `src/app/signin/SignInForm.tsx` | Create — client component for email form |
| `src/app/auth/callback/route.ts` | Create — code exchange + redirect |
| `src/app/api/auth/signin/route.ts` | Create — sends magic link OTP |
| `src/app/api/auth/signout/route.ts` | Create — signs out + redirects |
| `src/app/api/claim/route.ts` | Create — claims report for authenticated user |
| `src/app/history/page.tsx` | Create — history list + claim form |
| `src/app/history/ClaimReportForm.tsx` | Create — client component for slug claim input |
| `src/app/r/[slug]/ClaimPrompt.tsx` | Create — client component for per-report claim CTA |

## Modified Files Summary

| File | Change |
|---|---|
| `src/types/index.ts` | Add `ReportSummary` type; add `userId?: string` to `Report` |
| `src/lib/supabase.ts` | Add `userId` param to `saveReport`; add `claimReport`; add `getReportsByUser` |
| `src/lib/orchestrator.ts` | Accept + pass through optional `userId` |
| `src/app/api/analyze/route.ts` | Read session, pass `user?.id` to `runAnalysis` |
| `src/app/r/[slug]/page.tsx` | Read session, render `<ClaimPrompt>` |
| `src/app/layout.tsx` | Read session, render auth links in nav |
| `package.json` | Add `@supabase/ssr` |

---

## Edge Cases

- **Magic link used from different device** — Supabase handles PKCE; session is set correctly
- **`/auth/callback` hit without valid code** — redirect to `/signin` with `?error=invalid_link`
- **Claim of already-owned report** — `claimReport` returns `false`; show "This report is already saved to an account"
- **Anonymous report viewed by logged-in user** — `ClaimPrompt` shows "Add to history" (isOwned = false)
- **Report owned by different user** — `isOwned = false` (user IDs differ); `ClaimPrompt` shows "Add to history"; `claimReport` will fail at RLS because `user_id IS NOT NULL`; return appropriate error "Already saved by another account"

---

## Out of Scope

- Email/password auth
- Google OAuth
- Deleting reports from history
- Sharing history publicly
- Report refresh / re-running from history
