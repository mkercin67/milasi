# M7a-3 Design Document: Selection, Clipboard, and Editing by voiceIndex

## 1. Overview and Scope
Milestone M7a-3 establishes `voiceIndex` (1..4) as the sole identity for addressing voices in selection, range computation, clipboard operations, marquee resolution, commands, and UI state. `Voice.id` is preserved in the model definition for schema compliance and validation logging, but is completely eliminated from selection, clipboard, marquee, and interaction APIs.

## 2. Architecture Decisions (S1 - S9)

### S1: RangeSelection Specification
`RangeSelection` is strictly defined as:
```typescript
export interface RangeSelection {
  kind?: 'range';
  staffId: string;
  voiceIndex: 1 | 2 | 3 | 4;
  anchorId: string;
  focusId: string;
}
```
- `voiceId` is completely removed from `RangeSelection`, `Selection`, `findEventContext` return type, and all calling sites.
- A range selection lies strictly within ONE voice (`voiceIndex: 1 | 2 | 3 | 4`).
- A range may span multiple measures. Measures lacking that voice contribute no events to `eventsInRange`.

### S2: Voice.id Usage Boundaries
`Voice.id` remains on `Voice` objects in `src/core/model.ts` for model completeness and unique DOM/key identifiers.
- `voiceId` is NEVER used to address or lookup a voice in selection, clipboard, commands, marquee, or UI state.
- Allowed remaining `voiceId` occurrences in `src`:
  1. `src/core/validate.ts`: For reporting `ValidationError` location contexts.
  2. `src/io/migrations.ts`: For deterministic ID generation during v6->v7 migration.
- All other occurrences across `src` are eliminated.

### S3: Clipboard Payload and Target Resolution
- **Payload format**: `ClipboardPayload` carries pure `events: ScoreEvent[]` with relative durations and ticks, without voice identity.
- **How paste decides its target**:
  1. **Input mode (cursor active)**: Target voice is `cursor.voiceIndex`. Target measure is `cursor.measureId`. Target tick offset is `cursor.tick`.
  2. **Range selection mode**: Target voice is `selection.voiceIndex`. Target measure is the measure of the first event in the range. Target tick offset is the offset of the first event in that measure.
  3. **Single event selection mode**: Target voice is `firstCtx.voiceIndex`. Target measure is `firstCtx.measureId`. Target tick offset is the offset of the event in that measure.
- **Missing voice creation**: If the target measure lacks that `voiceIndex`, it is created in the SAME undo step using the exact semantics of D3 (M7a-2b): initial rests filling `[0, totalMTicks)` via `fillMeasureWithRests`, then slicing in the pasted events and filling to the barline. Voices in the measure remain strictly sorted by `voiceIndex`.
- Cross-voice copy-paste (e.g. copying from voice 2 and pasting into voice 1 or vice-versa) is explicitly supported.

### S4: Deletion Semantics
Deleting a selection in voice N (via Delete / Backspace in selection mode) converts the selected events to rests of matching durations through the standard rest creation path. All other voices on the staff remain completely untouched.

### S5: Marquee Selection
A marquee rectangle selects only events belonging to the voice of the first hit element in reading order. Hits in other voices within the same rectangle are ignored.

### S6: Keyboard Navigation and Editing in Selection Mode
- `ArrowLeft` / `ArrowRight`: Moves selection to previous/next event within the current voice on the staff (`nextEventId` constrained to `targetVoiceIndex`).
- `Shift+ArrowLeft` / `Shift+ArrowRight`: Extends the selection range within the current voice.
- Editing keys (`ArrowUp`/`ArrowDown` for semitone, `Ctrl+ArrowUp`/`Ctrl+ArrowDown` for octave, `Delete`/`Backspace`, `t` for tie, `s` for slur, articulations, dynamics): operate strictly on the selected voice.

### S7: Isolation and Deep-Equality Invariants
Every editing operation on voice N leaves all other voices deep-equal (`JSON.stringify` / `toEqual`) to their previous state. `undo()` restores the exact previous score with deep-equality.

### S8: Validation Invariant
`validateScore(score)` produces zero errors after every editing, clipboard, deletion, and undo/redo operation.

### S9: Out of Scope
The following capabilities are explicitly out of scope for M7a-3:
- Multi-voice simultaneous selection.
- Moving notes between voices via drag-and-drop.
- Voice crossing.
- Voice deletion commands.
- Grand staff multi-staff selection.

## 3. Test Plan
| Test ID | Description | Test Location |
|---|---|---|
| T1 | Selection in voice 2 over BWV 140/7 mm.1-2 fixture (real app path, range across barline, voice 1 never included) | `tests/core/m7a_voice_selection_ops.test.ts` |
| T2 | Voice-2 range operations (transpose semitone, transpose octave, delete, tie, slur, articulation, dynamics) leave voice 1 deep-equal; undo restores initial score | `tests/core/m7a_voice_selection_ops.test.ts` |
| T3 | Cross-voice copy & paste: voice 2 -> voice 1, voice 2 -> missing voice 2 (creation in 1 undo step), voice 2 -> existing voice 2 | `tests/core/m7a_voice_selection_ops.test.ts` |
| T4 | Seeded property test (20 seeds x 100 steps) over 2-voice score: select, transpose, delete, copy-paste, undo-all deep-equals initial score, redo-all deep-equals final score | `tests/core/voice_property_m7a3.test.ts` |
| T5 | Playwright E2E real app test: enter BWV 140/7 mm.1-2 in 2 voices, click/shift-click alto, semitone up, copy, paste into new measure, delete range, save and compare | `scripts/test_voice_selection_e2e.mjs` |
| T6 | UI marquee test: marquee over both voices selects only the first-hit voice | `tests/ui/marquee_voice_selection.test.ts` |
