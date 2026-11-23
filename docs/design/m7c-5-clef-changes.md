# M7c-5: Clef changes inside a staff

Status: APPROVED (owner, 2026-11-22; Q1 to Q3 as proposed). Parts 1 (model, helpers, commands, validation) and 2 (layout: per-event clef, small clef, trailing clef, header, cache key, gallery card 32) done. Part 3 (mouse, ghost note, keyboard and grace entry use the clef in force; the "Anahtar" dialog has the scope choice whole staff / from the selected note) is done. Part 4 (docs, parity, acceptance fixture) remains. The warning clef at a system end (Q1) came for free from the trailing-clef design and is already part of part 2.
Part of `docs/design/m7c-plan.md`, depends on M7c-4 (done). Closes the K. 545 gap 1 and is needed by the acceptance
excerpts below. Engraving conventions follow Gould, *Behind Bars*, "Clef changes".

## 1. What the printed examples show
Owner-supplied excerpts (cello and viola solo parts, public-domain or CC0; the files stay local):
1. **Change inside a bar**, small clef right before the first note it affects, no barline in between (viola part, bars 4 to 5; bass to treble to bass).
2. **Change at a bar start in the same system**: the small clef stands at the end of the previous bar, before the barline.
3. **Change at the start of a system**: the new clef is the full-size clef of the new system; the previous system ends with a small
   warning clef before its closing barline (viola part, end of bar 4).
4. **Dense changes**: cello solo parts change every one or two bars (bass, tenor, treble); one system can hold three clefs.
5. **Changes together with a new time signature or a double barline** (3/4 plus a double barline plus a bass clef): the clef,
   the time signature and the barline must not overlap.
6. Small clef is about 3/4 of the normal size. SMuFL has no separate glyph, so the existing `glyphScale` of 0.75 is used.

## 2. Model (no schema bump, field optional)
```ts
interface ClefChange { measureId: Id; tick: number; clef: Clef }   // tick = offset in the measure, 0 <= tick < measure length
interface Staff { ...; clef: Clef /* clef at the very start */; clefChanges?: ClefChange[] }
```
- `Staff.clef` stays the opening clef; `clefChanges` is kept sorted by measure order, then tick. Absent field = no change, old files byte-identical.
- One shared helper in `src/core/clef.ts`: `clefAt(score, staff, measureId, tick)`; `clefAtMeasureStart(score, staff, measureId)`.
  Both layout and every entry path call only these, so there is one rule for "which clef holds here".
- A change applies to **all voices** of the staff (clefs belong to the staff). Pitches are sounding pitches and do not change, so playback,
  transposition and copy/paste of notes are unaffected; only the staff position of a note changes.
- `tick` need not be on an event boundary: the change applies to every event whose start tick is >= `tick`. If the notes are edited,
  the change stays at its tick (it never silently moves to another note).

## 3. Commands
- `setClefChange(staffId, measureId, tick, clef)`: adds or replaces the change at that exact place; if `clef` equals the clef already in force
  just before it, the change is removed instead (a "change" to the same clef is meaningless).
- `removeClefChange(staffId, measureId, tick)`.
- Caveat of the "same clef removes the change" rule: it is judged when the command runs. A change to the clef already in force is dropped at that moment and is not restored
  if an earlier change is added later; the user then adds the change again.
- `setStaffClef` (M7c-4) keeps its meaning: it changes the opening clef and leaves the later changes alone.
- Deleting a measure removes the changes inside it; inserting or splitting a measure keeps ids, so nothing else is needed. Validation catches the rest.

## 4. Validation
New problem `invalid-clef-change` (error): unknown `measureId`, `tick` outside the measure, illegal clef (`isValidClef`), two changes at the same place,
or unsorted list. Pre-v7 files and files without the field are not touched.

## 5. Layout
- `layoutSingleMeasure` receives the clef **at the measure start** and the list of **changes inside the measure** `{tick, clef}`. Every
  `pitchToStaffPosition(p, clef)` call in the measure layout (about ten places, including grace notes, chords and polyphonic voices) uses
  `clefForTick(event.tick)`; the cache key of a measure chunk includes the opening clef and the changes.
- Small clef item: glyph at the column of the first event with tick >= change tick, placed a fixed distance before the notehead
  (and before its accidental). It adds to the column width so it never collides with notes, accidentals or grace notes.
- Change at tick 0 of a bar that is **not** first in its system: the small clef stands at the end of the previous bar, before the barline
  (extra width reserved in the previous bar), and nothing at the start of the bar.
- Change at tick 0 of the **first** bar of a system: the system header draws the full-size clef in force, as today but taken from
  `clefAtMeasureStart` instead of `staff.clef`. The previous system gets the small warning clef before its closing barline (v1.1, see Q1).
- Header key signature positions also use the clef in force at the system's first bar.
- Time signature, double barline and clef change at the same bar start: order left to right is barline, clef, key, time signature (Gould).
- Mouse and ghost note: `useGhostNote`, `useScoreInteractions`, `useEditorInput`, `pitchFromLetter` and the cursor resolve the clef with `clefAt`
  at the event or cursor tick instead of `staff.clef`.

## 6. UI
The existing "Anahtar" dialog gets a scope choice: **whole staff** (today's behaviour) or **from the selected note onwards**. The second option
creates a change at the selected note's tick, and a second choice **"back to the previous clef after this bar"** is not offered (a user adds a second change instead).
Removing a change: choose the clef already in force for that scope, which removes the change (rule in section 3).

## 7. Tests
- Core: `clefAt` for no change, one change, several changes, change at tick 0, change exactly on an event tick; `setClefChange` add, replace, remove-by-equal, undo;
  validation of the five error cases; measure delete.
- Layout: the same note gets a different y after a change; the small clef glyph exists with scale 0.75; bar start change goes to the previous bar's end;
  system start change goes to the header; two changes in one bar; key signature of a later system uses the clef in force; cache key changes with the change list.
- UI: ghost note and mouse entry after a change land on the right pitch; typed first note after a change starts from the middle line of the clef in force.
- Gallery: card with bass, tenor and treble inside one system and a change across a system break.
- Acceptance (after v1): Breidenbach, *Méditation* (CC0 1.0, IMSLP #997742) bars 13 to 21 hand-entered as a fixture with the CC0 header; the Beatty viola
  part and the Merenzeine sonatina are used only as local comparisons (not CC0; never committed).

## 8. Parts (each ends with `npm run check` green)
1. Model, helpers, commands, validation, tests. No visible change.
2. Layout: per-event clef, small clef glyph, system header, cache key, tests, gallery card.
3. Entry paths (mouse, ghost, keyboard, cursor) and the dialog scope.
4. Warning clef at system end (Q1), docs, parity matrix, traceability.

## 9. Known limits kept out of v1
Clipboard does not carry clef changes; no clef change inside a tuplet or beam break handling beyond "the beam is not broken"
(Gould allows a beam to cross a clef change; v1 keeps the beam); no playback effect (none needed).

## 10. Decisions needed from the owner
- **Q1:** warning clef at the end of the previous system (Gould and the viola example do this). Proposed as part 4 so the first three parts stay small. Move it earlier?
- **Q2:** the dialog scope "from the selected note onwards" (tick of the selected note). Alternative: only bar-start changes. Proposed: the selected note, because the cello and viola examples change inside bars.
- **Q3:** keep a beam unbroken across a clef change (proposed) or force a break.
