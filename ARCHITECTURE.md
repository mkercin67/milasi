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

## Tech stack

- TypeScript (strict), Vite, React (UI only), Vitest, immer (immutable updates)
- Rendering: Custom SVG renderer using embedded **Bravura** SMuFL vector glyph paths (`glyphPaths.ts`)
  with `<use href="...">` symbols for high-performance zero-FOUC rendering.
- Playback: Tone.js (encapsulated via `AudioEngine` interface; `FakeEngine` for headless testing).
- Desktop packaging later: Tauri (Phase 2).
- Boundaries: Single package enforced by folder structure and strict import rules.

## Folder layout and import rules

```
src/
  core/      data model, factory, commands, pure helpers         imports: nothing from this project
  layout/    Score -> LayoutResult (staff spaces), beams, cache  imports: core
  render/    LayoutResult -> SVG, glyph paths                    imports: layout, core
  playback/  Score -> schedule, AudioEngine, Player              imports: core
  io/        JSON load/save, schema validation, IndexedDB        imports: core
  ui/        React app, tools, hooks, keyboard/pointer handling  imports: everything above
  ui/i18n/   t(key) function, locales/tr.json, locales/en.json   standalone
tests/       mirrors src/ structure
```

Violating an import rule is a bug.

## Data model (src/core/model.ts)

Time is measured in integer **ticks**. `PPQ = 960` (ticks per quarter note). Never use floats for time.

```ts
type Id = string; // uuid

interface Score {
  schemaVersion: 1 | 2;
  id: Id;
  meta: { title: string; composer: string };
  parts: Part[];
  measures: MeasureDef[];            // global measure definitions
  overrides: Record<Id, Override>;   // manual layout overrides keyed by element id
}

interface MeasureDef {
  id: Id;
  timeSig: { num: number; den: number };
  keySig: number;                    // -7..7 circle of fifths
  tempo?: { bpm: number; beatUnit: number };
}

interface Part { id: Id; name: string; staves: Staff[]; instrument: string }
interface Staff { id: Id; clef: Clef; measures: Record<Id, StaffMeasure> }

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

interface NoteEvent extends BaseEvent {
  kind: 'note';
  pitches: Pitch[];                  // chord = multiple pitches
  tiedToNext?: boolean;              // legacy v1 event-level tie, migrated to Pitch.tiedToNext
  articulations: string[];
  dynamic?: string;
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

## Layout & Per-Measure Caching (src/layout)

- `layoutScore(score, options)` is pure and uses a **per-measure layout cache**.
- When editing a note in Measure 3, only Measure 3 is re-computed; cached system geometry and other measures are reused, maintaining sub-10ms latency on 64-measure scores.
- Beams are grouped **per measure** via `groupBeams(voiceEvents, timeSig)`:
  - Notes with baseType eighth, 16th, 32nd can be beamed.
  - Groups never cross barlines, voices, or beat boundaries (e.g. quarter-note beats in 4/4; dotted-quarter beats in 6/8).
  - Primary beam connects entire group; secondary beams connect 16th/32nd notes, with fractional stubs pointing inward.
  - Rendered as crisp SVG `<path>` polygon beams matching SMuFL standard thickness (0.5 staff spaces).

## Playback Architecture (src/playback)

- **AudioEngine Interface:** Decouples synthesis from scheduling.
  - `ToneEngine`: Wraps Tone.js `PolySynth` for real browser audio.
  - `FakeEngine`: Deterministic in-memory log of triggers for headless CI/CD.
- **Pure Schedule:** `buildSchedule(score, { fromEventId })`:
  - Translates pitches to MIDI notes and microtonal detune cents (`pitchToMidi`).
  - Converts ticks to seconds using measure tempo definitions (`tempo.bpm`, `tempo.beatUnit`).
  - Maps every event to `{ startSeconds, durationSeconds }`.
- **Player Scheduler:**
  - Lookahead scheduler running at 100 ms intervals, scheduling notes within a 1.0 s lookahead window.
  - `atSeconds` in `engine.trigger(note, atSeconds)` represents absolute audio engine clock time (`engine.now() + startSeconds`).
  - Supports pause/resume with microsecond precision, stop, tempo changes, volume, and mute.
  - Playhead tracking and visual note highlighting (`.playback-highlight`).

## Selection & Editing Model (Milestone 6a)

### 1. Selection Model (`src/core/selection.ts`)
```ts
type Selection =
  | { kind: 'none' }
  | { kind: 'event'; id: Id }
  | { kind: 'range'; staffId: Id; voiceId: Id; anchorId: Id; focusId: Id };
```
- Contiguous range selections across measures in a single voice.
- **R3 Voice Identity Rule:** Voice identity in the model is a stable `voiceIndex` (1..4) per staff. While random UUIDs exist on measure-level `voice.id`, cross-measure algorithms (range selection, transpose, delete) match by `voiceIndex` and never compare random UUIDs across measures.
- Operations:
  - `Shift+ArrowLeft/Right`: Extends range by 1 event.
  - `Shift+Click`: Extends range from anchor to clicked event.
  - Rubber-band / Marquee selection: Drags over events in select mode to select range (geometry computed from layout data without DOM reads).
  - `Ctrl+A`: Selects entire staff.
  - `Delete`/`Backspace`: Converts all selected notes in range to rests (one atomic command).
  - `ArrowUp`/`Down`, `Ctrl+ArrowUp`/`Down`: Transposes all notes in range (clamped to MIDI 21..108).

### 2. Clipboard Model (`src/core/clipboard.ts`)
- `copyRange(score, sel)` / `serializeClipboard(events)`: Pure clipboard serialization with schema validation.
- `pasteEvents(score, target, events, placedIds)`:
  - Pastes clipboard events into voice starting at target measure and tick.
  - **Barline Splitting:** Notes exceeding measure boundaries are automatically split into tied note segments matching measure durations.
  - Preserves existing downstream notes after paste insertion end.

### 3. Ties & Accidentals
- Pitch-level ties: Any pitch in a chord can be tied independently (`Pitch.tiedToNext`).
- `src/layout/ties.ts`: Generates crescent SVG `<path>` curves. When a tie crosses a system break, it splits into two half-ties:
  - First half exits to the right of system A (`x2 = measureEndX + 1.0`).
  - Second half enters from the left of system B (`x1 = clefEndX - 0.5`).
- Accidental cycling: `Shift+ArrowUp/Down` cycles through natural -> sharp -> double sharp or flat -> double flat; `KeyX` resets note to key signature default.

## File Format & Migrations (src/io)

- **Schema Versions:**
  - `schemaVersion: 1`: Initial format (M5).
  - `schemaVersion: 2`: Pitch-level ties (`Pitch.tiedToNext`), multi-measure range selections.
- **Progressive Migration:**
  - `deserializeScore` verifies `schemaVersion` and runs registered migrations sequentially (`v1 -> v2`) in a while loop:
    ```ts
    while (loadedScore.schemaVersion < CURRENT_SCHEMA_VERSION) {
      const migrator = migrations[loadedScore.schemaVersion];
      loadedScore = migrator(loadedScore);
    }
    ```
  - `migrateV1ToV2` copies legacy event-level `tiedToNext` to all pitches in the note and bumps version to 2.

## File Format & Autosave (src/io)

- **Native Format (`.sfscore`):**
  ```json
  {
    "app": "scoreforge",
    "savedAt": "2026-11-16T22:00:00.000Z",
    "score": { "schemaVersion": 1, ... }
  }
  ```
  - Backward compatible: `deserializeScore` accepts both the enveloped format and bare `Score` JSON.
  - Validated with `validateScore` on load.
- **Autosave & Recovery:**
  - Automatically saves dirty scores to IndexedDB with 1-second debounce.
  - Prompts to restore unsaved work upon crash or restart.
  - Dirty state indicator in title bar (`*`) and `beforeunload` protection.

## Localization (src/ui/i18n)

- Zero hard-coded user-facing strings; all UI strings routed through `t(key)`.
- Default language is Turkish (`tr`), with English (`en`) support.
- Correct Turkish music terminology: "Sol anahtarı", "Fa anahtarı", "Ölçü", "Diyez", "Bemol", "Bekar", "Birlik/İkilik/Dörtlük/Sekizlik/Onaltılık nota", "Es".

## Performance & Engraving Rules

- Keystroke-to-paint latency target: p95 < 50 ms on 64-measure scores.
- Zero DOM layout reads (`getBoundingClientRect`, `clientWidth`) during user interactions.
- Frame budget: 60 fps (16.6 ms per frame), zero long frames (> 50 ms) during playback and navigation.
