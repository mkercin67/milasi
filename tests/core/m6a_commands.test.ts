import { describe, expect, it } from 'vitest';
import {
  deleteMeasure,
  deleteRange,
  insertMeasure,
  resetAccidentalToKeySig,
  setExplicitAccidental,
  toggleTie,
  transposeRange,
} from '../../src/core/commands';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { migrations, serializeScore } from '../../src/io/json';
import { validateScore } from '../../src/core/validate';

describe('Milestone 6a Commands (src/core/commands.ts)', () => {
  it('deleteRange converts all events in range to rests and preserves durations', () => {
    const score = createEmptyScore({ measures: 1 });
    const staff = score.parts[0].staves[0];
    const mId = score.measures[0].id;
    const vId = staff.measures[mId].voices[0].id;

    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const n4 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
    staff.measures[mId].voices[0].events = [n1, n2, n3, n4];

    const range = {
      staffId: staff.id,
      voiceId: vId,
      anchorId: n2.id,
      focusId: n3.id,
    };

    const nextScore = deleteRange(range).apply(score);
    const events = nextScore.parts[0].staves[0].measures[mId].voices[0].events;
    expect(events[0].kind).toBe('note');
    expect(events[1].kind).toBe('rest');
    expect(events[1].duration).toBe(960);
    expect(events[2].kind).toBe('rest');
    expect(events[2].duration).toBe(960);
    expect(events[3].kind).toBe('note');
    expect(validateScore(nextScore)).toHaveLength(0);
  });

  it('transposeRange transposes all notes in range and clamps to MIDI 21..108', () => {
    const score = createEmptyScore({ measures: 1 });
    const staff = score.parts[0].staves[0];
    const mId = score.measures[0].id;
    const vId = staff.measures[mId].voices[0].id;

    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }); // MIDI 60
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }); // MIDI 62
    staff.measures[mId].voices[0].events = [n1, n2, createRest({ baseType: 'half', duration: 1920 })];

    const range = { staffId: staff.id, voiceId: vId, anchorId: n1.id, focusId: n2.id };
    const transposed = transposeRange(range, 2).apply(score);
    const evs = transposed.parts[0].staves[0].measures[mId].voices[0].events;
    expect((evs[0] as any).pitches[0].step).toBe('D');
    expect((evs[1] as any).pitches[0].step).toBe('E');

    // Bounds check: pitch at C8 (MIDI 108) cannot transpose up (+1)
    const highNote = createNote({ pitches: [createPitch('C', 8)], baseType: 'quarter' });
    staff.measures[mId].voices[0].events = [highNote, createRest({ baseType: 'half', duration: 2880 })];
    const rangeHigh = { staffId: staff.id, voiceId: vId, anchorId: highNote.id, focusId: highNote.id };
    expect(() => transposeRange(rangeHigh, 1).apply(score)).toThrow(/MIDI bounds/);
  });

  it('insertMeasure and deleteMeasure update measure count and handle single-measure constraint', () => {
    const score = createEmptyScore({ measures: 2 });
    const inserted = insertMeasure(0).apply(score);
    expect(inserted.measures).toHaveLength(3);
    expect(validateScore(inserted)).toHaveLength(0);

    const deleted = deleteMeasure(0).apply(inserted);
    expect(deleted.measures).toHaveLength(2);
    expect(validateScore(deleted)).toHaveLength(0);

    const singleScore = createEmptyScore({ measures: 1 });
    expect(() => deleteMeasure(0).apply(singleScore)).toThrow(/at least 1 measure/);
  });

  it('toggleTie toggles tie to next matching pitch in voice and throws when no match', () => {
    const score = createEmptyScore({ measures: 1 });
    const staff = score.parts[0].staves[0];
    const mId = score.measures[0].id;

    const n1 = createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('E', 4, 0)], baseType: 'quarter' });
    staff.measures[mId].voices[0].events = [n1, n2, n3, createRest({ baseType: 'quarter', duration: 960 })];

    // Toggle tie from n1 to n2 (matching pitch G4)
    const tiedScore = toggleTie(n1.id, 0).apply(score);
    const ev1 = tiedScore.parts[0].staves[0].measures[mId].voices[0].events[0] as any;
    expect(ev1.pitches[0].tiedToNext).toBe(true);

    // Untie when toggled again
    const untiedScore = toggleTie(n1.id, 0).apply(tiedScore);
    const ev1Untied = untiedScore.parts[0].staves[0].measures[mId].voices[0].events[0] as any;
    expect(ev1Untied.pitches[0].tiedToNext).toBe(false);

    // Tying n2 to n3 throws because n3 is E4, not G4
    expect(() => toggleTie(n2.id, 0).apply(score)).toThrow(/No matching next note/);
  });

  it('setExplicitAccidental and resetAccidentalToKeySig update alter and reset', () => {
    const score = createEmptyScore({ measures: 1 });
    const staff = score.parts[0].staves[0];
    const mId = score.measures[0].id;
    const n1 = createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'quarter' });
    staff.measures[mId].voices[0].events = [n1, createRest({ baseType: 'half', duration: 2880 })];

    // Sharp (+1)
    const sharpScore = setExplicitAccidental(n1.id, 1, 0).apply(score);
    expect((sharpScore.parts[0].staves[0].measures[mId].voices[0].events[0] as any).pitches[0].alter).toBe(1);

    // Double sharp (+1 again)
    const doubleSharp = setExplicitAccidental(n1.id, 1, 0).apply(sharpScore);
    expect((doubleSharp.parts[0].staves[0].measures[mId].voices[0].events[0] as any).pitches[0].alter).toBe(2);

    // Clamps at +2
    const clamped = setExplicitAccidental(n1.id, 1, 0).apply(doubleSharp);
    expect((clamped.parts[0].staves[0].measures[mId].voices[0].events[0] as any).pitches[0].alter).toBe(2);

    // Reset back to key signature (keySig = 0 -> alter = 0)
    const resetScore = resetAccidentalToKeySig(n1.id, 0).apply(clamped);
    expect((resetScore.parts[0].staves[0].measures[mId].voices[0].events[0] as any).pitches[0].alter).toBe(0);
  });

  it('schemaVersion 2 migration: upgrades v1 to v2 and serializes v2', () => {
    const v1Json = JSON.stringify({
      schemaVersion: 1,
      id: 'test-v1',
      meta: { title: 'V1 Score', composer: 'Test' },
      parts: [
        {
          id: 'p1',
          name: 'Treble',
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
                          kind: 'note',
                          id: 'n1',
                          baseType: 'quarter',
                          dots: 0,
                          duration: 960,
                          pitches: [{ step: 'C', octave: 4, alter: 0 }],
                          tiedToNext: true,
                          articulations: [],
                        },
                        {
                          kind: 'rest',
                          id: 'r1',
                          baseType: 'half',
                          dots: 1,
                          duration: 2880,
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
      measures: [{ id: 'm1', timeSig: { num: 4, den: 4 }, keySig: 0 }],
      overrides: {},
    });

    const v1Parsed = JSON.parse(v1Json);
    const migrated = migrations[1](v1Parsed);
    expect(migrated.schemaVersion).toBe(2);
    // Note's first pitch has tiedToNext migrated
    const n1 = migrated.parts[0].staves[0].measures['m1'].voices[0].events[0] as any;
    expect(n1.pitches[0].tiedToNext).toBe(true);

    const serialized = serializeScore(migrated);
    expect(serialized).toContain('"schemaVersion":2');
  });
});
