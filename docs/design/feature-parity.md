# Feature parity matrix (MuseScore / Finale class, Western notation)

Status: LIVING DOCUMENT. Referenced by `docs/design/m7c-plan.md` section 8.
Scope: Western notation only. Turkish repertoire (koma, makam) is deferred to M13 and listed once at the end.
Statuses: **DONE** (on main), **PLANNED Mx** (scheduled), **GAP** (not yet scheduled, needs a decision),
**NOT PLANNED** (deliberately out of scope). The "needed by" column names the real score or user need that
motivated the row, so priorities follow use, not feature lists.

## 1. Notes, rests, rhythm
| Feature | Status | Needed by |
|---|---|---|
| Notes, rests, dots, ties, chords, beams, beam grouping | DONE | all |
| Tuplets: triplet entry, number, beaming | DONE v1 (M7c-2b); bracket, other ratios and unequal groups are GAPs | Barge BWV 1030 m. 2 |
| Grace notes (appoggiatura, acciaccatura) | DONE v1 (M7c-3b): small notes with slash/beam/slur, entry through the main note, playback convention; single-voice measures only | Baroque flute and keyboard |
| Pickup (anacrusis) measure | DONE | BWV 1030 |
| Multi-measure rests | GAP | orchestral parts, flute parts |
| Cross-staff beams | NOT PLANNED | piano repertoire later |

## 2. Pitch, clef, key, meter
| Feature | Status | Needed by |
|---|---|---|
| Treble and bass clefs, key signatures, time signatures | DONE | all |
| Common time and cut time symbols | DONE (M7c-1) | BWV 772, BWV 1030 |
| C clefs (soprano, mezzo-soprano, alto, tenor, baritone), octave clefs (8vb/8va), F-clef lines 3 and 5, French violin | DONE v1 (M7c-4): toolbar "Anahtar" dialog changes the whole staff; pitches stay, only the written position changes. Key signature positions on C clefs are UNVERIFIED until compared with an IMSLP alto and tenor example; soprano, mezzo and baritone-C derive from the alto table and may touch a ledger line | viola, cello, tenor |
| Clef change inside a staff | DONE v1 (M7c-5): "Anahtar" dialog with scope whole staff or from the selected note; small clef in a bar, before the barline and as warning clef at a system end; entry by mouse, keyboard and grace notes uses the clef in force. Not carried by copy and paste; a beam is not broken by a change | K. 545 |
| Key and time change mid-score | DONE (scope: from here / whole score) | all |
| Transposing instruments (written vs sounding pitch) | GAP | clarinet, horn, band parts |

## 3. Articulation, dynamics, expression
| Feature | Status | Needed by |
|---|---|---|
| Staccato, tenuto, accent, marcato | DONE | all |
| Dynamics pp to ff, sfz, fp | DONE | all |
| Hairpins (crescendo, diminuendo) | DONE v1 (M7c-2c): select a range, button "Cresc." or "Dim."; below the staff; no keyboard shortcut, no manual length or position, not cleared by "clear notations", not carried by copy-paste | Barge BWV 1030 mm. 7 and later |
| Courtesy (cautionary) accidentals: print an accidental where key and bar do not require it | DONE v1: toolbar "Hatırlatma" on the selected notes (no keyboard shortcut yet) | Barge BWV 1030 mm. 9 and 12 |
| Slur clears articulations on its side (staccato dots sit between the heads and the slur) | DONE (same-system slurs; cross-system slurs unchanged) | Barge BWV 1030 m. 3 (four staccato eighths under one slur) |
| Text expressions ("cresc.", "dolce", "espr.", "pizz.", "arco"), bowing signs (down-bow, up-bow) | GAP (M10; Méditation uses "poco a poco cresc.", "pizz.", "arco", down-bows) | Barge BWV 1030 (expected) |
| Tempo text and BPM | DONE (basic); styled text M10 | BWV 1030 "Andante" |
| Fermata, breath mark, caesura | DONE (M7c-2) | chorales, wind parts |
| Ornaments: trill, mordent, inverted mordent, turn | DONE v1 (M7c-3): sign above the note, toolbar only, ignored by playback (M11) | Barge BWV 1030 m. 10, BWV 772, K. 545 |
| Trill extension line, arpeggio, glissando | GAP | keyboard and string repertoire |
| Ottava lines (8va, 8vb) | GAP | flute, piano high register |
| Pedal markings | PLANNED M12 | piano |
| Figured bass | PLANNED M12 | Baroque continuo |

## 4. Structure
| Feature | Status | Needed by |
|---|---|---|
| Barlines: single, double, final, repeat | DONE | all |
| Volta endings (1st and 2nd time) | DONE (M6d model field `volta`) | all |
| Rehearsal marks, measure numbers | GAP (measure numbers at system starts are drawn; boxed rehearsal letters are not; seen again in Breidenbach, Méditation, marks A and P) | Barge BWV 1030 (rehearsal "A"), ensemble parts |
| D.C., D.S., coda, segno | GAP | all |
| Staves and parts: grand staff, voices 1 to 4 | DONE | piano, SATB on two staves |
| Four-staff ensembles, groups, brackets, templates | DONE v1 (M7c-6); see KNOWN_ISSUES for bracket ends and part labels | string quartet, choir |
| Part extraction from a score | GAP | ensembles |

## 5. Text and lyrics
| Feature | Status | Needed by |
|---|---|---|
| Title, composer, subtitle | DONE | all |
| Lyrics verse 1, hyphens, melismas, polyphonic measures | DONE | vocal |
| Multi-verse lyrics | DONE v1 (M7c-7): up to 8 verses, stacked; no verse-number labels | hymns, songs |
| Note-name layer (solfege and letter) | DONE | students |
| Chord symbols (guitar style) | GAP | lead sheets |

## 6. Input and editing
| Feature | Status | Needed by |
|---|---|---|
| Keyboard and mouse note input, selection, copy and paste | DONE | all |
| MIDI keyboard input | GAP | students |
| Undo and redo, autosave, save and open | DONE | all |
| Transposition (semitone, octave) | DONE | all |
| Transpose whole score by interval | GAP | students |
| Find and replace, select similar | NOT PLANNED | later |

## 7. Output and interoperability
| Feature | Status | Needed by |
|---|---|---|
| Browser print | UNVERIFIED: no print code found in `src/`; treat as GAP until M8 | all |
| PDF export, paper sizes (A4, A5), margins, page layout | PLANNED M7d, M8 | printing and teaching |
| MusicXML import and export | PLANNED M9 | exchange with MuseScore and Finale |
| MIDI export, audio export (WAV or MP3) | GAP | students |
| Playback: metrical, with dynamics | DONE | all |
| Playback: fermata pause, ornaments, repeats | PLANNED M11 | all |
| Per-part mute and solo, mixer | DONE v1 (M7c-8): one MIDI channel per part, mute and solo per staff | ensembles |

## 8. Engraving quality
| Feature | Status | Needed by |
|---|---|---|
| Notehead, stem, beam, slur and tie shapes | DONE (Bravura glyphs) | all |
| Skyline spacing between staves | DONE (M7b-4) | grand staff |
| Collision avoidance among text, dynamics, hairpins | GAP | dense scores |
| Manual position overrides | DONE (position mode) | all |
| Style settings (staff size, fonts, spacing) | GAP | printing |

## 9. Deferred, Turkish repertoire (M13 and later)
Koma accidentals, makam key signatures, Turkish note names for playback and microtonal playback.

## 10. How this table is used
1. Each acceptance entry (a public-domain edition entered by hand) adds the gaps it exposes to the "Needed by" column.
2. A GAP row gets a milestone only after the owner agrees the order; nothing here changes the roadmap by itself.
3. Rows marked "expected" are predictions from reading the edition. They become fact or are removed after the entry.
4. Claims about the editions stay UNVERIFIED until the owner compares them with the IMSLP page.
