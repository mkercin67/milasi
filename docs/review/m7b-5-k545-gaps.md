# M7b-5 acceptance: Mozart K. 545 mm. 1-7, gap list

Reference: C.F. Peters (ca. 1938), urtext, IMSLP #70214, listed there as public domain; kept only in
`tests/private/`. A second scan (Goldenweiser/Muzyka 1964, not public domain) was looked at once as a private reading aid
only; it is not the fixture's source and is not referenced anywhere in the repository. Entered by hand in the application by the project owner;
fixture and tests: `tests/fixtures/mozartK545Mm1to7.ts`, `tests/layout/k545_acceptance.test.ts` (K1-K6).
Only Mozart's pitches and rhythms are taken over, no editorial marks.

## Found during entry
| # | Finding | Decision |
|---|---------|----------|
| 1 | No way to build a chord from the keyboard (the model and layout support chords); the owner entered the chords of mm. 5-7 as two voices | M7b-8: Shift+letter adds a pitch to the note left of the cursor (planned); the fixture uses single chord events |
| 2 | Range selection and copy/paste work on a single voice only, so a two-voice measure pastes only one voice | M7a-5 multi-voice selection (backlog) |
| 3 | The range selection band was always drawn on the first staff | fixed (selection bands per staff, S1-S2) |
| 4 | Pitch entry picks the octave nearest to the previous note; the Alberti figure C4 G4 E4 G4 needs one `Ctrl+Up` on the G | accepted, see BWV 772 gap 6 |

## Open differences (decision)
| # | Difference | Decision |
|---|------------|----------|
| 1 | The edition writes the left hand of mm. 1-4 in the treble clef and changes to the bass clef inside m. 5; the program has no clef change, the left hand is written in the bass clef with ledger lines | M7c (clef changes) |
| 2 | No trill sign in m. 4; no slurs (mm. 2 and 4) | M7c (ornaments), slurs optional |
| 3 | Common-time sign written as 4/4 | M7c |
| 4 | Chord noteheads of the voice-split entry differ from the fixture (one event vs two voices) | fixture is the reference |

## Verified
- Pitches, durations and rests of the right hand (7 measures) and the left hand (mm. 1-4 Alberti bass, mm. 5-7 chords) match the edition as read by the project lead and the owner. The chords of mm. 6-7 were read from an enlarged scan; the harmonic reading (C octave, C major in first inversion, G major above D) supports it.
- Every measure sums to 3840 ticks in both hands; `validateScore` reports nothing.
- Playback: 14 s at 120 bpm, 103 sounded notes (chords count each pitch).
- Chord layout: two noteheads on one x, four steps apart for F3+C4.
