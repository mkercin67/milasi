/**
 * Reference Score for Milestone 6d: "Süt İçtim Dilim Yandı".
 *
 * Characteristics:
 * - Title: "Süt İçtim Dilim Yandı"
 * - Subtitle: "Kilis / Güneydoğu Anadolu Türküsü"
 * - Composer: "Anonim (Kaynak: Abdurrahman Kızılay)"
 * - Arranger: "KYS Nota Kurulu"
 * - Meter: 2/4
 * - Key signature: 1 flat (-1)
 * - 9 measures (measures 0 to 8)
 * - Measure 0 is a pickup measure (actualTicks: 960)
 * - Section repeat with 1st and 2nd endings (Voltas)
 * - Syllables / lyrics on notes
 */

import {
  createMeasure,
  createNote,
  createPart,
  createPitch,
  createScore,
  newId,
} from '../core/factory';
import { Score } from '../core/model';

export function buildSutIctimScore(): Score {
  const score = createScore({
    title: 'Süt İçtim Dilim Yandı',
    subtitle: 'Kilis / Güneydoğu Anadolu Türküsü',
    composer: 'Anonim (Kaynak: Abdurrahman Kızılay)',
    arranger: 'KYS Nota Kurulu',
  });

  const mDefs = [];
  for (let i = 0; i < 9; i++) {
    const m = createMeasure({ num: 2, den: 4 });
    m.keySig = -1; // 1 flat (Bb)
    mDefs.push(m);
  }

  // Measure 0: Pickup (960 ticks)
  mDefs[0].actualTicks = 960;

  // Measure 1: Repeat start
  mDefs[1].repeat = 'start';

  // Measure 4: Volta 1
  mDefs[4].volta = { number: 1 };
  mDefs[4].repeat = 'end';

  // Measure 5: Volta 2
  mDefs[5].volta = { number: 2, openRight: false };

  // Measure 8: Final barline
  mDefs[8].endBarline = 'final';

  score.measures = mDefs;

  const part = createPart('Vocal');
  score.parts = [part];
  const staff = part.staves[0];

  // Notes and lyrics per measure
  // Measure 0: Pickup - 2 eighth notes: "Süt" "iç-"
  const n0_1 = createNote({ pitches: [createPitch('A', 4, 0)], baseType: 'eighth' });
  n0_1.lyrics = 'Süt';
  const n0_2 = createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'eighth' });
  n0_2.lyrics = 'iç-';
  staff.measures[mDefs[0].id] = { voices: [{ id: newId(), events: [n0_1, n0_2] }] };

  // Measure 1: 4 eighths: "tim", "di-", "lim", "yan-"
  const n1_1 = createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'eighth' });
  n1_1.lyrics = 'tim';
  const n1_2 = createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'eighth' });
  n1_2.lyrics = 'di-';
  const n1_3 = createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'eighth' });
  n1_3.lyrics = 'lim';
  const n1_4 = createNote({ pitches: [createPitch('A', 4, 0)], baseType: 'eighth' });
  n1_4.lyrics = 'yan-';
  staff.measures[mDefs[1].id] = { voices: [{ id: newId(), events: [n1_1, n1_2, n1_3, n1_4] }] };

  // Measure 2: 2 quarters: "dı", "a-"
  const n2_1 = createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' });
  n2_1.lyrics = 'dı';
  const n2_2 = createNote({ pitches: [createPitch('A', 4, 0)], baseType: 'quarter' });
  n2_2.lyrics = 'a-';
  staff.measures[mDefs[2].id] = { voices: [{ id: newId(), events: [n2_1, n2_2] }] };

  // Measure 3: 4 eighths: "man", "a-", "man", "a-"
  const n3_1 = createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'eighth' });
  n3_1.lyrics = 'man';
  const n3_2 = createNote({ pitches: [createPitch('A', 4, 0)], baseType: 'eighth' });
  n3_2.lyrics = 'a-';
  const n3_3 = createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'eighth' });
  n3_3.lyrics = 'man';
  const n3_4 = createNote({ pitches: [createPitch('A', 4, 0)], baseType: 'eighth' });
  n3_4.lyrics = 'a-';
  staff.measures[mDefs[3].id] = { voices: [{ id: newId(), events: [n3_1, n3_2, n3_3, n3_4] }] };

  // Measure 4: Volta 1: 1 half note: "man"
  const n4_1 = createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'half' });
  n4_1.lyrics = 'man';
  staff.measures[mDefs[4].id] = { voices: [{ id: newId(), events: [n4_1] }] };

  // Measure 5: Volta 2: 2 quarters: "man", "gü-"
  const n5_1 = createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' });
  n5_1.lyrics = 'man';
  const n5_2 = createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'quarter' });
  n5_2.lyrics = 'gü-';
  staff.measures[mDefs[5].id] = { voices: [{ id: newId(), events: [n5_1, n5_2] }] };

  // Measure 6: 2 quarters: "zel", "kız"
  const n6_1 = createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' });
  n6_1.lyrics = 'zel';
  const n6_2 = createNote({ pitches: [createPitch('A', 4, 0)], baseType: 'quarter' });
  n6_2.lyrics = 'kız';
  staff.measures[mDefs[6].id] = { voices: [{ id: newId(), events: [n6_1, n6_2] }] };

  // Measure 7: 4 eighths: "bir", "su", "ver", "ba-"
  const n7_1 = createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'eighth' });
  n7_1.lyrics = 'bir';
  const n7_2 = createNote({ pitches: [createPitch('E', 4, 0)], baseType: 'eighth' });
  n7_2.lyrics = 'su';
  const n7_3 = createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'eighth' });
  n7_3.lyrics = 'ver';
  const n7_4 = createNote({ pitches: [createPitch('E', 4, 0)], baseType: 'eighth' });
  n7_4.lyrics = 'ba-';
  staff.measures[mDefs[7].id] = { voices: [{ id: newId(), events: [n7_1, n7_2, n7_3, n7_4] }] };

  // Measure 8: 1 half note: "na"
  const n8_1 = createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'half' });
  n8_1.lyrics = 'na';
  staff.measures[mDefs[8].id] = { voices: [{ id: newId(), events: [n8_1] }] };

  return score;
}
