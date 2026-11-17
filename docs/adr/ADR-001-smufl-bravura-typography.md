# ADR-001: SMuFL Bravura Music Typography via Build-Time Vector Extraction

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
A high-performance music notation editor requires crisp, publication-quality music symbols (noteheads, clefs, flags, accidentals, dynamics, rests). Traditional approaches rely either on rendering fonts via HTML canvas, downloading OTF/WOFF2 webfonts with CSS `@font-face` and rendering them as `<text>` elements, or rasterizing glyphs as bitmap sprites.

Webfonts suffer from Flash of Unstyled Content (FOUC), layout shifts while fonts load asynchronously, cross-browser text baseline and kerning inconsistencies, and inability to inspect or manipulate individual glyph contours. Canvas rendering prevents declarative SVG styling, crisp vector zooming, and DOM accessibility.

## Decision
We extract SVG path strings directly from Steinberg's reference Bravura SMuFL OpenType font at build time using `opentype.js` (`scripts/buildGlyphPaths.mjs`). The extracted path definitions are emitted into `src/render/glyphPaths.generated.ts` and rendered via SVG `<use href="#smufl-...">` symbols defined in a global SVG `<defs>` block.

To prevent bundle bloat, `scripts/buildGlyphPaths.mjs` scans the codebase for referenced SMuFL glyph identifiers and extracts only the 62 active symbols used in the application.

## Consequences
### Positive
- Zero FOUC and zero network latency: Glyphs render immediately on initial page mount.
- Resolution-independent: Music symbols scale infinitely and cleanly without blurring.
- Pure declarative SVG: Symbols can be styled, colored, and animated with standard CSS/SVG properties.
- Strictly no SVG `<text>` elements for music glyphs, avoiding font measurement discrepancies.

### Negative
- Introducing a new SMuFL glyph requires re-running `npm run build` or the dev script to update `glyphPaths.generated.ts`.
