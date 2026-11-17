import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, deserializeScore } from '../../src/io/json';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { pasteLyrics, setLyrics, setRepeatEnd, setRepeatStart } from '../../src/core/commands';

describe('Milestone 6d Alignment: Model, Schema v6, and Repeat Commands', () => {
  it('FAILING-FIRST: CURRENT_SCHEMA_VERSION is 6 and supports repeatStart, repeatEnd, and LyricSyllable[]', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(6);
    const score = createEmptyScore({ numMeasures: 4 });
    expect(score.schemaVersion).toBe(6);
  });

  it('FAILING-FIRST: setRepeatStart and setRepeatEnd toggle repeat flags on measures cleanly', () => {
    const score = createEmptyScore({ numMeasures: 8, timeSig: { num: 2, den: 4 } });
    const m3Id = score.measures[3].id;
    const m4Id = score.measures[4].id;

    const withEnd = setRepeatEnd(m3Id, true).apply(score);
    expect(withEnd.measures[3].repeatEnd).toBe(true);

    const withStart = setRepeatStart(m4Id, true).apply(withEnd);
    expect(withStart.measures[4].repeatStart).toBe(true);

    // Can turn off cleanly
    const cleared = setRepeatEnd(m3Id, false).apply(withStart);
    expect(cleared.measures[3].repeatEnd).toBeUndefined();
  });

  it('FAILING-FIRST: NoteEvent.lyrics uses LyricSyllable array { verse: 1, text }', () => {
    const score = createEmptyScore({ numMeasures: 2 });
    const m0Id = score.measures[0].id;
    const note = createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' });
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [note];

    const withLyric = setLyrics(note.id, 'Süt').apply(score);
    const updatedNote = withLyric.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    expect(updatedNote.kind === 'note' ? updatedNote.lyrics : undefined).toEqual([
      { verse: 1, text: 'Süt' },
    ]);
  });

  it('FAILING-FIRST: pasteLyrics splits whitespace-separated words across subsequent notes', () => {
    const score = createEmptyScore({ numMeasures: 2, timeSig: { num: 2, den: 4 } });
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;
    const n1 = createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('E', 4, 0)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'quarter' });
    const n4 = createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' });
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [n1, n2];
    score.parts[0].staves[0].measures[m1Id].voices[0].events = [n3, n4];

    const pasted = pasteLyrics(n1.id, 'Re Mi Fa Sol', score).apply(score);
    const evsM0 = pasted.parts[0].staves[0].measures[m0Id].voices[0].events;
    const evsM1 = pasted.parts[0].staves[0].measures[m1Id].voices[0].events;

    expect(evsM0[0].kind === 'note' ? evsM0[0].lyrics : undefined).toEqual([{ verse: 1, text: 'Re' }]);
    expect(evsM0[1].kind === 'note' ? evsM0[1].lyrics : undefined).toEqual([{ verse: 1, text: 'Mi' }]);
    expect(evsM1[0].kind === 'note' ? evsM1[0].lyrics : undefined).toEqual([{ verse: 1, text: 'Fa' }]);
    expect(evsM1[1].kind === 'note' ? evsM1[1].lyrics : undefined).toEqual([{ verse: 1, text: 'Sol' }]);
  });

  it('FAILING-FIRST: migrates v5 score with repeat string and lyrics string to schema v6', () => {
    const v5Envelope = {
      app: 'scoreforge',
      savedAt: '2026-11-17T12:00:00.000Z',
      score: {
        schemaVersion: 5,
        id: 'score-v5-test',
        meta: { title: 'V5 Score' },
        measures: [
          { id: 'm1', timeSig: { num: 2, den: 4 }, keySig: 0, repeat: 'start' },
          { id: 'm2', timeSig: { num: 2, den: 4 }, keySig: 0, repeat: 'end' },
          { id: 'm3', timeSig: { num: 2, den: 4 }, keySig: 0, repeat: 'both' },
        ],
        parts: [
          {
            id: 'p1',
            name: 'Voice',
            staves: [
              {
                id: 's1',
                clef: { sign: 'G', line: 2 },
                measures: {
                  m1: {
                    voices: [
                      {
                        id: 'v1',
                        events: [
                          {
                            id: 'n1',
                            kind: 'note',
                            baseType: 'half',
                            dots: 0,
                            duration: 1920,
                            pitches: [{ step: 'C', octave: 4, alter: 0 }],
                            lyrics: 'Do',
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

    const loaded = deserializeScore(JSON.stringify(v5Envelope));
    expect(loaded.schemaVersion).toBe(6);
    expect(loaded.measures[0].repeatStart).toBe(true);
    expect(loaded.measures[0].repeatEnd).toBeUndefined();
    expect(loaded.measures[1].repeatStart).toBeUndefined();
    expect(loaded.measures[1].repeatEnd).toBe(true);
    expect(loaded.measures[2].repeatStart).toBe(true);
    expect(loaded.measures[2].repeatEnd).toBe(true);

    const note1 = loaded.parts[0].staves[0].measures.m1.voices[0].events[0];
    expect(note1.kind === 'note' ? note1.lyrics : undefined).toEqual([{ verse: 1, text: 'Do' }]);
  });
});
