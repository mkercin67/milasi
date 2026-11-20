# M7b Design: Grand Staff (two staves, one part)

**Status:** DRAFT v1 for lead/user approval. No code is written before approval.
**Builds on:** `docs/design/multi-staff-and-pages.md` (v3.2) sections 1, 2, 3, 7 (M7b). This document does not replace it. It fixes the decisions and the order of work for the first multi-staff milestone, against the code as it is today.
**Schema:** stays at v7 (no migration).

---

## 0. Goal and non-goals

**Goal.** A piano score: one `Part` with two `Staff` (treble, bass), shown as a grand staff with a brace, aligned columns, through barlines, and fully editable by keyboard and mouse in both staves.

**Non-goals (explicitly later):** cross-staff beaming and notes crossing staves, ottava/pedal/arpeggio, grace notes, multi-part ensembles and SATB templates (M7c), multi-staff range selection (separate design), parts extraction, pages (M7d).

## 1. Facts about the current code (verified, not assumed)

- Model already supports it: `Part.staves: Staff[]`, `Score.groups: StaffGroup[]` with `bracket: 'brace'` and `barlineSpan: 'through'`. `MeasureDef` carries key/time/tempo/volta for the whole score. `ScoreCursor` already has `staffId`.
- `buildSchedule` iterates `parts[].staves[]`, so playback of two staves needs verification, not new code.
- `layoutScore` lays out ONE staff: `score.parts[0].staves[0]` (`layoutScore.ts` lines ~55-56). `LayoutSystem.staves: LayoutStaff[]` exists in the types but only one entry is produced.
- `parts[0]` / `staves[0]` is hard-coded in 24 source files (UI input, selection, clipboard, ghost note, beat guide, cursor, factory...). This is the main risk of the milestone.
- Perf baseline (perf-2): a dense single staff costs about 28.8 ms per edit at 400 measures; 200 measure-staves is already at the 30 ms gate. Two staves x 100 measures is the same load, so incremental layout is **required**, not optional.

## 2. Decisions

**B1. Model.** Grand staff = one `Part`, `staves[0]` treble (G clef), `staves[1]` bass (F clef), plus `groups: [{ partIds: [part.id], bracket: 'brace', barlineSpan: 'through' }]`. Key, time signature, tempo, volta stay on `MeasureDef` (shared). Every staff has a `StaffMeasure` for every measure (existing validator rule).

**B2. Horizontal alignment.** Implement design doc section 1: per measure, the union of start ticks over all staves and voices forms the column grid. Column width = max over staves of the width that staff needs. Each staff is then laid out on the shared grid. Consequences: events at the same tick have the same x on both staves; measure widths are equal across staves. This generalises the existing per-staff "shared columns across voices" rule (RB) from voices to staves.

**B3. Vertical spacing.** Slice 1 uses a fixed gap (7.0 sp from the bottom line of staff 0 to the top line of staff 1). Dynamic skyline spacing (design doc 2.2-2.3) comes in its own slice, after editing works.

**B4. Group rendering.** Brace at the left of the system (SMuFL `brace`, scaled vertically to the system height; the glyph must be added to the glyph-path build list). System-start barline and every measure/final barline span from the top line of staff 0 to the bottom line of the last staff. Clef and key signature are drawn per staff.

**B5. Layout items carry `staffId`.** `LayoutItem.staffId?: string` is set for every item that belongs to a staff. Hit testing, cursor, ghost note and beat guide use it. Item `y` stays relative to the system top; staff offsets come from `LayoutStaff.y`.

**B6. Staff lookup replaces index access.** Add `findStaff(score, staffId)` and `activeStaff(score, cursor)` in core. All 24 files stop using `parts[0].staves[0]`. A checker `scripts/checkStaffZeroUsage.mjs` (modelled on `checkVoiceIdUsage.mjs`) fails the build on new uses outside an allowlist, which shrinks to zero by the end of the milestone (templates/factory excepted).

**B7. Editing.**
- Active staff = `cursor.staffId`.
- `BracketLeft` / `BracketRight` (physical keys, decision 12.3 of the main design) move the cursor to the staff above/below, **keeping measure and tick and voiceIndex** (same rule as voice switching, M7a-2b D4), snapping to an event start in the target staff. A missing voice is created on first entry (D3). On a Turkish Q keyboard these are the `Ğ` and `Ü` keys. Keycap labels come from the existing `getKeycapLabel`. Input mode only in this milestone.
- Status bar shows `Porte 1/2` next to `Ölçü · Vuruş · Ses`.
- Ctrl+Home/End and Ctrl+arrows (U2b) keep working and keep the staff.

**B8. Mouse.** The pointer resolves the system first, then the **nearest staff by y** inside it. Ghost note, click entry, caret and beat guide use that staff and the active voice. `xToEntryCursor` takes the staff id. Clicking an existing event still selects it by `eventId` (staff implied).

**B9. Creation.** New Score dialog gets a template choice: "Tek porte" (default, unchanged) / "Piyano (büyük porte)". No add/remove-staff command in this milestone. Templates only; SATB in M7c.

**B10. Playback.** One part, one MIDI channel; both staves are scheduled and merged by time. Needs a test, not new code. Mute/solo per staff is M7c.

**B11. Selection and clipboard.** Range selection stays within one staff (selection already carries `staffId`). Marquee selects the staff of the first-hit event (same rule as S5). Copy/paste is staff-relative: pasting goes to the cursor's staff. Selecting the same beat across both staves is part of the separate multi-voice/multi-staff selection design.

**B12. Performance (mandatory slice).** Layout cache per `(staffId, measureId)` keyed by a content hash of that staff-measure plus the shared grid inputs; an edit in one measure re-lays only that measure's staves and re-packs systems. Gate: keystroke-to-paint p95 <= 30 ms on a 100-measure 2-staff score using the perf-2 protocol (`scripts/multi_bench.mjs` extended to two staves); single-staff p95 must not regress by more than 5%.

## 3. Slices (each is accepted separately; each ends with a tag-worthy green CI)

| Slice | Content | Exit gate |
|---|---|---|
| **M7b-0** | `findStaff`/`activeStaff`, replace `parts[0].staves[0]` in 24 files, `checkStaffZeroUsage` | Zero behaviour change: all existing tests and gallery snapshots byte-identical |
| **M7b-1** | Multi-staff layout engine (B2-B5), static grand-staff gallery card built by code, no editing UI | Property tests: same tick => same x on both staves; equal measure widths; through barlines; brace height = system height; single-staff snapshots unchanged |
| **M7b-2** | Incremental layout cache (B12) | p95 gate above, measured and committed as evidence (R7) |
| **M7b-3** | Editing (B7-B9): template, staff switching, mouse, ghost/caret/beat guide per staff, status bar, playback test | Playwright E2E: right hand and left hand of 2 measures entered by keyboard only, and by mouse; saved file round-trips; **user manual test, keyboard and mouse** |
| **M7b-4** | Skyline vertical spacing (dynamics, lyrics, ledger lines between staves) | Collision property tests; gallery cards |
| **M7b-5** | Acceptance | Hand-entered excerpts of public-domain scores: Bach Invention No. 1 mm. 1-8 and Mozart K. 545 mm. 1-8 (source scan cited; nothing copied from CC-licensed editions); user visual review; tag `m7b` |

## 4. Tests and mutations (failing-first, outputs saved under `docs/review/evidence/`)

- Core: `findStaff` edge cases (unknown id, second staff); staff switch keeps tick/voice, snaps to event start, never mutates the score; playback schedules both staves in time order.
- Layout: column union property test over random two-staff scores (200 seeds); widths equal; no overlap across staves at equal ticks; brace/barline geometry.
- UI: keymap (BracketLeft/Right in input mode only, no Alt combinations), status bar `Porte n/m` (tr/en), mouse staff resolution by y (pure function test, as `xToEntryCursor`).
- Mutation patches (each must make a named test fail): (a) column union ignores staff 2; (b) staff switch resets tick to 0; (c) mouse staff resolution always returns staff 0; (d) through barline drawn only on staff 0.
- Traceability JSON `m7b-traceability.json`, machine-checked like earlier milestones.

## 5. Lessons applied from M7a

1. A keyboard-only AND a mouse workflow are listed as acceptance requirements up front, and the user performs them before acceptance.
2. Navigation across the whole score (not just within a measure) is designed in from the start (Ctrl+Home/End, Ctrl+arrows keep working across staves).
3. Visual claims are checked on screenshots, not on hashes; E2E scripts must exit explicitly and fail on any non-OK row.
4. No slice mixes tests, CI changes and reports in one commit.

## 6. Open questions for the user

1. **Staff switch keys:** physical `BracketLeft`/`BracketRight` = `Ğ`/`Ü` on a Turkish Q keyboard. Acceptable? (Ctrl+Up/Down is taken by octave transposition.)
2. **Default gap between the two staves:** 7.0 sp initially; will be replaced by skyline spacing in M7b-4. Acceptable as a first value?
3. **Order:** editing (M7b-3) before skyline spacing (M7b-4), so that you can write piano music early. Agreed?
4. **Start with M7b-0** (pure refactor, no visible change) after approval?
