# M7b-5 Acceptance: two public-domain piano excerpts, hand-entered

**Status:** approved procedure (user). Bach BWV 772 mm. 1-7 entered and verified (see `docs/review/m7b-5-bwv772-gaps.md`); Mozart K. 545 pending.
**Policy:** `docs/CORPUS_POLICY.md` applies. The reference score is read from a public-domain edition (Bach-Gesellschaft for BWV 772, Mozart: Breitkopf & Haertel complete edition for K. 545, both via IMSLP). The PDF stays in `tests/private/` (git-ignored). No PDF, scan or screenshot of an edition is committed.

## Pieces (measures 1-8 of each)
1. J. S. Bach, Invention No. 1 in C major, BWV 772: two voices, one per hand, sixteenths, beams, entries one beat apart.
2. W. A. Mozart, Piano Sonata No. 16 in C major, K. 545, first movement: right hand melody, left hand Alberti bass.

## Procedure
1. New Score, Piano template, 4/4, C major, 8 measures. Enter both hands with keyboard and mouse as a pianist would (staff switch `Ğ`/`Ü`).
2. Save to `tests/private/` (`bwv772_mm1-8.sfscore`, `k545_mm1-8.sfscore`). Not committed.
3. Compare screen and reference side by side. Write every difference into `docs/KNOWN_ISSUES.md` or a new backlog item (missing rest, wrong beam, spacing, missing symbol such as a trill or slur).
4. Playback must sound like the piece (rhythm and pitch), both hands.
5. After you accept, I convert each saved file into a committed fixture generator (header per policy section 4, notes as data, entered by hand by the user) plus a regression test: layout without overlaps, columns aligned across staves, through barlines, playback duration, save/load round trip.

## Accepted when
- Both excerpts are entered without leaving the application and without workarounds.
- No collisions between staves or inside a staff; beams, ledger lines, accidentals and rests look correct.
- The gaps found in step 3 are either fixed or listed with a decision (in the next milestone or accepted).
- CI green, tag `m7b`, `firstStaff` ceiling lowered to the real single-staff set.
