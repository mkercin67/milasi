// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import { appendMeasure } from '../../src/core/input';
import { deleteMeasure, insertMeasure } from '../../src/core/structureCommands';
import { History } from '../../src/core/commands';

describe('D2: Barline commands specification', () => {
  it('(i) appendMeasure on score ending with "final" changes previous to "single" and new to "final"', () => {
    const score = createEmptyScore({ measures: 2 }); // 2 measures: m1 single, m2 final
    expect(score.measures[0].endBarline).toBe('single');
    expect(score.measures[1].endBarline).toBe('final');

    const cmd = appendMeasure();
    const nextScore = cmd.apply(score);

    expect(nextScore.measures).toHaveLength(3);
    expect(nextScore.measures[0].endBarline).toBe('single');
    expect(nextScore.measures[1].endBarline).toBe('single');
    expect(nextScore.measures[2].endBarline).toBe('final');
  });

  it('(i-b) appendMeasure on score ending with "double" preserves "double" and new gets "single"', () => {
    let score = createEmptyScore({ measures: 2 });
    score = {
      ...score,
      measures: [
        { ...score.measures[0], endBarline: 'single' },
        { ...score.measures[1], endBarline: 'double' },
      ],
    };

    const cmd = appendMeasure();
    const nextScore = cmd.apply(score);

    expect(nextScore.measures).toHaveLength(3);
    expect(nextScore.measures[0].endBarline).toBe('single');
    expect(nextScore.measures[1].endBarline).toBe('double');
    expect(nextScore.measures[2].endBarline).toBe('single');
  });

  it('(ii) deleteMeasure on last measure ending with "final" sets new last measure to "final"', () => {
    const score = createEmptyScore({ measures: 2 }); // 2 measures: m1 single, m2 final
    const cmd = deleteMeasure(1);
    const nextScore = cmd.apply(score);

    expect(nextScore.measures).toHaveLength(1);
    expect(nextScore.measures[0].endBarline).toBe('final');
  });

  it('(iii) mid-score explicit "final" barline is NEVER touched by appendMeasure or deleteMeasure', () => {
    // 3-measure score: m1 final (explicit mid-score), m2 single, m3 final
    let score = createEmptyScore({ measures: 3 });
    // Explicitly set m1 to 'final', m2 to 'single', m3 to 'final'
    score = {
      ...score,
      measures: [
        { ...score.measures[0], endBarline: 'final' },
        { ...score.measures[1], endBarline: 'single' },
        { ...score.measures[2], endBarline: 'final' },
      ],
    };

    // Append measure -> m4 added
    const afterAppend = appendMeasure().apply(score);
    expect(afterAppend.measures).toHaveLength(4);
    expect(afterAppend.measures[0].endBarline).toBe('final'); // mid-score final untouched!
    expect(afterAppend.measures[1].endBarline).toBe('single');
    expect(afterAppend.measures[2].endBarline).toBe('single');
    expect(afterAppend.measures[3].endBarline).toBe('final');

    // Delete last measure (m4) -> m3 becomes 'final', m1 untouched
    const afterDelete = deleteMeasure(3).apply(afterAppend);
    expect(afterDelete.measures).toHaveLength(3);
    expect(afterDelete.measures[0].endBarline).toBe('final'); // mid-score final untouched!
    expect(afterDelete.measures[1].endBarline).toBe('single');
    expect(afterDelete.measures[2].endBarline).toBe('final');
  });

  it('undo restores both barlines atomically in a single step', () => {
    const score = createEmptyScore({ measures: 2 }); // m1 single, m2 final
    const history = new History(score);

    // Apply appendMeasure
    history.do(appendMeasure());
    const afterAppend = history.score;
    expect(afterAppend.measures).toHaveLength(3);
    expect(afterAppend.measures[1].endBarline).toBe('single');
    expect(afterAppend.measures[2].endBarline).toBe('final');

    // One undo restores both
    const restored = history.undo();
    expect(restored).not.toBeNull();
    expect(restored!.measures).toHaveLength(2);
    expect(restored!.measures[0].endBarline).toBe('single');
    expect(restored!.measures[1].endBarline).toBe('final');
  });

  it('0.1 insertMeasure at end: changes previous last from final to single, new measure gets final', () => {
    const score = createEmptyScore({ measures: 2 }); // m1 single, m2 final
    expect(score.measures[0].endBarline).toBe('single');
    expect(score.measures[1].endBarline).toBe('final');

    // insertMeasure after index 1 (at end)
    const cmd = insertMeasure(1);
    const nextScore = cmd.apply(score);

    expect(nextScore.measures).toHaveLength(3);
    expect(nextScore.measures[0].endBarline).toBe('single');
    expect(nextScore.measures[1].endBarline).toBe('single');
    expect(nextScore.measures[2].endBarline).toBe('final');
  });

  it('0.1 insertMeasure in middle: changes no barline on existing measures', () => {
    const score = createEmptyScore({ measures: 2 }); // m1 single, m2 final
    // insertMeasure after index 0 (in middle)
    const cmd = insertMeasure(0);
    const nextScore = cmd.apply(score);

    expect(nextScore.measures).toHaveLength(3);
    expect(nextScore.measures[0].endBarline).toBe('single');
    expect(nextScore.measures[1].endBarline).toBe('single');
    expect(nextScore.measures[2].endBarline).toBe('final');
  });

  it('0.1 insertMeasure undo restores both barlines atomically in one step', () => {
    const score = createEmptyScore({ measures: 2 }); // m1 single, m2 final
    const history = new History(score);

    history.do(insertMeasure(1));
    const afterInsert = history.score;
    expect(afterInsert.measures).toHaveLength(3);
    expect(afterInsert.measures[1].endBarline).toBe('single');
    expect(afterInsert.measures[2].endBarline).toBe('final');

    const restored = history.undo();
    expect(restored).not.toBeNull();
    expect(restored!.measures).toHaveLength(2);
    expect(restored!.measures[0].endBarline).toBe('single');
    expect(restored!.measures[1].endBarline).toBe('final');
  });
});
