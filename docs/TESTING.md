# Testing & Verification Guide

This document describes the testing practices, suites, and visual regression gallery for the ScoreForge music notation editor.

## Test Suites

1. **Unit and Behaviour Tests (`npm test`)**
   - Core model, factories, operations, commands, state management, and navigation.
   - Run via Vitest: `npx vitest run`

2. **Full Verification (`npm run check`)**
   - Runs TypeScript type checking (`tsc --noEmit`), folder boundary verification (`checkImports.mjs`), license audit (`checkLicenses.mjs`), keyboard shortcuts drift check (`generateShortcuts.mjs --check`), ESLint, Knip dead code analysis, Vitest suite, and Vite production build.
   - Must pass cleanly before every commit.

3. **Performance Benchmark (`npm run bench`)**
   - Measures keystroke-to-paint p50 and p95 across 64-measure and 200-measure scores using headless Playwright against a production build preview.
   - Writes timestamped JSON reports to `docs/perf/bench-<YYYY-MM-DD>.json`.

4. **Smoke Test (`npm run smoke`)**
   - Headless Playwright test verifying that the production preview loads, enters Input mode, accepts keystrokes, and creates notes.

---

## Visual Regression Gallery

The application includes an interactive Visual Regression Gallery accessible via URL parameter:

```
http://localhost:5173/?state=gallery
```

### Gallery Notation Cases (25 Active Cards + 1 Pending)

The gallery renders 25 distinct notation scenarios constructed exclusively through public score commands:

1. **1. Note Values & Augmentation Dots (`note-values-and-dots`)**: Whole, half, quarter, 8th, 16th, 32nd notes with single and double dots.
2. **2. Rests of All Values (`rests-all-values`)**: Whole, half, quarter, 8th, 16th, 32nd rests and dotted rests.
3. **3. Accidentals & Chords with Same Step (`accidentals-and-chords`)**: Sharps, flats, naturals, courtesy rules, and split-step chords.
4. **4. Metrical Beams & Fractional Stubs (`beams-all-cases`)**: Primary beams, 16th fractional beams, beams over rests, and 6/8 compound meter.
5. **5. Ties on the Same System (`ties-same-system`)**: Pitches tied within the same measure.
6. **6. Ties Across Barline (`ties-across-barline`)**: Pitches tied across a measure boundary on the same system.
7. **7. Ties Across System Break (`ties-across-system-break`)**: Tie split into two half-ties across a system line break.
8. **8. Slurs over Stem-Up Notes (`slurs-stem-up`)**: Legato slur positioned below noteheads on stem-up notes.
9. **9. Slurs over Stem-Down Notes (`slurs-stem-down`)**: Legato slur positioned above noteheads on stem-down notes.
10. **10. Long Multi-Measure Slurs (`slurs-long-multi-measure`)**: Slur spanning multiple measures and barlines.
11. **11. Slurs Across System Break (`slurs-cross-system`)**: Slur split into two half-slurs across a system line break.
12. **12. Dynamics Palette (`dynamics-range`)**: pp, p, mp, mf, f, ff, sfz, fp markings below staff.
13. **13. Articulations on Stem-Up Notes (`articulations-stem-up`)**: Staccato, tenuto, accent, marcato on notes with stems pointing up.
14. **14. Articulations on Stem-Down Notes (`articulations-stem-down`)**: Staccato, tenuto, accent, marcato on notes with stems pointing down.
15. **15. Mid-Score Key Change with Cancellation Naturals (`key-change-with-naturals`)**: Transition from 3 sharps (A major) to 1 flat (F major) showing cancellation naturals.
16. **16. Mid-Score Time Signature Changes (`time-signature-changes`)**: Transitions from 4/4 to 3/4 to 6/8 across consecutive measures.
17. **17. Pickup Measure (Anacrusis) (`pickup-measure`)**: Unnumbered measure 0 with fractional beat duration (actualTicks).
18. **18. Sectional Barlines: Double & Final (`barlines-double-and-final`)**: Standard single, sectional double, and final piece barlines.
19. **19. Repeat Signs: Start, End & Combined (`repeats-start-and-end`)**: Start repeat (|:), end repeat (:|), and combined back-to-back (:|:).
20. **20. Volta 1st & 2nd Endings (`voltas-open-and-closed-hooks`)**: 1st ending with closing downward hook; 2nd ending with open right edge.
21. **21. Lyrics: Syllable Hyphens & Melisma Extenders (`lyrics-hyphens-and-extenders`)**: Multi-syllable word hyphens and melisma underline extenders.
22. **22. Header Block: Title, Subtitle, Composer, Arranger (`header-four-fields`)**: Complete four-field header block reserving full measured clearance.
23. **23. Tempo Marking with Text Prefix & SMuFL Note (`tempo-markings`)**: Prefix text "Allegro vivace", quarter-note glyph, and BPM " = 120".
24. **24. Bass Clef (F Clef) Scoring (`bass-clef`)**: Bass clef positioned on line 4 with low and high notes.
25. **25. Measure Wrapping Across Widths (`wrapping-three-widths`)**: 8-measure piece demonstrating responsive line-breaking.
26. **26. Multi-Voice Polyphony (Pending M7a) (`multi-voice`)**: Marked as pending M7a and excluded from golden snapshots.

### SVG ViewBox Safety Testing

To guarantee that no glyph, beam, flag, or staff line touches or overflows the card boundary, `tests/render/gallery_viewbox.test.ts` executes across all cases at widths 385px, 600px, and 1200px, verifying that every layout item's bounding box is strictly within the computed SVG `viewBox`.

### Golden Snapshot Testing

The 25 active gallery scenarios are protected against unintended visual regressions via golden snapshot tests using Vitest:

- **Test file:** `tests/render/gallery_snapshots.test.ts`
- **Snapshot file:** `tests/render/__snapshots__/gallery_snapshots.test.ts.snap`

#### Running Golden Snapshot Tests:
```bash
npx vitest run tests/render/gallery_snapshots.test.ts
```

#### Updating Snapshots:
When an intentional visual or layout change is introduced and verified:
```bash
npx vitest run tests/render/gallery_snapshots.test.ts -u
```
Review `git diff tests/render/__snapshots__/gallery_snapshots.test.ts.snap` carefully before committing to ensure only expected SVG layout differences occurred.
