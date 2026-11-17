import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, deserializeScore, serializeScore } from '../../src/io/json';
import { createEmptyScore } from '../../src/core/factory';

describe('Milestone 6d: Schema v5 and Migrations', () => {
  it('FAILING-FIRST: CURRENT_SCHEMA_VERSION is 5 and supports repeat, volta, lyrics', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
  });

  it('migrates a v4 score to v5 cleanly preserving all existing data', () => {
    const v4Score = createEmptyScore({ numMeasures: 4 });
    (v4Score as any).schemaVersion = 4;
    const serialized = JSON.stringify({
      app: 'scoreforge',
      savedAt: '2026-11-17T12:00:00.000Z',
      score: v4Score,
    });

    const loaded = deserializeScore(serialized);
    expect(loaded.schemaVersion).toBe(5);
    expect(loaded.measures.length).toBe(4);
  });

  it('preserves repeat, volta, and lyrics in serialize/deserialize round-trip', () => {
    const score = createEmptyScore({ numMeasures: 4 });
    (score as any).schemaVersion = 5;
    score.measures[0].repeat = 'start';
    score.measures[1].repeat = 'end';
    score.measures[1].volta = { number: 1 };
    score.measures[2].volta = { number: 2, openRight: true };

    const m0Id = score.measures[0].id;
    const note = score.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    if (note.kind === 'note') {
      note.lyrics = 'Süt';
    }

    const envelope = serializeScore(score);
    const roundTripped = deserializeScore(envelope);

    expect(roundTripped.schemaVersion).toBe(5);
    expect(roundTripped.measures[0].repeat).toBe('start');
    expect(roundTripped.measures[1].repeat).toBe('end');
    expect(roundTripped.measures[1].volta).toEqual({ number: 1 });
    expect(roundTripped.measures[2].volta).toEqual({ number: 2, openRight: true });

    const rtNote = roundTripped.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    if (rtNote.kind === 'note') {
      expect(rtNote.lyrics).toBe('Süt');
    }
  });
});
