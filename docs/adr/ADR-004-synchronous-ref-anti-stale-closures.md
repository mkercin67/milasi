# ADR-004: Synchronous State Reference Pattern for Anti-Stale-Closures (Rule R2)

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
In React applications, event listeners (keyboard shortcuts, window mousemove/mouseup, clipboard paste, timers) commonly close over component state (`const [editorState, setEditorState] = useState(...)`). When events fire rapidly or across asynchronous boundaries, these closures capture stale copies of the state.

In Milestone 6a, a critical bug occurred where rapidly selecting notes across measures and immediately pressing `Ctrl+C` caused the clipboard handler to read an outdated 2-note selection instead of the newly selected 3 notes, because React had not yet committed the re-render.

## Decision
We enforce Permanent Rule R2 across the entire application:
1. **Single Synchronous State Reference:** A React ref (`stateRef.current`) is updated synchronously on every state transition (`stateRef.current = nextState`) *before* any state setter triggers React rendering.
2. **Handlers Query the Ref:** All keyboard listeners, pointer drag routines, clipboard handlers, and test hooks read exclusively from `stateRef.current`.
3. **Automated Verification Test:** `tests/ui/m6a_r2_stale_closure.test.ts` programmatically mutates editor selection without allowing a React re-render, and asserts that copy, paste, and delete commands immediately operate on the fresh state.

## Consequences
### Positive
- Completely eliminates stale closure race conditions in keyboard shortcuts and clipboard operations.
- Allows event handlers to chain multiple synchronous commands without waiting for React re-render ticks.
- Enables synchronous headless automated testing.

### Negative
- Developers must take care to read `stateRef.current` rather than captured closure variables inside callback functions.
