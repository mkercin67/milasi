// SPDX-License-Identifier: GPL-3.0-or-later
import {
  createEmptyScore,
  createMeasure,
  createNote,
  createPart,
  createPitch,
  createRest,
  createScore,
} from '../core/factory';
import { Score } from '../core/model';

/**
 * Builds a comprehensive test score exercising all Milestone 2 layout requirements.
 *
 * @param clefSign - 'G' for Treble or 'F' for Bass.
 * @returns Score instance.
 */
export function buildSampleScore(clefSign: 'G' | 'F'): Score {
  const isBass = clefSign === 'F';
  const score = createScore({
    title: isBass ? 'Demo Score — Bass Clef' : 'Demo Score — Treble Clef',
    composer: 'ScoreForge Demo',
  });

  // Measure 1: Rising scale (G major = 1 sharp)
  const m1 = createMeasure({ num: 4, den: 4 }, 1);
  // Measure 2: Dotted rhythms
  const m2 = createMeasure({ num: 4, den: 4 }, 1);
  // Measure 3: Rests of multiple lengths
  const m3 = createMeasure({ num: 4, den: 4 }, 1);
  // Measure 4: Chord with second & accidentals (including natural sign)
  const m4 = createMeasure({ num: 4, den: 4 }, 1);
  // Measure 5: Ledger lines above and below
  const m5 = createMeasure({ num: 4, den: 4 }, 1);

  score.measures = [m1, m2, m3, m4, m5];

  const part = createPart({
    name: isBass ? 'Bass Clef Part' : 'Treble Clef Part',
    clef: isBass ? { sign: 'F', line: 4 } : { sign: 'G', line: 2 },
  });
  score.parts = [part];

  // Base octave offset for bass clef vs treble clef
  const oct = isBass ? 2 : 4;

  // Measure 1: Rising scale
  const m1Events = [
    createNote({ pitches: [createPitch('G', oct, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('A', oct, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('B', oct, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('C', oct + 1, 0)], baseType: 'quarter' }),
  ];

  // Measure 2: Dotted rhythms
  const m2Events = [
    createNote({ pitches: [createPitch('D', oct + 1, 0)], baseType: 'quarter', dots: 1 }),
    createNote({ pitches: [createPitch('C', oct + 1, 0)], baseType: 'eighth' }),
    createNote({ pitches: [createPitch('B', oct, 0)], baseType: 'quarter', dots: 1 }),
    createNote({ pitches: [createPitch('A', oct, 0)], baseType: 'eighth' }),
  ];

  // Measure 3: Rests of multiple lengths
  const m3Events = [
    createRest({ baseType: 'half' }), // 1920
    createRest({ baseType: 'quarter' }), // 960
    createRest({ baseType: 'eighth' }), // 480
    createRest({ baseType: '16th' }), // 240
    createRest({ baseType: '16th' }), // 240
  ];

  // Measure 4: Chord with a second, followed by accidental cancelling with natural
  const m4Events = [
    // Chord with second: F# + G
    createNote({
      pitches: [createPitch('F', oct, 1), createPitch('G', oct, 0)],
      baseType: 'quarter',
    }),
    // Accidental cancelling to F natural (G major has F# in armör, so natural is rendered!)
    createNote({
      pitches: [createPitch('F', oct, 0)],
      baseType: 'quarter',
    }),
    // Followed by F sharp in same measure (sharp is rendered!)
    createNote({
      pitches: [createPitch('F', oct, 1)],
      baseType: 'quarter',
    }),
    // Quarter note
    createNote({
      pitches: [createPitch('G', oct, 0)],
      baseType: 'quarter',
    }),
  ];

  // Measure 5: Ledger lines above and below
  const m5Events = isBass
    ? [
        createNote({ pitches: [createPitch('E', 2, 0)], baseType: 'quarter' }), // 1 ledger below
        createNote({ pitches: [createPitch('C', 2, 0)], baseType: 'quarter' }), // 2 ledger below
        createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' }), // 1 ledger above (Middle C)
        createNote({ pitches: [createPitch('E', 4, 0)], baseType: 'quarter' }), // 2 ledger above
      ]
    : [
        createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' }), // 1 ledger below (Middle C)
        createNote({ pitches: [createPitch('A', 3, 0)], baseType: 'quarter' }), // 2 ledger below
        createNote({ pitches: [createPitch('A', 5, 0)], baseType: 'quarter' }), // 1 ledger above
        createNote({ pitches: [createPitch('C', 6, 0)], baseType: 'quarter' }), // 2 ledger above
      ];

  const staffObj = part.staves[0];
  staffObj.measures[m1.id] = { voices: [{ id: 'v1', voiceIndex: 1, events: m1Events }] };
  staffObj.measures[m2.id] = { voices: [{ id: 'v1', voiceIndex: 1, events: m2Events }] };
  staffObj.measures[m3.id] = { voices: [{ id: 'v1', voiceIndex: 1, events: m3Events }] };
  staffObj.measures[m4.id] = { voices: [{ id: 'v1', voiceIndex: 1, events: m4Events }] };
  staffObj.measures[m5.id] = { voices: [{ id: 'v1', voiceIndex: 1, events: m5Events }] };

  return score;
}

/**
 * Builds a 64-measure dense benchmark score filled with sixteenth notes and chords.
 */
export function createBenchmark64Score(): Score {
  const score = createScore({
    title: 'Benchmark 64 Measures — Sixteenths & Chords',
    composer: 'ScoreForge Benchmark',
  });

  const part = createPart({
    name: 'Violin',
    clef: { sign: 'G', line: 2 },
  });
  score.parts = [part];

  const timeSig = { num: 4, den: 4 };

  const pitchesPatterns = [
    ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'] as const,
    ['E', 'F', 'G', 'A', 'B', 'C', 'D', 'E'] as const,
    ['G', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const,
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A'] as const,
  ];

  for (let m = 0; m < 64; m++) {
    const mDef = createMeasure(timeSig, 0);
    score.measures.push(mDef);

    const pat = pitchesPatterns[m % pitchesPatterns.length];
    const oct = 4;
    // Beat 1 & 2: 8 sixteenth notes (8 * 240 = 1920 ticks)
    const sixteenths = pat.map((p, idx) =>
      createNote({
        pitches: [createPitch(p, idx >= 7 ? oct + 1 : oct, 0)],
        baseType: '16th',
      })
    );

    // Beat 3: two 16th chords (2 * 240 = 480 ticks) + one 8th chord (480 ticks) = 960 ticks
    const chord1 = createNote({
      pitches: [createPitch('C', oct, 0), createPitch('E', oct, 0), createPitch('G', oct, 0)],
      baseType: '16th',
    });
    const chord2 = createNote({
      pitches: [createPitch('D', oct, 0), createPitch('F', oct, 0), createPitch('A', oct, 0)],
      baseType: '16th',
    });
    const chord3 = createNote({
      pitches: [createPitch('E', oct, 0), createPitch('G', oct, 0), createPitch('B', oct, 0)],
      baseType: 'eighth',
    });

    // Beat 4: four 16th chords (4 * 240 = 960 ticks)
    const chord4 = createNote({
      pitches: [createPitch('F', oct, 0), createPitch('A', oct, 0), createPitch('C', oct + 1, 0)],
      baseType: '16th',
    });
    const chord5 = createNote({
      pitches: [createPitch('G', oct, 0), createPitch('B', oct, 0), createPitch('D', oct + 1, 0)],
      baseType: '16th',
    });
    const chord6 = createNote({
      pitches: [createPitch('A', oct, 0), createPitch('C', oct + 1, 0), createPitch('E', oct + 1, 0)],
      baseType: '16th',
    });
    const chord7 = createNote({
      pitches: [createPitch('C', oct, 0), createPitch('E', oct, 0), createPitch('G', oct, 0)],
      baseType: '16th',
    });

    const mEvents = [...sixteenths, chord1, chord2, chord3, chord4, chord5, chord6, chord7];

    part.staves[0].measures[mDef.id] = {
      voices: [{ id: `v1_bm_${m}`, voiceIndex: 1, events: mEvents }],
    };
  }

  return score;
}

export function createBenchmarkFullFeaturedScore(measureCount: number = 64): Score {
  const score = createEmptyScore({
    title: `Benchmark ${measureCount} Measures — Full Featured`,
    composer: 'ScoreForge Perf Benchmark',
    clef: { sign: 'G', line: 2 },
    keySig: 1,
    timeSig: { num: 4, den: 4 },
    measures: measureCount,
  });

  const staff = score.parts[0].staves[0];
  staff.slurs = [];

  const dynamics = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp'];
  const articulationsList: Array<Array<'staccato' | 'tenuto' | 'accent' | 'marcato'>> = [
    ['staccato'],
    ['tenuto'],
    ['accent'],
    ['marcato'],
    ['staccato', 'tenuto'],
  ];

  for (let m = 0; m < measureCount; m++) {
    const mDef = score.measures[m];
    const notes = [
      createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('B', 4, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('D', 5, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('G', 5, 0)], baseType: 'quarter' }),
    ];

    // Ties
    if (m % 2 === 0) {
      notes[1].pitches[0].tiedToNext = true;
      notes[1].tiedToNext = true;
    }

    // Dynamics
    notes[0].dynamic = dynamics[m % dynamics.length];

    // Articulations
    notes[1].articulations = articulationsList[m % articulationsList.length];
    notes[3].articulations = ['staccato'];

    // Lyrics
    notes[0].lyrics = [{ verse: 1, text: 'Süt' }];
    notes[1].lyrics = [{ verse: 1, text: 'iç-' }];
    notes[2].lyrics = [{ verse: 1, text: 'tim' }];
    notes[3].lyrics = [{ verse: 1, text: 'yar' }];

    staff.measures[mDef.id].voices[0].events = notes;

    // Slurs
    if (m % 4 === 0 && m + 1 < measureCount) {
      staff.slurs.push({
        id: `slur-${m}`,
        startEventId: notes[0].id,
        endEventId: notes[3].id,
      });
    }

    // Repeats
    if (m === 4) {
      mDef.repeatStart = true;
    }
    if (m === 8) {
      mDef.repeatEnd = true;
    }
  }

  return score;
}



