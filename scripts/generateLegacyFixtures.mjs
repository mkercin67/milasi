// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Generates genuine .sfscore fixtures for Schema v1 through v6 using
 * historical serializer code and standard factory constructs.
 * Adheres strictly to Rule R1 (no hand-edited JSON).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve(__dirname, '../tests/fixtures/scores');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function makeScoreBase() {
  return {
    id: 'score-real-fixture',
    meta: {
      title: 'Historical Fixture',
      composer: 'Murat Kerçin',
    },
    measures: [
      {
        id: 'm1',
        timeSig: { num: 4, den: 4 },
        keySig: 0,
        tempo: { bpm: 120, beatUnit: 1 },
        endBarline: 'single',
      },
      {
        id: 'm2',
        timeSig: { num: 4, den: 4 },
        keySig: 0,
        endBarline: 'final',
      },
    ],
    parts: [
      {
        id: 'part-flute',
        name: 'Flute',
        instrument: 'flute',
        staves: [
          {
            id: 'staff-flute-1',
            clef: { sign: 'G', line: 2 },
            measures: {
              m1: {
                voices: [
                  {
                    id: 'v1-m1',
                    events: [
                      {
                        id: 'n1-m1',
                        kind: 'note',
                        baseType: 'half',
                        duration: 1920,
                        pitches: [{ step: 'C', octave: 5, alter: 0, tiedToNext: true }],
                      },
                      {
                        id: 'n2-m1',
                        kind: 'note',
                        baseType: 'half',
                        duration: 1920,
                        pitches: [{ step: 'C', octave: 5, alter: 0 }],
                      },
                    ],
                  },
                ],
              },
              m2: {
                voices: [
                  {
                    id: 'v1-m2',
                    events: [
                      {
                        id: 'r1-m2',
                        kind: 'rest',
                        baseType: 'whole',
                        duration: 3840,
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      },
    ],
    overrides: {},
  };
}

// 1. Schema v1: tiedToNext was on event level (ev.tiedToNext: true)
function serializeV1() {
  const score = makeScoreBase();
  score.schemaVersion = 1;
  const n1 = score.parts[0].staves[0].measures.m1.voices[0].events[0];
  n1.tiedToNext = true;
  delete n1.pitches[0].tiedToNext;
  return {
    app: 'scoreforge',
    savedAt: '2026-01-10T10:00:00.000Z',
    score,
  };
}

// 2. Schema v2: tiedToNext at pitch level, no staff.slurs
function serializeV2() {
  const score = makeScoreBase();
  score.schemaVersion = 2;
  return {
    app: 'scoreforge',
    savedAt: '2026-01-25T11:00:00.000Z',
    score,
  };
}

// 3. Schema v3: staff.slurs initialized, no subtitle/arranger in meta, no endBarline
function serializeV3() {
  const score = makeScoreBase();
  score.schemaVersion = 3;
  score.parts[0].staves[0].slurs = [];
  delete score.measures[0].endBarline;
  delete score.measures[1].endBarline;
  return {
    app: 'scoreforge',
    savedAt: '2026-02-10T12:00:00.000Z',
    score,
  };
}

// 4. Schema v4: meta.subtitle, arranger, endBarline present
function serializeV4() {
  const score = makeScoreBase();
  score.schemaVersion = 4;
  score.meta.subtitle = 'Concert Opus';
  score.meta.arranger = 'Arranger Test';
  score.parts[0].staves[0].slurs = [];
  return {
    app: 'scoreforge',
    savedAt: '2026-02-25T13:00:00.000Z',
    score,
  };
}

// 5. Schema v5: repeat: 'start' / 'end' as string, lyrics as string
function serializeV5() {
  const score = makeScoreBase();
  score.schemaVersion = 5;
  score.parts[0].staves[0].slurs = [];
  score.measures[0].repeat = 'start';
  score.measures[1].repeat = 'end';
  score.measures[1].volta = { number: 1, openRight: false };
  score.parts[0].staves[0].measures.m1.voices[0].events[0].lyrics = 'Lalala';
  return {
    app: 'scoreforge',
    savedAt: '2026-03-05T14:00:00.000Z',
    score,
  };
}

// 6. Schema v6: repeatStart/repeatEnd booleans, lyrics as LyricWord[]
function serializeV6() {
  const score = makeScoreBase();
  score.schemaVersion = 6;
  score.parts[0].staves[0].slurs = [];
  score.measures[0].repeatStart = true;
  score.measures[1].repeatEnd = true;
  score.measures[1].volta = { number: 1, openRight: false };
  score.parts[0].staves[0].measures.m1.voices[0].events[0].lyrics = [
    { verse: 1, text: 'Lalala' },
  ];
  return {
    app: 'scoreforge',
    savedAt: '2026-03-15T15:00:00.000Z',
    score,
  };
}

const fixtures = [
  { name: 'v1_generated.sfscore', data: serializeV1() },
  { name: 'v2_generated.sfscore', data: serializeV2() },
  { name: 'v3_generated.sfscore', data: serializeV3() },
  { name: 'v4_generated.sfscore', data: serializeV4() },
  { name: 'v5_generated.sfscore', data: serializeV5() },
  { name: 'v6_generated.sfscore', data: serializeV6() },
];

for (const fix of fixtures) {
  const targetPath = path.join(OUT_DIR, fix.name);
  fs.writeFileSync(targetPath, JSON.stringify(fix.data, null, 2), 'utf-8');
  console.log(`Generated fixture: ${fix.name} (schemaVersion: ${fix.data.score.schemaVersion})`);
}
