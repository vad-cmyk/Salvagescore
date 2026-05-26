# Group A — Report Enhancements Design

Date: 2026-05-26

## Scope

Three additive improvements to every generated report. No new auth, no new infra.

---

## Feature 1: Auction Countdown Timer

**Goal:** Tell the buyer exactly how long they have before the auction.

**Data:**
- Add `auctionDate?: string` (ISO 8601) to the `Listing` type in `src/types/index.ts`
- Parse in `src/lib/scrapers/abetterbid.ts`: regex for "Sale Date" or "Auction Date" in page body text
- Parse in `src/lib/scrapers/copart-uk.ts`: same pattern from lot detail JSON or body text

**Display (`src/app/r/[slug]/page.tsx`):**
- New `AuctionCountdown` client component (lives in `src/app/r/[slug]/AuctionCountdown.tsx`)
- Renders between the summary card and the due-diligence disclaimer
- States: "Auction in 2d 14h 32m" (ticking), "Auction ended 3 days ago", hidden if no date
- Uses `setInterval(1000)` — client component only

**Edge cases:**
- Date parsing failure → `auctionDate` stays `undefined`, component renders nothing
- Auction ended → show "ended" state, not a negative countdown

---

## Feature 2: PDF Export

**Goal:** Let users save/share the report as a clean PDF document.

**Approach:** `@media print` CSS — no new dependency, no server round-trip.

**Changes:**
- `src/app/globals.css`: add `@media print` block
  - Hide: `nav`, hero video, share/print/WhatsApp buttons, bid calculator interactive controls, bodyshop spec copy button, FAQ, footer
  - Force: white background, black text, remove shadows/borders to flat lines
  - Page breaks: avoid breaking inside damage photo grid, cost tables, scenario table
  - Show report title and URL in footer via CSS `content`
- `src/app/r/[slug]/ReportActions.tsx`: wire `PrintButton` to `window.print()`

**Output:** Browser's native "Save as PDF" from the print dialog. Works on all platforms.

---

## Feature 3: ULEZ / Emission Zone Check

**Goal:** Warn UK buyers if the vehicle won't be ULEZ-compliant before they bid.

**Scope:** UK buyers only (`buyerLocation === 'uk'`). Computed at render time from `listing.year` and fuel type heuristic — no VRM needed.

**Euro standard heuristic (conservative):**
| Petrol | Euro standard |
|--------|--------------|
| < 2001 | Euro 3 |
| 2001–2005 | Euro 4 (borderline) |
| 2006–2010 | Euro 4 |
| 2011–2014 | Euro 5 |
| ≥ 2015 | Euro 6 |

Diesel is one generation behind (i.e., ≥ 2016 for Euro 6).

**ULEZ rule:** Euro 6 diesel or Euro 4+ petrol = compliant.

**Display:**
- New `UlezBadge` component rendered in `page.tsx` after the Insurance section, UK buyers only
- Three states:
  - `compliant`: green badge "ULEZ Compliant"
  - `non-compliant`: red badge "ULEZ Non-Compliant" + note about £12.50/day charge + TfL checker link
  - `check-required`: amber badge "Verify ULEZ Status" + TfL checker link (for borderline years 2001–2005)
- Fuel type derived from `listing.primaryDamage` / model name heuristic (diesel keywords), defaulting to petrol if unknown

---

## Implementation Order

1. Types — add `auctionDate` to `Listing`
2. Scrapers — parse auction date in ABB + Copart UK
3. `AuctionCountdown` component + wire into report page
4. Print CSS in `globals.css` + wire `PrintButton`
5. `UlezBadge` component + wire into report page

---

## Out of Scope

- TfL live API lookup (requires VRM, not available for US imports)
- CAZ (Clean Air Zone) cities beyond London ULEZ
- Saving/persisting `auctionDate` via a new Supabase column (can be added later)
