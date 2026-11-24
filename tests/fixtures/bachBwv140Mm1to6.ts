// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Reference Score Fixture: J. S. Bach, chorale "Gloria sei dir gesungen" from Cantata BWV 140 (no. 7), measures 1-6
 * (the first system of the four-part setting, 371 vierstimmige Choräle no. 179).
 *
 * Source: IMSLP #948558 (typeset by Toru Yaskawa, Public Domain dedication); the scan/PDF stays in tests/private/,
 *         see docs/CORPUS_POLICY.md. Notes read by the project lead from the two-staff keyboard layout and
 *         split into four voices; to be checked by the project owner against the scan (UNVERIFIED).
 * Composer: Johann Sebastian Bach
 * Composer Death Year: 1750
 * License: Public Domain
 *
 * Token grammar: see markedMeasures.ts ("~" tie, "^" fermata above, "(" ")" slurs). Sounding pitches; the edition has no
 * lyrics, so none are entered. One string per measure and voice, 4/4, E flat major.
 */
import { setKeySignature, setScoreMetadata } from '../../src/core/commands';
import { createEmptyScore } from '../../src/core/factory';
import { applyTemplate } from '../../src/core/ensembleCommands';
import type { Score } from '../../src/core/model';
import { applyMarks, fillStaffEvents, fillVoiceEvents } from './markedMeasures';

const MEASURES = 6;
// Open points, see docs/review/m7c-9-bach-gaps.md: the bass of m. 4 beat 4 (Eb4, a notehead shared with the tenor?).
export const BWV140_SOPRANO: readonly string[] = [
  'Eb4/4 G4/4 Bb4/4. Bb4/8',
  'Bb4/4 Bb4/4 C5/2',
  'Bb4/2^ r/4 Bb4/4',
  'Eb5/4 Bb4/4 Eb5/8 F5/8 G5/4',
  'F5/4 Eb5/4 D5/4 C5/4',
  'Bb4/2^ r/4 Bb4/4',
];
export const BWV140_ALTO: readonly string[] = [
  'Bb3/4 Eb4/4 G4/4 F4/4',
  'G4/4 F4/4 G4/4 F4/4',
  'F4/2^ r/4 F4/4',
  'Bb4/4. Ab4/8 G4/8 Ab4/8 Bb4/4',
  'Bb4/4 C5/4~ C5/8 Bb4/4 A4/8',
  'F4/2^ r/4 G4/4',
];
export const BWV140_TENOR: readonly string[] = [
  'G3/4 Bb3/4 Eb4/4 D4/4',
  'Eb4/4 Bb3/4 Bb3/4 A3/4',
  'D4/2^ r/4 D4/4',
  'Eb4/4 Eb4/4 Bb3/4 Eb4/4',
  'F4/4 F4/4 F4/4. C4/8',
  'D4/2^ r/4 Eb4/4',
];
export const BWV140_BASS: readonly string[] = [
  'Eb3/2~ Eb3/8 G3/8 Bb3/8 Ab3/8',
  'G3/8 F3/8 Eb3/8 D3/8 Eb3/8 C3/8 F3/4',
  'Bb2/2^ r/4 Bb3/8 Ab3/8',
  'G3/8 Ab3/8 G3/8 F3/8 Eb3/4 Eb4/4',
  'D4/8 C4/8 Bb3/8 A3/8 Bb3/4 F3/4',
  'Bb2/2^ r/4 Eb3/8 Db3/8',
];

/** Builds the SATB score: E flat major (three flats), 4/4, bracket from the template. */
export function buildBachBwv140Mm1to6(): Score {
  let score = applyTemplate('satb').apply(createEmptyScore({ measures: MEASURES }));
  const lines = [BWV140_SOPRANO, BWV140_ALTO, BWV140_TENOR, BWV140_BASS];
  score = structuredClone(score);
  const pending = lines.map((line, p) => fillStaffEvents(score, p, line));
  pending.forEach((pm) => {
    score = applyMarks(score, pm);
  });
  score = setKeySignature(score.measures[0].id, -3, 'score').apply(score);
  return setScoreMetadata({
    title: 'Gloria sei dir gesungen, BWV 140/7 (mm. 1-6)',
    composer: 'J. S. Bach',
  }).apply(score);
}

/**
 * The same chorale in the layout of the edition: a piano grand staff, soprano (voice 1) and alto (voice 2) on the
 * treble staff, tenor (voice 1) and bass (voice 2) on the bass staff. One fermata above the upper staff and one
 * below the lower staff, as printed. Sounding pitches; the tenor is written in the bass clef, as in the edition.
 */
export function buildBachBwv140KeyboardMm1to6(): Score {
  let score = applyTemplate('piano').apply(createEmptyScore({ measures: MEASURES }));
  score = structuredClone(score);
  const lower = (line: readonly string[]) => line.map((m) => m.replace(/\^/g, ''));
  const bassBelow = BWV140_BASS.map((m) => m.replace(/\^/g, '_'));
  const pending = [
    fillVoiceEvents(score, 0, 0, 1, BWV140_SOPRANO),
    fillVoiceEvents(score, 0, 0, 2, lower(BWV140_ALTO)),
    fillVoiceEvents(score, 0, 1, 1, lower(BWV140_TENOR)),
    fillVoiceEvents(score, 0, 1, 2, bassBelow),
  ];
  pending.forEach((pm) => {
    score = applyMarks(score, pm);
  });
  score = setKeySignature(score.measures[0].id, -3, 'score').apply(score);
  return setScoreMetadata({
    title: 'Gloria sei dir gesungen, BWV 140/7 (mm. 1-6), keyboard layout',
    composer: 'J. S. Bach',
  }).apply(score);
}
