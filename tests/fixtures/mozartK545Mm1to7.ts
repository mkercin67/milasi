// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Reference Score Fixture: W. A. Mozart, Piano Sonata No. 16 in C major ("Sonata facile"), K. 545,
 * 1st movement (Allegro), measures 1-7.
 *
 * Source: C.F. Peters (Leipzig, ca. 1938), ed. Martienssen/Weismann, urtext, via IMSLP #70214 (public domain
 *         as listed there); entered by hand by the project owner and checked by the project lead.
 * Composer: Wolfgang Amadeus Mozart
 * Composer Death Year: 1791
 * License: Public Domain
 *
 * The notes below are DATA entered by hand. Only pitches and rhythms of Mozart's text are taken over:
 * editorial fingerings, pedal marks, "non legato", the parenthesised dynamics and the trill sign are NOT
 * part of the fixture. No scan or engraving is in the repository (the reference stays in tests/private/,
 * see docs/CORPUS_POLICY.md).
 *
 * Token grammar: "<pitch>[+<pitch>...]/<duration>[.]" or "r/<duration>[.]"
 *   pitch: "<step>[#|b]<octave>"; several pitches joined with "+" form a chord (one event).
 *   duration: 1 whole, 2 half, 4 quarter, 8 eighth, 16 sixteenth, 32 thirty-second; "." = dotted.
 * One string per measure, one voice per staff (right hand, left hand), 4/4, C major.
 *
 * M7c-9d: like the edition, the left hand starts in the treble clef and changes to the bass clef inside m. 5
 * (before the last quarter, F3+C4), the trill sign stands over the F5 eighth of m. 4, and the common-time sign
 * is used, and the two slurs of mm. 2 and 4 are entered. Differences still accepted (docs/review/m7b-5-k545-gaps.md): no
 * editorial marks.
 */

import { createGrandStaffScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { setClefChange, setScoreMetadata, setTimeSignature, toggleOrnament, toggleSlur } from '../../src/core/commands';
import type { BaseDurationType, Score, ScoreEvent } from '../../src/core/model';

export const K545_RIGHT_HAND: readonly string[] = [
  'C5/2 E5/4 G5/4',
  'B4/4. C5/16 D5/16 C5/4 r/4',
  'A5/2 G5/4 C6/4',
  'G5/4 F5/8 E5/16 F5/16 E5/4 r/4',
  'A4/8 B4/16 C5/16 D5/16 E5/16 F5/16 G5/16 A5/16 G5/16 F5/16 E5/16 D5/16 C5/16 B4/16 A4/16',
  'G4/8 A4/16 B4/16 C5/16 D5/16 E5/16 F5/16 G5/16 F5/16 E5/16 D5/16 C5/16 B4/16 A4/16 G4/16',
  'F4/8 G4/16 A4/16 B4/16 C5/16 D5/16 E5/16 F5/16 E5/16 D5/16 C5/16 B4/16 A4/16 G4/16 F4/16',
];

export const K545_LEFT_HAND: readonly string[] = [
  'C4/8 G4/8 E4/8 G4/8 C4/8 G4/8 E4/8 G4/8',
  'D4/8 G4/8 F4/8 G4/8 C4/8 G4/8 E4/8 G4/8',
  'C4/8 A4/8 F4/8 A4/8 C4/8 G4/8 E4/8 G4/8',
  'B3/8 G4/8 D4/8 G4/8 C4/8 G4/8 E4/8 G4/8',
  'F4/4 r/4 r/4 F3+C4/4',
  'C3+C4/4 r/4 r/4 E3+C4/4',
  'D3+C4/4 r/4 r/4 D3+B3/4',
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
    const [pitchPart, durPart] = token.split('/');
    const dots = durPart.endsWith('.') ? 1 : 0;
    const baseType = DURATIONS[durPart.replace('.', '')];
    if (pitchPart === 'r') return createRest({ baseType, dots });
    const pitches = pitchPart.split('+').map((p) => {
      const m = /^([A-G])(#|b)?(\d)$/.exec(p);
      if (!m) throw new Error(`Bad token: ${token}`);
      return createPitch(m[1] as 'C', Number(m[3]), m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    });
    return createNote({ pitches, baseType, dots });
  });
}

/** Builds the seven-measure grand-staff score; beaming stays at the default (per beat). */
export function buildK545Mm1to7(): Score {
  const score = createGrandStaffScore({ measures: 7, timeSig: { num: 4, den: 4 } });
  const [treble, bass] = score.parts[0].staves;
  score.measures.forEach((m, i) => {
    treble.measures[m.id].voices[0].events = parseMeasure(K545_RIGHT_HAND[i]);
    bass.measures[m.id].voices[0].events = parseMeasure(K545_LEFT_HAND[i]);
  });
  // Commands last: they return frozen (immer) copies, so the events are filled in first.
  // The edition prints the bass clef, the common-time sign and then a treble clef at the start of the left hand (a
  // reminder that the clef is the treble clef). The program draws the effective clef only, so the staff starts in the
  // treble clef (plain copy: set before the commands run) and changes back to the bass clef before the last quarter of m. 5.
  bass.clef = { sign: 'G', line: 2 };
  let result = setClefChange(bass.id, score.measures[4].id, 2880, { sign: 'F', line: 4 }).apply(score);
  result = setTimeSignature(result.measures[0].id, { num: 4, den: 4 }, 'score', 'common').apply(result);
  // The trill over the eighth F5 of m. 4 (right hand, second event).
  const trillNote = result.parts[0].staves[0].measures[result.measures[3].id].voices[0].events[1];
  result = toggleOrnament(trillNote.id, 'trill').apply(result);
  // The two slurs of the right hand: m. 2 from the dotted B4 to the quarter C5, m. 4 from the eighth F5
  // to the last sixteenth (F5), below the trill.
  const rh = result.parts[0].staves[0];
  const rhEvents = (m: number) => rh.measures[result.measures[m].id].voices[0].events;
  const slur = (m: number, from: number, to: number) =>
    toggleSlur({ kind: 'range', staffId: rh.id, voiceIndex: 1, anchorId: rhEvents(m)[from].id, focusId: rhEvents(m)[to].id });
  result = slur(1, 0, 3).apply(result);
  result = slur(3, 1, 3).apply(result);
  return setScoreMetadata({
    title: 'Sonata facile, K. 545, 1st movement (mm. 1-7)',
    composer: 'W. A. Mozart',
  }).apply(result);
}
