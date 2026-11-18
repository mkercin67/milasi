# ScoreForge Review Pack

**Generated:** 2026-11-18T21:54:24.621Z  
**Target Milestone:** Foundation Hardening (Milestone H1) Closed  
**Architecture Version:** Schema v6 (Preparing Schema v7)  

---

## 1. Executive Summary & Verification Gate Summary

- **Test Suite Status:** 69 test files passed cleanly (517 total unit, integration, layout, and regression tests).
- **Import Boundary Audit:** 100% compliant across 100 source files via `scripts/checkImports.mjs`.
- **License Compliance Audit:** All 11 production dependencies strictly compliant with permissive licenses (MIT, 0BSD, OFL-1.1).
- **Physical Keymap Synchronization:** Mechanically verified between `src/ui/keymap.ts` and `docs/SHORTCUTS.md`.
- **Code Hygiene:** 0 ESLint warnings, 0 Knip dead-code warnings.
- **Git History Cleanliness:** 0 secrets, 0 private keys, 0 stale root screenshots.

---

## 2. Recent Git Log (Last 30 Commits)

* `0e3d4db` H1 closing 3: design document v3 (2026-11-18)
* `256a785` H1 closing 3: align architecture facts, fix design document keymap and corpus, pin CI node 22, add reviewpack generator (2026-11-18)
* `51d85ba` H1 closing 3: repo hygiene, delete stale root screenshots, add README and gitignore rules (2026-11-18)
* `eb3f63a` H1 closing 2: comprehensive v2 design document for multi-staff and pagination (2026-11-18)
* `da76dc7` H1 closing 2: system-level layout memoization, lazy override scanning, and sub-5ms layout budget (2026-11-18)
* `0c8bd2d` H1 closing 2: fix gallery content bugs, rhythmic underfill, stem-down slurs, overlay rendering, and comprehensive integrity test harness (2026-11-18)
* `99df1cf` H1 closing: resilience fault injection tests, autosave history recovery dialog, step 0 evidence screenshots, and design document (2026-11-18)
* `03278b1` H1 closing: unified keyboard map, input-mode notations, layoutMap keycaps, and grep test (2026-11-18)
* `b34af22` H1 closing: architecture decision records ADR-009 through ADR-012 and ADR-002 correction (2026-11-18)
* `949d3ec` H1 closing: performance probe alignment, honest before-after benchmark, and targeted command immer optimization (2026-11-18)
* `8ac1ed6` H1 closing: zero eslint warnings, strict react hooks errors, and type safety (2026-11-18)
* `26ffe47` H1 closing: fix gallery viewBox rendering bug and expand gallery to 25 feature cards (2026-11-18)
* `f937e81` H1: documentation refresh, architecture ADRs, and SHORTCUTS generator (2026-11-17)
* `5cd2903` H1: design document for multi-staff and pages (2026-11-17)
* `00983d1` H1: license audit, THIRD_PARTY_LICENSES.md, and checkLicenses script (2026-11-17)
* `44b4914` H1: resilience, error boundary, rolling autosave recovery, error ring buffer (2026-11-17)
* `768c584` H1: code health, linting, import checks, modularization under 600 lines (2026-11-17)
* `ca960f7` H1: regression gallery and golden snapshot tests (2026-11-17)
* `906b88d` H1: add GitHub Actions CI workflow (2026-11-17)
* `a295d2a` H1: performance optimizations, system virtualization, and benchmark script (2026-11-17)
* `37767a8` M6d polish: volta right hook rule, centered lyric hyphens, melisma extenders, and screenshot folder cleanup (2026-11-17)
* `8bc71c2` Fix: track all repeat playback intervals in eventRanges for active note highlighting (2026-11-17)
* `d918180` M6d fix: aligned repeat models, combined repeat barlines, true reference score, and lyrics entry (2026-11-17)
* `65ef5a6` M6d: repeats, voltas, lyrics, and reference score Süt İçtim Dilim Yandı (2026-11-17)
* `87231ce` M6c closing: fix header overlap with measured height, retake full-size screenshots, and add edge case tests (2026-11-17)
* `1ba2a66` M6c: score structure - header, tempo text, key and time changes, pickup measures, and barlines (2026-11-17)
* `43da74d` M6b closing 2: remove Ctrl+Delete measure shortcut, add legacy punctuation hints, and wire toolbar tooltips with shortcuts (2026-11-17)
* `91d4b84` M6b closing: terminology, event.code keymap, legato overlap, bundle size reduction, and 200% close-up verification (2026-11-17)
* `13e63db` M6b: dynamics, articulations, slurs, notations toolbar panel, and playback legato (2026-11-17)
* `df884eb` M6a closing: multi-measure selection, R2 anti-stale-closure refs, v1 migration test, and paste profile (2026-11-17)

---

## 3. Latest Benchmark Results (Playwright Headless)

**Benchmark File:** `bench-2026-11-17.json` | **Date:** 2026-11-17 | **Browser:** Chromium

| Scenario | Measures | Runs | Median (ms) | p95 (ms) | Target p95 (ms) | Status |
|:---|---:|---:|---:|---:|---:|:---:|
| `benchmark_64_full` | 64 | 30 | 8.6 | **14.9** | 25 | PASS |
| `benchmark_200_full` | 200 | 30 | 28.1 | **37.7** | 40 | PASS |


---

## 4. Tracked Files and Line Counts

Total Tracked Files: 346 | Total Lines: 194112

| Tracked File | Lines |
|:---|---:|
| `public/fonts/bravura_metadata.json` | 51899 |
| `src/fonts/bravura_metadata.json` | 51899 |
| `public/fonts/glyphnames.json` | 11984 |
| `src/fonts/glyphnames.json` | 11984 |
| `package-lock.json` | 4496 |
| `docs/review/REVIEW_PACK.md` | 1363 |
| `tests/render/__snapshots__/gallery_snapshots.test.ts.snap` | 1282 |
| `public/fonts/Bravura.woff2` | 1218 |
| `scripts/assets/Bravura.otf` | 867 |
| `scripts/run_m6a_e2e_verification.mjs` | 777 |
| `tests/render/__snapshots__/renderSvg.test.ts.snap` | 739 |
| `tests/layout/mouseInput.test.ts` | 667 |
| `src/ui/keymap.ts` | 588 |
| `src/layout/measureLayout.ts` | 586 |
| `src/ui/scoreView/useScoreInteractions.ts` | 575 |
| `src/render/renderSvg.ts` | 568 |
| `src/layout/layoutScore.ts` | 565 |
| `src/ui/App.tsx` | 565 |
| `scripts/run_m3c3_e2e_verification.mjs` | 549 |
| `src/core/input.ts` | 546 |
| `scripts/run_m3c4_e2e_verification.mjs` | 538 |
| `docs/design/multi-staff-and-pages.md` | 531 |
| `src/ui/app/useAppKeyboard.ts` | 531 |
| `src/ui/editor/useEditorSelection.ts` | 529 |
| `src/ui/ScoreView.tsx` | 524 |
| `scripts/run_m3c_e2e_verification.mjs` | 517 |
| `src/core/notationCommands.ts` | 497 |
| `src/ui/galleryCases.ts` | 495 |
| `tests/core/commands.test.ts` | 487 |
| `scripts/run_m6b_e2e_verification.mjs` | 480 |
| `src/ui/toolbar/ToolbarFileHistory.tsx` | 460 |
| `src/layout/mouse.ts` | 454 |
| `src/core/commands.ts` | 449 |
| `src/ui/app/modals/ConfirmModals.tsx` | 430 |
| `tests/core/input.test.ts` | 430 |
| `tests/layout/layoutScore.test.ts` | 429 |
| `scripts/run_m4_e2e_verification.mjs` | 426 |
| `scripts/run_m3c2_e2e_verification.mjs` | 412 |
| `scripts/bench.mjs` | 411 |
| `tests/layout/beamLayout.test.ts` | 397 |

*... and 306 additional tracked files.*


---

## 5. Schema Migrations (v1 through v6)


| Source Schema | Target Schema | Key Enhancements & Transformation |
|:---|:---|:---|
| **v1** | **v2** | Migrated legacy event-level ties (`NoteEvent.tiedToNext`) to per-pitch ties (`Pitch.tiedToNext`). |
| **v2** | **v3** | Introduced staff-level legato slurs (`Staff.slurs`), per-event dynamic expressions, and articulations. |
| **v3** | **v4** | Added score-level header metadata (`meta.subtitle`, `meta.arranger`) and measure tempo markings. |
| **v4** | **v5** | Added pickup/anacrusis measures (`actualTicks`) and mid-score time/key signature changes. |
| **v5** | **v6** | Added repeat barlines (`repeatStart`, `repeatEnd`), 1st/2nd ending voltas (`volta`), and lyrics syllables (`lyrics`). |
| **v6** | **v7 (Planned)** | Multi-staff grand staves (`parts[].staves[]`), explicit `Voice.voiceIndex: 1 \| 2 \| 3 \| 4`, cross-staff alignment. |


---

## 6. Regression Gallery Cards & Assertions


| # | Card ID | Feature Title | Verified DOM Assertions / Elements |
|:---:|:---|:---|:---|
| 1 | `note-values-and-dots` | Note Values & Augmentation Dots | `.glyph-augmentationDot`, `.glyph-noteheadBlack` |
| 2 | `rests-all-values` | Rests of All Values | Whole, half, quarter, 8th, 16th, 32nd, dotted quarter rests |
| 3 | `split-step-chords` | Chords with Same Step (Split-Step) | `glyph-accidentalSharp`, `glyph-accidentalNatural`, notehead collision offset |
| 4 | `beams-all-cases` | Metrical Beam Groups | `.score-beam`, `.score-stem` (4 sixteenths + 2 eighths + 1 quarter) |
| 5 | `ties-same-system` | Ties on Same System | `.score-tie`, crescent bezier path |
| 6 | `ties-across-barline` | Ties Across Barline | `.score-tie` linking boundary notes across barline |
| 7 | `ties-across-system-break`| Ties Across System Break | Split ties: `.score-tie` outgoing on sys 1, incoming on sys 2 |
| 8 | `slurs-stem-up` | Slurs (Stem Up, Placement Below) | `.score-slur`, bezier curve below noteheads |
| 9 | `slurs-stem-down` | Slurs (Stem Down, Placement Above) | `.score-slur`, bezier curve above noteheads |
| 10 | `slurs-long-phrase` | Multi-Measure Phrasing Slur | Long `.score-slur` spanning 3 measures |
| 11 | `slurs-across-system-break`| Slurs Across System Break | Split bezier slur arcs on system break |
| 12 | `dynamics-all-levels` | Dynamic Markings (ppp..fff) | `.glyph-dynamic*` (ppp, pp, p, mp, mf, f, ff, fff) |
| 13 | `articulations-stem-up` | Articulations (Stem Up) | Staccato, tenuto, accent, marcato placed opposite stems |
| 14 | `articulations-stem-down` | Articulations (Stem Down) | Articulations placed opposite stems (above noteheads) |
| 15 | `key-change-with-naturals`| Key Change with Naturals | `.glyph-accidentalNatural` cancellation glyphs |
| 16 | `time-signature-changes`| Mid-Score Time Signature Changes | `.score-timesig` inline time change |
| 17 | `pickup-measure` | Pickup Measure (Anacrusis) | Incomplete measure barline, excluded from measure numbering |
| 18 | `barlines-double-and-final`| Sectional Barlines: Double & Final | Double barline (`barlineDouble`), Final barline (`barlineFinal`) |
| 19 | `repeats-start-and-end` | Repeat Signs: Start, End & Combined | `repeatLeft`, `repeatRight`, `repeatRightLeft` with dots |
| 20 | `voltas-open-and-closed` | Volta 1st & 2nd Endings | Open right hook rule on 2nd ending, closed hook on 1st |
| 21 | `lyrics-hyphens-and-extenders`| Lyrics: Syllables, Hyphens & Extenders | Syllable text, centered dash hyphens, melisma extender line |
| 22 | `header-four-fields` | Header: Title, Subtitle, Composer, Arranger | 4 distinct header texts, zero bounding-box overlaps |
| 23 | `tempo-markings` | Tempo Marking with SMuFL Note | Text prefix, SMuFL note glyph, equals sign, BPM number |
| 24 | `bass-clef` | Bass Clef (F Clef) Scoring | `.glyph-fClef`, correct F-clef pitch positions |
| 25 | `wrapping-three-widths` | Measure Wrapping Across Widths | Exact same piece rendered at 385px, 600px, 1200px |
| 26 | `multi-voice` | Multi-Voice Polyphony (Pending M7a) | Marked pending: true, deferred to Milestone 7a |


---

## 7. Known Issues & Active Technical Scope (`docs/KNOWN_ISSUES.md`)

```markdown
# ScoreForge — Known Issues & Technical Limitations

This document lists known constraints and architectural trade-offs in the current implementation.

## 1. Bundle Size & SMuFL Glyph Paths (~1.16 MB bundle)
- **Status:** Optimized in Milestone 6b.
- **Details:** The Bravura SMuFL music font glyph paths are compiled into `src/render/glyphPaths.generated.ts` as static SVG path strings. This eliminates WebFont loading flash (FOUC), network latency, and canvas rasterization artifacts. In Milestone 6b closing, static analysis was introduced (`scripts/buildGlyphPaths.mjs`) to filter only the 53 active glyphs referenced across `src/`, reducing the generated glyph source file from 440.4 KB to 33.2 KB.
- **Impact:** Production JavaScript bundle dropped from 1,569.82 kB down to 1,169.19 kB (289.25 kB gzipped), a net reduction of 400.6 kB.
- **Roadmap:** In Phase 2, additional font weights or full microtonal glyph sets can be split into lazy-loaded chunks if needed.

## 2. Basic Synthesizer Playback Timbre
- **Status:** Scope Limit.
- **Details:** Audio playback currently utilizes Tone.js `PolySynth` with a triangle/sine oscillator and simple ADSR envelope.
- **Impact:** Sound is functional for pitch/duration auditioning, but lacks acoustic instrument realism.
- **Roadmap:** SoundFont / General MIDI sample-based synthesis engine planned for Phase 2.

## 3. Single Staff per System in Phase 1
- **Status:** Phase 1 Design Scope.
- **Details:** Currently, scores support a single staff (treble or bass clef) per system.
- **Roadmap:** Grand Staff (piano) and multi-part orchestral systems are scheduled for Phase 2.

## 4. Web Audio Autoplay User Gesture Requirement
- **Status:** Browser Security Standard.
- **Details:** Browsers restrict audio playback until an explicit user gesture (e.g. click, keypress) has occurred.
- **Handling:** Tone.js audio context starts automatically on first user click or spacebar transport action.

## 5. Measure-Level Voice Identifiers vs. Voice Index
- **Status:** Model Design Note.
- **Details:** In `Score`, each `StaffMeasure` contains `voices: Voice[]` where each voice has a local `id`. Cross-measure operations rely on the voice's zero-based `voiceIndex` (1..4) to maintain continuity across barlines rather than comparing voice UUIDs.

## 6. Score Structure Elements (Milestone 6c)
- **Status:** Implemented in Milestone 6c.
- **Details:** Supports header text (title, subtitle, composer, arranger), tempo text markings (e.g. "Allegro vivace ♩ = 120"), mid-score key signature changes with cancellation naturals, mid-score time signatures, pickup measures (anacrusis), and barlines (single, double, final).

## 7. Repeats, Voltas & Lyrics (Milestone 6d)
- **Status:** Implemented in Milestone 6d (Schema Version 6).
- **Details:** Supports repeat start (`repeatStart`), repeat end (`repeatEnd`), combined barlines (`repeatRightLeft`), volta brackets (`volta: { number }`), syllable-level lyrics (`lyrics: LyricSyllable[]`), Turkish solfège automation (`autoSolfege`), and lyrics input mode (`KeyU`).
- **Scope Limits:** Nested repeats without matching delimiters trigger validation errors (`nested-repeat`). Multiple lyric verses (verse > 1) and complex melisma curves are deferred to Phase 2.



```

---

## 8. Core Source Files

### 8.1 Data Model (`src/core/model.ts`)

```typescript
/**
 * Core data model for ScoreForge.
 *
 * All types represent plain serializable data structures with no functions,
 * classes, or hidden internal state. Coordinates in overrides are expressed
 * in staff spaces, and time is measured in integer ticks.
 */

/** Unique identifier type (UUID string). */
export type Id = string;

/** Root score container. */
export interface Score {
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6;
  id: Id;
  meta: {
    title: string;
    composer: string;
    subtitle?: string;
    arranger?: string;
  };
  parts: Part[];
  measures: MeasureDef[];
  overrides: Record<Id, Override>;
}

/** Supported barline types for measure endings. */
export type BarlineType = 'single' | 'double' | 'final';

/** Volta (1st and 2nd ending) specification (Milestone 6d). */
export interface VoltaDef {
  number: 1 | 2;
  openRight?: boolean;
}

/** Global measure definition shared by all staves across parts. */
export interface MeasureDef {
  id: Id;
  timeSig: {
    num: number;
    den: number;
  };
  keySig: number; // -7..7 on circle of fifths (0 = C major / A minor)
  tempo?: {
    bpm: number;
    beatUnit: number;
    tempoText?: string;
  };
  actualTicks?: number; // Optional custom duration in ticks (e.g. pickup/anacrusis measures)
  endBarline?: BarlineType;
  repeatStart?: boolean;
  repeatEnd?: boolean;
  volta?: VoltaDef;
}

/** Supported clef sign symbols. */
export type ClefSign = 'G' | 'F' | 'C';

/** Clef specification. */
export interface Clef {
  sign: ClefSign;
  line: number; // e.g. 2 for G clef (treble), 4 for F clef (bass)
}

/** A single instrument or musical part consisting of one or more staves. */
export interface Part {
  id: Id;
  name: string;
  staves: Staff[];
  instrument: string;
}

/** A musical slur connecting two events in the same staff. */
export interface Slur {
  id: Id;
  startEventId: Id;
  endEventId: Id;
  placement?: 'above' | 'below';
}

/** Allowed dynamic markings (Milestone 6b). */
export type DynamicType = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'sfz' | 'fp';
export const ALLOWED_DYNAMICS: ReadonlySet<string> = new Set([
  'pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp',
]);

/** Allowed articulation markings (Milestone 6b). */
export type ArticulationType = 'staccato' | 'tenuto' | 'accent' | 'marcato';
export const ALLOWED_ARTICULATIONS: ReadonlySet<string> = new Set([
  'staccato', 'tenuto', 'accent', 'marcato',
]);

/** A single staff belonging to a part. */
export interface Staff {
  id: Id;
  clef: Clef;
  measures: Record<Id, StaffMeasure>; // Keyed by MeasureDef.id
  slurs?: Slur[];
}

/** Staff contents within a specific measure, containing one or more voices. */
export interface StaffMeasure {
  voices: Voice[];
}

/** A voice channel within a measure holding a sequential list of score events. */
export interface Voice {
  id: Id;
  events: ScoreEvent[];
}

/** Discriminated union of score events. */
export type ScoreEvent = NoteEvent | RestEvent;

/** Supported fundamental duration types. */
export type BaseDurationType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd';

/** Base attributes shared by notes and rests. */
export interface BaseEvent {
  id: Id;
  duration: number; // Duration in ticks, scaled by dots and tuplets
  baseType: BaseDurationType;
  dots: number;
  tuplet?: {
    actual: number; // Number of notes played in the time of 'normal'
    normal: number; // Number of notes normally occupying this duration
  };
}

/** Syllable specification for lyrics (Milestone 6d). */
export interface LyricSyllable {
  verse: number;
  text: string;
}

/** Note event (single pitch or multi-pitch chord). */
export interface NoteEvent extends BaseEvent {
  kind: 'note';
  pitches: Pitch[];
  tiedToNext?: boolean;
  articulations: string[]; // e.g. 'staccato', 'accent', 'tenuto'
  dynamic?: string; // e.g. 'p', 'mf', 'f'
  lyrics?: LyricSyllable[]; // Syllables by verse (Milestone 6d)
}

/** Rest event. */
export interface RestEvent extends BaseEvent {
  kind: 'rest';
  wholeMeasure?: boolean;
}

/** Musical pitch step letter. */
export type PitchStep = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** Musical pitch with scientific octave and continuous microtonal alteration. */
export interface Pitch {
  step: PitchStep;
  octave: number; // Scientific pitch notation: C4 = middle C
  alter: number; // Semitone offset: 0 = natural, 1 = sharp, -1 = flat, 0.5 = quarter tone sharp
  tiedToNext?: boolean; // Tie to next note with identical pitch
}

/** Manual visual layout overrides in staff spaces. */
export interface Override {
  dx?: number;
  dy?: number;
  scale?: number;
  hidden?: boolean;
}

```

### 8.2 Selection Model (`src/core/selection.ts`)

```typescript
/**
 * Core selection helpers and range computations.
 */

import { Score, ScoreEvent } from './model';

export type Selection =
  | { kind: 'none' }
  | { kind: 'event'; id: string }
  | { kind: 'range'; staffId: string; voiceId: string; anchorId: string; focusId: string };

export interface RangeSelection {
  staffId: string;
  voiceId: string;
  anchorId: string;
  focusId: string;
}

/**
 * Finds the staff, measure, and voice location of an event by ID.
 */
export function findEventContext(
  score: Score,
  eventId: string
): {
  staffId: string;
  measureId: string;
  measureIndex: number;
  voiceId: string;
  voiceIndex: number;
  eventIndex: number;
} | null {
  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
        const mDef = score.measures[mIdx];
        const staffMeasure = staff.measures[mDef.id];
        if (!staffMeasure) continue;
        for (let vIdx = 0; vIdx < staffMeasure.voices.length; vIdx++) {
          const voice = staffMeasure.voices[vIdx];
          const evIdx = voice.events.findIndex((e) => e.id === eventId);
          if (evIdx !== -1) {
            return {
              staffId: staff.id,
              measureId: mDef.id,
              measureIndex: mIdx,
              voiceId: voice.id,
              voiceIndex: vIdx,
              eventIndex: evIdx,
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Returns all events in a specific voice across all measures in score reading order.
 * Resolves by voice ID or by voice index within each measure.
 */
export function getOrderedVoiceEvents(
  score: Score,
  staffId: string,
  voiceIndexOrId: number | string = 0
): Array<{ event: ScoreEvent; measureId: string; measureIndex: number }> {
  const result: Array<{ event: ScoreEvent; measureId: string; measureIndex: number }> = [];

  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (staff.id !== staffId) continue;
      for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
        const mDef = score.measures[mIdx];
        const staffMeasure = staff.measures[mDef.id];
        if (!staffMeasure) continue;
        for (let vIdx = 0; vIdx < staffMeasure.voices.length; vIdx++) {
          const voice = staffMeasure.voices[vIdx];
          const matches =
            typeof voiceIndexOrId === 'number'
              ? vIdx === voiceIndexOrId
              : voice.id === voiceIndexOrId || vIdx === 0;
          if (!matches) continue;
          for (const ev of voice.events) {
            result.push({ event: ev, measureId: mDef.id, measureIndex: mIdx });
          }
        }
      }
    }
  }

  return result;
}

/**
 * Returns all events in the specified range in reading order.
 */
export function eventsInRange(
  score: Score,
  range: RangeSelection
): ScoreEvent[] {
  const anchorCtx = findEventContext(score, range.anchorId);
  const vIndex = anchorCtx ? anchorCtx.voiceIndex : 0;
  const ordered = getOrderedVoiceEvents(score, range.staffId, vIndex);
  const anchorIdx = ordered.findIndex((item) => item.event.id === range.anchorId);
  const focusIdx = ordered.findIndex((item) => item.event.id === range.focusId);

  if (anchorIdx === -1 || focusIdx === -1) {
    return [];
  }

  const startIdx = Math.min(anchorIdx, focusIdx);
  const endIdx = Math.max(anchorIdx, focusIdx);

  return ordered.slice(startIdx, endIdx + 1).map((item) => item.event);
}

/**
 * Extends or creates a range selection towards targetEventId.
 */
export function extendSelection(
  score: Score,
  current: Selection,
  targetEventId: string
): Selection {
  const targetCtx = findEventContext(score, targetEventId);
  if (!targetCtx) return current;

  if (current.kind === 'none') {
    return {
      kind: 'range',
      staffId: targetCtx.staffId,
      voiceId: targetCtx.voiceId,
      anchorId: targetEventId,
      focusId: targetEventId,
    };
  }

  if (current.kind === 'event') {
    const anchorCtx = findEventContext(score, current.id);
    if (!anchorCtx || anchorCtx.staffId !== targetCtx.staffId || anchorCtx.voiceIndex !== targetCtx.voiceIndex) {
      return {
        kind: 'range',
        staffId: targetCtx.staffId,
        voiceId: targetCtx.voiceId,
        anchorId: targetEventId,
        focusId: targetEventId,
      };
    }
    return {
      kind: 'range',
      staffId: targetCtx.staffId,
      voiceId: anchorCtx.voiceId,
      anchorId: current.id,
      focusId: targetEventId,
    };
  }

  if (current.kind === 'range') {
    const anchorCtx = findEventContext(score, current.anchorId);
    if (!anchorCtx || anchorCtx.staffId !== targetCtx.staffId || anchorCtx.voiceIndex !== targetCtx.voiceIndex) {
      return {
        kind: 'range',
        staffId: targetCtx.staffId,
        voiceId: targetCtx.voiceId,
        anchorId: targetEventId,
        focusId: targetEventId,
      };
    }
    return {
      kind: 'range',
      staffId: current.staffId,
      voiceId: current.voiceId,
      anchorId: current.anchorId,
      focusId: targetEventId,
    };
  }

  return current;
}

/**
 * Returns measure range span and event count for a list of events.
 */
export function getRangeMeasureSpan(
  score: Score,
  events: ScoreEvent[]
): { startMeasureNumber: number; endMeasureNumber: number; count: number } {
  if (events.length === 0) {
    return { startMeasureNumber: 1, endMeasureNumber: 1, count: 0 };
  }

  const eventIds = new Set(events.map((e) => e.id));
  let minMeasureNumber = Infinity;
  let maxMeasureNumber = -Infinity;

  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
        const mDef = score.measures[mIdx];
        const staffMeasure = staff.measures[mDef.id];
        if (!staffMeasure) continue;
        for (const voice of staffMeasure.voices) {
          for (const ev of voice.events) {
            if (eventIds.has(ev.id)) {
              const mNum = mIdx + 1;
              if (mNum < minMeasureNumber) minMeasureNumber = mNum;
              if (mNum > maxMeasureNumber) maxMeasureNumber = mNum;
            }
          }
        }
      }
    }
  }

  return {
    startMeasureNumber: minMeasureNumber === Infinity ? 1 : minMeasureNumber,
    endMeasureNumber: maxMeasureNumber === -Infinity ? 1 : maxMeasureNumber,
    count: events.length,
  };
}


/**
 * Checks whether an event exists in the score.
 */
export function eventExists(score: Score, eventId: string): boolean {
  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (const mDef of score.measures) {
        const sm = staff.measures[mDef.id];
        if (!sm) continue;
        for (const v of sm.voices) {
          if (v.events.some((e) => e.id === eventId)) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Returns the next or previous event ID in reading order on a staff.
 */
export function nextEventId(
  score: Score,
  staffId: string,
  currentId: string | null,
  direction: 'prev' | 'next'
): string | null {
  const staff = score.parts.flatMap((p) => p.staves).find((s) => s.id === staffId);
  if (!staff) return null;

  const events: ScoreEvent[] = [];
  for (const mDef of score.measures) {
    const sm = staff.measures[mDef.id];
    if (sm) {
      for (const v of sm.voices) {
        events.push(...v.events);
      }
    }
  }

  if (events.length === 0) return null;

  if (!currentId) {
    return direction === 'next' ? events[0].id : events[events.length - 1].id;
  }

  const idx = events.findIndex((e) => e.id === currentId);
  if (idx === -1) {
    return direction === 'next' ? events[0].id : events[events.length - 1].id;
  }

  if (direction === 'next') {
    return idx < events.length - 1 ? events[idx + 1].id : events[idx].id;
  } else {
    return idx > 0 ? events[idx - 1].id : events[idx].id;
  }
}

```

### 8.3 Layout Types (`src/layout/types.ts`)

```typescript
/**
 * Type definitions for ScoreForge layout structures.
 *
 * Coordinates are expressed in staff spaces where 1 unit equals the distance
 * between two adjacent staff lines. The Y axis points downward with Y = 0
 * representing the top line of the staff.
 */

import { Score } from '../core/model';

export type LayoutItemKind = 'glyph' | 'line' | 'text' | 'beam';

/** Uniform stem direction for notes, chords, and beam groups. */
export type StemDirection = 'up' | 'down';

/** A single positioned visual element. */
export interface LayoutItem {
  id: string;
  eventId?: string;
  kind: LayoutItemKind;
  x: number;
  y: number;
  glyph?: string;
  text?: string;
  textAnchor?: 'start' | 'middle' | 'end';
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: string;
  x2?: number;
  y2?: number;
  thickness?: number;
  width?: number;
  scale?: number;
  hidden?: boolean;
  /** Polygon vertices (clockwise in staff spaces) for 'beam' items. */
  points?: Array<{ x: number; y: number }>;
  /** Beam level: 1 = primary, 2 = 16th secondary/stub, 3 = 32nd tertiary/stub. */
  level?: number;
  /** Beam group identifier attached to beam items (`data-beam-group`). */
  beamGroupId?: string;
  /** Ordered event IDs belonging to this beam item (`data-event-ids`). */
  eventIds?: string[];
  /** Zero-based system index if item is placed relative to a system staff. */
  systemIndex?: number;
  /** Optional notation subtype (e.g. dynamic type 'pp' or articulation type 'staccato'). */
  type?: string;
}

/** Positioned staff container within a system. */
export interface LayoutStaff {
  id: string;
  y: number;
  items: LayoutItem[];
}

/** A single horizontal system containing staves and barlines. */
export interface LayoutSystem {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  staves: LayoutStaff[];
  items: LayoutItem[];
}

/** Complete layout output representing positioned elements ready for rendering. */
export interface LayoutResult {
  width: number;
  height: number;
  systems: LayoutSystem[];
  items: LayoutItem[];
  score?: Score;
  appliedOverrides?: Record<string, { dx: number; dy: number }>;
}

/** Options configuring layout dimensions and wrapping behavior. */
export interface LayoutOptions {
  /** Target system width in staff spaces before wrapping to next system. */
  width?: number;
  contentWidth?: number;
  /** Vertical distance in staff spaces between consecutive systems. */
  systemSpacing?: number;
}

```

### 8.4 Keyboard Mapping (`src/ui/keymap.ts`)

```typescript
/**
 * Physical keyboard shortcut mapping for ScoreForge editor.
 *
 * All mappings are based exclusively on physical key codes (event.code),
 * ensuring identical behavior across QWERTY, Turkish Q, AZERTY, etc.
 */

import { ArticulationType, BaseDurationType, DynamicType, PitchStep } from '../core/model';

export type EditorMode = 'select' | 'input' | 'position' | 'lyrics';

export type UserAction =
  | 'transpose-semitone-up'
  | 'transpose-semitone-down'
  | 'transpose-octave-up'
  | 'transpose-octave-down'
  | 'convert-to-rest'
  | 'select-prev'
  | 'select-next'
  | 'extend-selection-prev'
  | 'extend-selection-next'
  | 'select-all'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'insert-measure'
  | 'delete-measure'
  | 'toggle-tie'
  | 'toggle-slur'
  | 'toggle-lyrics-mode'
  | 'lyrics-next-note'
  | 'lyrics-prev-note'
  | 'lyrics-commit-and-next'
  | 'lyrics-backspace-prev'
  | 'clear-notations'
  | 'cycle-accidental-up'
  | 'cycle-accidental-down'
  | 'reset-accidental'
  | 'clear-selection'
  | 'undo'
  | 'redo'
  | 'set-mode-select'
  | 'toggle-note-input'
  | 'toggle-position-mode'
  | 'exit-note-input'
  | 'enter-rest'
  | 'toggle-dot'
  | 'show-input-off-hint'
  | 'reset-override'
  | 'toggle-playback'
  | 'play-from-start'
  | 'stop-playback'
  | 'save-score'
  | 'save-as-score'
  | 'open-score'
  | 'toggle-diagnostics'
  | { type: 'apply-dynamic'; dynamic: DynamicType }
  | { type: 'toggle-articulation'; articulation: ArticulationType }
  | { type: 'nudge-override'; dx: number; dy: number }
  | { type: 'enter-pitch'; letter: PitchStep }
  | { type: 'set-duration'; baseType: BaseDurationType }
  | { type: 'legacy-key-hint'; hintKey: 'accent' | 'marcato' | 'tenuto' };

export interface KeyEventLike {
  code: string;
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface KeyMapContext {
  isPlaying?: boolean;
  lyricsInputEmpty?: boolean;
}

let layoutMapCache: Map<string, string> | null = null;

/**
 * Initializes layout mapping from the browser's Keyboard API if available.
 */
export async function initKeyboardLayoutMap(): Promise<void> {
  if (
    typeof navigator !== 'undefined' &&
    'keyboard' in navigator &&
    typeof (navigator as unknown as { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard?.getLayoutMap === 'function'
  ) {
    try {
      const map = await (navigator as unknown as { keyboard: { getLayoutMap: () => Promise<Map<string, string>> } }).keyboard.getLayoutMap();
      layoutMapCache = new Map();
      for (const [code, key] of map.entries()) {
        layoutMapCache.set(code, String(key).toUpperCase());
      }
    } catch {
      // getLayoutMap may reject if permissions policy blocks it
    }
  }
}

/**
 * Resolves localized keycap label for a physical key code.
 */
export function getKeycapLabel(code: string, fallbackKey?: string): string {
  if (layoutMapCache && layoutMapCache.has(code)) {
    return layoutMapCache.get(code)!;
  }
  if (fallbackKey) return fallbackKey;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

/**
 * Helper to check if an event represents the Escape key.
 */
export function isCancelDragEvent(e: KeyEventLike): boolean {
  return e.code === 'Escape';
}

/**
 * Helper to check if an event commits a text input (Enter).
 */
export function isInputCommitEvent(e: KeyEventLike): boolean {
  return e.code === 'Enter';
}

const DIGIT_DURATIONS: Record<string, BaseDurationType> = {
  Digit2: '32nd',
  Digit3: '16th',
  Digit4: 'eighth',
  Digit5: 'quarter',
  Digit6: 'half',
  Digit7: 'whole',
};

const DYNAMICS_BY_CODE: Record<string, DynamicType> = {
  Digit1: 'pp',
  Digit2: 'p',
  Digit3: 'mp',
  Digit4: 'mf',
  Digit5: 'f',
  Digit6: 'ff',
  Digit7: 'sfz',
  Digit8: 'fp',
};

const PITCH_LETTERS: Record<string, PitchStep> = {
  KeyC: 'C',
  KeyD: 'D',
  KeyE: 'E',
  KeyF: 'F',
  KeyG: 'G',
  KeyA: 'A',
  KeyB: 'B',
};

/**
 * Maps a physical keyboard event to a high-level editor action according to the active mode.
 *
 * All mappings are based exclusively on physical key codes (event.code) and boolean modifiers.
 * event.key is strictly ignored.
 *
 * @param e - Keyboard event or mock event containing code and modifier keys.
 * @param modeOrIsInput - Active editor mode ('select' | 'input' | 'position') or legacy boolean.
 * @returns Recognized UserAction or null if unmapped.
 */
export function mapKeyEvent(
  e: KeyEventLike,
  modeOrIsInput: EditorMode | boolean = 'select',
  context?: KeyMapContext
): UserAction | null {
  const mode: EditorMode =
    typeof modeOrIsInput === 'boolean' ? (modeOrIsInput ? 'input' : 'select') : modeOrIsInput;

  const isCmdOrCtrl = Boolean(e.ctrlKey || e.metaKey);
  const isShift = Boolean(e.shiftKey);
  const isAlt = Boolean(e.altKey);

  // Diagnostics shortcut (Ctrl+Alt+D)
  if (isCmdOrCtrl && isAlt && e.code === 'KeyD') {
    return 'toggle-diagnostics';
  }

  // All other Alt shortcuts are disabled
  if (isAlt) {
    return null;
  }

  // Ctrl / Cmd combinations across all modes
  if (isCmdOrCtrl) {
    if (e.code === 'KeyS') {
      return isShift ? 'save-as-score' : 'save-score';
    }
    if (e.code === 'KeyO') {
      return 'open-score';
    }
    if (e.code === 'KeyZ') {
      return isShift ? 'redo' : 'undo';
    }
    if (e.code === 'KeyY') {
      return 'redo';
    }
    if (e.code === 'ArrowUp' && !isShift) {
      return 'transpose-octave-up';
    }
    if (e.code === 'ArrowDown' && !isShift) {
      return 'transpose-octave-down';
    }
    if (e.code === 'Digit0' && !isShift) {
      return 'reset-override';
    }

    if (mode === 'select') {
      if (e.code === 'KeyA') return 'select-all';
      if (e.code === 'KeyC') return 'copy';
      if (e.code === 'KeyX') return 'cut';
      if (e.code === 'KeyV') return 'paste';
      if (e.code === 'KeyB') return 'insert-measure';
    } else if (mode === 'input') {
      if (e.code === 'KeyB') return 'insert-measure';
      if (e.code === 'KeyV') return 'paste';
    }
    return null;
  }

  // Playback shortcuts: Space = play/pause (Shift+Space = play from start)
  if (e.code === 'Space') {
    if (mode === 'lyrics') {
      return 'lyrics-commit-and-next';
    }
    return isShift ? 'play-from-start' : 'toggle-playback';
  }

  // Escape handling: stops playback first if active
  if (e.code === 'Escape') {
    if (context?.isPlaying) {
      return 'stop-playback';
    }
    if (mode === 'input') return 'exit-note-input';
    if (mode === 'position' || mode === 'lyrics') return 'set-mode-select';
    return 'clear-selection';
  }

  // Mode switching keys (unmodified)
  if (!isShift) {
    if (e.code === 'KeyV') return 'set-mode-select';
    if (e.code === 'KeyN') return 'toggle-note-input';
    if (e.code === 'KeyP') return 'toggle-position-mode';
    if (e.code === 'KeyU') return 'toggle-lyrics-mode';
  }

  // Lyrics mode keys
  if (mode === 'lyrics') {
    if (e.code === 'Enter') {
      return 'lyrics-commit-and-next';
    }
    if (e.code === 'Tab') {
      return isShift ? 'lyrics-prev-note' : 'lyrics-next-note';
    }
    if (e.code === 'Backspace' && context?.lyricsInputEmpty) {
      return 'lyrics-backspace-prev';
    }
    return null;
  }

  // Augmentation dot is Period across all modes (unmodified)
  if (!isShift && e.code === 'Period') {
    return 'toggle-dot';
  }

  // POSITION MODE
  if (mode === 'position') {
    // Arrow nudging: 0.25 normal, 1.0 with Shift
    const step = isShift ? 1.0 : 0.25;
    if (e.code === 'ArrowLeft') return { type: 'nudge-override', dx: -step, dy: 0 };
    if (e.code === 'ArrowRight') return { type: 'nudge-override', dx: step, dy: 0 };
    if (e.code === 'ArrowUp') return { type: 'nudge-override', dx: 0, dy: -step };
    if (e.code === 'ArrowDown') return { type: 'nudge-override', dx: 0, dy: step };

    // Tab navigation
    if (e.code === 'Tab') {
      return isShift ? 'select-prev' : 'select-next';
    }

    // Dynamics in position mode (Shift+Digit1..Digit8)
    if (isShift && DYNAMICS_BY_CODE[e.code]) {
      return { type: 'apply-dynamic', dynamic: DYNAMICS_BY_CODE[e.code] };
    }

    // Articulations in position mode (KeyJ, KeyK, KeyL, Shift+KeyL)
    if (isShift && e.code === 'KeyL') {
      return { type: 'toggle-articulation', articulation: 'marcato' };
    }
    if (!isShift) {
      if (e.code === 'KeyJ') return { type: 'toggle-articulation', articulation: 'staccato' };
      if (e.code === 'KeyK') return { type: 'toggle-articulation', articulation: 'tenuto' };
      if (e.code === 'KeyL') return { type: 'toggle-articulation', articulation: 'accent' };
      if (e.code === 'KeyS') return 'toggle-slur';
      if (e.code === 'KeyT') return 'toggle-tie';
      if (e.code === 'KeyX') return 'reset-accidental';
      if (e.code === 'Delete' || e.code === 'Backspace') return 'convert-to-rest';
      if (PITCH_LETTERS[e.code] || e.code === 'Digit0') return 'show-input-off-hint';
    }
    return null;
  }

  // SELECT MODE
  if (mode === 'select') {
    // Shift shortcuts
    if (isShift) {
      if (e.code === 'ArrowLeft') return 'extend-selection-prev';
      if (e.code === 'ArrowRight') return 'extend-selection-next';
      if (e.code === 'ArrowUp') return 'cycle-accidental-up';
      if (e.code === 'ArrowDown') return 'cycle-accidental-down';

      // Dynamics: Shift+Digit1..Digit8
      if (DYNAMICS_BY_CODE[e.code]) {
        return { type: 'apply-dynamic', dynamic: DYNAMICS_BY_CODE[e.code] };
      }

      // Marcato: Shift+KeyL
      if (e.code === 'KeyL') {
        return { type: 'toggle-articulation', articulation: 'marcato' };
      }

      if (e.key === '>' || e.code === 'Period') {
        return { type: 'legacy-key-hint', hintKey: 'accent' };
      }
      if (e.key === '^' && e.code !== 'Digit6') {
        return { type: 'legacy-key-hint', hintKey: 'marcato' };
      }

      return null;
    }

    // Legacy punctuation articulation hints
    if (e.key === '>' || (isShift && e.code === 'Period')) {
      return { type: 'legacy-key-hint', hintKey: 'accent' };
    }
    if (e.key === '^' && e.code !== 'Digit6') {
      return { type: 'legacy-key-hint', hintKey: 'marcato' };
    }
    if (!isCmdOrCtrl && (e.key === '-' || e.code === 'Minus')) {
      return { type: 'legacy-key-hint', hintKey: 'tenuto' };
    }

    // Unmodified keys in select mode
    if (e.code === 'KeyS') return 'toggle-slur';
    if (e.code === 'KeyT') return 'toggle-tie';
    if (e.code === 'KeyX') return 'reset-accidental';

    // Articulations: KeyJ (staccato), KeyK (tenuto), KeyL (accent)
    if (e.code === 'KeyJ') return { type: 'toggle-articulation', articulation: 'staccato' };
    if (e.code === 'KeyK') return { type: 'toggle-articulation', articulation: 'tenuto' };
    if (e.code === 'KeyL') return { type: 'toggle-articulation', articulation: 'accent' };

    // Duration palette
    if (DIGIT_DURATIONS[e.code]) {
      return { type: 'set-duration', baseType: DIGIT_DURATIONS[e.code] };
    }

    // Navigation and transposition
    if (e.code === 'ArrowLeft') return 'select-prev';
    if (e.code === 'ArrowRight') return 'select-next';
    if (e.code === 'ArrowUp') return 'transpose-semitone-up';
    if (e.code === 'ArrowDown') return 'transpose-semitone-down';
    if (e.code === 'Delete' || e.code === 'Backspace') return 'convert-to-rest';

    // Pitch keys or Digit0 show input-off hint
    if (PITCH_LETTERS[e.code] || e.code === 'Digit0') {
      return 'show-input-off-hint';
    }

    return null;
  }

  // INPUT MODE
  if (mode === 'input') {
    if (isShift) {
      if (e.code === 'KeyL') {
        return { type: 'toggle-articulation', articulation: 'marcato' };
      }
      if (DYNAMICS_BY_CODE[e.code]) {
        return { type: 'apply-dynamic', dynamic: DYNAMICS_BY_CODE[e.code] };
      }
      if (e.code === 'ArrowLeft') return 'extend-selection-prev';
      if (e.code === 'ArrowRight') return 'extend-selection-next';
      if (e.code === 'ArrowUp') return 'cycle-accidental-up';
      if (e.code === 'ArrowDown') return 'cycle-accidental-down';
      return null;
    }

    // Input mode notation keys: Tie (T), Slur (S), Natural (X), Articulations (J, K, L)
    if (e.code === 'KeyT') return 'toggle-tie';
    if (e.code === 'KeyS') return 'toggle-slur';
    if (e.code === 'KeyX') return 'reset-accidental';
    if (e.code === 'KeyJ') return { type: 'toggle-articulation', articulation: 'staccato' };
    if (e.code === 'KeyK') return { type: 'toggle-articulation', articulation: 'tenuto' };
    if (e.code === 'KeyL') return { type: 'toggle-articulation', articulation: 'accent' };

    // Note entry (C..B)
    if (PITCH_LETTERS[e.code]) {
      return { type: 'enter-pitch', letter: PITCH_LETTERS[e.code] };
    }

    // Rest entry
    if (e.code === 'Digit0') {
      return 'enter-rest';
    }

    // Duration palette
    if (DIGIT_DURATIONS[e.code]) {
      return { type: 'set-duration', baseType: DIGIT_DURATIONS[e.code] };
    }

    // Navigation and editing
    if (e.code === 'ArrowLeft') return 'select-prev';
    if (e.code === 'ArrowRight') return 'select-next';
    if (e.code === 'ArrowUp') return 'transpose-semitone-up';
    if (e.code === 'ArrowDown') return 'transpose-semitone-down';
    if (e.code === 'Delete' || e.code === 'Backspace') return 'convert-to-rest';

    // Legacy punctuation articulation hints
    if (e.key === '>' || (isShift && e.code === 'Period')) {
      return { type: 'legacy-key-hint', hintKey: 'accent' };
    }
    if (e.key === '^' && e.code !== 'Digit6') {
      return { type: 'legacy-key-hint', hintKey: 'marcato' };
    }
    if (!isCmdOrCtrl && (e.key === '-' || e.code === 'Minus')) {
      return { type: 'legacy-key-hint', hintKey: 'tenuto' };
    }

    return null;
  }

  // Legacy punctuation articulation hints across all modes
  if (e.key === '>' || (isShift && e.code === 'Period')) {
    return { type: 'legacy-key-hint', hintKey: 'accent' };
  }
  if (e.key === '^') {
    return { type: 'legacy-key-hint', hintKey: 'marcato' };
  }
  if (!isCmdOrCtrl && (e.key === '-' || e.code === 'Minus')) {
    return { type: 'legacy-key-hint', hintKey: 'tenuto' };
  }

  return null;
}

export interface KeyTableEntry {
  key: string;
  code: string;
  modifiers: string;
  mode: EditorMode | 'all';
  action: string;
}

/**
 * Returns the complete specification table of all physical key shortcuts.
 */
export function getCompleteKeyTable(): KeyTableEntry[] {
  return [
    // Global mode switches, Storage & Playback
    { key: 'Space', code: 'Space', modifiers: 'none', mode: 'all', action: 'toggle-playback' },
    { key: 'Space', code: 'Space', modifiers: 'Shift', mode: 'all', action: 'play-from-start' },
    { key: 'S', code: 'KeyS', modifiers: 'Ctrl', mode: 'all', action: 'save-score' },
    { key: 'S', code: 'KeyS', modifiers: 'Ctrl+Shift', mode: 'all', action: 'save-as-score' },
    { key: 'O', code: 'KeyO', modifiers: 'Ctrl', mode: 'all', action: 'open-score' },
    { key: 'Z', code: 'KeyZ', modifiers: 'Ctrl', mode: 'all', action: 'undo' },
    { key: 'Z', code: 'KeyZ', modifiers: 'Ctrl+Shift', mode: 'all', action: 'redo' },
    { key: 'Y', code: 'KeyY', modifiers: 'Ctrl', mode: 'all', action: 'redo' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'Ctrl', mode: 'all', action: 'transpose-octave-up' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'Ctrl', mode: 'all', action: 'transpose-octave-down' },
    { key: '0', code: 'Digit0', modifiers: 'Ctrl', mode: 'all', action: 'reset-override' },
    { key: 'V', code: 'KeyV', modifiers: 'none', mode: 'all', action: 'set-mode-select' },
    { key: 'N', code: 'KeyN', modifiers: 'none', mode: 'all', action: 'toggle-note-input' },
    { key: 'P', code: 'KeyP', modifiers: 'none', mode: 'all', action: 'toggle-position-mode' },
    { key: 'U', code: 'KeyU', modifiers: 'none', mode: 'all', action: 'toggle-lyrics-mode' },
    { key: 'Esc', code: 'Escape', modifiers: 'none', mode: 'select', action: 'clear-selection' },
    { key: 'Esc', code: 'Escape', modifiers: 'none', mode: 'input', action: 'exit-note-input' },
    { key: 'Esc', code: 'Escape', modifiers: 'none', mode: 'position', action: 'set-mode-select' },
    { key: 'Esc', code: 'Escape', modifiers: 'none', mode: 'lyrics', action: 'set-mode-select' },
    { key: 'Space', code: 'Space', modifiers: 'none', mode: 'lyrics', action: 'lyrics-commit-and-next' },
    { key: 'Enter', code: 'Enter', modifiers: 'none', mode: 'lyrics', action: 'lyrics-commit-and-next' },
    { key: 'Tab', code: 'Tab', modifiers: 'none', mode: 'lyrics', action: 'lyrics-next-note' },
    { key: 'Tab', code: 'Tab', modifiers: 'Shift', mode: 'lyrics', action: 'lyrics-prev-note' },
    { key: 'Backspace', code: 'Backspace', modifiers: 'none', mode: 'lyrics', action: 'lyrics-backspace-prev' },
    { key: '.', code: 'Period', modifiers: 'none', mode: 'all', action: 'toggle-dot' },

    // Select mode editing
    { key: 'A', code: 'KeyA', modifiers: 'Ctrl', mode: 'select', action: 'select-all' },
    { key: 'C', code: 'KeyC', modifiers: 'Ctrl', mode: 'select', action: 'copy' },
    { key: 'X', code: 'KeyX', modifiers: 'Ctrl', mode: 'select', action: 'cut' },
    { key: 'V', code: 'KeyV', modifiers: 'Ctrl', mode: 'select', action: 'paste' },
    { key: 'B', code: 'KeyB', modifiers: 'Ctrl', mode: 'select', action: 'insert-measure' },
    { key: 'S', code: 'KeyS', modifiers: 'none', mode: 'select', action: 'toggle-slur' },
    { key: 'T', code: 'KeyT', modifiers: 'none', mode: 'select', action: 'toggle-tie' },
    { key: 'X', code: 'KeyX', modifiers: 'none', mode: 'select', action: 'reset-accidental' },
    { key: 'J', code: 'KeyJ', modifiers: 'none', mode: 'select', action: 'toggle-articulation: staccato' },
    { key: 'K', code: 'KeyK', modifiers: 'none', mode: 'select', action: 'toggle-articulation: tenuto' },
    { key: 'L', code: 'KeyL', modifiers: 'none', mode: 'select', action: 'toggle-articulation: accent' },
    { key: 'L', code: 'KeyL', modifiers: 'Shift', mode: 'select', action: 'toggle-articulation: marcato' },

    // Position mode shortcuts
    { key: 'Left', code: 'ArrowLeft', modifiers: 'none', mode: 'position', action: 'nudge dx: -0.25' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'none', mode: 'position', action: 'nudge dx: +0.25' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'none', mode: 'position', action: 'nudge dy: -0.25' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'none', mode: 'position', action: 'nudge dy: +0.25' },
    { key: 'Left', code: 'ArrowLeft', modifiers: 'Shift', mode: 'position', action: 'nudge dx: -1.0' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'Shift', mode: 'position', action: 'nudge dx: +1.0' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'Shift', mode: 'position', action: 'nudge dy: -1.0' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'Shift', mode: 'position', action: 'nudge dy: +1.0' },
    { key: 'Tab', code: 'Tab', modifiers: 'none', mode: 'position', action: 'select-next' },
    { key: 'Tab', code: 'Tab', modifiers: 'Shift', mode: 'position', action: 'select-prev' },
    { key: 'S', code: 'KeyS', modifiers: 'none', mode: 'position', action: 'toggle-slur' },
    { key: 'T', code: 'KeyT', modifiers: 'none', mode: 'position', action: 'toggle-tie' },
    { key: 'X', code: 'KeyX', modifiers: 'none', mode: 'position', action: 'reset-accidental' },
    { key: 'J', code: 'KeyJ', modifiers: 'none', mode: 'position', action: 'toggle-articulation: staccato' },
    { key: 'K', code: 'KeyK', modifiers: 'none', mode: 'position', action: 'toggle-articulation: tenuto' },
    { key: 'L', code: 'KeyL', modifiers: 'none', mode: 'position', action: 'toggle-articulation: accent' },
    { key: 'L', code: 'KeyL', modifiers: 'Shift', mode: 'position', action: 'toggle-articulation: marcato' },

    // Dynamics across Select, Position, and Input modes
    ...(['select', 'position', 'input'] as const).flatMap((m) =>
      Object.entries(DYNAMICS_BY_CODE).map(([c, dyn]) => ({
        key: c.slice(5),
        code: c,
        modifiers: 'Shift',
        mode: m,
        action: `apply-dynamic: ${dyn}`,
      }))
    ),

    // Input mode shortcuts
    { key: 'C..B', code: 'KeyC..KeyB', modifiers: 'none', mode: 'input', action: 'enter-pitch' },
    { key: '0', code: 'Digit0', modifiers: 'none', mode: 'input', action: 'enter-rest' },
    { key: 'B', code: 'KeyB', modifiers: 'Ctrl', mode: 'input', action: 'insert-measure' },
    { key: 'V', code: 'KeyV', modifiers: 'Ctrl', mode: 'input', action: 'paste' },
    { key: 'S', code: 'KeyS', modifiers: 'none', mode: 'input', action: 'toggle-slur' },
    { key: 'T', code: 'KeyT', modifiers: 'none', mode: 'input', action: 'toggle-tie' },
    { key: 'X', code: 'KeyX', modifiers: 'none', mode: 'input', action: 'reset-accidental' },
    { key: 'J', code: 'KeyJ', modifiers: 'none', mode: 'input', action: 'toggle-articulation: staccato' },
    { key: 'K', code: 'KeyK', modifiers: 'none', mode: 'input', action: 'toggle-articulation: tenuto' },
    { key: 'L', code: 'KeyL', modifiers: 'none', mode: 'input', action: 'toggle-articulation: accent' },
    { key: 'L', code: 'KeyL', modifiers: 'Shift', mode: 'input', action: 'toggle-articulation: marcato' },

    // Duration Digits (Select & Input)
    { key: '2', code: 'Digit2', modifiers: 'none', mode: 'select', action: 'set-duration: 32nd' },
    { key: '3', code: 'Digit3', modifiers: 'none', mode: 'select', action: 'set-duration: 16th' },
    { key: '4', code: 'Digit4', modifiers: 'none', mode: 'select', action: 'set-duration: eighth' },
    { key: '5', code: 'Digit5', modifiers: 'none', mode: 'select', action: 'set-duration: quarter' },
    { key: '6', code: 'Digit6', modifiers: 'none', mode: 'select', action: 'set-duration: half' },
    { key: '7', code: 'Digit7', modifiers: 'none', mode: 'select', action: 'set-duration: whole' },

    { key: '2', code: 'Digit2', modifiers: 'none', mode: 'input', action: 'set-duration: 32nd' },
    { key: '3', code: 'Digit3', modifiers: 'none', mode: 'input', action: 'set-duration: 16th' },
    { key: '4', code: 'Digit4', modifiers: 'none', mode: 'input', action: 'set-duration: eighth' },
    { key: '5', code: 'Digit5', modifiers: 'none', mode: 'input', action: 'set-duration: quarter' },
    { key: '6', code: 'Digit6', modifiers: 'none', mode: 'input', action: 'set-duration: half' },
    { key: '7', code: 'Digit7', modifiers: 'none', mode: 'input', action: 'set-duration: whole' },

    // Navigation & Accidental cycling (Select & Input)
    { key: 'Left', code: 'ArrowLeft', modifiers: 'none', mode: 'select', action: 'select-prev' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'none', mode: 'select', action: 'select-next' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'none', mode: 'select', action: 'transpose-semitone-up' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'none', mode: 'select', action: 'transpose-semitone-down' },
    { key: 'Left', code: 'ArrowLeft', modifiers: 'Shift', mode: 'select', action: 'extend-selection-prev' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'Shift', mode: 'select', action: 'extend-selection-next' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'Shift', mode: 'select', action: 'cycle-accidental-up' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'Shift', mode: 'select', action: 'cycle-accidental-down' },
    { key: 'Del', code: 'Delete', modifiers: 'none', mode: 'select', action: 'convert-to-rest' },
    { key: 'Backspace', code: 'Backspace', modifiers: 'none', mode: 'select', action: 'convert-to-rest' },

    { key: 'Left', code: 'ArrowLeft', modifiers: 'none', mode: 'input', action: 'select-prev' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'none', mode: 'input', action: 'select-next' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'none', mode: 'input', action: 'transpose-semitone-up' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'none', mode: 'input', action: 'transpose-semitone-down' },
    { key: 'Left', code: 'ArrowLeft', modifiers: 'Shift', mode: 'input', action: 'extend-selection-prev' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'Shift', mode: 'input', action: 'extend-selection-next' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'Shift', mode: 'input', action: 'cycle-accidental-up' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'Shift', mode: 'input', action: 'cycle-accidental-down' },
    { key: 'Del', code: 'Delete', modifiers: 'none', mode: 'input', action: 'convert-to-rest' },
    { key: 'Backspace', code: 'Backspace', modifiers: 'none', mode: 'input', action: 'convert-to-rest' },
  ];
}

```
