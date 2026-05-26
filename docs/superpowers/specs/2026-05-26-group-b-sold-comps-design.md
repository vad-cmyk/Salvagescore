# Group B — Sold Auction Comps Design

Date: 2026-05-26

## Scope

Add a "Sold Auction Comps" section to every UK-source report showing 3–5 recently completed Copart UK auction results for the same make/model. UK buyers only. No changes to US buyer reports.

---

## Feature: Sold Auction Comps

**Goal:** Give UK buyers real hammer prices from completed auctions so they can benchmark a fair bid against actual market data — not just estimated resale values.

---

## Data Layer

### New type — `SoldLot` (`src/types/index.ts`)

```typescript
export type SoldLot = {
  lotNumber: string;
  title: string;
  hammerGbp: number;      // final auction hammer price in GBP
  odometerMiles?: number;
  primaryDamage: string;
  saleDate?: string;      // ISO 8601 — undefined if not available
  url: string;            // https://www.copart.co.uk/lot/{lotNumber}
};
```

### Updated `Report` type (`src/types/index.ts`)

Add `soldComps?: SoldLot[]` as an optional field alongside the existing `similarLots`.

---

## Scraper — `src/lib/scrapers/copart-uk-sold.ts`

**Export:** `fetchSoldComps(make: string, model: string, currentLotNumber: string): Promise<SoldLot[]>`

**Behaviour:**
- Opens a new Playwright Chromium browser (headless)
- Navigates to `https://www.copart.co.uk/search` with Incapsula challenge — same pattern as `copart-uk-search.ts`
- After cookies are set, calls the Copart UK Solr full-text search API:
  ```
  https://www.copart.co.uk/public/data/lotdetails/search/fullText/{QUERY}?page=0&size=8&searchCriteria={"SY_BNF":["SOLD"]}
  ```
  where `{QUERY}` is `{MAKE} {MODEL}` URL-encoded and uppercased.
- Parses response: `hb` → `hammerGbp`, `orr` → `odometerMiles`, `dd` → `primaryDamage`, `sad` → `saleDate` (Unix ms → ISO 8601), `ld` → `title`, `lotNumberStr` → `lotNumber`
- Filters out `currentLotNumber`, deduplicates by lot number
- Returns up to 5 results, sorted by `saleDate` descending (most recent first)
- Returns `[]` on any network error, parsing error, or empty response — never throws

**Error handling:** Entire function is wrapped in try/catch with `finally { await browser.close() }`. Failures are silent — the pipeline continues without comps.

---

## Database

### Migration

New column on the `reports` table:
```sql
ALTER TABLE reports ADD COLUMN IF NOT EXISTS sold_comps jsonb;
```

### `src/lib/supabase.ts`

`saveReport`: include `sold_comps: report.soldComps ?? null` in the insert.

`getReportBySlug`: map `data.sold_comps` → `soldComps: data.sold_comps ?? undefined`.

---

## Orchestrator — `src/lib/orchestrator.ts`

In the existing step 4 `Promise.all`, add `fetchSoldComps` alongside `fetchSimilarLots` — both guarded by `isUkSource`:

```typescript
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

Add `soldComps: soldComps.length > 0 ? soldComps : undefined` to the `Report` object.

---

## Display — `src/app/r/[slug]/page.tsx`

Rendered for **UK buyers only** (`!isUsBuyer`), placed directly after the existing "Similar Lots Active on Copart UK" section. Hidden if `report.soldComps` is undefined or empty.

**Section title:** "Sold Auction Comps"
**Sub-label:** "recent completed auctions · Copart UK"

Layout: list of up to 5 rows. Each row is an `<a>` linking to the Copart UK lot page (opens in new tab):

```
[title]                    £{hammerGbp}
{primaryDamage} · {odometerMiles} mi · {saleDate formatted as "DD Mon YYYY"}
```

Footer note: `"Final hammer prices at time of auction · Source: Copart UK · Check lot pages for full details"`

No new component file — rendered inline in `page.tsx` following the same pattern as the existing `similarLots` section.

---

## Edge Cases

- **Solr returns active lots instead of sold** — `hammerGbp` will be 0 or a live bid; filter out rows where `hammerGbp === 0`
- **`saleDate` unavailable** — render date cell as "—"
- **Fewer than 3 results** — show whatever is available; the section still renders
- **Zero results** — section is hidden entirely (same as `similarLots`)
- **Incapsula blocks request** — caught in try/catch, returns `[]`

---

## Out of Scope

- US sold comps (no Incapsula-free sold search available without a large scraper refactor)
- Caching or refreshing sold comps after report generation
- Sorting/filtering the comps list in the UI
