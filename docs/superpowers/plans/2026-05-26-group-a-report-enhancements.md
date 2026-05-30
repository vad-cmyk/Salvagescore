# Group A — Report Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auction countdown timer, PDF print export, and ULEZ compliance badge to every report.

**Architecture:** Three independent, additive changes. Types first, then scrapers, then UI components wired into the report page. `PrintButton` already calls `window.print()` — PDF only needs print CSS. No new dependencies required.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Playwright scrapers, Supabase.

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/types/index.ts` | Add `auctionDate?: string` to `Listing` |
| Modify | `src/lib/scrapers/copart-uk.ts` | Add `sad?: string` to Solr type; parse + return `auctionDate` |
| Modify | `src/lib/scrapers/abetterbid.ts` | Parse sale date from body text; return `auctionDate` |
| Create | `src/app/r/[slug]/AuctionCountdown.tsx` | Client component — live ticking countdown |
| Modify | `src/app/globals.css` | Add `@media print` block |
| Create | `src/app/r/[slug]/UlezBadge.tsx` | ULEZ compliance badge (UK buyers only) |
| Modify | `src/app/r/[slug]/page.tsx` | Wire `AuctionCountdown` and `UlezBadge` |

---

## Task 1: Add `auctionDate` to the `Listing` type

**Files:**
- Modify: `src/types/index.ts`

- [ ] Open `src/types/index.ts`. Add `auctionDate?: string;` to the `Listing` type after the `location` field:

```typescript
export type Listing = {
  source: ListingSource;
  lotNumber: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
  odometerMiles: number;
  primaryDamage: string;
  secondaryDamage?: string;
  titleStatus: string;
  estRetailUsd?: number;
  currentBidUsd?: number;
  buyItNowUsd?: number;
  photos: { url: string; caption?: string }[];
  history?: { accidents?: number; previousSales?: number; recalls?: number };
  location: string;
  auctionDate?: string; // ISO 8601, parsed from scraper
};
```

- [ ] Run `npx tsc --noEmit` — expect zero errors.

- [ ] Commit:
```bash
git add src/types/index.ts
git commit -m "feat: add auctionDate to Listing type"
```

---

## Task 2: Parse auction date in the Copart UK scraper

**Files:**
- Modify: `src/lib/scrapers/copart-uk.ts`

The Copart UK Solr API returns a `sad` field (sale auction date) as a Unix timestamp in milliseconds. Add it to the type and parse it.

- [ ] Add `sad?: number;` to `CopartUkSolrLot`:

```typescript
type CopartUkSolrLot = {
  ld: string;
  mkn: string;
  lcy: number;
  la: number;
  hb: number;
  orr: number;
  fv?: string;
  dd: string;
  sdd?: string;
  td: string;
  yn: string;
  lotNumberStr: string;
  sad?: number;   // sale auction date — Unix ms timestamp
  dynamicLotDetails?: { currentBid: number };
};
```

- [ ] In the `return` statement of `scrapeListing`, add `auctionDate` after `location`:

```typescript
return {
  source: 'copart-uk',
  lotNumber,
  vin: lot.fv && !lot.fv.includes('*') ? lot.fv : undefined,
  year,
  make,
  model,
  trim,
  odometerMiles: lot.orr ?? 0,
  primaryDamage: lot.dd || 'Unknown',
  secondaryDamage: lot.sdd || undefined,
  titleStatus: lot.td || 'Unknown',
  currentBidUsd: currentBid || undefined,
  estRetailUsd: lot.la || undefined,
  photos,
  location: lot.yn || 'UK',
  auctionDate: lot.sad ? new Date(lot.sad).toISOString() : undefined,
};
```

- [ ] Run `npx tsc --noEmit` — expect zero errors.

- [ ] Commit:
```bash
git add src/lib/scrapers/copart-uk.ts
git commit -m "feat: parse auction date from Copart UK API"
```

---

## Task 3: Parse auction date in the ABB scraper

**Files:**
- Modify: `src/lib/scrapers/abetterbid.ts`

ABB shows the sale date in the page body as "Sale Date: Thu. Dec 05, 2024" or "Auction Date: 12/05/2024".

- [ ] Inside the `page.evaluate()` block in `abetterbid.ts`, add a `saleDate` extraction after the `currentBidUsd` extraction:

```typescript
// Sale date — "Sale Date: Thu. Dec 05, 2024" or "Auction Date: 06/12/2024"
const saleDateMatch = bodyText.match(
  /(?:Sale|Auction)\s+Date[:\s]+([A-Za-z]{3}\.?\s+[A-Za-z]{3}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i
);
const rawSaleDate = saleDateMatch ? saleDateMatch[1].trim() : '';
```

- [ ] Add `rawSaleDate` to the `return` object inside `page.evaluate()`:

```typescript
return {
  carSchema,
  photos,
  odometer,
  lotNumber: lotMatch?.[1] ?? '',
  location,
  estRetailUsd,
  currentBidUsd,
  primaryDamage: getDetailFromText('Primary Damage'),
  secondaryDamage: getDetailFromText('Secondary Damage'),
  titleCode: getDetailFromText('Title Code'),
  pageTitle: document.title,
  bodyText: bodyText.slice(0, 2000),
  rawSaleDate,
};
```

- [ ] After the `try` block, after building `photos`, parse the raw date string into ISO 8601. Add this before the `return` statement:

```typescript
// Parse sale date string to ISO 8601
let auctionDate: string | undefined;
const rawSaleDate = data.rawSaleDate as string;
if (rawSaleDate) {
  const parsed = new Date(rawSaleDate.replace(/\./g, ''));
  if (!isNaN(parsed.getTime())) auctionDate = parsed.toISOString();
}
```

- [ ] Add `auctionDate` to the final `return` object (after `location`):

```typescript
return {
  source: 'abetterbid',
  lotNumber: (data.lotNumber as string) || targetUrl.match(/\/(\d{7,12})/)?.[1] || 'unknown',
  vin,
  year,
  make,
  model,
  trim,
  odometerMiles: parseMiles(data.odometer as string),
  primaryDamage,
  secondaryDamage,
  titleStatus,
  estRetailUsd: data.estRetailUsd as number | undefined,
  currentBidUsd: data.currentBidUsd as number | undefined,
  photos,
  location: (data.location as string) || 'Unknown',
  auctionDate,
};
```

- [ ] Run `npx tsc --noEmit` — expect zero errors.

- [ ] Commit:
```bash
git add src/lib/scrapers/abetterbid.ts
git commit -m "feat: parse auction date from A Better Bid"
```

---

## Task 4: Build the AuctionCountdown component

**Files:**
- Create: `src/app/r/[slug]/AuctionCountdown.tsx`

- [ ] Create the file with this full content:

```typescript
'use client';

import { useEffect, useState } from 'react';

function formatRemaining(ms: number): { text: string; urgent: boolean } {
  if (ms <= 0) return { text: '', urgent: false };
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const urgent = days === 0;
  if (days > 0) return { text: `${days}d ${hours}h ${mins}m`, urgent: false };
  if (hours > 0) return { text: `${hours}h ${mins}m ${secs}s`, urgent: hours < 4 };
  return { text: `${mins}m ${secs}s`, urgent: true };
}

export function AuctionCountdown({ auctionDate }: { auctionDate: string }) {
  const [remaining, setRemaining] = useState(() => new Date(auctionDate).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(new Date(auctionDate).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [auctionDate]);

  const ended = remaining <= 0;
  const { text, urgent } = ended ? { text: '', urgent: false } : formatRemaining(remaining);

  const auctionLabel = new Date(auctionDate).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
      ended
        ? 'border-[var(--border)] bg-[var(--bg-surface)]'
        : urgent
          ? 'border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.05)]'
          : 'border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.05)]'
    }`}>
      {/* Clock icon */}
      <svg className={ended ? 'text-[var(--text-muted)]' : urgent ? 'text-[#EF4444]' : 'text-[var(--amber)]'}
        width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M7.5 4.5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>

      {ended ? (
        <div>
          <span className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider">Auction ended</span>
          <span className="font-mono text-xs text-[var(--text-muted)] ml-2">{auctionLabel}</span>
        </div>
      ) : (
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider">Auction in</span>
          <span className={`font-display font-[800] text-lg leading-none tabular-nums ${urgent ? 'text-[#EF4444]' : 'text-[var(--amber-bright)]'}`}>
            {text}
          </span>
          <span className="font-mono text-[0.65rem] text-[var(--text-muted)]">{auctionLabel}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] Run `npx tsc --noEmit` — expect zero errors.

- [ ] Commit:
```bash
git add src/app/r/[slug]/AuctionCountdown.tsx
git commit -m "feat: AuctionCountdown client component"
```

---

## Task 5: Wire AuctionCountdown into the report page

**Files:**
- Modify: `src/app/r/[slug]/page.tsx`

- [ ] Add the import at the top of `page.tsx` with the other component imports:

```typescript
import { AuctionCountdown } from './AuctionCountdown';
```

- [ ] Find the due-diligence disclaimer block (the amber warning box starting with "AI-generated report"). Insert `AuctionCountdown` **above** it, immediately after the `{/* Summary */}` section:

```tsx
{/* Auction countdown — only shown when scraper captured the date */}
{listing.auctionDate && (
  <div className="animate-fade-up stagger-2 mt-3">
    <AuctionCountdown auctionDate={listing.auctionDate} />
  </div>
)}
```

- [ ] Run `npx tsc --noEmit` — expect zero errors. Start dev server and open any report URL to confirm the component doesn't crash (it will be hidden if `auctionDate` is undefined, which is expected for existing reports).

- [ ] Commit:
```bash
git add src/app/r/[slug]/page.tsx
git commit -m "feat: wire AuctionCountdown into report page"
```

---

## Task 6: Add @media print CSS for PDF export

**Files:**
- Modify: `src/app/globals.css`

`PrintButton` already calls `window.print()`. This task adds the print stylesheet so the output is clean.

- [ ] Append this block to the **end** of `src/app/globals.css`:

```css
/* ── Print / PDF export ──────────────────────────────────────────────── */
@media print {
  /* Hide interactive chrome */
  nav,
  .no-print,
  .hero-card,
  .faq-body,
  footer {
    display: none !important;
  }

  /* Reset backgrounds to white */
  body,
  [class*="bg-[var(--bg"] {
    background: #fff !important;
    color: #111 !important;
  }

  /* Flatten surfaces */
  [class*="rounded"],
  [class*="border"] {
    border-color: #ddd !important;
    box-shadow: none !important;
  }

  /* Text colours */
  [class*="text-[var(--text-primary)]"],
  [class*="text-[var(--text-secondary)]"] {
    color: #111 !important;
  }
  [class*="text-[var(--text-muted)]"] {
    color: #555 !important;
  }

  /* Avoid breaking inside cards */
  .photo-card,
  table,
  .animate-fade-up {
    break-inside: avoid;
    opacity: 1 !important;
    transform: none !important;
  }

  /* Page setup */
  @page {
    margin: 16mm;
    size: A4 portrait;
  }
}
```

- [ ] Open a report in the browser and use Cmd+P (Mac) / Ctrl+P (Windows) → Save as PDF. Verify: nav hidden, report content readable on white background.

- [ ] Commit:
```bash
git add src/app/globals.css
git commit -m "feat: add @media print CSS for PDF export"
```

---

## Task 7: Build the UlezBadge component

**Files:**
- Create: `src/app/r/[slug]/UlezBadge.tsx`

- [ ] Create the file with this full content:

```typescript
function detectDiesel(model: string, trim?: string): boolean {
  const hay = `${model} ${trim ?? ''}`.toUpperCase();
  return /\b(TDI|TDCI|CRDI|CDI|CDTI|DTI|SDI|JTD|HDI|D4D|BLUEDI|DIESEL|TD|D\b)/.test(hay);
}

function getEuroStandard(year: number, diesel: boolean): number {
  if (diesel) {
    if (year >= 2016) return 6;
    if (year >= 2011) return 5;
    if (year >= 2007) return 4;
    if (year >= 2001) return 3;
    return 2;
  }
  // petrol
  if (year >= 2015) return 6;
  if (year >= 2011) return 5;
  if (year >= 2006) return 4;
  if (year >= 2001) return 3;
  return 2;
}

type UlezStatus = 'compliant' | 'non-compliant' | 'check-required';

function getUlezStatus(year: number, diesel: boolean): UlezStatus {
  const euro = getEuroStandard(year, diesel);
  // ULEZ requires Euro 6 diesel, Euro 4+ petrol
  if (diesel) return euro >= 6 ? 'compliant' : 'non-compliant';
  if (euro >= 4) return 'compliant';
  // Petrol 2001-2005: straddles Euro 3/4 boundary — depends on exact model
  if (year >= 2001 && year <= 2005) return 'check-required';
  return 'non-compliant';
}

const TFL_CHECKER = 'https://tfl.gov.uk/modes/driving/check-your-vehicle/';

export function UlezBadge({ year, model, trim }: { year: number; model: string; trim?: string }) {
  const diesel = detectDiesel(model, trim);
  const status = getUlezStatus(year, diesel);
  const fuelLabel = diesel ? 'Diesel' : 'Petrol';
  const euro = getEuroStandard(year, diesel);

  if (status === 'compliant') {
    return (
      <div className="mt-4 p-4 rounded-xl border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.05)]">
        <div className="flex items-center gap-2 mb-1">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#22C55E" strokeWidth="1.3"/>
            <path d="M4.5 7l2 2 3-3" stroke="#22C55E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-mono text-xs font-[700] text-[#22C55E] uppercase tracking-wider">ULEZ Compliant</span>
        </div>
        <p className="font-mono text-[0.7rem] text-[var(--text-muted)]">
          {fuelLabel} · Est. Euro {euro} · Exempt from the London Ultra Low Emission Zone daily charge
        </p>
      </div>
    );
  }

  if (status === 'non-compliant') {
    return (
      <div className="mt-4 p-4 rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.04)]">
        <div className="flex items-center gap-2 mb-1">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#EF4444" strokeWidth="1.3"/>
            <path d="M5 5l4 4M9 5l-4 4" stroke="#EF4444" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span className="font-mono text-xs font-[700] text-[#EF4444] uppercase tracking-wider">ULEZ Non-Compliant</span>
        </div>
        <p className="font-mono text-[0.7rem] text-[var(--text-muted)] mb-2">
          {fuelLabel} · Est. Euro {euro} · Subject to £12.50/day ULEZ charge in London
        </p>
        <a href={TFL_CHECKER} target="_blank" rel="noopener noreferrer"
          className="font-mono text-[0.65rem] text-[#EF4444] hover:underline">
          Check on TfL →
        </a>
      </div>
    );
  }

  // check-required
  return (
    <div className="mt-4 p-4 rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.05)]">
      <div className="flex items-center gap-2 mb-1">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.5l5.5 10h-11L7 1.5z" stroke="#D97706" strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M7 5.5v3M7 9.5v.5" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span className="font-mono text-xs font-[700] text-[#D97706] uppercase tracking-wider">Verify ULEZ Status</span>
      </div>
      <p className="font-mono text-[0.7rem] text-[var(--text-muted)] mb-2">
        {fuelLabel} {year} — {year >= 2001 && year <= 2005 ? 'May be Euro 3 or Euro 4 depending on exact build date' : 'Borderline emission standard'}
      </p>
      <a href={TFL_CHECKER} target="_blank" rel="noopener noreferrer"
        className="font-mono text-[0.65rem] text-[#D97706] hover:underline">
        Check registration on TfL →
      </a>
    </div>
  );
}
```

- [ ] Run `npx tsc --noEmit` — expect zero errors.

- [ ] Commit:
```bash
git add src/app/r/[slug]/UlezBadge.tsx
git commit -m "feat: UlezBadge component with Euro standard heuristic"
```

---

## Task 8: Wire UlezBadge into the report page

**Files:**
- Modify: `src/app/r/[slug]/page.tsx`

- [ ] Add the import at the top with the other component imports:

```typescript
import { UlezBadge } from './UlezBadge';
```

- [ ] Find the Insurance section block (starts with `{insuranceInfo && (`). Immediately **after** its closing `)}`, add:

```tsx
{/* ULEZ badge — UK buyers only */}
{(report.buyerLocation === 'uk' || listing.source === 'copart-uk') && (
  <UlezBadge year={listing.year} model={listing.model} trim={listing.trim} />
)}
```

- [ ] Run `npx tsc --noEmit` — expect zero errors.

- [ ] Start the dev server, open a UK report, and verify the ULEZ badge appears below the Insurance section. Open a US report and verify it does not appear.

- [ ] Commit:
```bash
git add src/app/r/[slug]/page.tsx
git commit -m "feat: wire UlezBadge into report page for UK buyers"
```

---

## Task 9: Final check

- [ ] Run `npx tsc --noEmit` — zero errors.
- [ ] Run dev server: `npm run dev`
- [ ] Open `http://localhost:3000` — homepage loads, no console errors.
- [ ] Open any existing report — page renders, no crash. ULEZ badge visible for UK lot, hidden for US lot.
- [ ] Test print: Cmd+P on a report → verify nav hidden, content clean on white.
- [ ] Commit if any cleanup needed, then move to Group B.
