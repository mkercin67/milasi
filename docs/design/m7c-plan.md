# M7c plan: ensembles, clefs, fermata, ornaments, time-signature symbols

Status: PROPOSED (needs the project owner's approval before any code is written).
Builds on: `docs/design/multi-staff-and-pages.md` (v3.2, sections 3 and 7), `docs/review/m7b-5-bwv772-gaps.md`,
`docs/review/m7b-5-k545-gaps.md`, `docs/KNOWN_ISSUES.md`.

## 1. Why a plan and not just the v3.2 text
The v3.2 milestone text lists the M7c deliverables, but it was written before the two real acceptance entries
(BWV 772 and K. 545). Those entries produced three needs the text does not cover: **clef changes inside a staff**,
**ornaments (trill)** and an explicit order. This note adds them, orders the work so every step ships on its own,
and states the acceptance test of each step. Nothing here changes what M7b accepted.

## 2. What already works and must not regress
- One part with two staves (grand staff), two to four voices per staff with opposing stems, per-staff selection,
  multi-voice copy and paste, chord entry, note-name layer, lyrics in polyphonic measures.
- A four-voice SATB harmony exercise on **two staves** (soprano and alto on the treble staff, tenor and bass on the
  bass staff) is therefore already writable today. M7c adds the **four-staff** SATB layout and other ensembles; it
  does not replace the two-staff form, which is the usual form of a harmony exercise.

## 3. Sub-milestones (each ends with `npm run check` green, CI green, tag-ready)

| Step | Content | Depends on | Closes gap |
|---|---|---|---|
| **M7c-1** (DONE) | Time-signature symbols: `MeasureDef.timeSigDisplay = 'numeric' \| 'common' \| 'cut'` (SMuFL `timeSigCommon`, `timeSigCutCommon`). UI: choice in the time-signature dialog. Absent field = numeric, old files unchanged. | none | BWV 772 gap 2, K. 545 gap 3 |
| **M7c-2** | Fermata (and breath mark, caesura): `notations.fermata = 'above' \| 'below'` on notes and rests, placed against the staff skyline, ignored by playback (normal metrical playback until M11). Toolbar button and shortcut. | none | v3.2 scope |
| **M7c-3** | Ornaments, minimal set: trill sign `tr`, mordent, inverted mordent, turn. Stored as an event notation, drawn above the note on the skyline, ignored by playback until M11. Wavy continuation line for a trill over several notes is a later refinement. Grace notes follow in M7c-3b. | M7c-2 (shared above-staff placement) | BWV 772 gap 1, K. 545 gap 2 |
| **M7c-3b** | Grace notes: appoggiatura and acciaccatura (small notehead, slash for acciaccatura, slur to the main note), spacing and playback timing rules, entry by keyboard. Needed by the flute and piano repertoire. | M7c-3 | owner decision Q2 |
| **M7c-4** (DONE v1) | Clef model: C clefs (soprano, mezzo-soprano, alto, tenor, baritone), octave-shift clefs (treble 8vb for tenor), pitch-to-staff-position mapping for all of them, ledger lines, cursor and mouse entry on each clef, new-score and staff clef choice. | none | v3.2 scope |
| **M7c-5** (DONE v1) | Clef changes inside a staff: `Staff.clefChanges[] = { measureId, tick, clef }`. Small clef drawn before the first affected note (before the barline when the change falls on a measure start). Stored pitches are absolute, so playback and transposition are unaffected; only the staff position of notes changes. | M7c-4 | K. 545 gap 1 |
| **M7c-6** (DONE v1) | Ensemble model and layout: add or remove staves and parts, `Score.groups` (bracket, brace, barline span), templates SATB (4 staves), string quartet, voice + piano. Layout generalises from the first part to **all** parts of a system. Part labels with dynamic first-system indent. Through, individual and Mensurstrich barlines. | M7c-4 | v3.2 scope |
| **M7c-7** (DONE v1) | Multi-verse lyrics: verses 2 and above drawn, stacked, independent hyphens and extenders, 2.5 sp clearance against the next staff, lyric corridor between staves for individual barlines. Lyric entry targets a chosen verse. | M7c-6 | v3.2 scope |
| **M7c-8** (DONE v1) | Playback per part: one MIDI channel per part, mute and solo per staff. (Clef octave shifts need nothing here: pitches are sounding pitches, see m7c-4-clefs.md.) | M7c-6 | M7b-grand-staff B10 |
| **M7c-9** (9a to 9e DONE, 9f gates measured; owner visual sign-off open) | Acceptance entries from public-domain editions (section 5) and the gallery cards of the v3.2 exit gates. | all above | exit gates |

Order rationale: steps 1 to 3 are small, independent and each removes a visible difference from the editions we
already entered, so the owner sees progress early. Step 4 before 5 and 6 because every staff needs a correct clef
model first. Step 6 is the largest risk and comes after the notation features are stable.

## 4. Technical risks and how each is contained
- **Layout generalises from one part to all parts** (`firstPartStaves` and `firstStaff` callers). The staff-zero ratchet
  ceiling (15) must go down, never up; each `firstStaff` fallback that M7c-6 removes lowers it.
- **Performance budget** (v3.2 exit gate): keystroke-to-paint p95 <= 30 ms on a 50-measure four-staff score. A
  benchmark card is added in M7c-6 before any optimisation; the `grand-200` cache question (worst 29.2 ms) is
  re-measured there.
- **Skyline spacing** already takes arbitrary items and pairs of adjacent staves (S6), so fermata, ornaments and
  lyrics enter it as ordinary items. No redesign is expected; a test per new item kind proves it.
- **Schema**: every new field is optional and absent means the old behaviour, so no schema number change and old
  files stay byte-identical, as with `beamGrouping` and `showNoteNames`. `Staff.clefChanges` and `Score.groups`
  need a validation rule each.
- **Selection and clipboard** stay per staff. Cross-staff selection remains out of scope.
- **Cache keys**: every drawn field (clef, fermata, ornament, verse text, time-signature display) must be part of the
  measure cache key. The lyric and note-name regressions of this month came from a missing key; each step adds a
  "toggle shows the new state without clearing caches" test.

## 5. Acceptance corpus (public domain only, `docs/CORPUS_POLICY.md`)
All claims about an edition stay **UNVERIFIED until the owner checks them against the IMSLP scan**, as in M7b.
- M7c-4 and M7c-6: Beethoven, String Quartet Op. 18 No. 1, I, mm. 1-8 (four staves, bracket, through-barlines, viola in the alto clef).
- M7c-6 and M7c-7: Schubert, "An die Musik" D. 547, mm. 1-12 (voice with individual barline plus piano with brace).
- M7c-6 and M7c-7: Bach chorale BWV 140/7, mm. 1-8, entered by hand (SATB, fermatas, German lyrics). The owner's NBA scan stays in `tests/private/`.
- M7c-3 and M7c-1: the trill and common-time sign of BWV 772 mm. 1-7 close the open gaps of that entry.
- M7c-5: the clef change in K. 545 m. 5 closes the open gap of that entry.
- M7c-5 and M7c-9: Breidenbach, *Méditation* for solo cello (IMSLP #997742, CC0 1.0, so it may be committed as a hand-entered fixture with a CC0 header; the PDF stays in `tests/private/`): bars 13 to 21 (bass to tenor clef inside a system, time signatures 3/4, 4/4, 2/4, courtesy accidentals in parentheses) and bars 150 to 154 (tenor clef change at a system start). Planned for the acceptance step M7c-9, not entered yet.
- Traditional: "Üsküdar'a Gider İken", vocal melody only, for the lyric features (syllables, hyphens, extenders).

## 6. Decisions taken by the project owner (21.11.2026)
- **Scope: Western art music first.** The goal is a program that covers what Finale and MuseScore cover for students
  and teaching staff. No school-specific priority exists, so the order of section 3 stands.
- **Q1 closed:** order unchanged (steps 1 to 3 first, then clefs, then ensembles).
- **Q2 closed:** grace notes (appoggiatura, acciaccatura) are **in scope** as step **M7c-3b**, after the minimal
  ornament set. Reason: the reference instruments of the first user are flute and piano, and Baroque and later
  flute-and-piano literature needs grace notes, trills and breath marks.
- **Q3 closed:** Turkish repertoire (koma accidentals, makam key signatures, Turkish notation conventions) is a
  later project phase, scheduled after everything else (M13 and beyond). It is not forgotten: the data model must
  not make it impossible (pitch `alter` already accepts non-integer values; see `formatPitchName`).
- **Q4 closed for now:** minimal ornament set (trill, mordent, inverted mordent, turn); extend on request.
- **Additions that follow from the flute and piano reference:** breath mark and caesura (part of M7c-2 with the
  fermata, same placement code), ottava lines (8va/15ma, needed for flute and piano high register; tracked in the
  parity matrix, section 8).

## 7. What the owner has to verify by eye (per step)
Each step ends with one screenshot request: the entry or card named in section 5 next to the IMSLP page. Clef
placement, fermata position, ornament position and bracket and barline shape are judged against that page, not
against our own rules.

## 8. Parity matrix with MuseScore and Finale
A separate document, `docs/design/feature-parity.md` (to be written next), will list every notation and editing
feature a student or teacher of Western music expects, mark which milestone delivers it, and mark gaps that no
milestone covers yet (for example hairpins, ottava lines, text expressions, rehearsal marks, chord symbols,
transposing instruments, parts extraction). It is the tool to keep the roadmap honest.
