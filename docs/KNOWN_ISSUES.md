# ScoreForge — Known Issues & Technical Limitations

This document lists known constraints and architectural trade-offs in the current implementation.

## 1. Bundle Size & SMuFL Glyph Paths (~1.5 MB bundle)
- **Status:** Architectural Trade-off.
- **Details:** The Bravura SMuFL music font glyph paths are compiled directly into `src/render/glyphPaths.ts` as static SVG path strings. This eliminates WebFont loading flash (FOUC), network latency, and canvas rasterization artifacts.
- **Impact:** Production JavaScript bundle is ~1.5 MB uncompressed (~397 KB gzipped).
- **Roadmap:** In Phase 2, glyph paths will be split into lazy-loaded chunks or external SVG sprite sheets.

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
