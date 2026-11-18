# Architectural Design Document: Multi-Staff and Pagination (v2)

**Document Status:** PROPOSED ARCHITECTURAL BLUEPRINT (NOT REVIEWED BY LEAD IN FULL)  
**Target Schema:** Schema v7 (Milestone 7: Multi-Staff & Polyphony, Milestone 8: Pagination & Print)  
**Author:** ScoreForge Core Engineering  
**Scope:** Complete technical blueprint for multi-staff systems, voice polyphony, horizontal cross-staff alignment, vertical spacing, discrete page layouts, keymap conflict resolutions, audio routing, test corpus, and migration strategy. Zero runtime implementation in H1.

> [!WARNING]
> This architectural design document was authored as a technical design proposal for future milestones and has **NOT been reviewed by the lead in full**. All architectural proposals, key mappings, and schema specifications herein are subject to formal lead review and approval before Milestone 7 implementation begins.

## Revision History

| Version | Date | Author | Summary of Changes |
|:---|:---|:---|:---|
| **v1.0** | 17.11.2026 | Core Engineering | Initial architectural design draft for Schema v7 multi-staff systems and pagination. |
| **v2.0** | 18.11.2026 | Core Engineering | Resolved keymap collision (removed `KeyV` voice toggle colliding with global `set-mode-select`); added physical Turkish Q keycap mapping for `BracketLeft` (`Ğ`) and `BracketRight` (`Ü`); updated performance targets to Double rAF and Event Timing; updated corpus list with lead's exact pieces and milestone gates (Bach BWV 140 M7a, Brahms Op. 118 No. 2 M7a, Bach BWV 772 M7b, Mozart K. 545 M7b, Chopin Op. 28 No. 4 M7b, Debussy M7c, Schubert D. 547 M7c, Beethoven Op. 18 No. 1 M10 with viola alto clef; Turkish folk song); deferred page-turn hints to M13+; scoped C clefs to M10; added M7a performance exit gates. |

---

## 0. Ground Truth: Current Schema v6 Architecture

ScoreForge Schema v6 currently operates on a clean, decoupled data architecture where structural measures and musical events are separated into `measures: MeasureDef[]` and `parts[].staves[].measures[measureId]`.

### Current v6 TypeScript Types (from `src/core/model.ts`, `src/core/input.ts`, `src/core/selection.ts`)

```typescript
export type Id = string;

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

export type BarlineType = 'single' | 'double' | 'final';

export interface VoltaDef {
  number: 1 | 2;
  openRight?: boolean;
}

export interface MeasureDef {
  id: Id;
  timeSig: { num: number; den: number };
  keySig: number; // -7..7 on circle of fifths (0 = C major)
  tempo?: { bpm: number; beatUnit: number; tempoText?: string };
  actualTicks?: number; // Custom duration in ticks (e.g. pickup/anacrusis)
  endBarline?: BarlineType;
  repeatStart?: boolean;
  repeatEnd?: boolean;
  volta?: VoltaDef;
}

export type ClefSign = 'G' | 'F' | 'C';

export interface Clef {
  sign: ClefSign;
  line: number; // e.g. 2 for treble, 4 for bass
}

export interface Part {
  id: Id;
  name: string;
  staves: Staff[];
  instrument: string;
}

export interface Staff {
  id: Id;
  clef: Clef;
  measures: Record<Id, StaffMeasure>; // Keyed by MeasureDef.id
  slurs?: Slur[];
}

export interface StaffMeasure {
  voices: Voice[];
}

export interface Voice {
  id: Id;
  events: ScoreEvent[];
}

export type ScoreEvent = NoteEvent | RestEvent;

export type BaseDurationType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd';

export interface BaseEvent {
  id: Id;
  duration: number; // in ticks (PPQ = 960)
  baseType: BaseDurationType;
  dots: number;
  tuplet?: { actual: number; normal: number };
}

export interface LyricSyllable {
  verse: number;
  text: string;
}

export interface NoteEvent extends BaseEvent {
  kind: 'note';
  pitches: Pitch[];
  tiedToNext?: boolean;
  articulations: string[];
  dynamic?: string;
  lyrics?: LyricSyllable[];
}

export interface RestEvent extends BaseEvent {
  kind: 'rest';
  wholeMeasure?: boolean;
}

export type PitchStep = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export interface Pitch {
  step: PitchStep;
  octave: number; // C4 = middle C
  alter: number; // 0 = natural, 1 = sharp, -1 = flat
  tiedToNext?: boolean;
}

export interface Slur {
  id: Id;
  startEventId: Id;
  endEventId: Id;
  placement?: 'above' | 'below';
}

export interface Override {
  dx?: number;
  dy?: number;
  scale?: number;
  hidden?: boolean;
}

export interface ScoreCursor {
  staffId: Id;
  voiceId: Id;
  measureId: Id;
  tick: number;
}

export type Selection =
  | { kind: 'none' }
  | { kind: 'event'; id: string }
  | { kind: 'range'; staffId: string; voiceId: string; anchorId: string; focusId: string };
```

### Current `src/` Layout

- `src/core/`: Immutable data model, commands, factory, undo/redo history, time/tick calculations, selection helpers, validation.
- `src/layout/`: Pure layout engine: `layoutScore`, `measureLayout`, `systemBeams`, `headerLayout`, `notations`, `ties`, `slurs`, `overrideLayout`, `boundingBox`.
- `src/render/`: SMuFL Bravura rendering (`renderSvg.ts`), SVG elements, hit-test rectangles.
- `src/playback/`: Lookahead audio scheduling (`player.ts`, `schedule.ts`, `repeats.ts`, `pitch.ts`, `toneEngine.ts`).
- `src/ui/`: React view layer (`ScoreView.tsx`, `SystemView.tsx`), custom hooks (`useAppKeyboard.ts`, `useEditor.ts`, `useScoreVirtualization.ts`).

---

## 1. Units of Measurement and Coordinate Systems

ScoreForge adheres strictly to two unified unit systems:

1. **Internal Notation & Geometry (Staff Spaces - `sp`):**
   - All notation positioning, notehead dimensions, stem lengths, line thicknesses, margins, bounding boxes, and manual drag overrides are defined in dimensionless **staff spaces (`sp`)**.
   - 1 staff space (`1.0 sp`) is the vertical distance between two adjacent lines of a 5-line staff.
   - Standard staff height (5 lines, 4 spaces) = `4.0 sp`.
   - Default notehead width = `1.18 sp`.
   - Staff line thickness = `0.13 sp`.
   - Stem length = `3.50 sp`.

2. **Physical Page Geometry (Millimeters - `mm`):**
   - Sheet sizes, paper margins, printable areas, and binding offsets are defined in **millimeters (`mm`)**.
   - **Canonical Physical Scale:** `1.0 sp = 1.75 mm` (equivalent to staff size 7.0 mm, standard Rastral size 3 / Henle / Bärenreiter Urtext).
   - **Screen Display Conversion:**
     `pxPerMm = 96 / 25.4` (~3.7795 px/mm at 100% zoom).
     `staffSpacePx = 1.75 * pxPerMm` (~6.614 px per staff space at 100% zoom).
     User zoom factor linearly scales `staffSpacePx`.
   - **Print Conversion:** High-resolution vector SVG sets `width="210mm" height="297mm"` and `viewBox="0 0 pageWidthMm pageHeightMm"`, allowing lossless vector rendering at arbitrary DPI (300/600/1200 DPI).

---

## 2. Detailed Technical Sections (a) through (k)

### (a) Goals and Non-Goals

#### Goals
1. **Multi-Staff Scoring:** Staves per system (e.g. Piano Grand Staff with brace, Choir SATB with bracket, Chamber Quartet, Lead sheet with melody/bass).
2. **True Voice Polyphony:** Up to 4 voices per staff with Rule R3 compliance (`voiceIndex` 1..4), independent stem directions, rest consolidation/offset, and cross-voice collision resolution.
3. **Horizontal Cross-Staff Time Alignment:** Measure widths and tick columns aligned synchronously across all staves in a system.
4. **Discrete Pagination:** Multi-page layout (A4, Letter) with running headers, footers, system breaks, page breaks, and print scale.
5. **Deterministic Purity:** Zero DOM measuring during layout; all bounding boxes and line breaks calculated via pure numeric functions.
6. **Sub-40ms Keystroke Budget:** Single-note edit re-layout and paint must remain under 30 ms for 4 staves x 50 measures (200 measure-staves).

#### Non-Goals
1. Dynamic part extraction (generating single-instrument parts from a full conductor score) is deferred to Milestone 11.
2. Cross-staff beam distribution (e.g. Lisztian runs spanning piano treble and bass) is deferred to Milestone 10; data model reserves optional display property.
3. Microtonal custom staff line counts (0-line or 11-line experimental staves) are out of scope.
4. Live free-form drag-and-drop page reflow without underlying structure commands.

---

### (b) Data Model v7 and Migration (v6 -> v7)

#### Schema v7 Additions
Schema v7 evolves `parts[].staves[]` with minimal additive changes:

```typescript
// Additions to src/core/model.ts for Schema v7

export interface ScoreMetaV7 {
  title: string;
  composer: string;
  subtitle?: string;
  arranger?: string;
  lyricist?: string;
  copyright?: string;
}

export type SystemBracketType = 'none' | 'brace' | 'bracket' | 'subbracket';
export type BarlineSpanType = 'through' | 'mensur' | 'individual';

export interface PartV7 {
  id: Id;
  name: string;             // Full instrument name: e.g. "Flute 1", "Violoncello"
  shortName: string;        // Abbreviated name: e.g. "Fl. 1", "Vc."
  staves: StaffV7[];
  instrument: string;       // Instrument family identifier: e.g. "flute", "piano"
  bracket?: SystemBracketType; // Default bracket enclosing staves of this part
  barlineSpan?: BarlineSpanType; // Default barline connectivity across staves of this part
  midiPatch?: number;       // GM MIDI program number (0..127)
  midiChannel?: number;     // Assigned playback channel (0..15)
  pan?: number;             // Stereophonic pan: -1.0 (L) to +1.0 (R)
  volume?: number;          // Playback volume: 0.0 to 1.0
}

export interface StaffV7 {
  id: Id;
  clef: Clef;
  lines?: number;           // Default 5 (1 for single-line unpitched percussion)
  measures: Record<Id, StaffMeasureV7>;
  slurs?: Slur[];
}

export interface StaffMeasureV7 {
  voices: VoiceV7[];        // Array index corresponds to voiceIndex (0 = Voice 1, 1 = Voice 2, etc.)
}

export interface VoiceV7 {
  id: Id;
  voiceIndex: 1 | 2 | 3 | 4; // Stable voice index according to Rule R3
  events: ScoreEvent[];
}

export interface PageSettingsV7 {
  size: 'A4' | 'Letter' | 'Custom';
  widthMm: number;          // A4 = 210, Letter = 215.9
  heightMm: number;         // A4 = 297, Letter = 279.4
  marginTopMm: number;      // Default 15 mm
  marginBottomMm: number;   // Default 15 mm
  marginLeftMm: number;     // Default 15 mm
  marginRightMm: number;    // Default 15 mm
  staffSpaceMm: number;     // Default 1.75 mm
}

export interface MeasureDefV7 extends MeasureDef {
  systemBreak?: boolean;    // Force line break after this measure
  pageBreak?: boolean;      // Force page break after this measure
}

export interface ScoreV7 {
  schemaVersion: 7;
  id: Id;
  meta: ScoreMetaV7;
  pageSettings: PageSettingsV7;
  parts: PartV7[];
  measures: MeasureDefV7[];
  overrides: Record<Id, Override>;
}
```

#### Deterministic Migration Function (`migrateV6toV7`)

```typescript
export function migrateV6toV7(v6Score: Score): ScoreV7 {
  return {
    schemaVersion: 7,
    id: v6Score.id,
    meta: {
      title: v6Score.meta.title ?? '',
      composer: v6Score.meta.composer ?? '',
      subtitle: v6Score.meta.subtitle ?? '',
      arranger: v6Score.meta.arranger ?? '',
    },
    pageSettings: {
      size: 'A4',
      widthMm: 210,
      heightMm: 297,
      marginTopMm: 15,
      marginBottomMm: 15,
      marginLeftMm: 15,
      marginRightMm: 15,
      staffSpaceMm: 1.75,
    },
    measures: v6Score.measures.map((m) => ({
      ...m,
      systemBreak: false,
      pageBreak: false,
    })),
    parts: v6Score.parts.map((p) => ({
      id: p.id,
      name: p.name,
      shortName: p.name.length > 5 ? p.name.slice(0, 4) + '.' : p.name,
      instrument: p.instrument ?? 'piano',
      bracket: p.staves.length > 1 ? 'brace' : 'none',
      barlineSpan: p.staves.length > 1 ? 'through' : 'individual',
      midiPatch: 0,
      midiChannel: 0,
      pan: 0,
      volume: 0.8,
      staves: p.staves.map((s) => ({
        id: s.id,
        clef: s.clef,
        lines: 5,
        slurs: s.slurs ? [...s.slurs] : [],
        measures: Object.fromEntries(
          Object.entries(s.measures).map(([mId, sm]) => [
            mId,
            {
              voices: sm.voices.map((v, vIdx) => ({
                id: v.id,
                voiceIndex: ((vIdx + 1) as 1 | 2 | 3 | 4),
                events: [...v.events],
              })),
            },
          ])
        ),
      })),
    })),
    overrides: { ...v6Score.overrides },
  };
}
```

---

### (c) Voice Rules (Rule R3 Compliance, Polyphony, and Collisions)

According to permanent **Rule R3**, voice identity is a stable `voiceIndex` (1..4) per staff:
- `voiceIndex === 1`: Primary upper voice. Stems point UP by default. Articulations above.
- `voiceIndex === 2`: Primary lower voice. Stems point DOWN by default. Articulations below.
- `voiceIndex === 3`: Secondary upper voice. Stems point UP. Shifted right on collision.
- `voiceIndex === 4`: Secondary lower voice. Stems point DOWN. Shifted left on collision.

#### Voice Rules Matrix
1. **Single-Voice Staff (Voice 1 only active):**
   - Dynamic stem direction: pitches below middle staff line (B4 in treble, D3 in bass) point UP; pitches on or above middle line point DOWN.
   - Standard rest vertical placement (whole rest hangs from line 4; half rest sits on line 3; quarter/eighth centered).
2. **Polyphonic Staff (Voices 1 and 2 active simultaneously):**
   - **Stem Direction:** Voice 1 stems point strictly UP regardless of pitch; Voice 2 stems point strictly DOWN regardless of pitch.
   - **Unison Noteheads:**
     - Identical pitch and identical duration (e.g. two quarter C4s): share a single notehead with two stems (one up, one down).
     - Identical pitch with differing durations (e.g. half note in Voice 1, quarter in Voice 2): Voice 1 notehead placed normally; Voice 2 notehead placed adjacent with zero horizontal overlap.
   - **Second Intervals Across Voices:**
     - Upper voice (Voice 1) sits on the left of its stem (stem up at right edge); Lower voice (Voice 2) sits on the right of its stem (stem down at left edge). Stems do not intersect.
   - **Rest Consolidation & Displacement:**
     - Coincident full-measure rests or identical value rests at the same tick across voices are rendered as a single consolidated rest by default.
     - Divergent rests: Voice 1 rests pushed vertically upward (by +2 to +4 sp above line 4); Voice 2 rests pushed vertically downward (by -2 to -4 sp below line 0).
3. **Beams, Ties, and Slurs in Polyphony:**
   - Beaming is strictly intra-voice (events in Voice 1 never beam to Voice 2).
   - Ties connect only notes with identical pitch within the same voice.
   - Slurs in Voice 1 curve upward (placement = 'above'); slurs in Voice 2 curve downward (placement = 'below').

---

### (d) Layout Pipeline Stages and Cache Architecture

```
+-------------------------------------------------------------------------------+
|                       SCOREFORGE LAYOUT PIPELINE v2                           |
+-------------------------------------------------------------------------------+
                                        |
  [Stage 1: Staff-Measure Layout]      | Input: StaffMeasure, MeasureDef, Clef
                                        v Cache Key: ${mDef.id}_${keySig}_${timeSig}_${eventsHash}
                                   [Natural Chunks] (width, tickColumns)
                                        |
  [Stage 2: Cross-Staff Alignment]     | Combine all staves across Part for each measure
                                        v Column Max Widths across staves
                                   [Synchronized Measure Chunks]
                                        |
  [Stage 3: Line / System Breaking]    | Dynamic programming / greedy with systemBreak flags
                                        v System Plans (measures per system)
                                   [System Plans]
                                        |
  [Stage 4: Page Pagination]           | Height budgeting: system height + staff distances + margins
                                        v Page Plans (systems per page, pageBreak flags)
                                   [Page Plans]
                                        |
  [Stage 5: System Construction & Cache]| System memoization key: width + measure cacheKeys
                                        v Justification stretch, barlines, voltas, brackets
                                   [Positioned Layout Systems]
                                        |
  [Stage 6: Beams & Overrides]         | applyVisualOverrides -> generateSystemBeams
                                        v Final positioned elements
                                   [LayoutResult]
```

#### Pipeline Stages
1. **Stage 1 (Staff-Measure Chunk):**
   - Pure function `layoutStaffMeasure(staffMeasure, mDef, clef)`.
   - Computes tick-to-x positioning for each voice. Output: `tickColumns: Map<number, { minX: number, width: number }>`.
   - Cached via WeakMap and bitwise integer hash of voice events.
2. **Stage 2 (Horizontal Cross-Staff Synchronization):**
   - For every measure `mDef.id`:
     `colWidth(tick) = max_{staff in staves}(tickWidth(staff, tick))`
   - Natural measure width = sum of all synchronized column widths + measure margins + barlines.
   - Guarantees identical measure width across all staves in every system.
3. **Stage 3 (System Breaking):**
   - Greedy line breaking evaluating `targetContentWidth`.
   - If `mDef.systemBreak === true`, system is closed immediately and wraps to next line.
4. **Stage 4 (Vertical Layout and Page Breaking):**
   - Page budget: `usableHeightMm = pageHeightMm - (marginTopMm + marginBottomMm)`.
   - Converted to staff spaces: `usableHeightSp = usableHeightMm / (staffSpaceMm)`.
   - System height = `(stavesCount * 4.0 sp) + ((stavesCount - 1) * staffDistanceSp) + systemSpacingSp`.
   - Default `staffDistanceSp = 6.0 sp` (between staves of same instrument) or `8.0 sp` (between different instruments).
   - If adding next system exceeds `usableHeightSp` OR preceding measure has `pageBreak === true`: start new page.
5. **Stage 5 (Justification and System Rendering):**
   - Non-last systems justified to `targetContentWidth`.
   - Last system of score: if natural width >= 70% of page width, justified; if < 70%, left-aligned (ragged right).
6. **Stage 6 (Brackets, Barlines, Overrides, Beams):**
   - Multi-staff system brackets/braces drawn at `x = 0`.
   - Through-barlines drawn continuously across staves for piano grand staves and chamber sections.

---

### (e) Selection and Cursor Matrix with Keymap Conflict Table

Multi-staff navigation introduces multi-dimensional cursor motion:
- **Horizontal:** ArrowLeft / ArrowRight navigates between events or tick offsets within the active voice.
- **Vertical within Staff:** KeyA..KeyG enters pitch; ArrowUp / ArrowDown transposes selection.
- **Vertical across Staves / Voices:** Switching active staff and active voice.

#### Conflict Resolution Rules
1. **NO Alt modifier:** In ScoreForge, Alt is reserved exclusively for browser/OS window commands and screen readers.
2. **Master Mode Key Reservations:**
   - `KeyV` is **permanently reserved** as the master shortcut for **Select Mode** (`set-mode-select`) across all modes, and `Ctrl+KeyV` for clipboard `paste`. It must **never** be bound to voice switching.
   - `KeyN` is the master shortcut for **Note Input Mode** (`toggle-note-input`).
   - `KeyP` is the master shortcut for **Position Mode** (`toggle-position-mode`).
   - `KeyU` is the master shortcut for **Lyrics Mode** (`toggle-lyrics-mode`).
3. **Tab Key (Contextual Routing):**
   - In **Position Mode** (`mode === 'position'`): Tab cycles through elements in the measure; Shift+Tab reverses.
   - In **Lyrics Mode** (`mode === 'lyrics'`): Tab commits syllable and jumps to next note; Shift+Tab jumps to previous note.
   - In **Note Input Mode** (`mode === 'input'`): Tab switches active voice (`voiceIndex` 1 -> 2 -> 1); Shift+Tab cycles backward (2 -> 1).
4. **Staff Switching & Turkish Q Layout Mappings:**
   - In ScoreForge, keyboard events are dispatched strictly via physical `event.code`, guaranteeing identical behavior across keyboard layouts.
   - `BracketLeft` (`event.code === 'BracketLeft'`):
     - Physical keycap on US layout: `[`
     - Physical keycap on Turkish Q layout: `Ğ` (G-breve)
     - Action: Move cursor / selection to staff above.
     - Dynamic layout label: `getKeycapLabel('BracketLeft')` returns `"["` on US and `"Ğ"` on Turkish Q.
   - `BracketRight` (`event.code === 'BracketRight'`):
     - Physical keycap on US layout: `]`
     - Physical keycap on Turkish Q layout: `Ü` (U-umlaut)
     - Action: Move cursor / selection to staff below.
     - Dynamic layout label: `getKeycapLabel('BracketRight')` returns `"]"` on US and `"Ü"` on Turkish Q.

#### Complete Conflict Table (Mechanically Verified Against `src/ui/keymap.ts`)

| Key Event (`event.code`) | Modifiers | Mode | Action | Conflict Check & Precedence |
|:---|:---|:---|:---|:---|
| `BracketLeft` (US: `[`, TR: `Ğ`) | `none` | `input` / `select` | Move cursor / selection to staff above | Physical `event.code`. No collision with any existing action. |
| `BracketRight` (US: `]`, TR: `Ü`) | `none` | `input` / `select` | Move cursor / selection to staff below | Physical `event.code`. No collision with any existing action. |
| `Tab` | `none` | `input` | Cycle Voice (1 -> 2 -> 1) | Gated strictly by `mode === 'input'`. |
| `Tab` | `Shift` | `input` | Cycle Voice backward (2 -> 1) | Gated strictly by `mode === 'input'`. |
| `Tab` | `none` | `position` | Select next layout element | Gated strictly by `mode === 'position'`. |
| `Tab` | `Shift` | `position` | Select previous layout element | Gated strictly by `mode === 'position'`. |
| `Tab` | `none` | `lyrics` | Advance to next lyric note | Gated strictly by `mode === 'lyrics'`. |
| `Tab` | `Shift` | `lyrics` | Move to previous lyric note | Gated strictly by `mode === 'lyrics'`. |
| `KeyV` | `none` | All modes | Set Select Mode (`set-mode-select`) | Master mode switch. Never overloaded with voice toggling. |
| `KeyV` | `Ctrl` | `select` / `input` | Paste clipboard | Standard OS shortcut. |
| `KeyN` | `none` | All modes | Toggle Note Input Mode | Master mode toggle. |
| `KeyP` | `none` | All modes | Toggle Position Mode | Master mode toggle. |
| `KeyU` | `none` | All modes | Toggle Lyrics Mode | Master mode toggle. |
| `KeyL` | `none` | `select` / `input` / `position` | Accent articulation | No conflict (verified in M6b). |
| `KeyL` | `Shift` | `select` / `input` / `position` | Marcato articulation | No conflict. |
| `KeyJ` | `none` | `select` / `input` / `position` | Staccato articulation | No conflict. |
| `KeyK` | `none` | `select` / `input` / `position` | Tenuto articulation | No conflict. |
| `KeyT` | `none` | `select` / `input` / `position` | Tie to next note ("Bağ") | No conflict. |
| `KeyS` | `none` | `select` / `input` / `position` | Slur ("Legato bağı") | No conflict. |
| `KeyS` | `Ctrl` | All modes | Save score | Standard shortcut. |
| `KeyS` | `Ctrl+Shift` | All modes | Save as score | Standard shortcut. |
| `Delete` / `Backspace` | `none` | `select` | Convert selected note to rest | Delete NEVER deletes measures. |

---

### (f) Playback Facts and Multi-Staff Audio Architecture

1. **Independent Track per Part:**
   - In `src/playback/schedule.ts`, `buildSchedule` processes every part and staff sequentially.
   - In Schema v7, each Part is allocated a dedicated Web Audio / Tone.js Synth channel:
     - Part 1 (Flute): Tone.PolySynth (lead timber, pan = -0.3).
     - Part 2 (Piano): Tone.PolySynth (grand piano envelope, pan = 0.0, staves 1 & 2 share audio channel).
     - Part 3 (Cello): Tone.PolySynth (warm sustained envelope, pan = +0.3).
2. **Polyphonic Voice Scheduling:**
   - Multiple voices on the same staff emit separate `ScheduledNote` entries at identical or overlapping `startSeconds`.
   - Audio engine triggers notes polyphonically without voice stealing or mutual cancellation.
3. **Lookahead Engine (`player.ts`):**
   - The ~1.0s lookahead window in `Player.tick()` automatically consumes notes across all parts and voices in sorted chronological order (`startSeconds`, then `midi`).
   - Web Audio clock scheduling ensures zero jitter across staves.
4. **Active Playback Highlight:**
   - `eventRanges` maps each `eventId` across all staves and repeat passes.
   - Dynamic green playback highlight dyes active event groups across all staves simultaneously.

---

### (g) Undo/Redo and Multi-Staff Clipboard

1. **Atomic Structural History:**
   - Every operation (insert measure across all staves, change pitch, delete range across staves, paste) produces a single command executed via `history.do(command)`.
   - Undo restores the exact previous `ScoreV7` state in a single step.
2. **Multi-Staff Clipboard Format:**
   - Clipboard payload includes source staff count, voice indices, and relative tick offsets:
```typescript
export interface ClipboardPayloadV7 {
  type: 'scoreforge/clipboard';
  version: 7;
  stavesCount: number;
  measuresCount: number;
  stavesData: Array<{
    staffOffset: number; // 0 = source staff, 1 = staff below
    voices: Array<{
      voiceIndex: 1 | 2 | 3 | 4;
      events: ScoreEvent[];
    }>;
  }>;
}
```
   - If pasted into a single staff, only `staffOffset === 0` is applied.
   - If pasted with multi-staff selection, all matching target staves receive their respective voice streams.

---

### (h) Performance Plan: H1 Baseline and Budgets

#### Measured H1 Performance Baseline (Production & Node Benchmark)
- **Node Command Execution (64 full-featured measures):** median = 0.48 ms, p95 = 0.90 ms.
- **Node Layout Execution (`layoutScore` single-edit):**
  - 64 measures: median = 0.72 ms, p95 = 1.32 ms.
  - 200 measures: median = 1.09 ms, p95 = 3.20 ms (Target: < 5.0 ms).
  - 400 measures: median = 1.93 ms, p95 = 6.73 ms (Target: < 5.0 ms median).
- **Browser Keystroke-to-Paint (Chromium, Production Build, n = 50):**
  - 64-measure full-featured (Double rAF / Next Paint): Median = 12.10 ms, p95 = 17.60 ms (Target: < 25 ms).
  - 200-measure full-featured (Double rAF / Next Paint): Median = 26.30 ms, p95 = 32.20 ms (Target: < 30 ms).

#### Multi-Staff Performance Budgets for Milestone 7 and Milestone 8
1. **Single-Staff Measure Layout (Stage 1):** Budget <= 0.02 ms per measure on cache hit; <= 0.25 ms on miss.
2. **Cross-Staff Alignment (Stage 2):** Budget <= 0.50 ms for 200 measures across 4 staves.
3. **System Construction & Cache (Stage 5):**
   - Untouched systems must achieve 100% cache hits via `systemLayoutCache`.
   - Budget for 50 systems (200 measures) with 1 edited measure <= 2.5 ms.
4. **Keystroke-to-Paint Budget:**
   - 2-staff piano score (100 measures, 200 measure-staves): p95 <= 30 ms.
   - 4-staff quartet score (50 measures, 200 measure-staves): p95 <= 35 ms.

---

### (i) Test & Corpus Plan: Milestone Verification Corpus

To guarantee real-world musicological fidelity, Milestone 7, 8, and 10 verification is anchored against the lead's designated corpus representing every structural archetype:

1. **J.S. Bach — Chorale "Wachet auf, ruft uns die Stimme", BWV 140 closing chorale (SATB) (Milestone 7a):**
   - *Test Role:* 4-part homophonic choral texture, independent vocal staves with German lyrics, bracket grouping, individual barlines (unbroken between staves for lyrics clearance), fermatas.
2. **J. Brahms — Intermezzo in A major, Op. 118 No. 2, mm. 1-8 (Milestone 7a):**
   - *Test Role:* Polyphonic voice leading on single and two staves (melody + inner voices with opposing stems), complex cross-rhythms, hairpins, pedal markings.
3. **J.S. Bach — Invention No. 1 in C major, BWV 772, mm. 1-8 (Milestone 7b):**
   - *Test Role:* Two-staff grand staff contrapuntal two-part polyphony, cross-staff thematic imitation, 16th-note beam groups, treble and bass clef cross-staff alignment.
4. **W.A. Mozart — Piano Sonata in C major, K. 545, 1st Mvt, mm. 1-8 (Milestone 7b):**
   - *Test Role:* Two-staff grand staff with melody and Alberti bass accompaniment, classical phrasing, long legato slurs, dynamics (p, f).
5. **F. Chopin — Prelude in E minor, Op. 28 No. 4, mm. 1-12 (Milestone 7b):**
   - *Test Role:* Two-staff grand staff with expressive polyphonic voice leading in left hand (chords with independent descending tenor/bass lines), dense chromatic accidentals, tempo rubato text.
6. **Claude Debussy — "Golliwogg's Cakewalk" from Children's Corner, mm. 1-8 (Milestone 7c):**
   - *Test Role:* Multi-staff syncopations, sudden dynamic shifts (fp, sfz), staccato accents, mid-score key signature changes (E-flat major to G-flat major with natural cancellations).
7. **F. Schubert — "An die Musik", D. 547, mm. 1-12 (Milestone 7c):**
   - *Test Role:* Mixed ensemble: 1 single vocal staff (bracket none, individual barline, German lyrics) above a 2-staff piano accompaniment (curly brace, through-barlines).
8. **L. van Beethoven — String Quartet No. 1 in F major, Op. 18 No. 1, 1st Mvt, mm. 1-8 (Milestone 10):**
   - *Test Role:* Chamber bracket, alto C-clef for viola, through-barlines connecting all 4 staves, extreme dynamic contrasts. Note: C clefs (alto, tenor) are scoped strictly to Milestone 10.
9. **Turkish Folk Song (to be chosen by the human):**
   - *Test Role:* Traditional Turkish makam/folk song scoring with Turkish lyrics, solfege syllables, regional meters and vocal ornaments.

---

### (j) Risks and Architectural Alternatives

#### Risk 1: Cross-Staff Beam Complexity and Collision
- *Problem:* Liszt/Chopin piano passages where a single beam group starts in the bass staff and continues into the treble staff.
- *Alternative A:* Implement full cross-staff beam physics in M7. (Rejected: huge scope risk, delays core multi-staff delivery).
- *Alternative B (Recommended):* Reserve `crossStaffTarget?: Id` in NoteEvent schema; keep beam generation strictly intra-staff in M7. Deliver cross-staff beam routing in Milestone 10.

#### Risk 2: Full-Page Reflow Layout Freezes
- *Problem:* Editing measure 1 of a 40-page orchestral score causes page reflow across all 40 pages, exceeding the 30 ms budget.
- *Alternative A:* Recompute all 40 pages on every keystroke. (Rejected: scales as O(pages), p95 > 120 ms).
- *Alternative B (Recommended):* Page-level memoization. System breaking is O(N) integer math. Pages before the edited measure are untouched; pages after are re-paginated using cached system heights.

#### Risk 3: Barline Collisions with Lyrics
- *Problem:* Choral music requires barlines to stop at the bottom line of the staff so they do not cut through the lyrics between staves.
- *Alternative A:* Let barlines cut through text with white SVG backgrounds. (Rejected: amateurish typography, violates Henle/Bärenreiter engraving standards).
- *Alternative B (Recommended):* Dedicated `barlineSpan: 'individual'` for vocal parts and `barlineSpan: 'through'` for instrumental groups.

---

### (k) Sub-Milestone Breakdown and Exit Criteria

#### Milestone 7a: Multi-Voice Polyphony on a Single Staff
- **Deliverables:** Rule R3 compliance (`voiceIndex` 1..4), opposing stems, unison notehead sharing, independent voice beaming, voice switching keymap (`Tab`, `Shift+Tab`).
- **Exit Criteria:**
  - Invention BWV 772 right-hand 2-voice passage renders with zero stem collisions.
  - Test suite verifies clean copy/paste of individual voices.
  - Single-note edit latency <= 15 ms on 64 measures.
  - **Performance Exit Gate:** 200-measure single-staff keystroke-to-paint p95 < 30 ms (Double rAF and Event Timing API).
  - **Multi-Staff Target:** 4-staff x 64-measure keystroke-to-paint p95 < 35 ms (Double rAF and Event Timing API).

#### Milestone 7b: Two-Staff Grand Staff (Piano)
- **Deliverables:** `Score.parts[0]` holding 2 staves (Treble + Bass), curly brace at system start, synchronized cross-staff tick columns, through-barlines.
- **Exit Criteria:**
  - Mozart K. 545 full 1st movement renders across systems with perfect vertical beat alignment between melody and Alberti bass.
  - All barlines connect both staves with zero visual gap.

#### Milestone 7c: Multi-Part Ensembles (Choir & String Quartet)
- **Deliverables:** Up to 4 parts, part names and shortNames with system 1 indent, instrument brackets, barline grouping rules (`through` vs `individual`), multi-track audio routing.
- **Exit Criteria:**
  - Beethoven Op. 18 No. 1 (4 staves) and Bach BWV 140 (SATB) render accurately.
  - Web Audio player routes each part to dedicated synth channel.

#### Milestone 7d: Milestone 7 Hardening & Polish
- **Deliverables:** Regression gallery expansion (multi-voice, piano, quartet cards), golden snapshot updates, sub-30ms performance verification on 200 measure-staves.
- **Exit Criteria:**
  - 100% test pass rate across all test suites.
  - `npm run check` clean with zero lint or knip warnings.

---

## 3. Lead Decisions Recorded

1. **Last Page Ragged Rule (< 70%):**
   - The final page of a score or piece is justified only if its content width exceeds 70% of the printable width; otherwise, systems remain left-aligned to prevent grotesque horizontal note stretching.
2. **Instrument Templates with Bracket & Barline Rules:**
   - Standard templates (`piano`, `satb`, `string_quartet`, `lead_sheet`, `solo_instrument`) pre-populate default clefs, bracket types (`brace` vs `bracket`), and barline spans (`through` vs `individual`).
3. **Part Names and System 1 Indent:**
   - System 1 reserves an indent (default 12 to 18 sp) on the left to render full instrument names (e.g. "Violino I", "Pianoforte").
   - Subsequent systems render abbreviated names (`shortName`, e.g. "Vl. I", "Pno.") in a compact margin indent (6 to 8 sp).
4. **Deferred to Milestone 13+: Page-Turn Hints:**
   - Visual page-turn hints on rests at the bottom of odd-numbered pages are deferred to Milestone 13+ (no page-turn hints in M7/M8).
5. **Cross-Staff Display Property Reserved for M10:**
   - Schema v7 reserves `crossStaffTarget?: Id` in NoteEvent without enabling rendering until M10.
6. **Part Extraction Deferred to M11:**
   - Conductor score editing is the primary focus of M7/M8. Extracting isolated instrumental parts into independent `.sfscore` files is scheduled for M11.
7. **C Clefs (Alto & Tenor) Scoped to M10:**
   - C clefs for viola and cello tenor passages are scoped strictly to Milestone 10. M7 supports G clef (treble) and F clef (bass).

---

## 4. Open Questions for the Human

*(No implementation will proceed on these until explicitly directed by the user)*

1. **System Name Indent:** Should abbreviated instrument names on systems after the first be enabled by default for 2-staff piano scores, or only for multi-part ensemble scores (>= 2 parts)?
2. **Lyric Syllable Collisions Across Staves:** For SATB choral scores with text under each of the 4 staves, what is your preferred minimum vertical clearance between the bottom of a lyric syllable and the top line of the next staff down (recommended: `2.5 sp`)?
3. **Keyboard Shortcut for Staff Switching:** Is `BracketLeft` (`[`) and `BracketRight` (`]`) acceptable for moving the input cursor between staves, or do you prefer a dedicated modal key combination (e.g. `Ctrl+Alt+ArrowUp` / `Ctrl+Alt+ArrowDown`)?
