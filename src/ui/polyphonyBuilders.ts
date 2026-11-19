// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Source: J. S. Bach, chorale "Wachet auf, ruft uns die Stimme", BWV 140/7
 * (371 vierstimmige Choraele no. 179), mm. 1-6 soprano and alto of the two-staff
 * reduction; reference scan IMSLP #948558 (Toru Yaskawa, public-domain
 * dedication), notes entered by hand; the scan itself is not in the repo.
 * Composer: J. S. Bach. Composer Death Year: 1750. License: public domain.
 *
 * Scope note: Fermata, common-time "C" symbol, and figured bass are out of scope.
 * Entered as plain half notes in 4/4 as specified.
 */

import { addVoice } from '../core/commands';
import { createEmptyScore, createNote, createPitch, createRest } from '../core/factory';
import { Score } from '../core/model';

export interface PolyphonyGalleryCard {
  id: string;
  title: string;
  tag: 'OBSERVED' | 'PROPOSED' | 'OBSERVED / PROPOSED';
  description: string;
  notesChecklist?: string[];
  build: () => Score;
}

/**
 * Builds the hand-entered corpus fixture for BWV 140/7 mm. 1-6.
 */
export function buildBwv140Reduction(): Score {
  const score = createEmptyScore({ measures: 6 });
  score.meta.title = 'BWV 140/7 "Wachet auf, ruft uns die Stimme" (mm. 1-6)';
  score.meta.composer = 'J. S. Bach';

  const staff = score.parts[0].staves[0];
  staff.clef = { sign: 'G', line: 2 };

  score.measures = score.measures.map((mDef) => ({
    ...mDef,
    keySig: -3, // E-flat major
    timeSig: { num: 4, den: 4 },
  }));

  for (let m = 0; m < 6; m++) {
    const mDef = score.measures[m];
    // Ensure Voice 2 exists in measure
    addVoice(staff.id, mDef.id, 2).apply(score);
  }

  // Measure 1
  // S: Eb4 q | G4 q | Bb4 dotted-q | Bb4 e
  // A: Bb3 q | Eb4 q | G4 q | F4 q
  const m1Id = score.measures[0].id;
  staff.measures[m1Id] = {
    voices: [
      {
        id: 'bwv140-m1-v1',
        voiceIndex: 1,
        events: [
          createNote({ pitches: [createPitch('E', 4, -1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'quarter', dots: 1 }),
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'eighth' }),
        ],
      },
      {
        id: 'bwv140-m1-v2',
        voiceIndex: 2,
        events: [
          createNote({ pitches: [createPitch('B', 3, -1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('E', 4, -1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'quarter' }),
        ],
      },
    ],
  };

  // Measure 2
  // S: Bb4 q | Bb4 q | C5 h
  // A: G4 q | F4 q | G4 q | F4 q
  const m2Id = score.measures[1].id;
  staff.measures[m2Id] = {
    voices: [
      {
        id: 'bwv140-m2-v1',
        voiceIndex: 1,
        events: [
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'half' }),
        ],
      },
      {
        id: 'bwv140-m2-v2',
        voiceIndex: 2,
        events: [
          createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'quarter' }),
        ],
      },
    ],
  };

  // Measure 3
  // S: Bb4 h | rest q | Bb4 q
  // A: F4 h  | rest q | F4 q
  const m3Id = score.measures[2].id;
  staff.measures[m3Id] = {
    voices: [
      {
        id: 'bwv140-m3-v1',
        voiceIndex: 1,
        events: [
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'half' }),
          createRest({ baseType: 'quarter', duration: 960 }),
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'quarter' }),
        ],
      },
      {
        id: 'bwv140-m3-v2',
        voiceIndex: 2,
        events: [
          createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'half' }),
          createRest({ baseType: 'quarter', duration: 960 }),
          createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'quarter' }),
        ],
      },
    ],
  };

  // Measure 4
  // S: Eb5 q | Bb4 q | Eb5 e | F5 e | G5 q
  // A: Bb4 dotted-q | Ab4 e | G4 e | Ab4 e | Bb4 q
  const m4Id = score.measures[3].id;
  staff.measures[m4Id] = {
    voices: [
      {
        id: 'bwv140-m4-v1',
        voiceIndex: 1,
        events: [
          createNote({ pitches: [createPitch('E', 5, -1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('E', 5, -1)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('F', 5, 0)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('G', 5, 0)], baseType: 'quarter' }),
        ],
      },
      {
        id: 'bwv140-m4-v2',
        voiceIndex: 2,
        events: [
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'quarter', dots: 1 }),
          createNote({ pitches: [createPitch('A', 4, -1)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('A', 4, -1)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'quarter' }),
        ],
      },
    ],
  };

  // Measure 5
  // S: F5 q | Eb5 q | D5 q | C5 q
  // A: Bb4 q | C5 q (tied to next) | C5 e | Bb4 q | A4 natural e
  const m5Id = score.measures[4].id;
  staff.measures[m5Id] = {
    voices: [
      {
        id: 'bwv140-m5-v1',
        voiceIndex: 1,
        events: [
          createNote({ pitches: [createPitch('F', 5, 0)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('E', 5, -1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('D', 5, 0)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'quarter' }),
        ],
      },
      {
        id: 'bwv140-m5-v2',
        voiceIndex: 2,
        events: [
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'quarter' }),
          createNote({ pitches: [{ step: 'C', octave: 5, alter: 0, tiedToNext: true }], baseType: 'quarter', tiedToNext: true }),
          createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('A', 4, 0)], baseType: 'eighth' }), // Explicit alter 0 (natural)
        ],
      },
    ],
  };

  // Measure 6
  // S: Bb4 h | rest q | Bb4 q
  // A: F4 h  | rest q | G4 q
  const m6Id = score.measures[5].id;
  staff.measures[m6Id] = {
    voices: [
      {
        id: 'bwv140-m6-v1',
        voiceIndex: 1,
        events: [
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'half' }),
          createRest({ baseType: 'quarter', duration: 960 }),
          createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'quarter' }),
        ],
      },
      {
        id: 'bwv140-m6-v2',
        voiceIndex: 2,
        events: [
          createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'half' }),
          createRest({ baseType: 'quarter', duration: 960 }),
          createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' }),
        ],
      },
    ],
  };

  return score;
}

/**
 * Returns the 9 polyphonic gallery cards per milestone M7a-2a specification.
 */
export function getPolyphonyGalleryCards(): PolyphonyGalleryCard[] {
  return [
    {
      id: 'poly-1-stems-opposite-thirds-aligned',
      title: 'Card 1: Two Voices, Stems Opposite, Thirds/Fourths Aligned (RA, RB, RC)',
      tag: 'OBSERVED',
      description: 'Voice 1 stems up, Voice 2 stems down; harmonic thirds and fourths share identical column X.',
      build: () => {
        const score = createEmptyScore({ measures: 1 });
        const staff = score.parts[0].staves[0];
        const mId = score.measures[0].id;
        staff.measures[mId].voices = [
          {
            id: 'v1',
            voiceIndex: 1,
            events: [
              createNote({ pitches: [createPitch('E', 5)], baseType: 'quarter' }),
              createNote({ pitches: [createPitch('F', 5)], baseType: 'quarter' }),
              createNote({ pitches: [createPitch('G', 5)], baseType: 'half' }),
            ],
          },
          {
            id: 'v2',
            voiceIndex: 2,
            events: [
              createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' }), // third below E5
              createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' }), // fourth below F5
              createNote({ pitches: [createPitch('E', 5)], baseType: 'half' }),   // third below G5
            ],
          },
        ];
        return score;
      },
    },
    {
      id: 'poly-2-second-shared-stem-line',
      title: 'Card 2: Second Between Voices with Shared Stem Line (RC)',
      tag: 'OBSERVED',
      description: 'D5 over C5: stems share one vertical line; Voice 1 head sits to the left, Voice 2 head sits to the right.',
      build: () => {
        const score = createEmptyScore({ measures: 1 });
        const staff = score.parts[0].staves[0];
        const mId = score.measures[0].id;
        staff.measures[mId].voices = [
          {
            id: 'v1',
            voiceIndex: 1,
            events: [
              createNote({ pitches: [createPitch('D', 5)], baseType: 'quarter' }),
              createNote({ pitches: [createPitch('E', 5)], baseType: 'half', dots: 1 }),
            ],
          },
          {
            id: 'v2',
            voiceIndex: 2,
            events: [
              createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' }),
              createNote({ pitches: [createPitch('C', 5)], baseType: 'half', dots: 1 }),
            ],
          },
        ];
        return score;
      },
    },
    {
      id: 'poly-3-unison-shared-and-displaced',
      title: 'Card 3: Unisons: Shared Head vs Displaced Head (RD)',
      tag: 'PROPOSED',
      description: 'Same duration produces single shared notehead with two stems; different durations produce displaced Voice 2 notehead.',
      build: () => {
        const score = createEmptyScore({ measures: 1 });
        const staff = score.parts[0].staves[0];
        const mId = score.measures[0].id;
        staff.measures[mId].voices = [
          {
            id: 'v1',
            voiceIndex: 1,
            events: [
              createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' }), // unison same duration
              createNote({ pitches: [createPitch('E', 5)], baseType: 'half' }),    // unison diff duration
              createNote({ pitches: [createPitch('G', 5)], baseType: 'quarter' }),
            ],
          },
          {
            id: 'v2',
            voiceIndex: 2,
            events: [
              createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' }), // unison same duration
              createNote({ pitches: [createPitch('E', 5)], baseType: 'quarter' }), // unison diff duration (quarter vs half)
              createNote({ pitches: [createPitch('C', 5)], baseType: 'half' }),
            ],
          },
        ];
        return score;
      },
    },
    {
      id: 'poly-4-rests-shared-and-elevated',
      title: 'Card 4: Shared Rest vs One-Voice Rests (RE)',
      tag: 'OBSERVED / PROPOSED',
      description: 'Identical rests at same tick merge at staff center; one-voice rests elevated (V1) or depressed (V2).',
      build: () => {
        const score = createEmptyScore({ measures: 1 });
        const staff = score.parts[0].staves[0];
        const mId = score.measures[0].id;
        staff.measures[mId].voices = [
          {
            id: 'v1',
            voiceIndex: 1,
            events: [
              createNote({ pitches: [createPitch('G', 5)], baseType: 'quarter' }),
              createRest({ baseType: 'quarter', duration: 960 }), // shared rest on beat 2
              createRest({ baseType: 'quarter', duration: 960 }), // v1 elevated rest on beat 3
              createNote({ pitches: [createPitch('G', 5)], baseType: 'quarter' }),
            ],
          },
          {
            id: 'v2',
            voiceIndex: 2,
            events: [
              createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
              createRest({ baseType: 'quarter', duration: 960 }), // shared rest on beat 2
              createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }), // note in v2 on beat 3
              createRest({ baseType: 'quarter', duration: 960 }), // v2 depressed rest on beat 4
            ],
          },
        ];
        return score;
      },
    },
    {
      id: 'poly-5-voices-3-and-4-offsets',
      title: 'Card 5: Voices 3 and 4 with Extra Offsets (RA)',
      tag: 'PROPOSED',
      description: 'Four simultaneous voices on one staff: V1 & V3 stems up (V3 offset +1.25 sp), V2 & V4 stems down (V4 offset -1.25 sp).',
      build: () => {
        const score = createEmptyScore({ measures: 1 });
        const staff = score.parts[0].staves[0];
        const mId = score.measures[0].id;
        staff.measures[mId].voices = [
          { id: 'v1', voiceIndex: 1, events: [createNote({ pitches: [createPitch('C', 5)], baseType: 'whole' })] },
          { id: 'v2', voiceIndex: 2, events: [createNote({ pitches: [createPitch('E', 4)], baseType: 'whole' })] },
          { id: 'v3', voiceIndex: 3, events: [createNote({ pitches: [createPitch('G', 4)], baseType: 'whole' })] },
          { id: 'v4', voiceIndex: 4, events: [createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' })] },
        ];
        return score;
      },
    },
    {
      id: 'poly-6-ties-in-both-voices',
      title: 'Card 6: Ties in Both Voices Following Voice Curve (RF)',
      tag: 'OBSERVED',
      description: 'Voice 1 tie curves above; Voice 2 tie curves below (observed in Bach BWV 140/7 m.5).',
      build: () => {
        const score = createEmptyScore({ measures: 2 });
        const staff = score.parts[0].staves[0];
        const m0Id = score.measures[0].id;
        const m1Id = score.measures[1].id;

        // Voice 1 tie: G5 tied across barline
        staff.measures[m0Id].voices = [
          {
            id: 'v1-m0',
            voiceIndex: 1,
            events: [createNote({ pitches: [{ step: 'G', octave: 5, alter: 0, tiedToNext: true }], baseType: 'whole', tiedToNext: true })],
          },
          {
            id: 'v2-m0',
            voiceIndex: 2,
            events: [createNote({ pitches: [{ step: 'C', octave: 4, alter: 0, tiedToNext: true }], baseType: 'whole', tiedToNext: true })],
          },
        ];

        staff.measures[m1Id].voices = [
          {
            id: 'v1-m1',
            voiceIndex: 1,
            events: [createNote({ pitches: [createPitch('G', 5)], baseType: 'whole' })],
          },
          {
            id: 'v2-m1',
            voiceIndex: 2,
            events: [createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' })],
          },
        ];

        return score;
      },
    },
    {
      id: 'poly-7-beams-in-both-voices',
      title: 'Card 7: Beams in Both Voices (RA)',
      tag: 'OBSERVED',
      description: 'Eighth notes in Voice 1 beamed up; eighth notes in Voice 2 beamed down (observed in Bach BWV 140/7 m.4).',
      build: () => {
        const score = createEmptyScore({ measures: 1 });
        const staff = score.parts[0].staves[0];
        const mId = score.measures[0].id;

        staff.measures[mId].voices = [
          {
            id: 'v1',
            voiceIndex: 1,
            events: [
              createNote({ pitches: [createPitch('E', 5)], baseType: 'eighth' }),
              createNote({ pitches: [createPitch('F', 5)], baseType: 'eighth' }),
              createNote({ pitches: [createPitch('G', 5)], baseType: 'quarter' }),
              createNote({ pitches: [createPitch('C', 5)], baseType: 'half' }),
            ],
          },
          {
            id: 'v2',
            voiceIndex: 2,
            events: [
              createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' }),
              createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
              createNote({ pitches: [createPitch('E', 4)], baseType: 'eighth' }),
              createNote({ pitches: [createPitch('F', 4)], baseType: 'eighth' }),
              createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' }),
            ],
          },
        ];

        return score;
      },
    },
    {
      id: 'poly-8-dots-in-both-voices',
      title: 'Card 8: Augmentation Dots in Both Voices (RG)',
      tag: 'OBSERVED / PROPOSED',
      description: 'Voice 1 dot on line goes in space above; Voice 2 dot on line goes in space below.',
      build: () => {
        const score = createEmptyScore({ measures: 1 });
        const staff = score.parts[0].staves[0];
        const mId = score.measures[0].id;

        staff.measures[mId].voices = [
          {
            id: 'v1',
            voiceIndex: 1,
            events: [
              createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'half', dots: 1 }), // line 3, dot above
              createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' }),
            ],
          },
          {
            id: 'v2',
            voiceIndex: 2,
            events: [
              createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' }),
              createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'half', dots: 1 }), // line 3, dot below
            ],
          },
        ];

        return score;
      },
    },
    {
      id: 'poly-9-bwv-140-reduction-whole-fixture',
      title: 'Card 9: J. S. Bach BWV 140/7 mm. 1-6 Soprano & Alto (Full Reference)',
      tag: 'OBSERVED',
      description: 'Chorale "Wachet auf, ruft uns die Stimme" mm. 1-6 reference reduction in Eb major (4/4).',
      notesChecklist: [
        'm1 S: Eb4 q | G4 q | Bb4 dotted-q | Bb4 e',
        'm1 A: Bb3 q | Eb4 q | G4 q | F4 q',
        'm2 S: Bb4 q | Bb4 q | C5 h',
        'm2 A: G4 q | F4 q | G4 q | F4 q',
        'm3 S: Bb4 h | rest q | Bb4 q',
        'm3 A: F4 h  | rest q | F4 q',
        'm4 S: Eb5 q | Bb4 q | Eb5 e | F5 e | G5 q',
        'm4 A: Bb4 dotted-q | Ab4 e | G4 e | Ab4 e | Bb4 q',
        'm5 S: F5 q | Eb5 q | D5 q | C5 q',
        'm5 A: Bb4 q | C5 q (tied to next) | C5 e | Bb4 q | A4 natural e',
        'm6 S: Bb4 h | rest q | Bb4 q',
        'm6 A: F4 h  | rest q | G4 q',
      ],
      build: () => buildBwv140Reduction(),
    },
  ];
}
