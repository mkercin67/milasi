# M7b-7 Beam grouping setting (design, for approval)

Status: APPROVED (the project owner delegated the two open choices: two-beat window, score-wide setting). Trigger: Bach BWV 772 acceptance (Bach-Gesellschaft groups eighth notes across
the half bar in 4/4; MiLaSi groups per beat only).

## Decision
Option B: a score-level setting `beamGrouping`, `'beat'` (default, today's behaviour) or
`'half-bar'`.

## Model
- `Score.layoutSettings?: { beamGrouping?: 'beat' | 'half-bar' }` (optional field).
- No schema bump: a missing field means `'beat'`, so every existing file loads unchanged.
  Unknown values are rejected by `validateScore` (error `invalid-beam-grouping`).
- Setting it is an undoable command `setBeamGrouping(mode)`; save/load round trip keeps it.

## Rule `'half-bar'` (4/4 only; every other time signature behaves as `'beat'`)
The measure is cut into two windows of 2 beats (ticks 0-1919 and 1920-3839).
1. If EVERY event of a window is a note of base type `eighth` (no rests, no 16th/32nd, no
   quarter or longer, same tuplet key), the window becomes ONE beam group of 4.
2. Otherwise the window falls back to the `'beat'` rule (groups per beat, 16ths stay with their beat).
3. Groups never cross the half-bar boundary (tick 1920).
4. Chords count as notes; a window with a rest is never merged (Bach m.2 left hand keeps its pair).

## Layout
- `groupBeams(events, timeSig, mode = 'beat')`; `layoutSingleMeasure` and the polyphonic path pass
  the mode through `layoutScore`.
- The mode is part of the measure cache key (otherwise a cached chunk would hide the switch).
- Stem direction and beam slope already work for any group size (beamLayout is size-agnostic).

## UI
- Score info dialog: select "Beaming: by beat / by half bar" (Turkish and English strings).
- Not in the toolbar; manual per-group beaming stays M7c.

## Tests (to write after approval)
- G1 4/4, 8 eighths -> two groups of 4 in `'half-bar'`, four groups of 2 in `'beat'`.
- G2 window with a rest (8th 8th quarter-rest) -> falls back to pairs.
- G3 window with a 16th run (8th 8th 16th 16th 16th 16th) -> beat grouping inside the window.
- G4 3/4, 6/8, 2/2 are unchanged in `'half-bar'`.
- G5 mixed tuplet key inside a window -> no merge.
- G6 cache: toggling the mode on the same score changes the beam item count (no stale chunk).
- G7 command undo/redo, save/load round trip, `validateScore` rejects `'quarter-bar'`.
- G8 layout: grouped stems end on the single beam line (no stem gap), skyline unaffected.
- Browser E2E replaced by G6/G8 plus the manual Bach acceptance (m.3 left hand shows two 4-note beams after switching the setting in Score Information).

## Out of scope
Per-measure or per-group manual override, 12/8 and other meters, automatic rule by edition.
