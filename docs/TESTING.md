# Testing & Verification Guide

This document describes the testing practices, suites, and visual regression gallery for the music notation editor.

## Test Suites

1. **Unit and Behaviour Tests (`npm test`)**
   - Core model, factories, operations, commands, state management, and navigation.
   - Run via Vitest: `npx vitest run`

2. **Full Verification (`npm run check`)**
   - Runs TypeScript type checking (`tsc --noEmit`), Vitest suite, and lint/style checks.
   - Must pass cleanly before any commit.

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

### Gallery Notation Cases

The gallery renders 6 canonical notation scenarios constructed via standard commands:

1. **A. Basic Notes & Durations (`basic-notes`)**
   - Whole, half, quarter, eighth, and sixteenth notes.
   - Standard quarter and eighth rests.
   - Dotted notes verifying augmentation dot positioning in staff spaces.

2. **B. Accidental Rules & Naturals (`accidental-rules`)**
   - Key signature accidentals vs explicit accidentals.
   - Measure-scoped accidentals (subsequent identical pitch in measure inherits accidental without re-drawing).
   - Natural signs (`natural`) restoring key signature or explicit accidentals across and within measures.

3. **C. Beam Groupings & Fractional Beams (`beam-groupings`)**
   - 4/4 meter beam subdividing (grouping eighths and sixteenths by half-measure / beat).
   - 3/4 meter beam groupings (grouping full measure or beat boundaries).
   - Fractional beam hooks on isolated 16th notes.

4. **D. Multi-Voice Polyphony (`multi-voice`)**
   - Voice 1 (soprano/melody): stems pointing up.
   - Voice 2 (bass/harmony): stems pointing down.
   - Distinct rhythmic values coexisting within the same measure.

5. **E. Dynamics, Articulations, Ties & Slurs (`notations-and-curves`)**
   - Articulations: Staccato (`J`), Tenuto (`K`), Accent (`L`), Marcato (`Shift+L`).
   - Dynamics: `p`, `mf`, `f` placed below the staff.
   - Ties per pitch connecting notes across measures.
   - Legato slurs (`S`) curving across barlines with Bezier control points avoiding note collisions.

6. **F. Score Structure & Lyrics (`score-structure-and-lyrics`)**
   - Header metadata (Title, Subtitle, Composer, Arranger) with measured spacing.
   - Repeat signs (`|:` and `:|`) and Volta brackets (1st ending with hook, 2nd open ending).
   - Key signature change mid-score with cancellation naturals.
   - Double barlines and final thick-thin barlines.
   - Lyrics with centered hyphens between syllables and melisma extenders (`_`).

### Golden Snapshot Testing

The gallery scenarios are protected against unintended visual regressions via golden snapshot tests using Vitest:

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
