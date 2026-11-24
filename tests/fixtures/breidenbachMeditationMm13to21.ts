// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Reference Score Fixture: Kjelden Breidenbach, "Méditation" for solo violoncello (c. 2014, rev. 2019),
 * measures 13-21 (bass-clef whole notes, a clef change to the tenor clef and the changes of metre 4/4, 3/4, 4/4, 2/4, 4/4).
 *
 * Source: IMSLP #997742, "Complete Score", PDF typeset by the composer (Kjelden Breidenbach, 2019); the file
 *         page lists the licence as Creative Commons Zero 1.0. The PDF stays in tests/private/ (CORPUS_POLICY).
 *         Notes read by the project lead; to be checked by the project owner against the PDF (UNVERIFIED).
 * Composer: Kjelden Breidenbach
 * Composer Death Year: n/a (living composer; CC0 dedication)
 * License: CC0-1.0
 *
 * Token grammar: see markedMeasures.ts (chords with "+", lowest pitch first). Sounding pitches. E flat major (three flats).
 * Not entered (docs/review/m7c-9-meditation-gaps.md): the rehearsal mark A, the courtesy (flat) signs, the clef sign
 * the edition prints before the barline.
 */
import { setClefChange, setKeySignature, setScoreMetadata, setTimeSignature } from '../../src/core/commands';
import { createEmptyScore } from '../../src/core/factory';
import type { Score } from '../../src/core/model';
import { applyMarks, fillStaffEvents } from './markedMeasures';

const MEASURES = 9;
export const MEDITATION_MM13_21: readonly string[] = [
  'G2+Eb3/1', // m. 13
  'G2+E3/1@pp', // m. 14
  '(<G2+Eb3/1', // m. 15 (slur and crescendo start)
  'Eb3/4) Eb3/4 G3/4 C4/4]', // m. 16
  'C#4+A4/2.@f C#4+A4/4', // m. 17 (tenor clef from here)
  '(C#4+A4/8 B#3+G#4/8) (B#3+G#4/8 B3+G4/8) (B3+G4/8 B#3+G#4/8)', // m. 18 (3/4)
  'C#4+A4/2. C#4+A4/4', // m. 19 (4/4)
  '(C#4+A4/8 B#3+G#4/8) (B#3+G#4/8 B3+G4/8)', // m. 20 (2/4)
  'B3+G4/2. B3+G4/4', // m. 21 (4/4)
];

/** Builds the nine-measure solo cello excerpt. */
export function buildBreidenbachMeditationMm13to21(): Score {
  let score = createEmptyScore({ measures: MEASURES, clef: { sign: 'F', line: 4 }, timeSig: { num: 4, den: 4 } });
  score = structuredClone(score);
  score.parts[0].name = 'Solo Violoncello';
  score.parts[0].shortName = 'Vc.';
  score.parts[0].instrument = 'cello';
  const pending = fillStaffEvents(score, 0, MEDITATION_MM13_21);
  score = applyMarks(score, pending);
  score = setKeySignature(score.measures[0].id, -3, 'score').apply(score);
  score = setTimeSignature(score.measures[5].id, { num: 3, den: 4 }, 'from-here').apply(score);
  score = setTimeSignature(score.measures[6].id, { num: 4, den: 4 }, 'from-here').apply(score);
  score = setTimeSignature(score.measures[7].id, { num: 2, den: 4 }, 'from-here').apply(score);
  score = setTimeSignature(score.measures[8].id, { num: 4, den: 4 }, 'from-here').apply(score);
  score = setClefChange(score.parts[0].staves[0].id, score.measures[4].id, 0, { sign: 'C', line: 4 }).apply(score);
  return setScoreMetadata({ title: 'Méditation (mm. 13-21)', composer: 'K. Breidenbach' }).apply(score);
}
