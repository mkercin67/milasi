# ADR-007: DOM System Virtualization for Large Scores

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
In a 200-measure score, rendering every system, staff line, notehead, stem, beam, tie, slur, dynamic, and lyric syllable directly into the SVG DOM creates over 6,000 DOM elements. Even with fast layout computation, having thousands of SVG elements in the browser DOM causes browser compositing and style re-calculation bottlenecks, increasing keystroke-to-paint latency from 13 ms up to ~50 ms.

## Decision
1. **Viewport Virtualization:** `useScoreVirtualization.ts` monitors the scroll container's `scrollTop` and visible client height.
2. **System Windowing:** The virtualizer maps scroll coordinates to the layout result's system vertical bounds `[system.y, system.y + system.height]`. It calculates `visibleSystemIndices`, retaining only the visible systems plus an overscan buffer of 1 system above and 1 system below to guarantee smooth scrolling.
3. **SVG Layer Culling:** In `ScoreSvgLayers.tsx`, offscreen systems render zero SVG nodes. Total DOM node count remains constant under 800 nodes regardless of whether the score contains 10, 100, or 500 measures.

## Consequences
### Positive
- Keystroke-to-paint p95 on a 200-measure score drops from 49.9 ms down to 5.4 ms (far surpassing the 40 ms target).
- DOM element count remains bounded under 800 SVG elements.
- Memory usage is minimized.

### Negative
- Rapid programmatic scrolling (e.g. jumping to the end of a 500-measure score) must ensure scroll coordinates update synchronously before rendering.
