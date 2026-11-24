# M7c-8 — Playback per part

Status: CLOSED v1 (owner approved Q1–Q3 as proposed, 2026-11-24)

## 1. Where we are

`buildSchedule` already tags every `ScheduledNote` with `partId` and `midiChannel` (`Part.midiChannel`, 0..15,
set by the ensemble templates). But the player sends all notes to one `ToneEngine` PolySynth, so:

- every part sounds the same (one triangle-wave timbre);
- a rehearsal use case is impossible: "play only the soprano", "everything except the piano".

Melis needs exactly this for practice (hear the other parts without her own).

## 2. Scope (v1)

1. **Mute and solo per part** (and per staff of a multi-staff part, see Q1). Standard rule: if any solo is on,
   only soloed parts sound; otherwise every non-muted part sounds.
2. **One timbre per channel**: the engine keeps one synth voice set per `midiChannel`, with a small built-in
   palette (e.g. triangle, sine, soft square, sawtooth with low gain) chosen by `Part.instrument` family
   (voice, strings, winds/flute, keyboard, other). No sample libraries, no new dependency (GPL-clean).
3. **Per-part volume** (0..100 %), kept in the mixer state.
4. A small **Mixer panel** (toolbar button "Mixer"): one row per part with name, M, S and a volume slider.
   Keyboard: no new shortcut in v1.
5. Mixer state is a **playback setting, not score data**: it is not saved in the `.sfscore` file, is not
   undoable, and does not change the schema. It resets when a different score is opened.
6. Muted notes are skipped when scheduling to the engine, not removed from `buildSchedule`: cursor
   follow, measure positions and total time stay identical, and the schedule memo cache stays valid.

## 3. Design

- `src/playback/mixer.ts` (pure): `MixerState {muted: Set<partId>, solo: Set<partId>, volume: Map<partId, number>}`,
  `isAudible(state, partId)`, `gainFor(state, partId)`, `setMuted/setSolo/setVolume` returning new states.
- `AudioEngine.trigger` gets an optional `channel` and `gain` (fake engine records them, so tests need no audio).
- `Player.setMixer(state)`: applied at the moment a note is triggered, so changing mute or solo during playback
  takes effect from the next note without rebuilding the schedule.
- `ToneEngine`: lazily creates one `PolySynth` per channel, all into the shared volume node and limiter.
- UI: `MixerPanel.tsx` (popover like the Parts dialog), i18n en/tr, `data-testid` per row.
- Layering respected: `playback` does not import `ui`/`layout`; the panel lives in `ui`.

## 4. Tests (planned)

- MX1 mute removes a part from the triggered notes, schedule unchanged.
- MX2 solo overrides mute; two solos sound together.
- MX3 volume maps to the gain passed to the engine.
- MX4 changing the mixer while playing affects only notes not yet triggered.
- MX5 timbre family mapping is total (every `Part.instrument` string maps to a family).
- MX6 panel markup lists every part with M/S controls; i18n parity.
- Perf: building the trigger list for a 4-part, 200-measure score stays within the existing playback budget.

## 5. Known limits (v1)

- Synth timbres only; no real instrument samples.
- Mixer state is not saved with the score (reload resets it).
- No pan, reverb or per-note velocity curves (M11 playback enhancements).
- Transposing instruments are not handled here (pitches are sounding pitches).

## 6. Questions for the owner

- Q1. Mute/solo granularity: per **part** (violin I, piano) as proposed, with the two piano staves moving
  together? The roadmap line said "per staff"; per part is simpler and matches what a mixer shows. A
  per-staff switch for multi-staff parts could be added later.
- Q2. Mixer state not saved in the score file (playback setting only), as proposed?
- Q3. Built-in synth palette (no sample files) for v1, as proposed?

## 7. Progress
- Implemented in one step: `src/playback/mixer.ts` (pure state, timbre families), `Player.setMixer` (mute/solo/gain applied when a note is triggered), `TriggerNote` (midiChannel, gain, timbre) for engines, `ToneEngine` with one PolySynth per timbre FAMILY (not per channel, so two parts that share a MIDI channel still keep their own timbre), `MixerPanel` in the playback toolbar (shown only for scores with 2+ parts). Tests MX1-MX6, MP1-MP3.
