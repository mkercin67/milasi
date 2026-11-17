# ADR-003: Pure Layout Computation in Staff Spaces with Zero DOM Reads

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
Interactive score editors frequently suffer from performance degradation and layout thrashing when event handlers or layout routines query the browser DOM (e.g. `getBoundingClientRect()`, `offsetWidth`, `getComputedStyle()`). In a complex score, reading layout triggers browser reflow and recalculation of styles, blowing past the 16.6 ms frame budget.

Additionally, expressing internal musical layout in pixels tightly couples the score layout to a specific zoom level, screen DPI, or window size.

## Decision
1. **Unit of Abstraction:** All layout coordinates are calculated in abstract **staff spaces** (1 unit = the vertical distance between two adjacent staff lines). Pixel conversion occurs solely in the final SVG rendering pass (`y_px = y_spaces * 8.0 * zoom`).
2. **Pure Deterministic Pipeline:** The layout engine (`src/layout/layoutScore.ts`) is a pure function taking `(score, options)` and returning an immutable `LayoutResult`. It contains zero DOM imports and runs identically in Node.js and the browser.
3. **Zero DOM Reads Rule:** Pointer, keyboard, and drag handlers never query DOM layout properties during interactions. All hit-testing, marquee selection intersection, ghost note snapping, and caret navigation are computed mathematically against the existing in-memory `LayoutResult`.
4. **Per-Measure Layout Cache:** Measures are independently sized and cached. Modifying a note in Measure 5 recomputes only Measure 5, reusing geometry for all unmodified measures.

## Consequences
### Positive
- Predictable, sub-millisecond layout passes for single-note edits.
- Zero forced reflows or style recalculations during mouse drags or keyboard input.
- Layout data is fully testable with standard Vitest assertions.

### Negative
- Text widths (e.g. lyrics, titles) cannot be queried via DOM `measureText` at runtime and must rely on deterministic proportional character advance tables.
