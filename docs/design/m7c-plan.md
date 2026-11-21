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
| **M7c-1** | Time-signature symbols: `MeasureDef.timeSigDisplay = 'numeric' \| 'common' \| 'cut'` (SMuFL `timeSigCommon`, `timeSigCutCommon`). UI: choice in the time-signature dialog. Absent field = numeric, old files unchanged. | none | BWV 772 gap 2, K. 545 gap 3 |
| **M7c-2** | Fermata: `notations.fermata = 'above' \| 'below'` on notes and rests, placed against the staff skyline, ignored by playback (normal metrical playback until M11). Toolbar button and shortcut. | none | v3.2 scope |
| **M7c-3** | Ornaments, minimal set: trill sign `tr`, mordent, inverted mordent, turn. Stored as an event notation, drawn above the note on the skyline, ignored by playback until M11. Wavy continuation line for a trill over several notes is a later refinement. Grace notes are a **separate decision** (section 6, Q2). | M7c-2 (shared above-staff placement) | BWV 772 gap 1, K. 545 gap 2 |
| **M7c-4** | Clef model: C clefs (soprano, mezzo-soprano, alto, tenor, baritone), octave-shift clefs (treble 8vb for tenor), pitch-to-staff-position mapping for all of them, ledger lines, cursor and mouse entry on each clef, new-score and staff clef choice. | none | v3.2 scope |
| **M7c-5** | Clef changes inside a staff: `Staff.clefChanges[] = { measureId, tick, clef }`. Small clef drawn before the first affected note (before the barline when the change falls on a measure start). Stored pitches are absolute, so playback and transposition are unaffected; only the staff position of notes changes. | M7c-4 | K. 545 gap 1 |
| **M7c-6** | Ensemble model and layout: add or remove staves and parts, `Score.groups` (bracket, brace, barline span), templates SATB (4 staves), string quartet, voice + piano. Layout generalises from the first part to **all** parts of a system. Part labels with dynamic first-system indent. Through, individual and Mensurstrich barlines. | M7c-4 | v3.2 scope |
| **M7c-7** | Multi-verse lyrics: verses 2 and above drawn, stacked, independent hyphens and extenders, 2.5 sp clearance against the next staff, lyric corridor between staves for individual barlines. Lyric entry targets a chosen verse. | M7c-6 | v3.2 scope |
| **M7c-8** | Playback per part: one MIDI channel per part, mute and solo per staff, clef octave shift honoured in playback. | M7c-6 | M7b-grand-staff B10 |
| **M7c-9** | Acceptance entries from public-domain editions (section 5) and the gallery cards of the v3.2 exit gates. | all above | exit gates |

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
- Traditional: "Üsküdar'a Gider İken", vocal melody only, for the lyric features (syllables, hyphens, extenders).

## 6. Open decisions for the project owner (musical, not technical)
- **Q1. Priority within M7c.** The order above follows the editions we already entered. If the coursework of the
  faculty needs something earlier (for example four-staff SATB for choir or harmony assignments), the order of
  steps 4 to 7 can change; steps 1 to 3 stay first because they are small.
- **Q2. Grace notes (appoggiatura, acciaccatura).** Not in the v3.2 text and listed as a non-goal of M7b. They are
  common in Baroque and in Turkish repertoire. Proposal: treat them as a **separate step M7c-3b** after the minimal
  ornament set, because they change spacing and playback timing, which trills and mordent signs do not.
- **Q3. Turkish music needs.** Koma accidentals and makam key signatures are scheduled for M13 and stay there. The
  owner or the faculty should confirm whether an earlier, simpler form is needed for coursework (for example
  Turkish note names in the note-name layer, which already exist as solfège).
- **Q4. Which ornament signs** a first-year harmony or analysis course uses: the minimal set (trill, mordent,
  inverted mordent, turn) is a proposal and is cheap to extend later.

## 7. What the owner has to verify by eye (per step)
Each step ends with one screenshot request: the entry or card named in section 5 next to the IMSLP page. Clef
placement, fermata position, ornament position and bracket and barline shape are judged against that page, not
against our own rules.
