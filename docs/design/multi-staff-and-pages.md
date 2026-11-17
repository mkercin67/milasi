# Architectural Design Document: Multi-Staff and Pagination (Milestone M7 / M8 Preview)

**Document Status:** DRAFT / PROPOSAL  
**Target Versions:** Schema v7, Milestones M7 (Multi-Staff & Instruments) and M8 (Pagination & Print)  
**Author:** ScoreForge Core Engineering  
**Scope:** Architectural blueprint, data model extensions, layout algorithms, cursor/selection dynamics, audio routing, performance budgets, and migration strategy. No runtime implementation is introduced in H1.

---

## 1. Overview and Design Objectives

ScoreForge currently operates on a single-staff, continuous vertically stacked system layout (one staff per system, single page container with virtualized system rendering). Milestones M7 and M8 will introduce:
1. **Multi-Staff Scoring:** Scores with multiple staves per system (e.g. Piano Grand Staff with brace, SATB choir with bracket, chamber ensembles, lead sheets with chord/vocal staves).
2. **Page Pagination:** Discrete page layouts (A4, US Letter, Custom), margins, running headers/footers, explicit system and page break markers, and print-ready SVG exports.

The design principles established in M1-H1 remain invariant:
- **Single Source of Truth:** Immutable score state managed with Immer.
- **Pure Layout Calculations:** Layout functions remain pure, deterministic, and isolated from React and DOM measurements.
- **Sub-40ms Keystroke Budget:** Full score keystroke-to-paint budget must remain under 40 ms on modern hardware for 4 staves × 100 measures (400 measure-staves).
- **Stable Voice Identity:** Rule R3 (`voiceIndex` 1..4 per staff) is strictly maintained across all staves.

---

## 2. Multi-Staff Data Model Extensions

### 2.1 Staves and Instrument Hierarchy

Currently:
```typescript
interface Score {
  id: string;
  schemaVersion: 6;
  meta: ScoreMeta;
  settings: ScoreSettings;
  measures: Measure[]; // Currently assumes 1 staff
}
```

Proposed Schema v7 Extension:
```typescript
interface InstrumentDef {
  id: string;
  name: string;
  shortName: string;
  staves: StaffDef[];
  bracket?: 'brace' | 'bracket' | 'none';
  barlineSpan?: 'through' | 'mensur' | 'individual'; // Whether barlines connect staves
  midiPatch?: number; // GM instrument number (0..127)
  pan?: number; // -1.0 (left) to +1.0 (right)
  volume?: number; // 0.0 to 1.0
}

interface StaffDef {
  id: string; // Stable UUID
  staffIndex: number; // 0-based ordering within system (0 = top)
  defaultClef: ClefType;
  lines: number; // 5 for standard, 1 for percussion
  tuning?: string[]; // For tablature / string instruments
}

interface Measure {
  index: number;
  timeSignature?: TimeSignature;
  keySignature?: KeySignature;
  staves: MeasureStaff[]; // Multi-staff container per measure
  // Global measure properties
  repeatStart?: boolean;
  repeatEnd?: boolean;
  volta?: VoltaDef;
  pageBreak?: boolean;   // Explicit page break after this measure
  systemBreak?: boolean; // Explicit system break after this measure
}

interface MeasureStaff {
  staffIndex: number;
  clef?: ClefType; // In-measure clef changes
  voices: Voice[]; // Rule R3: voiceIndex 1..4 per staff
}
```

### 2.2 System Groupings, Brackets, and Barlines Across Staves

- **System Brackets & Braces:**
  - `brace`: Curly brace grouping staves of a single polyphonic instrument (e.g. Piano, Harp, Organ manual).
  - `bracket`: Square bracket with wings grouping families of instruments (e.g. Violins I & II, SATB).
  - `sub-bracket`: Nested thin line grouping identical instruments inside an orchestral section.
- **Barline Connections:**
  - `through`: Continuous barline spanning from the top line of the top staff to the bottom line of the bottom staff (standard for piano grand staff and chamber groupings).
  - `mensur`: Barlines drawn only in the space between staves, leaving staff interiors open (Renaissance / early music notation).
  - `individual`: Barlines broken between staves (standard for vocal and choral scores so text and syllables remain unobstructed).
- **Barline Types:** Normal, double, repeat-start, repeat-end, repeat-both, and final barlines continue to apply synchronously across the entire system height.

---

## 3. Pagination Model

### 3.1 Page Dimensions and Page Layout Hierarchy

Pages are represented as geometric containers:
```typescript
interface PageLayout {
  pageIndex: number; // 0-based
  width: number;     // e.g. 794 px (A4 @ 96 DPI: 210mm x 297mm = 794 x 1123)
  height: number;    // e.g. 1123 px
  margins: {
    top: number;     // e.g. 56 px (15mm)
    bottom: number;  // e.g. 56 px (15mm)
    inner: number;   // e.g. 75 px (20mm, left on recto, right on verso)
    outer: number;   // e.g. 56 px (15mm)
  };
  contentBounds: { x: number; y: number; width: number; height: number };
  systems: SystemLayout[]; // Systems placed on this page
  pageNumber: number; // 1-based display number
  headerText?: { left?: string; center?: string; right?: string };
  footerText?: { left?: string; center?: string; right?: string };
}
```

### 3.2 Header, Footer, and First-Page Handling
- **First Page:**
  - Top margin contains the Score Header Block (Title, Subtitle, Composer, Arranger).
  - Suppresses running header and displays no top page number.
  - Dedicates remaining vertical space to systems.
- **Subsequent Pages:**
  - Running header at `margins.top - 20px`: Left = Title/Movement, Right = Page number (or reversed for verso/recto book layout).
  - Running footer at `height - margins.bottom + 20px`: Centered copyright notice.
- **Page Breaks:**
  - Soft Page Breaks: Calculated automatically by the vertical layout pass when adding the next system would violate `margins.bottom`.
  - Hard Page Breaks: Triggered by user `pageBreak: true` on a measure.

---

## 4. Multi-Staff Layout Algorithm

The layout algorithm operates in three pure, sequential stages:

### Stage 1: Horizontal Measure Sizing & Voice Alignment
1. **Synchronized Beat Anchors:**
   - For measure `m`, gather all event timestamps across all staves and all active voices.
   - Compute global beat tick columns within the measure (e.g. beat 0, 0.5, 1.0, 1.5, ...).
   - Ensure the horizontal width `W_m` of measure `m` accommodates the widest voice/staff event spacing and accidental clusters across any staff in that measure.
2. **System Breaking (Horizontal Line Breaking):**
   - Greedy break with Knuth-Plass style optimal paragraph balancing across lines.
   - Systems are created with uniform content width `W_content`.
   - Justify measures within each system by expanding spring spacers between note columns.

### Stage 2: Vertical Staff and System Placement
1. **Intra-System Staff Spacing:**
   - Standard staff spacing: Distance between staff reference baselines $D_{staff} = 64\text{ px}$ (8 staff spaces of 8 px).
   - Collision avoidance expansion:
     - Compute top boundary bounding box for staff $i+1$ (high notes, ledger lines, stem-up notes, dynamics above, lyrics above).
     - Compute bottom boundary bounding box for staff $i$ (low notes, ledger lines, stem-down notes, lyrics below, pedal lines).
     - If clearance $< 16\text{ px}$ (2 staff spaces), push staff $i+1$ downward dynamically.
2. **System Height Calculation:**
   $$\text{SystemHeight} = \text{TopStaffPadding} + \sum_{i=0}^{S-2} D_{\text{staff}, i} + 32\text{ px (bottom staff)} + \text{SystemLyricsAndDynamics}$$
3. **Inter-System Vertical Justification:**
   - Minimum system gap: $32\text{ px}$ (4 staff spaces).
   - If a page has remaining vertical slack and contains $\ge 2$ systems, distribute remaining space evenly between systems up to a maximum justification ratio of 1.3× (otherwise leave page bottom open on the final page).

### Stage 3: Rendering & System Virtualization
- Each system calculates its absolute page coordinates `(pageIndex, x, y)`.
- The Virtualized DOM renderer maps visible viewport rectangles to intersecting `(pageIndex, systemIndex)` tuples.
- Offscreen systems on offscreen pages render zero DOM nodes.

---

## 5. Multi-Staff Selection and Cursor Model

### 5.1 Cursor Coordinates
The single-staff cursor `(measureIndex, voiceIndex, noteIndex)` is extended to:
```typescript
interface CursorLocation {
  staffIndex: number;   // 0 = top staff, 1 = bottom staff in grand staff
  measureIndex: number; // 0..measures.length - 1
  voiceIndex: number;   // 1..4 (Rule R3)
  eventIndex: number;   // 0..events.length - 1
  tickOffset: number;   // Musical time position in ticks from measure start
}
```

### 5.2 Navigation Semantics
- `ArrowLeft` / `ArrowRight`: Moves to previous/next note within current staff. At measure boundaries, advances across barlines within the same staff.
- `ArrowUp` / `ArrowDown` (in Navigation Mode):
  - Transposition (when notes are selected).
  - Staff jumping: `Alt+ArrowUp` / `Alt+ArrowDown` moves cursor to the identical musical tick on the staff above/below.
- `Tab` / `Shift+Tab`: Cycles through active voices (1 -> 2 -> 3 -> 4) or staves.

### 5.3 Multi-Staff Selection
- **Range Selection:**
  - Defined as a rectangular span: `(startStaffIndex, startMeasure, startTick)` to `(endStaffIndex, endMeasure, endTick)`.
  - Highlight overlay renders bounding boxes across staves within the selected time window.
- **Copy / Cut / Paste:**
  - Clipboard serializes multi-staff slices with explicit `staffOffset`.
  - Pasting onto a single staff pastes staff 0 of the clipboard; pasting onto a grand staff maps matching source staves to target staves.

---

## 6. Multi-Staff Playback Routing

### 6.1 Audio Architecture with Tone.js
- **Synthesizer Allocation:**
  - Dedicated `Tone.PolySynth` instance per staff (or per instrument channel).
  - Prevents voice stealing between bass and treble staves in piano music.
- **Instrument Mapping:**
  - Treble Staff (Staff 0): Acoustic Grand Piano (Bright), Pan = -0.15.
  - Bass Staff (Staff 1): Acoustic Grand Piano (Warm), Pan = +0.15.
  - Multi-Instrument Ensemble: Separate PolySynth with GM sound presets, separate GainNode and PannerNode per instrument.
- **Lookahead Scheduling:**
  - Preserves ScoreForge's existing 100ms lookahead audio loop (`playbackEngine.ts`).
  - Iterates through all staves in the current measure slice and schedules note events synchronously with fractional microsecond accuracy.

---

## 7. Performance Budget: 4 Staves × 100 Measures

### 7.1 Quantitative Budget Targets (Production Build)
- Total Score Volume: 4 staves × 100 measures = 400 measure-staves (~1,600 notes).
- Keystroke-to-Paint Budget: $\le 40\text{ ms}$ (p95).
- Background Full Layout Budget: $\le 60\text{ ms}$ (p95).
- Memory Overhead: $\le 35\text{ MB}$ heap allocation for layout cache and SVG elements.

### 7.2 Architectural Strategies to Meet the Budget
1. **Two-Tier Layout Invalidation:**
   - Tier 1 (Local): Editing a note in Staff 1, Measure 42 only recalculates the horizontal beat column widths of Measure 42.
   - Tier 2 (System Reflow): Only reflows systems downstream if Measure 42 width changes by $> 4\text{ px}$.
2. **DOM Virtualization:**
   - 100 measures across 4 staves produces ~25 multi-staff systems (~8 pages).
   - Only 2 to 3 systems are in the viewport at any time (~12 staves total).
   - DOM node count is capped under 800 SVG nodes regardless of score length.
3. **No DOM Measuring:**
   - All text widths (lyrics, tempo, staff labels, titles) use deterministic width lookup tables and character-advance estimates.

---

## 8. Schema Migration Path (v6 -> v7)

### 8.1 Migration Logic
- All existing v1..v6 scores have a single implicit staff.
- When loading a schema v6 document:
  1. Inspect `score.schemaVersion`. If $< 7$, run `migrateV6ToV7(score)`.
  2. Synthesize default instrument:
     ```typescript
     instruments: [{
       id: 'inst-1',
       name: 'Parti 1',
       shortName: 'P1',
       staves: [{ id: 'staff-1', staffIndex: 0, defaultClef: 'treble', lines: 5 }]
     }]
     ```
  3. Wrap existing `measure.voices` into `measure.staves[0].voices`.
  4. Retain all existing measure-level properties (`repeatStart`, `repeatEnd`, `volta`, `lyrics`, `keySignature`, `timeSignature`).
  5. Upgrade `schemaVersion` to 7.
- Complete round-trip serialization and golden snapshot tests verify that zero musical data is altered during migration.

---

## 9. Open Questions and Tradeoffs

1. **Cross-Staff Beaming:**
   - *Question:* Should notes in piano music be allowed to beam across staves (e.g. left hand notes beamed into right hand staff)?
   - *Recommendation for M7:* Defer cross-staff beams to M7b; initial M7 will confine beams to a single staff.
2. **Collision Resolution vs Layout Speed:**
   - *Question:* Should vertical staff spacing use continuous quadratic programming (like LilyPond / Gould) or segmented bounding box bounding?
   - *Recommendation:* Segmented bounding box bounding (horizontal slices per measure). It runs in $O(M)$ time and meets the sub-40ms performance budget.
3. **Continuous Scrolling vs Page View Toggle:**
   - *Recommendation:* Provide a user toggle between "Sürekli Akış" (Continuous single-column ribbon) and "Sayfa Görünümü" (Paginated A4/Letter sheets). Continuous view remains default for editing; Page view is used for layout polishing and printing.
