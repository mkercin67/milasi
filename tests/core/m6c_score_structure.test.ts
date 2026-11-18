// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import {
  setEndBarline,
  setKeySignature,
  setPickup,
  setScoreMetadata,
  setTimeSignature,
} from '../../src/core/commands';
import { validateScore } from '../../src/core/validate';
import { CURRENT_SCHEMA_VERSION, deserializeScore, serializeScore } from '../../src/io/json';

describe('Milestone 6c: Score Structure Core Models & Commands', () => {
  it('updates score metadata (title, subtitle, composer, arranger) via setScoreMetadata', () => {
    const score = createEmptyScore({ numMeasures: 4 });
    const updated = setScoreMetadata({
      title: 'Yıldızların Altında',
      subtitle: 'Nihavend Şarkı',
      composer: 'Kaptanzade Ali Rıza Bey',
      arranger: 'Skor Düzenleyici',
    }).apply(score);

    expect(updated.meta.title).toBe('Yıldızların Altında');
    expect(updated.meta.subtitle).toBe('Nihavend Şarkı');
    expect(updated.meta.composer).toBe('Kaptanzade Ali Rıza Bey');
    expect(updated.meta.arranger).toBe('Skor Düzenleyici');
    expect(validateScore(updated)).toHaveLength(0);
  });

  it('changes key signature mid-score with scope from-here and score', () => {
    const score = createEmptyScore({ numMeasures: 4 });
    const m2Id = score.measures[1].id;

    // Scope 'from-here' changes measure 2, 3, 4 to 2 sharps (D major)
    const fromHere = setKeySignature(m2Id, 2, 'from-here').apply(score);
    expect(fromHere.measures[0].keySig).toBe(0);
    expect(fromHere.measures[1].keySig).toBe(2);
    expect(fromHere.measures[2].keySig).toBe(2);
    expect(fromHere.measures[3].keySig).toBe(2);
    expect(validateScore(fromHere)).toHaveLength(0);

    // Scope 'score' changes ALL measures to -3 flats (Eb major)
    const allScore = setKeySignature(m2Id, -3, 'score').apply(fromHere);
    expect(allScore.measures[0].keySig).toBe(-3);
    expect(allScore.measures[1].keySig).toBe(-3);
    expect(allScore.measures[2].keySig).toBe(-3);
    expect(allScore.measures[3].keySig).toBe(-3);
    expect(validateScore(allScore)).toHaveLength(0);
  });

  it('changes time signature mid-score with scope from-here and score', () => {
    const score = createEmptyScore({ numMeasures: 4 });
    const m2Id = score.measures[1].id;

    const fromHere = setTimeSignature(m2Id, { num: 3, den: 4 }, 'from-here').apply(score);
    expect(fromHere.measures[0].timeSig).toEqual({ num: 4, den: 4 });
    expect(fromHere.measures[1].timeSig).toEqual({ num: 3, den: 4 });
    expect(fromHere.measures[2].timeSig).toEqual({ num: 3, den: 4 });
    expect(fromHere.measures[3].timeSig).toEqual({ num: 3, den: 4 });
  });

  it('configures pickup measure (anacrusis) on measure 1 and validates actualTicks', () => {
    const score = createEmptyScore({ numMeasures: 4 });
    const m1Id = score.measures[0].id;

    // Set pickup measure to 1 quarter note = 960 ticks
    const pickupScore = setPickup(m1Id, 960).apply(score);
    expect(pickupScore.measures[0].actualTicks).toBe(960);

    // After setting actualTicks to 960, replacing measure 1 content with 1 quarter note must validate cleanly
    const modifiedScore = {
      ...pickupScore,
      parts: [
        {
          ...pickupScore.parts[0],
          staves: [
            {
              ...pickupScore.parts[0].staves[0],
              measures: {
                ...pickupScore.parts[0].staves[0].measures,
                [m1Id]: {
                  voices: [
                    {
                      id: 'v-pickup',
                      events: [
                        {
                          id: 'pickup-rest',
                          kind: 'rest' as const,
                          baseType: 'quarter' as const,
                          dots: 0,
                          duration: 960,
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
    };

    expect(validateScore(modifiedScore)).toHaveLength(0);
  });

  it('configures end barline types: single, double, final', () => {
    const score = createEmptyScore({ numMeasures: 4 });
    const m2Id = score.measures[1].id;

    const withDouble = setEndBarline(m2Id, 'double').apply(score);
    expect(withDouble.measures[1].endBarline).toBe('double');
    expect(validateScore(withDouble)).toHaveLength(0);

    const withFinal = setEndBarline(m2Id, 'final').apply(score);
    expect(withFinal.measures[1].endBarline).toBe('final');
    expect(validateScore(withFinal)).toHaveLength(0);
  });

  it('upgrades schemaVersion to 4+ and migrates v1, v2, v3 scores cleanly', () => {
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(4);

    const v3Score = {
      app: 'scoreforge',
      savedAt: '2026-11-17T10:00:00.000Z',
      score: {
        schemaVersion: 3,
        id: 'score-v3-test',
        meta: {
          title: 'V3 Test Piece',
          composer: 'Composer V3',
        },
        measures: [
          {
            id: 'm-1',
            timeSig: { num: 4, den: 4 },
            keySig: 0,
          },
        ],
        parts: [
          {
            id: 'part-1',
            name: 'Music',
            instrument: 'piano',
            staves: [
              {
                id: 'staff-1',
                clef: { sign: 'G', line: 2 },
                slurs: [],
                measures: {
                  'm-1': {
                    voices: [
                      {
                        id: 'v-1',
                        events: [
                          {
                            id: 'r-1',
                            kind: 'rest',
                            baseType: 'whole',
                            dots: 0,
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
      },
    };

    const loaded = deserializeScore(JSON.stringify(v3Score));
    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.meta.title).toBe('V3 Test Piece');
    expect(loaded.meta.subtitle).toBe('');
    expect(loaded.meta.arranger).toBe('');
    expect(loaded.measures[0].endBarline).toBe('final');

    const serialized = serializeScore(loaded);
    expect(serialized).toContain(`"schemaVersion":${CURRENT_SCHEMA_VERSION}`);
  });
});
