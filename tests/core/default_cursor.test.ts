// SPDX-License-Identifier: GPL-3.0-or-later
/** The cursor a fresh editor starts with (the single place where "first staff" is the intended default). */
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createGrandStaffScore } from '../../src/core/factory';
import { defaultCursor } from '../../src/core/input';

describe('defaultCursor', () => {
  it('D1: a grand staff starts on the first (upper) staff, voice 1, start of the first measure', () => {
    const score = createGrandStaffScore({ measures: 3 });
    expect(defaultCursor(score)).toEqual({
      staffId: score.parts[0].staves[0].id,
      voiceIndex: 1,
      measureId: score.measures[0].id,
      tick: 0,
    });
  });

  it('D2: a single-staff score gets the same default; a score without measures gets none', () => {
    const score = createEmptyScore({ measures: 2 });
    expect(defaultCursor(score)?.measureId).toBe(score.measures[0].id);
    expect(defaultCursor({ ...score, measures: [] })).toBeNull();
  });
});
