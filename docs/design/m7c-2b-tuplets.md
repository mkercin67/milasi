# M7c-2b: Tuplets (triplets first)

Status: IMPLEMENTED v1 (found by the Barge BWV 1030 acceptance entry, measure 2: sixteenth triplets).
Part of `docs/design/m7c-plan.md`. Placement of the number is a first proposal and stays UNVERIFIED until compared with a
public-domain edition.

## 1. Why now
Bar 2 of the Barge flute part holds two groups of three sixteenths in the time of two. Entered as plain sixteenths the
bar was 4.5 beats long. The model already had `NoteEvent.tuplet` and a duration formula; entry, drawing and
validation were missing.

## 2. Model (no schema change)
- `event.tuplet = { actual, normal }` on notes and rests (already in the model). A 3:2 sixteenth lasts 160 ticks.
- All ratios of PPQ-based values are exact in integer ticks (960 divides by 3), so no rounding appears in v1.

## 3. Entry
- A toolbar button "3" and the key `Q` (input mode) toggle triplet entry. It stays on until switched off.
- The first entry creates a **complete group**: the entered event plus `actual - 1` rests of the same value. A bar
  therefore never holds half a tuplet. The group takes `normal x value` ticks (sixteenth triplet = 480).
- An entry on a slot of the same ratio and value replaces just that slot. The cursor advances one slot at a time.
- A plain (non-tuplet) entry over a tuplet slot, or a group that does not fit before the barline, is rejected.
- Entry now respects a pickup measure's `actualTicks` (it used the full time-signature length before).

## 4. Drawing
- One number per group (`tuplet3`, SMuFL), centred over the group on the stem side, 0.6 sp clear of the stems.
- Beams: a tuplet group is one beam group of `actual` notes, so two sixteenth triplets in one beat are two groups.
- v1 draws the number only. A bracket for unbeamed groups is a known gap.

## 5. Validation
- `invalid-tuplet` (ratio must be integers, actual >= 2, normal >= 1, actual != normal).
- `tuplet-duration-mismatch` (error): duration must equal the value scaled by the ratio.
- `incomplete-tuplet` (warning): a run of same-ratio events whose length is not a multiple of `actual`.

## 6. Not in this step
Tuplet bracket, ratios other than 3:2 from the UI (the model, number and beaming already accept 2 to 9), unequal
groups (for example eighth + sixteenth + sixteenth in a triplet), nested tuplets, tuplet playback checks beyond tick
arithmetic, and changing the duration of a tuplet slot in place.
