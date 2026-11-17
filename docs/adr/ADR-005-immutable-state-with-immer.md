# ADR-005: Command Pattern with Immer Structural Sharing for State and History

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
A professional notation editor requires robust, unbounded multi-level undo/redo, crash resistance, and atomic transactions. Direct mutation of the score data structure makes undo/redo difficult and bug-prone, leading to silent state corruption. Conversely, deep-cloning an entire 100-measure score (`JSON.parse(JSON.stringify(score))`) on every keystroke incurs severe garbage collection and CPU overhead.

## Decision
1. **Command Pattern:** All user modifications (adding notes, changing pitch, moving dynamics, editing lyrics, adding measures) are dispatched as atomic commands (`src/core/commands/`).
2. **Immer Structural Sharing:** Each command executes an Immer `produce(score, draft => { ... })` producer. Only the measures and voices that actually change receive new object references; unmodified measures share memory references with previous states.
3. **Undo/Redo History Stack:** The application state maintains `history.past`, `history.present`, and `history.future` stacks of immutable score references.

## Consequences
### Positive
- Structural sharing keeps memory consumption low (< 15 MB heap for hundreds of undo states).
- Pure reference equality checks (`prevMeasure === nextMeasure`) enable instantaneous cache hits in the layout engine.
- Atomic commits prevent half-applied, corrupted score states.

### Negative
- Developers must avoid accidental mutations outside of Immer draft producers.
