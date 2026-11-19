// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  advanceCursor,
  enterNote,
  moveCursor,
  ScoreCursor,
} from '../../src/core/input';
import { createEmptyScore } from '../../src/core/factory';
import { History } from '../../src/core/commandTypes';
import { validateScore } from '../../src/core/validate';

describe('Cursor Keyed by voiceIndex (Item 1)', () => {
  it('moves cursor in voice 2 across a barline and stays in voice 2', () => {
    const score = createEmptyScore();
    const staffId = score.parts[0].staves[0].id;
    const m1Id = score.measures[0].id;
    const m2Id = score.measures[1].id;

    const cursor: ScoreCursor = {
      staffId,
      voiceIndex: 2,
      measureId: m1Id,
      tick: 3840, // At the barline of 4/4
    };

    const next = advanceCursor(score, cursor, 0);
    expect(next.measureId).toBe(m2Id);
    expect(next.voiceIndex).toBe(2);
    expect(next.tick).toBe(0);
  });

  it('moves cursor via left/right arrow across measures in voice 2 without falling back to voice 1', () => {
    const score = createEmptyScore();
    const staffId = score.parts[0].staves[0].id;
    const m1Id = score.measures[0].id;
    const m2Id = score.measures[1].id;

    // Both measures only have voice 1 in default score
    const cursor: ScoreCursor = {
      staffId,
      voiceIndex: 2,
      measureId: m1Id,
      tick: 0,
    };

    // Right arrow to next measure
    const nextCursor = moveCursor(score, cursor, 'next');
    expect(nextCursor.measureId).toBe(m2Id);
    expect(nextCursor.voiceIndex).toBe(2);
    expect(nextCursor.tick).toBe(0);

    // Left arrow back to first measure
    const prevCursor = moveCursor(score, nextCursor, 'prev');
    expect(prevCursor.measureId).toBe(m1Id);
    expect(prevCursor.voiceIndex).toBe(2);
    expect(prevCursor.tick).toBe(0);
  });

  it('entering a note in voice 2 of a measure with only voice 1 creates voice 2 and leaves voice 1 untouched', () => {
    const score = createEmptyScore();
    const staffId = score.parts[0].staves[0].id;
    const mId = score.measures[0].id;

    const voice1Before = JSON.parse(
      JSON.stringify(score.parts[0].staves[0].measures[mId].voices[0])
    );
    expect(score.parts[0].staves[0].measures[mId].voices.length).toBe(1);

    const cursor: ScoreCursor = {
      staffId,
      voiceIndex: 2,
      measureId: mId,
      tick: 0,
    };

    const cmd = enterNote(cursor, {
      baseType: 'quarter',
      pitch: { step: 'C', octave: 4, alter: 0 },
    });

    const nextScore = cmd.apply(score);
    const voices = nextScore.parts[0].staves[0].measures[mId].voices;

    expect(voices.length).toBe(2);
    expect(voices[0].voiceIndex).toBe(1);
    expect(voices[1].voiceIndex).toBe(2);

    // Voice 1 must be completely untouched
    expect(voices[0]).toEqual(voice1Before);

    // Voice 2 must contain the entered note and remainder rests
    expect(voices[1].events.length).toBeGreaterThan(0);
    expect(voices[1].events[0].kind).toBe('note');
    expect((voices[1].events[0] as any).pitches[0].step).toBe('C');

    // Score must be valid
    const errors = validateScore(nextScore).filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('undo/redo restores cursor voiceIndex and score state', () => {
    const score = createEmptyScore();
    const staffId = score.parts[0].staves[0].id;
    const mId = score.measures[0].id;

    const history = new History(score);

    const cursor: ScoreCursor = {
      staffId,
      voiceIndex: 2,
      measureId: mId,
      tick: 0,
    };

    const cmd = enterNote(cursor, {
      baseType: 'quarter',
      pitch: { step: 'E', octave: 4, alter: 0 },
    });

    history.do(cmd);
    expect(
      history.score.parts[0].staves[0].measures[mId].voices.length
    ).toBe(2);

    history.undo();
    expect(
      history.score.parts[0].staves[0].measures[mId].voices.length
    ).toBe(1);

    history.redo();
    expect(
      history.score.parts[0].staves[0].measures[mId].voices.length
    ).toBe(2);
    expect(
      history.score.parts[0].staves[0].measures[mId].voices[1].voiceIndex
    ).toBe(2);
  });
});
