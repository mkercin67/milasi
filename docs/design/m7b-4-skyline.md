# M7b-4 Design: Vertical spacing between staves (skyline)

**Status:** DRAFT v1 for lead/user approval. No code is written before approval.
**Builds on:** `docs/design/multi-staff-and-pages.md` section 2 (2.2, 2.3) and `docs/design/m7b-grand-staff.md` B3.
**Schema:** unchanged (v7). Layout only.

## 1. Problem

The gap between two staves of a system is a fixed 7.0 sp (bottom line of staff k to top line of staff k+1; staff pitch 11 sp). High notes of the lower staff (ledger lines, stems, beams) and low notes of the upper staff can reach into each other or collide. Today nothing prevents it.

## 2. Facts about the code (verified)

- `layoutScore.ts` builds items for staff k with the offset `staffOffsets[k] = k * 11` baked into their `y`; `sysStep` (system pitch) and `systemExtra` are constants of the whole score.
- A system is cached per system key (`systemLayoutCache`); beams are generated inside the system pass (`generateSingleSystemBeams`) in system coordinates.
- Pointer, cursor and beat guide already read the staff position from `LayoutStaff.y` through `staffOffsetInSystem(system, staffId)`. They keep working when the gap differs per system.
- `getItemRect(item)` (layout/mouse.ts) gives a conservative box for every item kind.

## 3. Decisions proposed

**S1. Gap per system, grow only.** For each system and each adjacent staff pair, `gap = max(7.0, needed)`. The minimum 7.0 sp stays (approved earlier), so a normal piano score looks exactly as it does now; only systems with real collisions grow.

**S2. Needed gap.** Skylines are computed on the final items of the system (after beams). For staff k: `bottom_k(x)` = lowest extent below its bottom line (>= 0 sp), from items belonging to staff k (noteheads, ledger lines, stems, beams, accidentals, articulations/dynamics placed below). For staff k+1: `top_{k+1}(x)` = highest extent above its top line (>= 0 sp). Then
`needed = max over x of ( bottom_k(x) + top_{k+1}(x) ) + padding`, padding = 1.5 sp. Only horizontally overlapping extents count, found with a sweep over item x-intervals (O(n log n) per system, no per-keystroke cost beyond the cached system pass).

**S3. Which items.** Every non-hidden item with a rect (`getItemRect`) that has a `staffId`. Items without a staff (through barlines, brace, system text) do not take part. Slurs, ties and hairpins are included through their bounding boxes if they are layout items with a rect; otherwise they are listed as a known limitation and added when found missing.

**S4. Applying the gap.** Layout first at the base offsets (as today), then the extra `gap - 7.0` is added to the `y` of every item of staff k+1 and all staves below it (post-pass on a copy, so cache entries stay at base positions). Through barlines, the brace (`scaleY`) and `LayoutSystem.height` are derived from the final span. `LayoutStaff.y` carries the final offsets, so pointer, cursor and beat guide need no change.

**S5. System stacking.** `sysStep` stops being a constant: system y is the running sum of system heights plus `systemSpacing`. Single-staff scores keep identical numbers (byte-identical output, tested as today).

**S6. More than two staves.** The rule is pairwise for adjacent staves; the offsets accumulate. M7c uses it for ensembles.

**S7. Lyrics between staves** (lyric clearance 2.5 sp, `Y_min` 10.5 sp in the main design) are out of scope: piano has no lyrics between staves. They are added with M7c (choir). The skyline function takes lyric items like any other item, so no redesign is needed.

## 4. Tests (written before code)

- K1: normal piano score: gap stays exactly 7.0 (layout byte-identical to M7b-3b).
- K2: treble staff with very low notes (below the bass-side limit, ledger lines) and bass staff with very high notes in the same columns: gap > 7.0 and no item rect of staff k overlaps an item rect of staff k+1 (property test over random scores, seeded).
- K3: collision only in measure 1: the gap of that SYSTEM grows, another system without collision keeps 7.0.
- K4: horizontal non-overlap: a low note in the upper staff at x far from a high note in the lower staff does not grow the gap.
- K5: pointer staff resolution, cursor and beat guide are correct in a grown system (nearest staff by y, caret on the bass staff line).
- K6: single-staff output byte-identical to before (existing snapshot tests).
- K7: system y accumulates (two systems, second one grown): no overlap between system 1 and 2.
- Mutation checks: gap ignores horizontal overlap (K4 fails); padding 0 (K2 fails); shifting only staff k+1 but not the through barline (barline/brace extents test fails).
- Gallery card 28: collision case before/after, `fixedSize`.
- Perf gate: grand-100 and grand-200 bench must stay at p95 <= 30 ms (measured with `--grand`, evidence file).

## 5. Questions for the user

1. **Padding 1.5 sp** (clear space between the lowest item of the upper staff and the highest of the lower staff). OK?
2. **Per-system gap** (systems may have different heights) instead of one gap for the whole score. A uniform gap would be simpler but one collision would stretch every system. OK?
3. **Order:** this slice has no UI change; accept it after the gallery card and the tests, without a manual test. OK?
