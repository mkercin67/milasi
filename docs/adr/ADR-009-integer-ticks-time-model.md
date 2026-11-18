# ADR-009: Integer Ticks Time Model for Metric Duration and Tuplets

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
Musical notation requires exact proportional division of measures into beats and subdivisions. Representing note durations using floating-point fractional beats (e.g., 0.25, 0.3333333) leads to floating-point rounding errors, cumulative drift across measures, and failure of exact equality comparisons when calculating beat boundaries, beam groupings, and tuplet alignments.

## Decision
We adopt an integer ticks time model throughout ScoreForge (`src/core/model.ts`):
1. **Base Resolution:** A quarter note is defined as exactly **960 ticks** (`QUARTER_NOTE_TICKS = 960`).
2. **Divisibility:** 960 is highly composite, allowing exact integer divisions without remainders:
   - Whole note = 3840 ticks
   - Half note = 1920 ticks
   - Quarter note = 960 ticks
   - Eighth note = 480 ticks
   - 16th note = 240 ticks
   - 32nd note = 120 ticks
   - 64th note = 60 ticks
   - Triplets (3 in time of 2): quarter tuplet = 640 ticks, eighth tuplet = 320 ticks, 16th tuplet = 160 ticks
   - Quintuplets (5 in time of 4): eighth quintuplet = 384 ticks
3. **Pure Integer Math:** All layout functions (`layoutScore`, `groupBeams`, `layoutCursor`), validation (`validateScore`), and playback scheduling (`buildSchedule`) perform duration arithmetic strictly using integer addition, subtraction, modulo, and integer comparison.

## Consequences
### Positive
- Zero cumulative drift across arbitrarily long scores (even 200+ measures).
- Exact equality checks (`eventTick === beatTick`) are deterministic and immune to floating-point precision flaws.
- Clean and unambiguous beam group boundary detection matching standard engraving rules.

### Negative
- Very high tuplet ratios (such as 7-tuplets or 11-tuplets) require careful integer division with roundoff distribution if implemented in future milestones.
