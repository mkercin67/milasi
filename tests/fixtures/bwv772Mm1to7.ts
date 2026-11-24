// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Reference Score Fixture: J. S. Bach, Invention No. 1 in C major, BWV 772, measures 1-7.
 *
 * Source: Bach-Gesellschaft Ausgabe, Band 3 (B.W. III.), via IMSLP; entered by hand by the project owner.
 * Composer: Johann Sebastian Bach
 * Composer Death Year: 1750
 * License: Public Domain
 *
 * The notes below are DATA entered by hand from the public-domain edition. No scan or engraving
 * is part of the repository (the reference stays in tests/private/, see docs/CORPUS_POLICY.md).
 *
 * Token grammar: "<step>[#|b]<octave>/<duration>[.][~]" or "r/<duration>[.]"
 *   duration: 1 whole, 2 half, 4 quarter, 8 eighth, 16 sixteenth, 32 thirty-second; "." = dotted;
 *   "~" = tied to the next note of the same pitch.
 * One string per measure, one voice per staff (right hand, left hand), 4/4, C major.
 *
 * M7c-9d: the common-time sign and the four ornament signs (mm. 1, 2, 5, 6) are entered, and the
 * first seven notes of m. 1 are in the octave of the edition (C4 ...; they were an octave too high before).
 * Difference accepted (docs/review/m7b-5-bwv772-gaps.md): beam slopes are engraved by the program.
 */

import { createGrandStaffScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { setBeamGrouping, setScoreMetadata, setTimeSignature, toggleOrnament } from '../../src/core/commands';
import type { BaseDurationType, Score, ScoreEvent } from '../../src/core/model';

export const BWV772_RIGHT_HAND: readonly string[] = [
    'r/16 C4/16 D4/16 E4/16 F4/16 D4/16 E4/16 C4/16 G4/8 C5/8 B4/8 C5/8',
    'D5/16 G4/16 A4/16 B4/16 C5/16 A4/16 B4/16 G4/16 D5/8 G5/8 F5/8 G5/8',
    'E5/16 A5/16 G5/16 F5/16 E5/16 G5/16 F5/16 A5/16 G5/16 F5/16 E5/16 D5/16 C5/16 E5/16 D5/16 F5/16',
    'E5/16 D5/16 C5/16 B4/16 A4/16 C5/16 B4/16 D5/16 C5/16 B4/16 A4/16 G4/16 F#4/16 A4/16 G4/16 B4/16',
    'A4/8 D4/8 C5/8. D5/16 B4/16 A4/16 G4/16 F#4/16 E4/16 G4/16 F#4/16 A4/16',
    'G4/16 B4/16 A4/16 C5/16 B4/16 D5/16 C5/16 E5/16 D5/16 B4/32 C5/32 D5/16 G5/16 B4/8 A4/16 G4/16',
    'G4/8 r/8 r/4 r/16 G4/16 A4/16 B4/16 C5/16 A4/16 B4/16 G4/16',
];

export const BWV772_LEFT_HAND: readonly string[] = [
    'r/2 r/16 C3/16 D3/16 E3/16 F3/16 D3/16 E3/16 C3/16',
    'G3/8 G2/8 r/4 r/16 G3/16 A3/16 B3/16 C4/16 A3/16 B3/16 G3/16',
    'C4/8 B3/8 C4/8 D4/8 E4/8 G3/8 A3/8 B3/8',
    'C4/8 E3/8 F#3/8 G3/8 A3/8 B3/8 C4/4~',
    'C4/16 D3/16 E3/16 F#3/16 G3/16 E3/16 F#3/16 D3/16 G3/8 B2/8 C3/8 D3/8',
    'E3/8 F#3/8 G3/8 E3/8 B2/8. C3/16 D3/8 D2/8',
    'r/16 G2/16 A2/16 B2/16 C3/16 A2/16 B2/16 G2/16 D3/8 G3/8 F#3/8 G3/8',
];

const DURATIONS: Record<string, BaseDurationType> = {
  '1': 'whole',
  '2': 'half',
  '4': 'quarter',
  '8': 'eighth',
  '16': '16th',
  '32': '32nd',
};

/** Parses one measure string into events (see the token grammar above). */
export function parseMeasure(text: string): ScoreEvent[] {
  return text.split(' ').map((token) => {
    const tied = token.endsWith('~');
    const [pitchPart, durPart] = token.replace('~', '').split('/');
    const dotted = durPart.endsWith('.');
    const baseType = DURATIONS[durPart.replace('.', '')];
    const dots = dotted ? 1 : 0;
    if (pitchPart === 'r') return createRest({ baseType, dots });
    const m = /^([A-G])(#|b)?(\d)$/.exec(pitchPart);
    if (!m) throw new Error(`Bad token: ${token}`);
    const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return createNote({
      pitches: [createPitch(m[1] as 'C', Number(m[3]), alter)],
      baseType,
      dots,
      tiedToNext: tied || undefined,
    });
  });
}

/** Builds the seven-measure grand-staff score with half-bar beaming (as in the edition). */
export function buildBwv772Mm1to7(): Score {
  const score = createGrandStaffScore({ measures: 7, timeSig: { num: 4, den: 4 } });
  const [treble, bass] = score.parts[0].staves;
  score.measures.forEach((m, i) => {
    treble.measures[m.id].voices[0].events = parseMeasure(BWV772_RIGHT_HAND[i]);
    bass.measures[m.id].voices[0].events = parseMeasure(BWV772_LEFT_HAND[i]);
  });
  // Commands last: they return frozen (immer) copies, so the events are filled in first.
  const titled = setScoreMetadata({
    title: 'Invention No. 1 in C major, BWV 772 (mm. 1-7)',
    composer: 'J. S. Bach',
  }).apply(score);
  const common = setTimeSignature(titled.measures[0].id, { num: 4, den: 4 }, 'score', 'common').apply(titled);
  // The four ornament signs of the edition (written as trills): m. 1 over B4, m. 2 over F5, m. 5 over the dotted
  // eighth C5, m. 6 over the eighth B4 (event indexes in the right hand).
  let result = common;
  for (const [m, idx] of [[0, 10], [1, 10], [4, 2], [5, 13]]) {
    const ev = result.parts[0].staves[0].measures[result.measures[m].id].voices[0].events[idx];
    result = toggleOrnament(ev.id, 'trill').apply(result);
  }
  return setBeamGrouping('half-bar').apply(result);
}
