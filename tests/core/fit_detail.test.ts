// SPDX-License-Identifier: GPL-3.0-or-later
/** "Does not fit" message detail: tried length versus room left in the measure. */
import { describe, expect, it } from 'vitest';
import { createGrandStaffScore } from '../../src/core/factory';
import { fitDetail, formatNoteFraction } from '../../src/core/input';
import type { ScoreCursor } from '../../src/core/input';

describe('formatNoteFraction', () => {
  it('F1: ticks become reduced fractions of a whole note', () => {
    expect(formatNoteFraction(480)).toBe('1/8');
    expect(formatNoteFraction(240)).toBe('1/16');
    expect(formatNoteFraction(1440)).toBe('3/8');
    expect(formatNoteFraction(360)).toBe('3/32');
    expect(formatNoteFraction(3840)).toBe('1/1');
    expect(formatNoteFraction(0)).toBe('0');
  });
});

describe('fitDetail', () => {
  const score = createGrandStaffScore({ measures: 1, timeSig: { num: 4, den: 4 } });
  const at = (tick: number): ScoreCursor => ({
    staffId: score.parts[0].staves[0].id,
    voiceIndex: 1,
    measureId: score.measures[0].id,
    tick,
  });

  it('F2: an eighth on the last sixteenth slot reports "1/8 > 1/16" (the Bach m. 6 case)', () => {
    expect(fitDetail(score, at(3600), 'eighth', 0)).toBe(' (1/8 > 1/16)');
  });

  it('F3: a dotted note is measured with its dot; a note that fits gives no detail', () => {
    expect(fitDetail(score, at(3000), 'quarter', 1)).toBe(' (3/8 > 7/32)');
    expect(fitDetail(score, at(3360), 'eighth', 0)).toBe('');
    expect(fitDetail(score, { ...at(0), measureId: 'missing' }, 'eighth', 0)).toBe('');
  });
});
