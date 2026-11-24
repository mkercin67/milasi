# M7b-5 acceptance: Bach BWV 772 mm. 1-7, gap list

Reference: Bach-Gesellschaft Band 3 (public domain, kept only in `tests/private/`).
Entered by hand in the application by the project owner; fixture and tests:
`tests/fixtures/bwv772Mm1to7.ts`, `tests/layout/bwv772_acceptance.test.ts` (A1-A8).

## Found during entry and fixed
| # | Finding | Fix |
|---|---------|-----|
| 1 | Stems of stem-up notes floated about 0.6 sp right of their notehead in justified systems (stretch scaled the 1.18 sp offset; dots, flags and displaced seconds drifted too) | `anchorX` in `applyEventAnchors`, commit "keep stems/dots/flags at a fixed offset" (J1-J4, A8) |
| 2 | Edition beams eighth notes across the half bar in 4/4; the program grouped per beat only | Score setting `beamGrouping` `'beat' \| 'half-bar'`, M7b-7 (G1-G8, A5) |
| 3 | The entering half of a tie across a system break started right of the first notehead and was invisible | Starts at the system header, B18 (T1) |
| 4 | Mouse entry in rest measures, entry inside a rest | M7b-6 |

## Open differences (decision)
| # | Difference | Decision |
|---|------------|----------|
| 1 | No trill sign (mm. 1, 2 and 5 of the entered range) | M7c (ornaments) |
| 2 | The edition writes the common-time sign, the program writes 4/4 | DONE M7c-9d: the fixture uses the common-time sign (A9) |
| 3 | Beam slopes are flatter than the engraving (clamped to one staff space) | accepted (cosmetic) |
| 4 | An entry that does not fit the measure (an eighth at the last sixteenth slot) gives no message; the player only sees that nothing happens | backlog: status bar hint "does not fit" |
| 5 | Rests cannot be deleted, only overwritten with notes (`Delete` turns a note into a rest) | by design; document in the user guide |
| 6 | Pitch entry picks the octave nearest to the previous note, so leaps of a fifth or more need `Ctrl+Up/Down` or the mouse | accepted; keyboard octave key is a candidate for M7c |
| 7 | mm. 4-5 left hand: the saved entry used a slur, the edition has a tie (same pitch). The fixture uses a tie (playback 0.625 s) | entry mistake, not a program gap |

## Verified
- Pitches, durations and rests of all 14 hand-measures match the edition (entry file vs fixture: 0 event differences).
- Every measure sums to 3840 ticks in both hands; `validateScore` reports nothing.
- Layout at widths 100/140/200: no notehead overlaps, no staff collisions, columns aligned (42 shared ticks), barlines through both staves.
- Playback: 14 s at 120 bpm, 152 sounded notes, tied C4 as one note of 0.625 s.
