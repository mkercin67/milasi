# ADR-002: Web Audio Decoupled Engine with Lookahead Scheduling

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
Interactive score playback requires precise, sample-accurate note timing and polyphonic articulation. Browser `setTimeout` and `requestAnimationFrame` timers exhibit significant jitter (10-50 ms), which creates audible rhythmic stuttering if audio triggers are invoked directly from JavaScript timers.

Furthermore, automated testing in Node.js (Vitest) cannot access native Web Audio APIs or hardware output devices.

## Decision
1. **Decoupled AudioEngine Interface:** We define an abstract `AudioEngine` interface (`src/playback/audio.ts`) with methods `trigger(note, atSeconds)`, `now()`, `setMasterVolume()`, and `close()`.
   - `ToneEngine` (`src/playback/toneEngine.ts`) implements this using Tone.js `PolySynth` for real browser audio.
   - `FakeEngine` (`src/playback/fakeEngine.ts`) implements this with an in-memory chronological event log for deterministic, headless unit tests.
2. **Lookahead Audio Scheduler:** The playback player (`src/playback/player.ts`) converts score ticks to absolute wall-clock seconds (`buildSchedule`). A cooperative 100 ms interval timer schedules upcoming note events up to 1.0 s into the future directly onto the Web Audio hardware clock (`engine.now() + startSeconds`).

## Consequences
### Positive
- Microsecond-accurate rhythmic playback immune to main thread UI rendering stalls or garbage collection pauses.
- 100% testable in headless CI/CD environments without audio hardware.
- Clean separation between musical scheduling logic and Web Audio synthesis.

### Negative
- State changes (such as immediate pause or pitch stop) require canceling pre-scheduled Web Audio hardware events.
