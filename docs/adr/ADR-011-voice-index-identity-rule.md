# ADR-011: Rule R3 - Stable Voice Index Identity Across Measures

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
In polyphonic notation, multiple independent melodic voices exist within a single musical staff. Each measure stores an array of voices. Early prototypes assigned random unique IDs (e.g. `voice-uuid-1234`) to voice objects per measure.

When navigating across measures, calculating cross-measure ties, splitting beams, or copying/pasting across barlines, comparing random `voice.id` values resulted in false mismatches across barlines, breaking tie lookups and cursor tracking.

## Decision
Permanent Architectural Rule **R3** is established:
1. **Stable Voice Index:** Voice identity in the score model is defined by its zero-based or one-based index `voiceIndex` (1..4) within the staff measure's `voices` array.
2. **Cross-Measure Equivalence:** Voice 1 in Measure N corresponds to Voice 1 in Measure N+1. Random IDs may exist on voice objects for React keys, but they are **never** compared across measures.
3. **Barline Traversals:**
   - Tie lookups (`toggleTie`, `layoutTies`) search for the matching pitch in the same `voiceIndex` in the adjacent measure.
   - Cursor movement (`moveCursorDirection`) preserves `voiceIndex` when stepping across barlines.
   - Notation commands (`insertNote`, `deleteEvent`, `toggleSlur`) identify voices by staff measure index.

## Consequences
### Positive
- Cross-barline ties and slurs find the correct melodic voice reliably across all measures and systems.
- Cursor navigation does not jump between voices when crossing barlines.
- Clean foundation ready for Milestone 7a (explicit multi-voice polyphony).

### Negative
- Staff measure voices arrays must maintain consistent ordering (Voice 1 at index 0, Voice 2 at index 1, etc.).
