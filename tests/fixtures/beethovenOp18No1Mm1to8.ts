// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Reference Score Fixture: L. van Beethoven, String Quartet No. 1 in F major, Op. 18 No. 1,
 * 1st movement (Allegro con brio), measures 1-8.
 *
 * Source: public-domain edition on IMSLP (the scan stays in tests/private/, see docs/CORPUS_POLICY.md);
 *         notes entered by hand by the project owner, checked by the project lead.
 * Composer: Ludwig van Beethoven
 * Composer Death Year: 1827
 * License: Public Domain
 *
 * STATUS: ENTERED (m. 1-8). One string per measure, one array per instrument. Token grammar: see
 * markedMeasures.ts (notes "<pitch>[+<pitch>...]/<duration>[.]" or "r/<duration>[.]", plus "(" ")" slurs,
 * "<" ">" "]" hairpins, "!" staccato, "@p" dynamics). Sounding pitches as in the edition: violins in the treble
 * clef, viola in the alto clef (middle C on the middle line = C4), cello in the bass clef.
 */
import { setKeySignature, setScoreMetadata } from '../../src/core/commands';
import { createEmptyScore } from '../../src/core/factory';
import { applyTemplate } from '../../src/core/ensembleCommands';
import type { Score } from '../../src/core/model';
import { applyMarks, fillStaffEvents } from './markedMeasures';

const MEASURES = 8;
// Entered from the IMSLP #973801 scan (Breitkopf Gesamtausgabe, 1862, Public Domain). Notes of m. 1-4 by the
// project lead and of m. 5-8 by the project owner (program entry, converted to this grammar); checked on screen
// against the scan by the owner. Marks follow the scan: p under m. 1, slurs, staccato, hairpins (< m. 5, > m. 6).
// Open points, see docs/review/m7c-9-beethoven-gaps.md: the hairpins of m. 7-8 and whether the first curve of m. 1
// is a slur (as entered) or a tie. The mark before the half note of violin II m. 7 is a stain in the scan, not a grace note.
export const OP18_1_VIOLIN_I: readonly string[] = [
  '(F4/4@p (F4/8) G4/16 F4/16) E4/8! F4/8!',
  'C4/4 r/4 r/4',
  '(F4/4 (F4/8) G4/16 F4/16) E4/8! F4/8!',
  'D4/4 r/4 r/4',
  '(<F5/4 (F5/8) G5/16 F5/16) E5/8! F5/8!]',
  '(>G5/2 Bb4/4)]',
  '(A4/2 D5/8. Bb4/16)',
  '(A4/2 A4/4)',
];
export const OP18_1_VIOLIN_II: readonly string[] = [
  '(F4/4@p (F4/8) G4/16 F4/16) E4/8! F4/8!',
  'C4/4 r/4 r/4',
  '(F4/4 (F4/8) G4/16 F4/16) E4/8! F4/8!',
  'D4/4 r/4 r/4',
  '(<Bb4/2.',
  '(>Bb4/2)] G4/4)]',
  '(F4/2 Bb4/8. G4/16)',
  'F4/2 E4/4',
];
export const OP18_1_VIOLA: readonly string[] = [
  '(F3/4@p (F3/8) G3/16 F3/16) E3/8! F3/8!',
  'C3/4 r/4 r/4',
  '(F3/4 (F3/8) G3/16 F3/16) E3/8! F3/8!',
  'D3/4 r/4 r/4',
  '(<D4/2.',
  '(>C4/2.)]',
  '(C4/4)] D4/4 G3/4)',
  '(C4/8 B3/8 C4/8 B3/8 C4/4)',
];
export const OP18_1_CELLO: readonly string[] = [
  '(F3/4@p (F3/8) G3/16 F3/16) E3/8! F3/8!',
  'C3/4 r/4 r/4',
  '(F3/4 (F3/8) G3/16 F3/16) E3/8! F3/8!',
  'D3/4 r/4 r/4',
  '(<D3/2.',
  '(>E3/2.)]',
  '(F3/4)] D3/4 Bb2/4)',
  'C3/2.',
];

/** Builds the four-part score: F major (one flat), 3/4, bracket and through barlines from the template. */
export function buildBeethovenOp18No1Mm1to8(): Score {
  let score = applyTemplate('stringQuartet').apply(
    createEmptyScore({ measures: MEASURES, timeSig: { num: 3, den: 4 } })
  );
  const lines = [OP18_1_VIOLIN_I, OP18_1_VIOLIN_II, OP18_1_VIOLA, OP18_1_CELLO];
  // Events first, marks by commands last (fillStaffEvents and applyMarks keep that order).
  score = structuredClone(score);
  const pending = lines.map((line, p) => fillStaffEvents(score, p, line));
  pending.forEach((pm) => {
    score = applyMarks(score, pm);
  });
  score = setKeySignature(score.measures[0].id, -1, 'score').apply(score);
  return setScoreMetadata({
    title: 'String Quartet Op. 18 No. 1, 1st movement (mm. 1-8)',
    composer: 'L. van Beethoven',
  }).apply(score);
}
