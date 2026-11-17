import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, deserializeScore, serializeScore } from '../../src/io/json';
import { createEmptyScore } from '../../src/core/factory';

describe('Milestone 6d: Schema v6 and Migrations', () => {
  it('CURRENT_SCHEMA_VERSION is 6 and supports repeatStart, repeatEnd, volta, lyrics', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(6);
  });

  it('migrates a v4 score to v6 cleanly preserving all existing data', () => {
    const v4Score = createEmptyScore({ numMeasures: 4 });
    (v4Score as any).schemaVersion = 4;
    const serialized = JSON.stringify({
      app: 'scoreforge',
      savedAt: '2026-11-17T12:00:00.000Z',
      score: v4Score,
    });

    const loaded = deserializeScore(serialized);
    expect(loaded.schemaVersion).toBe(6);
    expect(loaded.measures.length).toBe(4);
  });

  it('preserves repeatStart, repeatEnd, volta, and lyrics in serialize/deserialize round-trip', () => {
    const score = createEmptyScore({ numMeasures: 4 });
    score.measures[0].repeatStart = true;
    score.measures[1].repeatEnd = true;
    score.measures[1].volta = { number: 1 };
    score.measures[2].volta = { number: 2, openRight: true };

    const m0Id = score.measures[0].id;
    const note = score.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    if (note.kind === 'note') {
      note.lyrics = [{ verse: 1, text: 'Süt' }];
    }

    const envelope = serializeScore(score);
    const roundTripped = deserializeScore(envelope);

    expect(roundTripped.schemaVersion).toBe(6);
    expect(roundTripped.measures[0].repeatStart).toBe(true);
    expect(roundTripped.measures[1].repeatEnd).toBe(true);
    expect(roundTripped.measures[1].volta).toEqual({ number: 1 });
    expect(roundTripped.measures[2].volta).toEqual({ number: 2, openRight: true });

    const rtNote = roundTripped.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    if (rtNote.kind === 'note') {
      expect(rtNote.lyrics).toEqual([{ verse: 1, text: 'Süt' }]);
    }
  });
});
