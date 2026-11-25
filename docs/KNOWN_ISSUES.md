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
- **Clef changes (M7c-5, v1):** a clef change belongs to the whole staff at a tick of a measure. Not carried by copy and paste; a beam is not broken by a change; "Notasyonu temizle" leaves clef changes alone; a change stays at its tick when the notes before it are edited (it does not follow a note). A change to the clef already in force removes the change, judged when the command runs (it is not restored if an earlier change is added later). The warning clef at a system end is drawn for every bar followed by a different clef.
- **Clefs (M7c-4):** key signature positions: tenor with three flats and alto with four sharps are verified against printed parts, alto with one flat looks right, all other alto and tenor key signatures are UNVERIFIED until compared with a printed part; soprano, mezzo-soprano and baritone C clef signatures are derived from the alto table and may touch a ledger line. The new-score dialog offers no clef choice (use the "Anahtar" button afterwards). The 8vb/8va clefs only change how notes are written; pitches are sounding pitches, so playback is unaffected.
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

- **Tuplets (M7c-2b, v1):** Only 3:2 can be entered from the UI (toolbar "3" or `Q` in input mode). A tuplet number is drawn, but no bracket for unbeamed groups. Unequal groups, nested tuplets, in-place duration change of a tuplet slot, and mouse-entry/clipboard behaviour with tuplets are not yet verified. See `docs/design/m7c-2b-tuplets.md`.
- **Ornaments (M7c-3, v1):** one ornament per note, drawn above the note; toolbar buttons only (no keyboard shortcut yet); no wavy continuation line for a trill over several notes, no accidental above or below the sign, playback ignores ornaments (M11). "Notasyonu temizle" does not remove ornaments yet. See `docs/design/m7c-3-ornaments.md`.
- **Grace notes (M7c-3b, v1):** drawn only in single-voice staff measures (polyphonic measures ignore them); a grace note cannot be selected or clicked on its own; the slur to the main note is always drawn; grace entry keys are not in the keymap (so not in `SHORTCUTS.md`); "Notasyonu temizle" does not clear grace notes (use "Süsleri sil"); playback follows a v1 convention (acciaccatura at most a 32nd, appoggiatura half of the main note; no long appoggiatura rule for dotted main notes). See `docs/design/m7c-3b-grace-notes.md`.
- **Ensembles (M7c-6, v1):** brackets are a thick bar with two short serifs (no curled SMuFL ends); part labels are single-line estimates by character count (multi-line names are split at line breaks); no hiding of empty staves; the Parts dialog groups ALL parts at once (no partial groups from the UI yet); the status bar shows "Staff n/m" only inside a multi-staff part; selection, clipboard and paste stay inside one staff.

## Multi-verse lyrics (M7c-7, v1)
- No verse-number labels ("1.", "2.") are drawn before the first syllable.
- At most 8 verses; the verse is chosen with the selector in lyrics mode (no shortcut).
- In polyphonic measures lyric lines are stacked per measure; alignment across voices is approximate.

## Per-part playback (M7c-8, v1)
- Mute, solo and volume are per part; the two staves of a piano move together.
- Mixer settings are a playback setting: not saved in the score file, not undoable, reset when the score is replaced.
- Timbres are built-in synth waveforms per instrument family (voice, strings, winds, keyboard, other); no sample libraries, no pan or reverb.
- The audition sound while entering notes uses the default timbre.

## Acceptance corpus (M7c-9, v3.2 exit audit)
- **Cross-part selection and clipboard:** selecting or copying across several parts or staves at once is out of scope for v3.2; selection works inside one staff (all its voices). Planned with the page and layout work, not before.
- **Marks the editions print that are not supported yet** (all listed in `docs/review/m7c-9-*-gaps.md`): boxed rehearsal letters, text expressions (poco a poco cresc., pizz., arco), bowing signs, a slide (fall) mark, courtesy time signature and clef before a system break, parenthesised courtesy accidentals. Candidates for M10.
- **Header clef at tick 0:** a clef change at tick 0 is drawn as the staff's header clef; the printed sequence bass clef, C, treble clef of K. 545 m. 4 to 5 is shown as treble only.
- **Performance gate:** the relayout of a 50-measure four-staff score with three lyric verses measures 11.6 ms at p95 in isolation (owner's machine) (gate 30 ms; test gates 60 ms under load). The gate measures layout; React paint and the mixer panel were not part of that measurement.
- **Owner sign-off:** given on 25.11.2026: the owner compared all seven fixtures with the scans on screen (plan section 7).

