# M7c-6 — Ensembles (multi-part scores)

Status: APPROVED v1 (owner approved Q1–Q3 as proposed, 2026-11-23)

## 1. Goal

A score may contain several parts (SATB, string quartet, voice + piano), shown together in every
system with brackets/braces, barlines spanning the right staves, and part labels. Today only the
first part is laid out (`firstPartStaves`).

## 2. Model (no schema bump needed)

`Part`, `Staff` and `Score.groups: StaffGroup[]` already exist (v7). Additions:

- Part order = `score.parts` order; staff order in a system = parts in order, each part's staves in order.
- `StaffGroup` semantics (already typed): `bracket: none|brace|bracket`, `barlineSpan: through|individual|mensurstrich`.
  Groups may not overlap partially (validate rule `invalid-group`: unknown partId, empty, or crossing groups).
- A multi-staff part with no group keeps the implicit piano brace (today's behaviour, unchanged).
- A score with several parts and NO group: no bracket, individual barlines (safe default, nothing invented).

## 3. Commands (src/core/ensembleCommands.ts, new)

- `addPart(instrumentPreset, afterPartId?)` — new part with empty measures matching the score's measure
  list (time signature / key come from measure defs, so they follow automatically).
- `removePart(partId)` — refuses to remove the last part; removes it from groups (drops empty groups).
- `movePart(partId, direction)`.
- `setGroup(partIds, bracket, barlineSpan)` / `removeGroup(groupId)`.
- `applyTemplate(templateId)` — `solo`, `piano` (1 part, 2 staves), `satb` (4 parts, bracket, individual),
  `stringQuartet` (4 parts, bracket, through), `voicePiano` (voice + brace piano). Used by the new-score
  dialog and by "replace layout" on an existing score only when the score is empty (otherwise it
  adds parts, never deletes music).
- Instrument presets (name, shortName, clef, midiProgram, midiChannel): flute, violin, viola, cello,
  soprano/alto/tenor/bass voice, piano. Channels allocated automatically (skip 9).

All commands are undoable through the existing command/immer mechanism.

## 4. Layout

1. `layoutStaves(score)` returns the flat list of staves of ALL parts (replaces `firstPartStaves` in
   layoutScore; the staff index `k` that the 7b code already uses for `s{k}-` ids, `staffOffsets`,
   `alignStaffColumns` and skyline spacing keeps working unchanged — this is the point of the 7b design).
2. `staffOffsets` gets a larger gap between parts than inside a part (inside piano: 7 sp as today;
   between parts: 9 sp; lyric corridors enlarge it through the existing skyline spacing).
3. Brackets/braces from groups: brace = curly glyph (existing), bracket = thick vertical line + serifs
   at the group's first/last staff; nested group = bracket drawn left of an inner brace.
4. Barlines: `through` = one line from top of first to bottom of last staff of the group;
   `individual` = per staff; `mensurstrich` = between staves only (drawn in gaps). A score with groups
   draws a system-start line spanning the whole ensemble.
5. Part labels: first system shows `Part.name` right-aligned left of the staff, indent computed from the
   widest label (multi-sp formula in multi-staff-and-pages.md 3.3); later systems show `shortName`
   (indent from widest short name; none when all empty). Text width measured with the existing text
   metrics helper.
6. Performance: only the first measure chunk per staff is recomputed on edit (existing chunk cache
   key). New benchmark card: 50 measures × 4 staves, keystroke-to-paint p95 ≤ 30 ms.

## 5. UI (kept small in this step)

- New-score dialog: template choice (solo, piano, SATB, quartet, voice+piano).
- Toolbar "Partiler" dialog: list of parts, add/remove/move, instrument preset, group bracket choice.
- Editing remains per staff: selection, cursor, clipboard, ghost note, mouse all use the staff id of
  the clicked/selected item (the staff-zero ratchet lowers further: callers fall back to the selected
  staff instead of `firstStaff`). Cross-part selection and cross-part paste are NOT in this step.
- Playback: all staves already play as one merged score; per-part mute/solo/instrument is M7c-8.

## 6. Tests / gates

- core: add/remove/move part, template shapes, group validation, undo/redo, removePart cleans groups.
- layout: 4-part SATB and quartet: staff count, offsets monotone, bracket extents equal group span,
  `through` barline spans exactly the group, `individual` barlines never cross a gap, label indent equals
  widest label + margin, short names on system 2, single-part scores byte-identical to before (golden
  comparison on existing gallery cases).
- ui: template choice builds expected score.
- gallery cards: String quartet (bracket, through), SATB (individual barlines), voice + piano.
- benchmark card per 4.6. Traceability rows B77+.

## 7. Explicitly out of scope

Cross-part editing/paste, lyrics corridor between SATB staves beyond the skyline (multi-verse is M7c-7),
per-part playback (M7c-8), transposing instruments (separate roadmap item), part extraction/PDF parts
(M8+), system-level reordering of staves per system (hide empty staves).

## 8. Proposed order of work (small commits, each `npm run check` green)

1. Core commands + validation + tests.
2. Layout generalisation (flat staves, offsets, labels) with single-part golden equality.
3. Brackets and barline spans.
4. UI: new-score templates + Partiler dialog.
5. Gallery cards, benchmark, docs, ratchet.

## 9. Decisions requested from the owner

- Q1. Default for several parts without a group: no bracket + individual barlines (proposed) vs. automatic bracket.
- Q2. Hide-empty-staves is deferred (proposed) — OK?
- Q3. Part labels: full names on system 1, short names afterwards (proposed) — OK?

## 10. Progress

- Step 1 (commands, templates, validation) DONE: CI #92. Step 2 (layout of all parts) DONE: CI #93. Step 3a (braces, brackets, barline spans) DONE: CI #94. Step 3b (part labels, indent) implemented. Decisions Q1–Q3 approved as proposed.
