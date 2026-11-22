# M7c-4: Clef model (C clefs, octave clefs, staff clef choice)

Status: IN PROGRESS (approved by the owner; part 1 model/formula done).
Part of `docs/design/m7c-plan.md` (step M7c-4, no dependencies). Clef conventions follow the engraving literature
(Gould, *Behind Bars*, chapter on clefs and key signatures; Ross). Key signature placement on C clefs is
**UNVERIFIED until the owner compares it with a public-domain viola or tenor part** (see section 5).

## 1. What is added
| Clef | Staff line of the clef sign | Typical use |
|---|---|---|
| G (treble) | 2 (today), 1 (French violin, rare) | flute, violin, voice |
| F (bass) | 4 (today), 3 and 5 (rare) | cello, bass, left hand |
| C: soprano, mezzo-soprano, alto, tenor, baritone | 1, 2, 3, 4, 5 | viola (alto), cello and bassoon (tenor), old vocal parts |
| Octave clefs: treble 8vb, treble 8va, bass 8vb | G or F line, with a small 8 | tenor voice, guitar, piccolo-like writing, contrabass |

Today `Clef = { sign: 'G' | 'F' | 'C', line }` exists, but the code reads only the **sign**, and for C it assumes
the alto clef; the `line` is ignored everywhere.

## 2. Model (no schema number change)
- `Clef.line` becomes meaningful: it is the staff line (1 = bottom .. 5 = top) of the clef sign.
- New optional `Clef.octaveShift?: -1 | 1`: the written pitch is one octave above (-1, "8vb") or below (+1, "8va")
  the sounding pitch. Absent = 0. Allowed only on G and F clefs.
- `Pitch` stays the **sounding** pitch. Playback and the schedule do not change at all. Only the staff position
  changes with the clef.
- Validation: sign and line must be a legal pair (G: 1 or 2; F: 3, 4, 5; C: 1 to 5), `octaveShift` only -1 or 1 and
  only on G or F. Unknown values are errors.

## 3. One formula for the staff position
The diatonic number of a pitch is `octave * 7 + stepIndex` (C = 0 .. B = 6). The reference note of each clef sign sits on
its line: G4 (diatonic 32) for G, F3 (24) for F, C4 (28) for C. With the clef line `L` (1 = bottom line):

`bottomLineDiatonic = referenceDiatonic - 2 * (L - 1) + 7 * octaveShift` (octaveShift -1 = "8vb", +1 = "8va")`

Checks against today's values: treble G line 2 gives 30 (E4), bass F line 4 gives 18 (G2), alto C line 3 gives 24 (F3).
The direction sign is chosen so that treble 8vb has its bottom line at E3 (a tenor voice sings an octave below the
written E4). The same function replaces the three hard-coded tables in `pitchToStaffPosition` and `yToStaffPosition`,
and gives the reference pitch for "first note entered" in `pitchFromLetter` (the note on the middle line of the clef:
B4 treble, D3 bass, C4 alto, A3 tenor).

## 4. Layout and entry
- Clef glyphs: `gClef`, `fClef`, `cClef`, and `gClef8vb`, `gClef8va`, `fClef8vb` (SMuFL names, added to the glyph
  whitelist). The sign sits on its line: `y = 4 - (L - 1)`.
- Ledger lines, stems, beams, slurs, ties and the rest placement already work from the staff position and do not change.
- Mouse and cursor entry use the same formula (`yToStaffPosition`), so a click on a staff line gives the right pitch on
  every clef (test per clef).
- The clef is drawn at the start of each system, as today, from the staff's clef.

## 5. Key signature on each clef (the one UNVERIFIED part)
Today the code keeps two tables (treble and bass, in staff-space Y values). The new design keeps a **single table of
diatonic staff positions per clef family** (treble, bass, and each C clef), generated from one rule and checked by tests:
- Treble sharps F5 C5 G5 D5 A4 E5 B4 and flats B4 E5 A4 D5 G4 C5 F4 (current, verified by use).
- Bass = treble shifted down two octaves (current values give the same result; test proves it).
- C clefs and octave clefs: octave clefs reuse their base clef's table; for each C clef the table is the treble table
  shifted by the whole number of octaves that places the first sharp and the first flat where printed editions put
  them (alto and tenor are the two common cases). I will write the tables from Gould and Ross, and I will **not close
  the step until the owner confirms one public-domain alto and one tenor example** (IMSLP). Until then the status
  note in this file says UNVERIFIED.

## 6. Editing
- New command `setStaffClef(staffId, clef)`; undoable; **pitches are not changed** (notes move on the staff, the
  sound stays). A warning in the tooltip says so.
- Toolbar (score structure area): a "Anahtar" button opens a small dialog: clef family (G, F, C), line (for C),
  octave shift. New staves created later (M7c-6) use the same dialog.
- Clef changes in the middle of a staff are **not** in this step (M7c-5).

## 7. Not in this step
Clef change inside a staff (M7c-5), percussion clef, tablature clefs, transposing-instrument settings (written versus
sounding pitch of the instrument; octave clefs here are only a notation device), MusicXML export (M9, the data
maps directly to `sign`, `line` and `clef-octave-change`).

## 8. Acceptance
- Unit tests: the formula for all 5 C clefs, G and F lines, octave clefs; round trip `pitchToStaffPosition` and
  `yToStaffPosition` on every clef; validation errors; `setStaffClef` keeps pitches.
- Layout tests: clef glyph and its y for each clef; key signature positions for 1, 2 and 7 sharps and flats on treble, bass,
  alto and tenor; ledger lines above and below on alto and tenor.
- Gallery cards: one staff per clef (alto, tenor, treble 8vb) with a key signature and a few notes.
- Owner check: one alto and one tenor example from a public-domain edition, compared with the print.

## 9. Order of work (each part ends with `npm run check` green)
1. Model, validation, the single formula, `pitchFromLetter` reference, tests (no visible change for treble and bass).
2. Layout: clef glyphs, key signature tables, ledger lines, mouse entry.
3. `setStaffClef` command, dialog and toolbar button, translations.
4. Gallery cards, parity matrix, docs, traceability.
