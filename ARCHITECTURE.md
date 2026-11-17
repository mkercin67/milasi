# ScoreForge — Architecture

Goal: a web-based music notation editor (later packaged for desktop with Tauri) that matches what
academics value in Finale: full manual control over every element, contemporary notation support,
microtonal pitch, scripting, and publication-quality engraving. Free and open source.

## Design principles (do not violate)

1. **Manual control first.** Every visual element can be overridden by the user. Automatic layout
   is a default, never a lock.
2. **Core is UI-independent.** `src/core` must run in plain Node with no DOM, no React.
3. **The score is plain serializable data.** No classes with hidden state, no functions inside the
   model. `JSON.stringify(score)` must round-trip.
4. **Every user change is a Command.** Undo/redo works because of this. No direct mutation.
5. **Microtonal-ready from day one.** Pitch alteration is a number (semitones), not an enum.
6. **Scriptable.** Anything the UI can do must be possible through a public API (later: `src/api`).
7. **Localization from day one.** The code, comments, file names and docs are in English, but
   every string the user sees comes from a translation file. Default UI language is **Turkish
   (`tr`)**; English (`en`) is the second language. Hard-coded user-visible strings are a bug.
8. **Units:** layout coordinates are in *staff spaces* (1 unit = distance between two staff lines).
   Conversion to pixels happens only in the renderer.
9. **Zero DOM layout reads in handlers:** Event handlers never query `getBoundingClientRect`,
   `clientWidth`, or computed styles during pointer or keyboard interactions.

## Permanent Rules (R1 - R3)

- **R1. Canonical Test Data Creation:** Tests must create their data through the exact SAME path the app uses (`NewScoreModal` / `createEmptyScore` / real keystrokes / commands), never through hand-built fixtures that differ from runtime behavior. Multi-measure and multi-system cases are mandatory for anything that spans or moves across measures.
- **R2. Synchronous State Reference & Anti-Stale-Closures:** Keyboard, pointer, and clipboard handlers read state through a single source: a ref updated synchronously on every state change (`stateRef.current`), or a reducer with `getState()`. No handler may capture state in a closure that can go stale across async boundaries or between React re-renders.
- **R3. Stable Voice Identity:** Voice identity in the model is a stable `voiceIndex` (1..4) per staff, identical across measures. While random UUIDs exist on measure-local `voice.id`, cross-measure algorithms (range selection, transposition, deletion, copy/paste, and playback voice matching) compare and preserve `voiceIndex`, never comparing random UUIDs across measures.

## Tech stack

- TypeScript (strict), Vite, React 18, Vitest, immer (immutable state updates with structural sharing).
- Rendering: Custom SVG renderer using embedded **Bravura** SMuFL vector glyph paths (`glyphPaths.generated.ts`) with `<use href="...">` symbols for high-performance zero-FOUC rendering.
- Playback: Tone.js (encapsulated via `AudioEngine` interface; `FakeEngine` for deterministic headless testing).
- Boundaries: Single package enforced by folder structure, strict import rules (`scripts/checkImports.mjs`), and strict license audit (`scripts/checkLicenses.mjs`).
- Modular File Size Limit: Every file in `src/` must remain strictly under 600 lines of code.

## Folder layout and import rules

```
src/
  core/      data model, factory, commands, selection, clipboard imports: nothing from this project
  layout/    Score -> LayoutResult (staff spaces), beams, cache  imports: core
  render/    LayoutResult -> SVG, glyph paths                    imports: layout, core
  playback/  Score -> schedule, AudioEngine, Player              imports: core
  io/        JSON load/save, schema validation, IndexedDB        imports: core
  ui/        React app, tools, hooks, keyboard/pointer handling  imports: everything above
  ui/i18n/   t(key) function, locales/tr.json, locales/en.json   standalone
tests/       mirrors src/ structure
```

Folder boundary import rules are automatically verified in CI via `node scripts/checkImports.mjs`. Violating an import rule fails the build.

## Data model (src/core/model.ts)

Time is measured in integer **ticks**. `PPQ = 960` (ticks per quarter note). Never use floats for time.

```ts
type Id = string; // uuid

interface Score {
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6;
  id: Id;
  meta: {
    title: string;
    composer: string;
    subtitle?: string;
    arranger?: string;
  };
  parts: Part[];
  measures: MeasureDef[];            // global measure definitions
  overrides: Record<Id, Override>;   // manual layout overrides keyed by element id
}

interface VoltaDef {
  number: number;                    // 1 for 1st ending, 2 for 2nd ending
  text?: string;                     // e.g. "1.", "2."
}

interface MeasureDef {
  id: Id;
  timeSig: { num: number; den: number };
  keySig: number;                    // -7..7 circle of fifths
  tempo?: {
    bpm: number;
    beatUnit: number;
    tempoText?: string;
  };
  actualTicks?: number;              // pickup/anacrusis measure duration in ticks
  endBarline?: 'single' | 'double' | 'final';
  repeatStart?: boolean;             // Milestone 6d repeat start (|:)
  repeatEnd?: boolean;               // Milestone 6d repeat end (:|)
  volta?: VoltaDef;                  // Milestone 6d 1st / 2nd ending bracket
}

interface Part { id: Id; name: string; staves: Staff[]; instrument: string }
interface Staff {
  id: Id;
  clef: Clef;
  measures: Record<Id, StaffMeasure>;
  slurs?: Slur[];                    // M6b staff-level slur collection
}

interface Slur {
  id: Id;
  startEventId: Id;
  endEventId: Id;
  placement?: 'above' | 'below';
}

interface StaffMeasure { voices: Voice[] }
interface Voice { id: Id; events: ScoreEvent[] }

type ScoreEvent = NoteEvent | RestEvent;

interface BaseEvent {
  id: Id;
  duration: number;                  // ticks, includes dots and tuplet scaling
  baseType: 'whole'|'half'|'quarter'|'eighth'|'16th'|'32nd';
  dots: number;
  tuplet?: { actual: number; normal: number };
}

interface LyricSyllable {
  verse: number;                     // 1-based verse number (default: 1)
  text: string;                      // Syllable text; trailing '-' connects hyphen, '_' connects extender
}

interface NoteEvent extends BaseEvent {
  kind: 'note';
  pitches: Pitch[];                  // chord = multiple pitches
  tiedToNext?: boolean;              // legacy v1 event-level tie, migrated to Pitch.tiedToNext
  articulations: string[];
  dynamic?: string;
  lyrics?: LyricSyllable[];          // Milestone 6d lyrics
}

interface RestEvent extends BaseEvent {
  kind: 'rest';
  wholeMeasure?: boolean;
}

interface Pitch {
  step: 'C'|'D'|'E'|'F'|'G'|'A'|'B';
  octave: number;
  alter: number;                     // semitones; 0, 1, -1, 0.5 (quarter tone)
  tiedToNext?: boolean;              // Pitch-level tie to matching pitch in next chord/note
}

interface Override {
  dx?: number;                       // staff spaces horizontal offset
  dy?: number;                       // staff spaces vertical offset
  scale?: number;
  hidden?: boolean;
}
```

## Modular Architecture & Subsystem Decomposition

To ensure long-term maintainability, single-responsibility separation, and adherence to the < 600 line limit, major subsystems are decomposed into cohesive modules:

### 1. UI Shell & Application Core (`src/ui/app/`)
- `App.tsx`: Top-level orchestrator under 600 lines.
- `useAppKeyboard.ts`: Complete physical key mapping router using `event.code`.
- `useAppPlayback.ts`: Audio engine connection, transport controls, and playhead synchronization.
- `useAppStorage.ts`: File opening/saving, export, and rolling 5-version autosave recovery.
- `useAppScoreActions.ts`: Measure insertion, tempo, key signature, and modal action dispatches.
- `useAppVerificationStates.ts`: Verification harness exposing test hooks (`window.__editorTestHooks`).
- `AppModals.tsx`: Central modal container.
- `modals/ConfirmModals.tsx`: Confirm/alert dialogs.

### 2. ScoreView & DOM System Virtualization (`src/ui/scoreView/`)
- `ScoreView.tsx`: Main view container with scroll sync.
- `useScoreVirtualization.ts`: Viewport culling engine. Tracks scroll position and container bounds to compute `visibleSystemIndices` with a 1-system buffer above and below.
- `ScoreSvgLayers.tsx`: Pure SVG layer compositor for systems, staves, barlines, headers, and highlights. Offscreen systems are culled, reducing DOM nodes from > 6,000 to < 800 for 200-measure scores.
- `ScoreInteractionOverlays.tsx`: Marquee selection rubberband, note input ghost note, and position drag overlays.
- `ScoreViewLyricsInput.tsx`: In-place lyrics text input aligned to notes.

### 3. Core Commands Subsystem (`src/core/commands/`)
- `commands.ts`: Command dispatcher and undo/redo history manager.
- `noteCommands.ts`: Note/rest insertion, pitch alteration, accidentals, duration changes, and tuplets.
- `selectionCommands.ts`: Range transpose, deletion, rest conversion, and voice switching.
- `measureCommands.ts`: Measure addition, deletion, pickup measure settings, and barlines.
- `notationCommands.ts`: Dynamics, articulations, ties, slurs, repeat markers, and voltas.

### 4. Layout & Beam Algorithms (`src/layout/`)
- `layoutScore.ts`: Pure score layout coordinator.
- `systems/systemBreakPlanner.ts`: Measure line-breaking and content width distribution.
- `systems/systemLayoutPass.ts`: Vertical system placement, staff baselines, and coordinate translation.
- `beams/beamGrouping.ts`: Metrical beam grouping across measures.
- `beams/beamSlope.ts`: SMuFL-standard beam slope calculation and collision checks.
- `notations.ts`: Dynamic markings, articulation stacking, and bezier slur curves.
- `ties.ts`: Multi-measure and cross-system split tie crescent paths.

## Resilience & Error Recovery Model

### 1. Application Error Boundary (`src/ui/ErrorBoundary.tsx`)
- Wraps the core editing canvas (`ScoreView`).
- If an unhandled React error occurs during rendering or layout:
  1. Catches the error and logs it to the rolling error buffer.
  2. Displays an emergency recovery screen with 3 non-destructive recovery actions:
     - **Son otomatik kaydı geri yükle:** Restores the most recent valid IndexedDB autosave snapshot.
     - **Mevcut eseri dosya olarak indir:** Downloads an emergency `.sfscore` JSON backup of the current state directly to disk.
     - **Hata raporunu kopyala:** Copies the error message, stack trace, and recent error ring buffer entries to clipboard.

### 2. Rolling 5-Version Autosave (`src/io/storage.ts`)
- Automatically saves scores to IndexedDB store `scoreforge_autosaves`.
- Maintains a rolling history of the last 5 autosaves with timestamps and measure counts.
- `loadAutosave()` fetches the latest snapshot; `loadAutosaveHistory()` allows rollback to earlier snapshots.
- Debounced at 1.0 second; non-blocking.

### 3. Global Error Ring Buffer (`window.__errorLog`)
- Fixed-capacity circular buffer retaining the last 50 error and warning events.
- Automatically hooks `window.onerror` and `window.onunhandledrejection`.
- Available programmatically for diagnostic triage and user bug reporting.

## Interaction Model: Three Explicit Modes

The editor state operates in three strictly separated modes (`state.mode`):

1. **Select Mode (`mode: 'select'`):**
   - Click note/rest: selects the event.
   - Click empty staff space: clears selection, places caret.
   - Vertical pointer drag on note/chord: changes pitch live in 0.5-space steps with visual ledger lines and status bar target pitch; commits one `changePitch` command on release. Horizontal movement is ignored.
   - Drag on rest: selects only (no pitch change).
   - Keys: `ArrowUp`/`ArrowDown` (semitone transpose), `Ctrl+Up`/`Down` (octave transpose), `Left`/`Right` (event navigation), `Delete` (convert to rest), `Space` (play/pause).
   - Shortcut to activate: `KeyV` or `Escape`.

2. **Note Input Mode (`mode: 'input'`):**
   - Pointer hover: shows ghost note snapped to diatonic pitch (hidden outside staff area).
   - Click on staff or note: enters note with active duration and pitch.
   - Keys: letters `A`–`G` enter pitch at cursor; `Digit1`–`5` set duration; `Digit0` enters rest; `Period` toggles dot; `ArrowLeft`/`Right` moves caret.
   - Shortcut to toggle: `KeyN`.

3. **Position Mode (`mode: 'position'`):**
   - Fine engraving adjustments for manual layout overrides (`score.overrides[id]`).
   - Drag or arrow keys nudge visual position (`dx` / `dy`).
   - Offset limits:
     - Notes/chords: `dy` is locked to 0 (pitch defines vertical position; vertical offset is rejected with warning); `dx` is clamped within its measure boundary.
     - Rests: `dx` is clamped within measure; `dy` is clamped to staff bounds (-4.0 to +4.0 staff spaces).
   - Shortcut to toggle: `KeyP`.

## Selection & Clipboard Model

- **Selection Model (`src/core/selection.ts`):**
  - `{ kind: 'none' } | { kind: 'event', id } | { kind: 'range', staffId, voiceId, anchorId, focusId }`.
  - Contiguous event run within voice across measures resolved via `eventsInRange(score, range)`.
  - Selection extension via `extendRange(score, selection, direction)`.
  - Handlers read state synchronously via refs (R2 anti-stale-closure rule).
- **Clipboard (`src/core/clipboard.ts`):**
  - Payloads serialized with `{ app: 'scoreforge-clip', version: 1, events }`.
  - `pasteEvents` splits pasted events across barlines into standard units with ties and preserves measure durations.
- **Voice Index Rule (R3):**
  - Voice continuity across barlines relies on stable `voiceIndex` (1..4) within `StaffMeasure.voices`, not measure-local voice UUIDs.

## File Format & Schema Migrations (v1 through v6)

- **Schema Versions & Chained Migrations:**
  - `schemaVersion: 6`: Repeats (`repeatStart`, `repeatEnd`), 1st/2nd ending voltas (`volta`), and lyrics (`lyrics`).
  - `schemaVersion: 5`: Pickup measures (`actualTicks`), mid-score time/key signatures.
  - `schemaVersion: 4`: Header metadata (`subtitle`, `arranger`), tempo markings.
  - `schemaVersion: 3`: Staff-level slurs (`Staff.slurs`) and per-event dynamics / articulations.
  - `schemaVersion: 2`: Per-pitch ties (`Pitch.tiedToNext`).
  - `schemaVersion: 1`: Legacy event-level ties (`NoteEvent.tiedToNext`).
  - Automatic sequential migration: `v1 -> v2 -> v3 -> v4 -> v5 -> v6` on file load.
- **Native Format (`.sfscore`):**
  ```json
  {
    "app": "scoreforge",
    "savedAt": "2026-11-17T12:00:00.000Z",
    "score": { "schemaVersion": 6, ... }
  }
  ```
  - Backward compatible: `deserializeScore` accepts both enveloped and bare JSON for all schema versions.
  - Validated with `validateScore` on load.

## Performance Benchmarks & Targets (H1 Hardening)

- **Production Keystroke-to-Paint Budget:**
  - 64-measure full score: p50 = 3.9 ms, p95 = 5.2 ms (Target: < 25 ms).
  - 200-measure full score: p50 = 4.1 ms, p95 = 5.4 ms (Target: < 40 ms).
- **DOM Virtualization:**
  - Maintains < 800 SVG DOM elements for 200-measure scores by rendering only visible systems plus a 1-system vertical buffer.
- **Zero DOM Reads:** All layout computations and interactive feedback are calculated purely in memory without reading layout properties or calling browser DOM measuring.
