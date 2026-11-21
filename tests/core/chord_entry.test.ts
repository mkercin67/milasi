// SPDX-License-Identifier: GPL-3.0-or-later
/** M7b-8: chord entry helpers (Shift+letter adds a pitch above the note just entered). */
import { describe, expect, it } from 'vitest';
import { changePitch } from '../../src/core/commands';
import { createGrandStaffScore, newId } from '../../src/core/factory';
import { advanceCursor, chordPitchAbove, enterNote, enterRest, findNoteBeforeCursor, topPitch } from '../../src/core/input';
import type { ScoreCursor } from '../../src/core/input';
import type { Pitch, Score } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';

const p = (step: Pitch['step'], octave: number, alter = 0): Pitch => ({ step, octave, alter });

const startCursor = (score: Score): ScoreCursor => ({
  staffId: score.parts[0].staves[1].id,
  voiceIndex: 1,
  measureId: score.measures[0].id,
  tick: 0,
});

describe('chordPitchAbove / topPitch', () => {
  it('C1: the first matching letter strictly above the top pitch (Mozart K. 545 chords)', () => {
    expect(chordPitchAbove(p('F', 3), 'C', 0)).toEqual(p('C', 4));
    expect(chordPitchAbove(p('C', 3), 'C', 0)).toEqual(p('C', 4)); // same letter: the octave above
    expect(chordPitchAbove(p('E', 3), 'C', 0)).toEqual(p('C', 4));
    expect(chordPitchAbove(p('D', 3), 'C', 0)).toEqual(p('C', 4));
    expect(chordPitchAbove(p('D', 3), 'B', 0)).toEqual(p('B', 3));
    expect(chordPitchAbove(p('B', 3), 'C', 0)).toEqual(p('C', 4)); // across the octave boundary
  });

  it('C2: the accidental comes from the key signature (G major: F is sharp)', () => {
    expect(chordPitchAbove(p('C', 4), 'F', 1)).toEqual(p('F', 4, 1));
  });

  it('C3: topPitch picks the highest pitch regardless of list order', () => {
    expect(topPitch([p('C', 4), p('F', 3)])).toEqual(p('C', 4));
    expect(topPitch([p('F', 3), p('G', 3), p('E', 3)])).toEqual(p('G', 3));
  });
});

describe('findNoteBeforeCursor', () => {
  it('C4: finds the note just entered, then a chord can be built on it (F3 + C4)', () => {
    const score = createGrandStaffScore({ measures: 2, timeSig: { num: 4, den: 4 } });
    const cursor = startCursor(score);
    const id = newId();
    const entered = enterNote(cursor, { baseType: 'quarter', pitch: p('F', 3), eventId: id }).apply(score);
    const next = advanceCursor(entered, cursor, 960);
    const note = findNoteBeforeCursor(entered, next);
    expect(note?.id).toBe(id);
    const chord = changePitch(id, [...note!.pitches, chordPitchAbove(topPitch(note!.pitches), 'C', 0)]).apply(entered);
    const after = findNoteBeforeCursor(chord, next);
    expect(after?.pitches.map((x) => `${x.step}${x.octave}`)).toEqual(['F3', 'C4']);
    expect(validateScore(chord)).toEqual([]);
  });

  it('C5: a rest before the cursor, or no event at all, gives null', () => {
    const score = createGrandStaffScore({ measures: 1, timeSig: { num: 4, den: 4 } });
    const cursor = startCursor(score);
    expect(findNoteBeforeCursor(score, cursor)).toBeNull();
    const withRest = enterRest(cursor, { baseType: 'quarter' }).apply(score);
    expect(findNoteBeforeCursor(withRest, { ...cursor, tick: 960 })).toBeNull();
    expect(findNoteBeforeCursor(withRest, null)).toBeNull();
  });

  it('C6: at the start of the next measure the last note of the previous measure is found', () => {
    const score = createGrandStaffScore({ measures: 2, timeSig: { num: 4, den: 4 } });
    const cursor = startCursor(score);
    const id = newId();
    const entered = enterNote({ ...cursor, tick: 2880 }, { baseType: 'quarter', pitch: p('G', 3), eventId: id }).apply(score);
    const found = findNoteBeforeCursor(entered, { ...cursor, measureId: score.measures[1].id, tick: 0 });
    expect(found?.id).toBe(id);
  });
});
