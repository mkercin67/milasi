// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Reference Score Fixture: F. Schubert, "An die Musik" (text: Franz von Schober), D. 547 / Op. 88 No. 4,
 * second version, measures 1-5 (piano introduction and the first vocal phrase), high voice, D major, 2/2.
 *
 * Source: Franz Schubert's Werke, Serie XX, Band 5, No. 314b, ed. E. Mandyczewski (Breitkopf & Haertel, Leipzig,
 *         1895), via IMSLP #10425 (Public Domain). The scan stays in tests/private/, see docs/CORPUS_POLICY.md.
 *         Notes read by the project lead; to be checked by the project owner against that scan (UNVERIFIED).
 * Composer: Franz Schubert
 * Composer Death Year: 1828
 * License: Public Domain
 *
 * Token grammar: see markedMeasures.ts. Chords are written with "+" (one event). Voice: voice part, one staff;
 * piano: right hand (treble staff) and left hand (bass staff). Verse 1 and 2 are pasted with pasteLyrics.
 * Marks: p (m. 1), pp (m. 3), a short diminuendo hairpin under the first two chords of m. 2, staccato dots,
 * slurs, and the start repeat sign before m. 3.
 */
import { setKeySignature, setRepeatStart, setScoreMetadata, setTimeSignature, addGraceNote, pasteLyrics } from '../../src/core/commands';
import { createEmptyScore, createPitch } from '../../src/core/factory';
import { applyTemplate } from '../../src/core/ensembleCommands';
import type { Score } from '../../src/core/model';
import { applyMarks, fillStaffEvents, parseMarkedMeasure } from './markedMeasures';

const MEASURES = 5;
export const AN_DIE_MUSIK_VOICE: readonly string[] = [
  'r/1',
  'r/1',
  'r/4 A4/4 D5/4 D5/4',
  'F#4/2. B4/4',
  'D4/4. D4/8 (F#4/8 E4/8) (D4/8 E4/8)',
];
export const AN_DIE_MUSIK_RIGHT_HAND: readonly string[] = [
  'A3+D4+F#4/8@p A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8',
  '>A3+D4+A4/8 A3+D4+A4/8] A3+D4+A4/8 A3+D4+A4/8 A3+C#4+G4/8 A3+C#4+G4/8 G3+A3+C#4+E4/8 G3+A3+C#4+E4/8',
  'F#3+A3+D4/8@pp A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8',
  'A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8 F#3+D4+F#4/8 F#3+F#4/8 B3+D4+F#4/8 B3+D4+F#4/8',
  'r/8 A3+D4+F#4/8 A3+D4+F#4/8 A3+D4+F#4/8 r/8 A3+C#4+G4/8 A3+C#4+G4/8 A3+C#4+G4/8',
];
export const AN_DIE_MUSIK_LEFT_HAND: readonly string[] = [
  'r/4 (A2/4 D3/4) D3/4!',
  'F#2/2 A2/4! A1/4!',
  'D2/4 r/4 r/2',
  'r/4 (F#2/4 B2/4) G#2/4!',
  'A2/4 r/4 A2/4 r/4',
];
const VERSE_1 = 'Du hol- de Kunst, in wie viel grau- en_';
const VERSE_2 = 'Oft hat ein Seuf- zer, dei- ner Harf\' ent- flos- sen,';

/** Builds the voice and piano score: D major (two sharps), cut time, bracketless voice, braced piano. */
export function buildSchubertD547Mm1to5(): Score {
  let score = applyTemplate('voicePiano').apply(createEmptyScore({ measures: MEASURES, timeSig: { num: 2, den: 2 } }));
  score = structuredClone(score);
  const pending = [
    fillStaffEvents(score, 0, AN_DIE_MUSIK_VOICE),
    fillStaffEvents(score, 1, AN_DIE_MUSIK_RIGHT_HAND),
  ];
  // The piano part has two staves; the left hand is staff 1 of part 1.
  const lh = score.parts[1].staves[1];
  const lhItems: typeof pending[0]['items'] = [];
  
  score.measures.forEach((m, i) => {
    const parsed = parseMarkedMeasure(AN_DIE_MUSIK_LEFT_HAND[i]);
    lh.measures[m.id].voices[0].events = parsed.events;
    parsed.events.forEach((ev, k) => lhItems.push({ id: ev.id, marks: parsed.marks[k] }));
  });
  pending.push({ staffId: lh.id, items: lhItems });
  pending.forEach((pm) => {
    score = applyMarks(score, pm);
  });
  score = setKeySignature(score.measures[0].id, 2, 'score').apply(score);
  score = setTimeSignature(score.measures[0].id, { num: 2, den: 2 }, 'score', 'cut').apply(score);
  // The start repeat sign before m. 3 (the matching end repeat lies after the excerpt).
  score = setRepeatStart(score.measures[2].id, true).apply(score);
  const voiceEvents = (m: number) => score.parts[0].staves[0].measures[score.measures[m].id].voices[0].events;
  // Lyrics: verse 1 and 2 start on the first note of m. 3 (the quarter rest is skipped).
  const first = voiceEvents(2)[1].id;
  score = pasteLyrics(first, VERSE_1, undefined, 1).apply(score);
  score = pasteLyrics(first, VERSE_2, undefined, 2).apply(score);
  // The small eighth note (appoggiatura, B4) in front of the first note of m. 5.
  score = addGraceNote(voiceEvents(4)[0].id, {
    kind: 'appoggiatura',
    pitch: createPitch('B', 4),
    baseType: 'eighth',
  }).apply(score);
  return setScoreMetadata({ title: 'An die Musik, D. 547 (mm. 1-5)', composer: 'F. Schubert' }).apply(score);
}
