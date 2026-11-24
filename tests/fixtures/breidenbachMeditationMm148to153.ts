// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Reference Score Fixture: Kjelden Breidenbach, "Méditation" for solo violoncello (c. 2014, rev. 2019),
 * measures 148-153 (ff with accents, a tie over the barline, a diminuendo, the change to the tenor clef in the
 * middle of m. 150 and a p whole note).
 *
 * Source: IMSLP #997742, "Complete Score", PDF typeset by the composer (Kjelden Breidenbach, 2019); the file
 *         page lists the licence as Creative Commons Zero 1.0. The PDF stays in tests/private/ (CORPUS_POLICY).
 *         Notes read by the project lead; to be checked by the project owner against the PDF (UNVERIFIED).
 * Composer: Kjelden Breidenbach
 * Composer Death Year: n/a (living composer; CC0 dedication)
 * License: CC0-1.0
 *
 * Token grammar: see markedMeasures.ts. Sounding pitches, E flat major (three flats), 4/4.
 * Not entered (docs/review/m7c-9-meditation-gaps.md): the down-bow signs, the rehearsal mark P.
 */
import { setClefChange, setKeySignature, setScoreMetadata, toggleArticulation } from '../../src/core/commands';
import { createEmptyScore } from '../../src/core/factory';
import type { Score } from '../../src/core/model';
import { applyMarks, fillStaffEvents } from './markedMeasures';

export const MEDITATION_MM148_153: readonly string[] = [
  'C2/4@ff r/4 D4/4 r/4', // m. 148 (accents on C2 and D4)
  'C2/4 r/4 >C4/2~', // m. 149 (accent on C2; the diminuendo starts on the half note)
  'C4/2 (C4/4 D4/4)]', // m. 150 (tenor clef from the third beat)
  'G4/1@p', // m. 151
  'r/2 (C4/4 D4/4)', // m. 152
  'G4/1', // m. 153
];

/** Builds the six-measure solo cello excerpt. */
export function buildBreidenbachMeditationMm148to153(): Score {
  let score = createEmptyScore({ measures: 6, clef: { sign: 'F', line: 4 }, timeSig: { num: 4, den: 4 } });
  score = structuredClone(score);
  score.parts[0].name = 'Solo Violoncello';
  score.parts[0].shortName = 'Vc.';
  score.parts[0].instrument = 'cello';
  const pending = fillStaffEvents(score, 0, MEDITATION_MM148_153);
  score = applyMarks(score, pending);
  score = setKeySignature(score.measures[0].id, -3, 'score').apply(score);
  const ev = (m: number, i: number): string =>
    score.parts[0].staves[0].measures[score.measures[m].id].voices[0].events[i].id;
  for (const [m, i] of [[0, 0], [0, 2], [1, 0], [1, 2]] as const) {
    score = toggleArticulation(ev(m, i), 'accent').apply(score);
  }
  score = setClefChange(score.parts[0].staves[0].id, score.measures[2].id, 1920, { sign: 'C', line: 4 }).apply(score);
  return setScoreMetadata({ title: 'Méditation (mm. 148-153)', composer: 'K. Breidenbach' }).apply(score);
}
