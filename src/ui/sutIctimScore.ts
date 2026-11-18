// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Reference Score Fixture: "Süt İçtim Dilim Yandı"
 *
 * Source: Traditional Turkish Folk Song (Kilis / Gaziantep regional folklore)
 * Composer: Traditional / Anonymous
 * Composer Death Year: Traditional / Pre-1900 (Public Domain)
 * License: Public Domain
 *
 * Characteristics:
 * - Title: "Süt İçtim Dilim Yandı"
 * - Meter: 2/4
 * - Clef: Treble (G2)
 * - Key Signature: C major (0 sharps/flats)
 * - 8 full measures (no pickup, no voltas)
 * - Measure 4: quarters F4, E4 with repeatEnd
 * - Measure 5: eighths D4, E4, F4, G4 with repeatStart
 * - Measure 8: quarters D4, D4 with repeatEnd
 * - Turkish solfège syllables (Do, Re, Mi, Fa, Sol, La, Si) via autoSolfege command
 */

import { createEmptyScore, createNote, createPitch } from '../core/factory';
import { autoSolfege, setRepeatEnd, setRepeatStart, setScoreMetadata } from '../core/commands';
import { Score } from '../core/model';
import { produce } from 'immer';

/**
 * Builds the true "Süt İçtim Dilim Yandı" reference score using score commands.
 *
 * @returns Score configured with reference notes, repeats, and solfege syllables.
 */
export function buildSutIctimScore(): Score {
  // 1. Create base empty 8-measure score in 2/4 C major
  let score = createEmptyScore({ numMeasures: 8, timeSig: { num: 2, den: 4 } });

  // 2. Set metadata
  score = setScoreMetadata({
    title: 'Süt İçtim Dilim Yandı',
    composer: 'Müzik Notlarım',
    subtitle: '',
    arranger: '',
  }).apply(score);

  // Helpers for pitches and notes
  const p = (step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', oct = 4) => createPitch(step, oct, 0);
  const n8 = (step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', oct = 4) =>
    createNote({ pitches: [p(step, oct)], baseType: 'eighth' });
  const n4 = (step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', oct = 4) =>
    createNote({ pitches: [p(step, oct)], baseType: 'quarter' });

  // 3. Define measure notes
  const measuresNotes = [
    [n8('D'), n8('E'), n8('F'), n8('G')], // Measure 1: D4 E4 F4 G4
    [n8('F'), n8('G'), n8('G'), n8('G')], // Measure 2: F4 G4 G4 G4
    [n8('F'), n8('G'), n8('G'), n8('G')], // Measure 3: F4 G4 G4 G4
    [n4('F'), n4('E')],                   // Measure 4: quarters F4 E4 (repeatEnd)
    [n8('D'), n8('E'), n8('F'), n8('G')], // Measure 5: D4 E4 F4 G4 (repeatStart)
    [n8('E'), n8('F'), n8('D'), n8('E')], // Measure 6: E4 F4 D4 E4
    [n8('C'), n8('C'), n8('F'), n8('E')], // Measure 7: C4 C4 F4 E4
    [n4('D'), n4('D')],                   // Measure 8: quarters D4 D4 (repeatEnd)
  ];

  score = produce(score, (draft) => {
    const staff = draft.parts[0].staves[0];
    for (let mIdx = 0; mIdx < 8; mIdx++) {
      const mId = draft.measures[mIdx].id;
      staff.measures[mId].voices[0].events = measuresNotes[mIdx];
    }
  });

  // 4. Set repeat markings via commands
  score = setRepeatEnd(score.measures[3].id, true).apply(score);
  score = setRepeatStart(score.measures[4].id, true).apply(score);
  score = setRepeatEnd(score.measures[7].id, true).apply(score);

  // 5. Apply Turkish solfege syllables via autoSolfege command
  score = autoSolfege(score.id).apply(score);

  return score;
}
