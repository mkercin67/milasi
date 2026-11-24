# M7c-9 — Acceptance corpus and v3.2 exit gates

Status: APPROVED v1 (owner approved Q1–Q3 as proposed, 2026-11-24)

## 1. Where we are

M7c-1 to M7c-8 delivered the notation features (fermata, ornaments, grace notes, clefs, clef changes, ensembles,
multi-verse lyrics, per-part playback). What is still open is the proof against real editions (plan section 5)
and the exit gates of v3.2. The method is the one of M7b-5 (K. 545, BWV 772):

- The **project owner enters the notes by hand** from the public-domain scan (the scan stays in
  `tests/private/`, never committed). The project lead checks the entry and writes the acceptance test with
  literal numbers read from the entered score, not from the code under test.
- Every fixture has the header of `mozartK545Mm1to7.ts` (source, composer, death year, license) and obeys
  `docs/CORPUS_POLICY.md`. The shared token grammar (`parseMeasure`) is reused; a fixture for several staves
  or parts gets one array of measure strings per staff.
- Differences from the edition are listed in `docs/review/m7c-9-<piece>-gaps.md` and accepted or turned into a
  roadmap item. All claims about an edition stay UNVERIFIED until the owner checks them against the scan.

## 2. Steps (one commit each, owner screenshot after each)

| Step | Piece | What it proves | Fixture file |
|---|---|---|---|
| 9a | Beethoven, String Quartet Op. 18 No. 1, I, mm. 1-8 | four staves, bracket, through barlines, viola alto clef, labels, dynamics | `tests/fixtures/beethovenOp18No1Mm1to8.ts` |
| 9b | Bach, chorale BWV 140/7, mm. 1-8 | SATB individual barlines, fermatas, lyrics (verse 1, and verse 2 if the edition has it), tenor clef or 8vb | `tests/fixtures/bachBwv140Mm1to8.ts` |
| 9c | Schubert, "An die Musik" D. 547, mm. 1-12 | voice with individual barline plus piano with brace, lyrics across a system break | `tests/fixtures/schubertD547Mm1to12.ts` |
| 9d | K. 545 m. 5 clef change and BWV 772 trill and common-time sign | closes the gaps recorded in `m7b-5-k545-gaps.md` and `m7b-5-bwv772-gaps.md` with the M7c features | edit of the two existing fixtures |
| 9e | Breidenbach, *Méditation* (CC0), bars 13-21 and 150-154 | bass to tenor clef inside a system, time signature changes, courtesy accidentals, clef change at a system start | `tests/fixtures/breidenbachMeditationExcerpts.ts` |
| 9f | Exit gates | see section 3 | tests, docs, gallery |

9a to 9e each add: the fixture, an acceptance test file (valid score, tick sums, entered pitches at chosen
positions, layout without overlaps, JSON round trip, playback schedule length), a gap note, and a gallery card
only when the piece shows something no card shows yet.

## 3. Exit gates (step 9f)

1. **Staff-zero ratchet**: reduce the 14 `firstStaff` fallbacks where the cause is a hidden single-part
   assumption (list in `m7b-staff-ratchet.json`), ceiling goes down, never up.
2. **Performance**: keystroke-to-paint p95 <= 30 ms on a 50-measure four-staff score (benchmark card from
   M7c-6, re-measured with lyrics of three verses and the mixer present).
3. **Cross-part selection and clipboard**: stays out of scope (KNOWN_ISSUES); the audit states this
   explicitly instead of leaving it implicit.
4. **Docs**: `feature-parity.md` updated (what M7c delivered, what is still a gap), KNOWN_ISSUES consolidated,
   `m7c-plan.md` marked DONE, v3.2 release notes draft.
5. **Visual sign-off**: the owner confirms each fixture next to its scan page (plan section 7).

## 4. What I need from the owner per step

- The measures typed in the token grammar (or screenshots of the scan pages in the chat, which I read and
  transcribe; the screenshots are never committed). I can transcribe a screenshot, but the owner's check
  against the scan is what makes an entry verified.
- Editorial marks (fingerings, editor's slurs) are left out unless the step lists them.

## 5. Known limits (expected)

- Excerpts only (8 to 12 bars), not full pieces.
- Dynamics, slurs, fermatas, grace notes and ornaments appear only where M7c implemented them; anything else in
  the scan is listed in the gap note, not approximated.
- No audio comparison; playback is checked by schedule length and note counts.

## 6. Questions for the owner

- Q1. Order 9a to 9e as in the table (Beethoven first because it exercises the biggest new feature, the
  ensemble layout), as proposed?
- Q2. Entry method: you type the token strings for the first fixture (I give a template), and later I
  transcribe from screenshots you paste for you to check, as proposed?
- Q3. Are Breidenbach (CC0) and the other three pieces still the right acceptance set, or do you want a flute
  or flute-and-piano piece in public domain added (it would be the closest to Melis's repertoire)?
