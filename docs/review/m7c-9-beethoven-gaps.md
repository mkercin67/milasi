# M7c-9a: Beethoven, String Quartet Op. 18 No. 1, I, mm. 1-8: differences from the edition

Source: IMSLP #973801 (Breitkopf Gesamtausgabe, Serie 6 No. 37, 1862, Public Domain). The scan stays in
`tests/private/`. All claims are UNVERIFIED until the owner has checked them against the scan page.

Entered: 3/4, F major, notes, `p` under m. 1, slurs, staccato and the hairpins of mm. 5-8 for four parts.

## Open points
1. **Acciaccatura** before the half note of violin II, m. 7 (a small slashed note in the scan). Not entered: its
   pitch has not been read yet. The program can write it (`addGraceNote`), the fixture grammar cannot yet.
2. **First curve of m. 1** (F4 to F4 in every part): entered as a slur. If the owner reads it as a tie the
   playback changes (one held note instead of two). To be confirmed from the scan or a recording.
3. **Hairpins of mm. 7-8** and the dynamics after m. 8 (`cresc.`, `f` of the second system) are outside this
   excerpt or not yet compared.
4. **Tempo mark** "Allegro con brio" and the title block of the edition are not drawn (title and composer come
   from the score metadata).
5. **Editorial differences of layout**: the edition has stems and slur directions of its own; ours follow the
   program's rules (see KNOWN_ISSUES).

## Bugs the corpus found
- Slurs in an ensemble were shaped by noteheads and staccato dots of other staves (giant curves). Fixed in
  `layoutSlurs`, tests SE1, SE2 (B120, B121).
