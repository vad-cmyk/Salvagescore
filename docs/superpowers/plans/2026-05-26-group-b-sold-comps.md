# Group B — Sold Auction Comps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Sold Auction Comps" section to UK-source reports showing 3–5 completed Copart UK auction results with real hammer prices.

**Architecture:** New `SoldLot` type + `soldComps` field on `Report`. New `fetchSoldComps` Playwright scraper hits the Copart UK Solr API with a `SOLD` status filter. Wired into the orchestrator in parallel with `fetchSimilarLots`. Persisted as `sold_comps JSONB` in Supabase. Rendered inline in `page.tsx` for UK buyers only, after the existing Similar Lots section.

**Tech Stack:** Next.js 16 App Router, TypeScript, Playwright (Chromium), Supabase Postgres, Tailwind v4.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/types/index.ts` | Modify | Add `SoldLot` type; add `soldComps` to `Report` |
| `src/lib/scrapers/copart-uk-sold.ts` | Create | `fetchSoldComps` — Playwright + Copart UK Solr sold search |
| Supabase (via MCP) | Migration | Add `sold_comps JSONB` column to `reports` table |
| `src/lib/supabase.ts` | Modify | Save/load `soldComps` ↔ `sold_comps` |
| `src/lib/orchestrator.ts` | Modify | Wire `fetchSoldComps` in parallel with `fetchSimilarLots` |
| `src/app/r/[slug]/page.tsx` | Modify | Render "Sold Auction Comps" section for UK buyers |

---

## Task 1: Add `SoldLot` type and `soldComps` to `Report`

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `SoldLot` type after the `SimilarLot` block (line 147)**

Open `src/types/index.ts`. After the closing `};` of `SimilarLot` (line 147), insert:

```typescript
/** A completed Copart UK auction result — actual hammer price. */
export type SoldLot = {
  lotNumber: string;
  title: string;
  hammerGbp: number;
  odometerMiles?: number;
  primaryDamage: string;
  saleDate?: string;  // ISO 8601
  url: string;
};
```

- [ ] **Step 2: Add `soldComps` to the `Report` type**

In the `Report` type, after `similarLots?: SimilarLot[];` (line 192), add:

```typescript
  soldComps?: SoldLot[];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "$(git rev-parse --show-toplevel)" && npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(group-b): add SoldLot type and soldComps to Report"
```

---

## Task 2: Build `copart-uk-sold.ts` scraper

**Files:**
- Create: `src/lib/scrapers/copart-uk-sold.ts`

- [ ] **Step 1: Create the file with the full implementation**

Create `src/lib/scrapers/copart-uk-sold.ts`:

```typescript
import { chromium } from 'playwright';
import type { SoldLot } from '@/types';

type SolrSoldLot = {
  lotNumberStr?: string;
  ld?: string;       // lot description e.g. "2020 BMW 3 SERIES 2.0 320D M SPORT"
  hb?: number;       // hammer / final bid GBP
  orr?: number;      // odometer miles
  dd?: string;       // primary damage
  sad?: number;      // sale date — Unix timestamp milliseconds
};

/**
 * Fetch up to 5 recently sold Copart UK lots matching make/model.
 * Uses Playwright to acquire the Incapsula session cookie, then hits
 * the Solr full-text search API with a SOLD status filter.
 * Returns [] on any failure — never throws.
 */
export async function fetchSoldComps(
  make: string,
  model: string,
  currentLotNumber: string
): Promise<SoldLot[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-GB',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  });
  const page = await context.newPage();

  try {
    // Step 1 — acquire Incapsula session cookie by visiting the search page
    await page.goto('https://www.copart.co.uk/search', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page
      .waitForFunction(
        () => document.title.toLowerCase().includes('copart'),
        { timeout: 10000 }
      )
      .catch(() => {});

    // Step 2 — call Solr with SOLD status filter using the authenticated cookie jar
    const query = `${make} ${model}`.toUpperCase();
    const searchCriteria = encodeURIComponent(JSON.stringify({ SY_BNF: ['SOLD'] }));
    const apiUrl =
      `https://www.copart.co.uk/public/data/lotdetails/search/fullText/` +
      `${encodeURIComponent(query)}?page=0&size=8&searchCriteria=${searchCriteria}`;

    const resp = await context.request.get(apiUrl, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://www.copart.co.uk/',
      },
    });

    if (!resp.ok()) return [];

    const json = (await resp.json()) as {
      data?: { results?: { content?: SolrSoldLot[] } };
    };

    const items = json.data?.results?.content ?? [];

    return items
      .filter(
        (item) =>
          item.lotNumberStr &&
          item.lotNumberStr !== currentLotNumber &&
          (item.hb ?? 0) > 0
      )
      .slice(0, 5)
      .map((item) => ({
        lotNumber: item.lotNumberStr!,
        title: item.ld ?? '',
        hammerGbp: item.hb ?? 0,
        odometerMiles: item.orr ?? undefined,
        primaryDamage: item.dd ?? 'Unknown',
        saleDate: item.sad ? new Date(item.sad).toISOString() : undefined,
        url: `https://www.copart.co.uk/lot/${item.lotNumberStr}`,
      }))
      .sort((a, b) => {
        if (!a.saleDate && !b.saleDate) return 0;
        if (!a.saleDate) return 1;
        if (!b.saleDate) return -1;
        return new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
      });
  } catch {
    return [];
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/lib/scrapers/copart-uk-sold.ts
git commit -m "feat(group-b): add fetchSoldComps Playwright scraper"
```

---

## Task 3: Add `sold_comps` column to Supabase

**Files:**
- Supabase `reports` table (via MCP `execute_sql` or Supabase CLI)

- [ ] **Step 1: Run the migration**

Using Supabase MCP `execute_sql` (or `supabase db query` if CLI v2.79+):

```sql
ALTER TABLE reports ADD COLUMN IF NOT EXISTS sold_comps jsonb;
```

- [ ] **Step 2: Verify the column exists**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reports' AND column_name = 'sold_comps';
```

Expected: one row — `sold_comps | jsonb`.

- [ ] **Step 3: Commit a note (no code change needed)**

```bash
git commit --allow-empty -m "chore(group-b): add sold_comps column to reports table"
```

---

## Task 4: Update `supabase.ts` save/load

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Add `sold_comps` to `saveReport` insert**

In `saveReport`, after `verdict_confidence: report.verdictConfidence ?? null,` (line 32), add:

```typescript
      sold_comps: report.soldComps ?? null,
```

The full insert block should now be:

```typescript
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
    })
```

- [ ] **Step 2: Add `soldComps` to `getReportBySlug` return**

After `verdictConfidence: data.verdict_confidence ?? undefined,` (line 66), add:

```typescript
    soldComps: data.sold_comps ?? undefined,
```

The full return object should now end with:

```typescript
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
  } as Report;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat(group-b): persist soldComps in Supabase"
```

---

## Task 5: Wire `fetchSoldComps` into orchestrator

**Files:**
- Modify: `src/lib/orchestrator.ts`

- [ ] **Step 1: Add the import**

At the top of `src/lib/orchestrator.ts`, after the `fetchSimilarLots` import (line 10), add:

```typescript
import { fetchSoldComps } from './scrapers/copart-uk-sold';
```

- [ ] **Step 2: Update the `Promise.all` in step 4**

Find the existing step 4 block (lines 58–64):

```typescript
  // 4. Synthesis + similar lots in parallel
  const [synthesis, similarLots] = await Promise.all([
    synthesizeReport(listing, damage, cost, resale),
    isUkSource
      ? fetchSimilarLots(listing.make, listing.model, listing.lotNumber)
      : Promise.resolve([]),
  ]);
```

Replace with:

```typescript
  // 4. Synthesis + similar lots + sold comps in parallel
  const [synthesis, similarLots, soldComps] = await Promise.all([
    synthesizeReport(listing, damage, cost, resale),
    isUkSource
      ? fetchSimilarLots(listing.make, listing.model, listing.lotNumber)
      : Promise.resolve([]),
    isUkSource
      ? fetchSoldComps(listing.make, listing.model, listing.lotNumber)
      : Promise.resolve([]),
  ]);
```

- [ ] **Step 3: Add `soldComps` to the `Report` object**

Find line 82 where `similarLots` is set:

```typescript
    similarLots: similarLots.length > 0 ? similarLots : undefined,
```

After it, add:

```typescript
    soldComps: soldComps.length > 0 ? soldComps : undefined,
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add src/lib/orchestrator.ts
git commit -m "feat(group-b): wire fetchSoldComps into orchestrator"
```

---

## Task 6: Render "Sold Auction Comps" in report page

**Files:**
- Modify: `src/app/r/[slug]/page.tsx`

- [ ] **Step 1: Add the sold comps section after the similar lots block**

Find the closing of the similar lots section (the `)}` that closes the UK `report.similarLots` conditional, around line 1059). Directly after it, insert:

```tsx
        {/* Sold auction comps — UK buyers only */}
        {!isUsBuyer && report.soldComps && report.soldComps.length > 0 && (
          <div className="animate-fade-up stagger-5 mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Sold Auction Comps</SectionLabel>
              <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">
                recent completed auctions · Copart UK
              </span>
            </div>
            <div className="space-y-2">
              {report.soldComps.map((comp) => (
                <a
                  key={comp.lotNumber}
                  href={comp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--text-muted)] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[0.8rem] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] truncate">
                      {comp.title}
                    </p>
                    <p className="font-mono text-[0.65rem] text-[var(--text-muted)] mt-0.5">
                      {comp.primaryDamage}
                      {comp.odometerMiles
                        ? ` · ${comp.odometerMiles.toLocaleString()} mi`
                        : ''}
                      {comp.saleDate
                        ? ` · ${new Date(comp.saleDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}`
                        : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-[700] text-[var(--text-primary)]">
                      £{comp.hammerGbp.toLocaleString()}
                    </p>
                    <p className="font-mono text-[0.6rem] text-[var(--text-muted)]">hammer</p>
                  </div>
                </a>
              ))}
            </div>
            <p className="mt-3 font-mono text-[0.6rem] text-[var(--text-muted)]">
              Final hammer prices at time of auction · Source: Copart UK · Check lot pages for full details
            </p>
          </div>
        )}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add 'src/app/r/[slug]/page.tsx'
git commit -m "feat(group-b): render Sold Auction Comps section in report page"
```

---

## Task 7: Final check and summary commit

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 2: Verify all six changes are in place**

```bash
# Types
grep -n "SoldLot\|soldComps" src/types/index.ts

# Scraper exists
ls src/lib/scrapers/copart-uk-sold.ts

# Supabase save/load
grep -n "sold_comps\|soldComps" src/lib/supabase.ts

# Orchestrator
grep -n "fetchSoldComps\|soldComps" src/lib/orchestrator.ts

# Page
grep -n "soldComps\|Sold Auction" 'src/app/r/[slug]/page.tsx'
```

Expected: each command returns at least one matching line.
