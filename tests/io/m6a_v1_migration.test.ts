import { describe, expect, it } from 'vitest';
import { deserializeScore } from '../../src/io/json';

describe('M6a: SchemaVersion 1 Migration (v1 -> v2)', () => {
  const v1ScoreCore = {
    schemaVersion: 1,
    id: 'm5-v1-score-id',
    meta: {
      title: 'M5 Legacy Score',
      composer: 'Test Author',
    },
    measures: [
      {
        id: 'm1',
        timeSig: { num: 4, den: 4 },
        keySig: 0,
        tempo: { bpm: 120, beatUnit: 1 },
      },
    ],
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
                    id: 'voice-1',
                    events: [
                      {
                        id: 'note-chord-tied',
                        kind: 'note' as const,
                        baseType: 'quarter' as const,
                        dots: 0,
                        duration: 960,
                        pitches: [
                          { step: 'C' as const, octave: 4, alter: 0 },
                          { step: 'G' as const, octave: 4, alter: 0 },
                        ],
                        tiedToNext: true,
                        articulations: [],
                      },
                      {
                        id: 'note-chord-target',
                        kind: 'note' as const,
                        baseType: 'quarter' as const,
                        dots: 0,
                        duration: 960,
                        pitches: [
                          { step: 'C' as const, octave: 4, alter: 0 },
                          { step: 'G' as const, octave: 4, alter: 0 },
                        ],
                        tiedToNext: false,
                        articulations: [],
                      },
                      {
                        id: 'rest-half',
                        kind: 'rest' as const,
                        baseType: 'half' as const,
                        dots: 0,
                        duration: 1920,
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

  it('loads enveloped .sfscore schemaVersion 1 produced by M5 build and migrates ties per pitch', () => {
    const envelopedV1 = JSON.stringify({
      app: 'scoreforge',
      version: '0.1.0',
      schemaVersion: 1,
      savedAt: '2026-11-12T19:00:00.000Z',
      score: v1ScoreCore,
    });

    const loaded = deserializeScore(envelopedV1);

    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.meta.title).toBe('M5 Legacy Score');

    const firstEvent = loaded.parts[0].staves[0].measures['m1'].voices[0].events[0];
    expect(firstEvent.kind).toBe('note');
    if (firstEvent.kind === 'note') {
      expect(firstEvent.pitches).toHaveLength(2);
      expect(firstEvent.pitches[0].tiedToNext).toBe(true);
      expect(firstEvent.pitches[1].tiedToNext).toBe(true);
    }

    const secondEvent = loaded.parts[0].staves[0].measures['m1'].voices[0].events[1];
    expect(secondEvent.kind).toBe('note');
    if (secondEvent.kind === 'note') {
      expect(secondEvent.pitches[0].tiedToNext).toBeUndefined();
      expect(secondEvent.pitches[1].tiedToNext).toBeUndefined();
    }
  });

  it('loads bare schemaVersion 1 JSON without envelope and migrates ties per pitch', () => {
    const bareV1 = JSON.stringify(v1ScoreCore);

    const loaded = deserializeScore(bareV1);

    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.meta.title).toBe('M5 Legacy Score');

    const firstEvent = loaded.parts[0].staves[0].measures['m1'].voices[0].events[0];
    expect(firstEvent.kind).toBe('note');
    if (firstEvent.kind === 'note') {
      expect(firstEvent.pitches[0].tiedToNext).toBe(true);
      expect(firstEvent.pitches[1].tiedToNext).toBe(true);
    }
  });
});
