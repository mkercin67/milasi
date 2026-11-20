# M7b-3 Design: Editing the grand staff

**Status:** DRAFT v1 for lead/user approval. No code before approval.
**Builds on:** `docs/design/m7b-grand-staff.md` (B6-B11). Layout (M7b-1) and the perf gate (M7b-2) are accepted.

## 0. Facts (verified in code)

- 29 call sites still use `firstStaff(score)` (ratchet ceiling 29). Every one assumes "the staff the cursor is on is staff 0". They are the work of this milestone: after M7b-3 the ceiling must drop to the callers that are legitimately single-staff (template and loader paths).
- `ScoreCursor` already has `staffId`; `moveCursor`, `advanceCursor`, voice switching and U2b navigation already work per `cursor.staffId`.
- Layout items carry `staffId` and `LayoutStaff.y` gives each staff's offset inside a system (M7b-1c). The caret (`computeCursorPosition`), `getPointerSystemCoords` and `xToEntryCursor` still look at staff 0 only.
- Clef-dependent code (pitch from letter key, ghost note pitch from y) reads `firstStaff(score).clef`; on the bass staff this would give wrong octaves. This is the most likely source of silent bugs.

## 1. Decisions

**E1. Template.** New Score dialog gets a choice "Tek porte" (default, unchanged) / "Piyano (büyük porte)". The Piyano choice calls `createGrandStaffScore` (already exists). Clef selector is disabled for it; key, time signature, measure count, title apply as today. Part name "Piyano".

**E2. Staff switch (keyboard).** Physical `BracketLeft` = staff above, `BracketRight` = staff below (Turkish Q: `Ğ` / `Ü`), input mode only, no modifiers. The cursor keeps `measureId`, `voiceIndex` and `tick`; the tick snaps to the start of the event covering it in the target staff (never forward), as voice switching does (M7a-2b D4). A missing voice is created only on first entry (D3). At the first/last staff the key does nothing (no wrap). Pure function `moveCursorToStaff(score, cursor, 'up'|'down')` in `core/input.ts`; it never mutates the score.

**E3. Clef per staff.** One helper `cursorStaff(score, cursor)` (= `findStaff(score, cursor.staffId)`) replaces `firstStaff` in all input, ghost, beat-guide, caret, selection and clipboard paths. Pitch entry, ghost-note pitch and click pitch use that staff's clef.

**E4. Caret, beat guide, ghost note.** Positioned inside the staff of the cursor: y from `LayoutStaff.y` of `cursor.staffId`; the caret and beat guide span that staff only (4 sp), not the whole system.

**E5. Mouse.** Resolve the system by y, then the nearest staff by y inside it (midpoint between the two staves is the boundary). The ghost note, click entry and caret use that staff and the active voice. Clicking an existing event selects it (staff implied). Clicking empty space moves the cursor to that staff.

**E6. Status bar.** `Porte 1/2` next to `Ölçü · Vuruş · Ses` (tr/en), shown only when the score has more than one staff in the active part.

**E7. Selection and clipboard.** Range selection stays inside one staff; marquee takes the staff of the first-hit event (S5). Copy keeps staff-relative content; paste goes to the cursor's staff. Cross-staff selection is out of scope (separate design).

**E8. Playback.** One part, one channel; both staves merge by time. Test only: a two-staff score schedules the notes of both staves in time order and total duration equals the longest staff.

**E9. Save/load.** Round-trip of a two-staff score (staves, clefs, groups) through save and load, unchanged schema v7. Test only.

## 2. Slices (each ends with a green CI; E2E and manual test before acceptance)

| Slice | Content | Gate |
|---|---|---|
| **M7b-3a** | E1, E2, E3 (input paths), E6, E8, E9; keymap + SHORTCUTS.md + help text | Unit tests; Playwright **keyboard-only**: right hand and left hand of 2 measures, save/load; **user keyboard test** |
| **M7b-3b** | E3 (ghost/caret/beat guide), E4, E5, E7 | Pure-function tests for staff-by-y; Playwright **mouse**: both staves; **user mouse test** |

Ratchet: ceiling lowered at the end of each slice to the measured count; it must reach the "legitimately single-staff only" set by M7b-5.

## 3. Tests and mutations

- Core: `moveCursorToStaff` (up/down, first/last staff stay, keeps tick/voice, snaps mid-event tick to event start, never mutates).
- Unit: keymap BracketLeft/Right (input mode only; ignored with Ctrl/Alt/Shift; Select mode unchanged); status bar tr/en.
- Layout/pure: staff-by-y resolution incl. boundary; caret y per staff; bass-clef pitch from letter key (C3 on bass, not C5).
- Mutations (each must fail a named test): (a) staff switch resets tick to 0; (b) mouse staff resolution always returns staff 0; (c) pitch entry uses staff 0 clef on the bass staff; (d) paste ignores the cursor's staff.
- Traceability: rows B7-B11 in `m7b-traceability.json` become DONE with literal test names.

## 4. Manual acceptance (user)

Keyboard: new Piyano score; type a right-hand measure; `Ü` to the bass staff; type a left-hand measure; `Ğ` back; Ctrl+Home/End and Ctrl+arrows keep the staff; Tab switches voices inside a staff; save, reload.
Mouse: hover shows the ghost note in the staff under the pointer; click enters a note there; selecting, moving and deleting notes in both staves; Undo/Redo.

## 5. Open questions

1. Slice order 3a (keyboard) before 3b (mouse), each accepted separately: agreed?
2. Staff switch does not wrap at the ends (stays on the first/last staff): agreed?
3. In the Piyano template both staves start with whole-measure rests and the cursor starts on staff 0: agreed?
