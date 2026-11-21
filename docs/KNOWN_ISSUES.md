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

## 3. Grand Staff (Milestone 7b) and its Open Differences
- **Status:** Implemented in Milestone 7b (accepted with Bach BWV 772 mm. 1-7 and Mozart K. 545 mm. 1-7; see `docs/review/m7b-5-bwv772-gaps.md` and `docs/review/m7b-5-k545-gaps.md`). One part with several staves forms one system (brace, barlines through the staves, cross-staff column alignment). Multi-part systems and part/group handling remain M7c.
- **Chord entry:** `Shift+C..B` adds a pitch above the note just entered (M7b-8). Chords can only be built upwards; a single pitch of a chord cannot be removed yet.
- **Not yet supported (M7c):** clef changes inside a staff (the Peters edition of K. 545 writes the left hand in the treble clef and changes clef in m. 5), trills and other ornaments (the common-time and cut-time signs exist since M7c-1), C clefs, fermatas.
- **Selection and clipboard:** a plain range selection works on one voice of one staff; press `M` (select mode) to select every voice of a measure, then copy/cut/paste/delete act on all voices (M7a-5, `docs/design/m7a-5-multi-voice-selection.md`). Selection across several staves is not supported.
- **Entry ergonomics:** the octave of a typed pitch is the one nearest to the previous note, so leaps of a fifth or more need `Ctrl+Up/Down`; an entry that does not fit the measure shows no explanatory message; rests cannot be deleted, only overwritten with notes.
- **Engraving:** beam slopes are flatter than in printed editions (accepted).

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
- **Details:** Supports repeat start (`repeatStart`), repeat end (`repeatEnd`), combined barlines (`repeatRightLeft`), volta brackets (`volta: { number }`), syllable-level lyrics (`lyrics: LyricSyllable[]`), a derived note-name line (`layoutSettings.showNoteNames`, Do Re Mi or C D E, separate from lyrics; see `docs/design/note-name-layer.md`), and lyrics input mode (`KeyU`).
- **Scope Limits:** Nested repeats without matching delimiters trigger validation errors (`nested-repeat`). Multiple lyric verses (verse > 1) and complex melisma curves are deferred to Phase 2.


