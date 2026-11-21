# M7c-2: Fermata, breath mark, caesura

Status: IMPLEMENTED (owner approved the plan). Differences from the proposal: the commands are `cycleFermata` (none, above, below) and `togglePhraseMark`; keys are `H` (fermata) and `Shift+H` (breath mark), because `F` is a pitch letter in input mode; the caesura has a toolbar button only. Fermata above/below and phrase-mark offsets are first-proposal values and stay UNVERIFIED until compared with a public-domain edition.
Part of `docs/design/m7c-plan.md`. Placement rules below are standard engraving practice as described in the
engraving literature (Gould, *Behind Bars*; Ross, *The Art of Music Engraving*); the exact distances are a first
proposal and are **UNVERIFIED until the owner compares the result with a public-domain score**.

## 1. What is added
| Mark | SMuFL glyph | Belongs to | Placement |
|---|---|---|---|
| Fermata above | `fermataAbove` | a note or a rest | above the event, centred on the notehead (or on the rest) |
| Fermata below | `fermataBelow` | a note or a rest | below the event, centred the same way |
| Breath mark | `breathMarkComma` | the event it follows | above the staff, to the right of the event, between it and the next event |
| Caesura | `caesura` | the event it follows | same place as the breath mark |

Typical use: fermata at phrase ends of chorales (BWV 140/7), breath mark in wind and vocal parts (the flute is the
reference instrument of the first user), caesura where a performance pause is written.

## 2. Model (optional fields, absent = none; no schema number change)
- `NoteEvent.fermata?` and `RestEvent.fermata?`: `'above' | 'below'`.
- `NoteEvent.phraseMark?` and `RestEvent.phraseMark?`: `'breath' | 'caesura'`, drawn **after** the event.
- Validation: unknown values are errors.
- Clipboard: the fields live on the event, so copy, cut and paste carry them (test).
- Cache: the marks are drawn by the notation layer (like articulations), not inside the measure chunk, so the measure
  cache key does not change. A test proves that toggling shows the new state without clearing caches.

## 3. Layout
- A new `layoutFermatas(score, layout, index)` in `src/layout/notations.ts`, next to `layoutArticulations`.
- The notehead index is extended with `topY` and `bottomY` (the extent of noteheads **and stem**) and with rests
  (today it only knows noteheads). Rests are found by their `rest*` glyph items.
- Above: `y = min(-1.0, topY - 1.0)`. Below: `y = max(staffBottom + 1.0, bottomY + 1.0)` (staff top line is y = 0,
  bottom line is y = 4). A fermata is therefore never inside the staff and never touches a stem or beam.
- Breath mark and caesura: `x` = right edge of the event plus 0.9 sp, `y` = one space above the top line.
- Skyline: the items enter the staff skyline like any above-staff item, so a fermata over the top staff of a grand
  staff pushes the system apart only when needed (rule S6 of `m7b-4-skyline.md`).
- Glyphs `fermataAbove`, `fermataBelow`, `breathMarkComma`, `caesura` are added to `scripts/buildGlyphPaths.mjs`.

## 4. Editing
- Commands `toggleFermata(selection, placement)` and `setPhraseMark(selection, mark | null)`, both through
  `eventsInRange`, so they work on one note, a range, and all voices of a measure.
- Toolbar (notation panel): a fermata button that cycles none, above, below; a small menu for breath mark and caesura.
- Keyboard: one shortcut for the fermata. The key is chosen from the free keys of `docs/SHORTCUTS.md` when the code is
  written, and the sync check (`generateShortcuts --check`) keeps the documentation honest.
- Default placement of a new fermata: above for voice 1 and for single-voice staves, below for voice 2 when its stems
  point down (the owner can still choose).

## 5. Playback
Ignored. The metrical playback stays unchanged until M11 (interactive pause). This is written into the test names so
nobody mistakes it for a bug.

## 6. Acceptance
- Unit and layout tests: placement above and below, over a stem-up note, a stem-down note, a beamed group, a chord, a rest.
- Gallery card: fermata (above and below), breath mark and caesura on one flute-like staff and on a grand staff.
- Corpus (public domain, hand-entered): the phrase fermatas of the closing chorale BWV 140/7 from the
  Bach-Gesellschaft edition (planned in `m7c-plan.md` section 5).
- The owner compares one screenshot of the gallery card with the IMSLP page of that edition.

## 7. Not in this step
Fermata duration in playback (M11), fermata on a barline (needs a barline-attached mark, later), grand pause
(Generalpause) multi-measure rests, and any non-Western pause signs.
