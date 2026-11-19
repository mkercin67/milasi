# MiLaSi — Known Issues & Technical Limitations

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
- **Details:** In `Score`, each `StaffMeasure` contains `voices: Voice[]` where each voice has a local `id`. Cross-measure operations rely on the voice's one-based `voiceIndex` (1..4) to maintain continuity across barlines rather than comparing voice UUIDs.

## 6. Score Structure Elements (Milestone 6c)
- **Status:** Implemented in Milestone 6c.
- **Details:** Supports header text (title, subtitle, composer, arranger), tempo text markings (e.g. "Allegro vivace ♩ = 120"), mid-score key signature changes with cancellation naturals, mid-score time signatures, pickup measures (anacrusis), and barlines (single, double, final).

## 7. Repeats, Voltas & Lyrics (Milestone 6d)
- **Status:** Implemented in Milestone 6d (Schema Version 6).
- **Details:** Supports repeat start (`repeatStart`), repeat end (`repeatEnd`), combined barlines (`repeatRightLeft`), volta brackets (`volta: { number }`), syllable-level lyrics (`lyrics: LyricSyllable[]`), Turkish solfège automation (`autoSolfege`), and lyrics input mode (`KeyU`).
- **Scope Limits:** Nested repeats without matching delimiters trigger validation errors (`nested-repeat`). Multiple lyric verses (verse > 1) and complex melisma curves are deferred to Phase 2.


