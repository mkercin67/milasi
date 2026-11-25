# M7d — Pages and layout (design note, DRAFT for owner approval)

Status: DRAFT. No code is written until the owner approves this note.
Follows `multi-staff-and-pages.md` sections 7 (Milestone 7d) and 11 (page data model); where this note differs, this note wins and says so.

## 1. Where we are

- `layoutScore` stacks systems in one continuous column: `systemSpacing` between systems (default 10 sp), a header block (title, composer) above the first system, wrapping at `width` staff spaces.
- There is no notion of a page, a paper size, a margin, a page number, a manual system break or a manual page break.
- Print is a GAP (`feature-parity.md`): no print code, no PDF. That is M8.

## 2. Goal of M7d

A score can be viewed as **paper sheets** (A4 and others) with real page breaks, margins, a title block on page 1, a running header and page numbers on the following pages, and the user can force system and page breaks. M7d produces the pages; M8 turns the same pages into PDF and print. Nothing in M7d may change how the notation inside a system is laid out (all M7a to M7c layout tests and gallery snapshots stay unchanged).

## 3. Decisions proposed (owner: approve or change)

| # | Decision | Proposal | Why |
|---|---|---|---|
| D1 | Default paper | A4 portrait; also A5, Letter, and custom size in mm; landscape toggle | Melis's materials, school printing |
| D2 | Staff size | 7.0 mm staff height, so 1 sp = 1.75 mm (the usual engraving size), changeable per score between 5 and 9 mm | converts paper millimetres to staff spaces in one place |
| D3 | Margins | 15 mm sides, 15 mm top and bottom (about 8.6 sp); editable | matches common printed parts |
| D4 | Two views | "Sürekli" (continuous, as today, the default) and "Sayfa" (paged); the choice is a view setting, not stored in the score | nothing existing changes for people who never switch |
| D5 | Page setup is stored in the score (paper, orientation, margins, staff size) | optional field, see section 4 | the printed result must follow the file |
| D6 | A system is never split over two pages; a measure is never split over two systems | standard engraving rule, already true for systems | keeps layout deterministic |
| D7 | Vertical justification | systems on a page are spaced out evenly to fill the page only when the page is more than 70 % full and it is not the last page; otherwise they keep the normal spacing | avoids both ragged and stretched pages |
| D8 | Print CSS and `@page` | moved to M8 (the plan listed it under 7d) | M7d stays on layout and view, M8 owns output |
| D9 | Page turns on rests | stays deferred to M13 | unchanged lead decision |

## 4. Model (the smallest possible)

```ts
interface PageSetup {
  paper: 'A4' | 'A5' | 'Letter' | 'custom';
  orientation: 'portrait' | 'landscape';
  widthMm?: number; heightMm?: number;      // only for 'custom'
  marginsMm: { top: number; bottom: number; left: number; right: number };
  staffHeightMm: number;                    // 7.0 by default
}
// Score.pageSetup?: PageSetup               (absent = A4 portrait defaults, nothing stored)
// MeasureDef.systemBreakBefore?: true       (a system must start here)
// MeasureDef.pageBreakBefore?: true         (a page must start here)
```

`PageDef` of the older note (page number, width, height, margins, system indices) is **derived**, never stored: it is the output of the pagination function. Storing only the setup and the two break flags keeps the file small and the layout deterministic.

Schema: optional fields. If the repository's migration policy needs a version bump for any new optional score field, step M7d-1 adds schema v8 with a migration test; I check how M7c-5 (`Staff.clefChanges`) did it and do the same, and I tell you before bumping.

## 5. Pipeline

1. Unchanged: columns, systems, skylines, system heights (`layoutScore`).
2. New pure function `paginate(layout, pageSetup)`: places systems onto pages top to bottom. Available height = page height minus margins minus (page 1: the title block, page 2+: the running header). A forced `pageBreakBefore` starts a new page; `systemBreakBefore` forces the line wrap before that measure (applied in step 1, because it changes the system split).
3. Result: `Page[] = { number, systemIndices, yOffsets, header? }`. Nothing is drawn by the function; the view and later the PDF export both read it.
4. The width for system wrapping in page view is the printable width in sp (A4 portrait with D2 and D3: about 120 sp wide minus 2 × 8.6 = about 103 sp).

## 6. Sub-steps (each ends with `npm run check` green, CI green)

| Step | Content | Tests |
|---|---|---|
| **M7d-1** | Page setup model, conversion mm to sp, `systemBreakBefore` honoured by `layoutScore` (no page code yet) | break forces a new system; JSON round trip; setup defaults; existing layout tests and snapshots unchanged |
| **M7d-2** | `paginate()` with title block on page 1 and running header from page 2, page numbers | property tests: no system overflows the printable height; margins respected; every system on exactly one page; forced breaks respected; vertical justification rules (D7) |
| **M7d-3** | Commands and UI to set a system break and a page break before the selected measure; Page Setup dialog (paper, orientation, margins, staff size) | command tests; undo/redo; dialog test |
| **M7d-4** | Page view in the UI: sheets with shadow, "Sürekli / Sayfa" toggle, only the visible page and its neighbours mounted | DOM node count and page switch latency (see section 7); E2E for the toggle |
| **M7d-5** | Acceptance: a long generated score (40 measures, four staves, three lyric verses) plus the seven M7c fixtures in page view; gallery card for "page 1 title block, page 2 running header" | owner visual check |

## 7. Gates

- Property tests above.
- Page switching latency <= 15 ms and DOM nodes <= 1200 across 10 pages (from the older note).
- Layout time of the 50-measure four-staff score with three verses stays within the M7c-9f gate (p95 <= 30 ms in isolation, measured 11.6 ms); pagination adds its own budget of <= 5 ms on the same score.
- `staff-zero` ceiling stays 14 or goes down; no new `firstStaff` caller.
- Corpus: no new copyrighted material; the long fixture is generated, not copied.

## 8. Risks

- Pagination before vertical justification needs exact system heights; we already have them from the skyline pass, so no second layout pass is expected. If a lyric or text change moves a system height, the page is recomputed (cheap, the function is pure).
- A single system taller than a page (a very large ensemble at a large staff size): the function reports it and places it alone instead of looping.
- Forced system breaks interact with the existing width-based wrapping: a break only ever shortens a system, never lengthens it.

## 9. Out of scope for M7d

PDF and print output (M8), automatic page-turn hints (M13), part extraction and multi-measure rests (a separate milestone, to be placed on the roadmap), manual dragging of system positions, facing pages and inner/outer margins.

## 10. Questions for the owner

- Q1. Are D1 to D9 right? The ones I would most like your view on: D2 (7.0 mm staff height) and D3 (15 mm margins), because they decide what a printed page looks like.
- Q2. Is it acceptable that print CSS moves from M7d to M8 (D8)?
- Q3. Should "Sayfa" view be the default for new scores, or stay "Sürekli" (my proposal)?
- Q4. Debussy, "Golliwogg's Cakewalk" (older note, row 8) is public domain by date, but the claim that the scan has the layout we want is unverified. Keep it as an optional extra acceptance piece, or drop it in favour of a flute or flute-and-piano piece in Melis's repertoire (you have not answered this yet)?

## 11. What you verify by eye (per step)

- M7d-1: a forced system break puts the chosen measure first on a new line; nothing else moves.
- M7d-3 and M7d-4: A4 portrait sheet looks like a printed page: margins, title block, page number, no system cut off at the bottom; switching views does not lose your place.
- M7d-5: each of the seven fixtures and the long score in page view, compared with the scan page layout where it applies.
