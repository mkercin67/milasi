// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, deserializeScore } from '../../src/io/json';

describe('Milestone 6b: Schema Migrations (v1 -> v2 -> v3)', () => {
  it('migrates a v2 score to v3: initializes staff.slurs as empty array', () => {
    const v2Score = {
      schemaVersion: 2,
      id: 'v2-score-id',
      meta: { title: 'V2 Test Score', composer: 'Tester' },
      measures: [{ id: 'm1', timeSig: { num: 4, den: 4 }, keySig: 0 }],
      parts: [
        {
          id: 'part-1',
          name: 'Piano',
          instrument: 'default',
          staves: [
            {
              id: 'staff-1',
              clef: { sign: 'G' as const, line: 2 },
              measures: {
                m1: {
                  voices: [
                    {
                      id: 'v1',
                      events: [
                        {
                          id: 'note-1',
                          kind: 'note' as const,
                          baseType: 'whole' as const,
                          dots: 0,
                          duration: 3840,
                          pitches: [{ step: 'C' as const, octave: 4, alter: 0 }],
                          articulations: [],
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

    const loaded = deserializeScore(JSON.stringify(v2Score));
    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.parts[0].staves[0].slurs).toEqual([]);
  });

  it('migrates a v1 score through v2 to v3 sequentially', () => {
    const v1Score = {
      schemaVersion: 1,
      id: 'v1-score-id',
      meta: { title: 'V1 Test Score', composer: 'Tester' },
      measures: [{ id: 'm1', timeSig: { num: 4, den: 4 }, keySig: 0 }],
      parts: [
        {
          id: 'part-1',
          name: 'Piano',
          instrument: 'default',
          staves: [
            {
              id: 'staff-1',
              clef: { sign: 'G' as const, line: 2 },
              measures: {
                m1: {
                  voices: [
                    {
                      id: 'v1',
                      events: [
                        {
                          id: 'note-1',
                          kind: 'note' as const,
                          baseType: 'whole' as const,
                          dots: 0,
                          duration: 3840,
                          pitches: [{ step: 'C' as const, octave: 4, alter: 0 }],
                          tiedToNext: true,
                          articulations: [],
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

    const loaded = deserializeScore(JSON.stringify(v1Score));
    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const firstNote = loaded.parts[0].staves[0].measures['m1'].voices[0].events[0] as any;
    expect(firstNote.pitches[0].tiedToNext).toBe(true);
    expect(loaded.parts[0].staves[0].slurs).toEqual([]);
  });
});
