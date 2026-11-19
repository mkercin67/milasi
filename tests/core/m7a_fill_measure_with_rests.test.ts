// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Dedicated fillMeasureWithRests acceptance tests (Item 8):
 * - Tests 2/4, 3/4, 4/4, 6/8, 5/8, 7/8, 9/16, and pickup with actualTicks
 * - Exact sum to target ticks
 * - Valid baseType
 * - At most one dot
 * - Fewest events possible (3/4 gives exactly 1 dotted half rest)
 * - Each result passes validateScore
 */

import { describe, expect, it } from 'vitest';
import { createMeasure, createPart, createScore } from '../../src/core/factory';
import { fillMeasureWithRests, measureTicks } from '../../src/core/time';
import { validateScore } from '../../src/core/validate';

describe('fillMeasureWithRests Comprehensive Specification (Item 8)', () => {
  const cases: Array<{
    meter: string;
    timeSig: { num: number; den: number };
    actualTicks?: number;
    expectedCount?: number;
  }> = [
    { meter: '2/4', timeSig: { num: 2, den: 4 } },
    { meter: '3/4', timeSig: { num: 3, den: 4 }, expectedCount: 1 }, // exactly 1 dotted half rest!
    { meter: '4/4', timeSig: { num: 4, den: 4 }, expectedCount: 1 }, // 1 whole rest
    { meter: '6/8', timeSig: { num: 6, den: 8 }, expectedCount: 1 }, // 1 dotted half rest
    { meter: '5/8', timeSig: { num: 5, den: 8 } },
    { meter: '7/8', timeSig: { num: 7, den: 8 } },
    { meter: '9/16', timeSig: { num: 9, den: 16 } },
    { meter: 'pickup (1 beat in 4/4)', timeSig: { num: 4, den: 4 }, actualTicks: 960, expectedCount: 1 }, // 1 quarter rest
  ];

  cases.forEach(({ meter, timeSig, actualTicks, expectedCount }) => {
    it(`decomposes correctly and validates for ${meter}`, () => {
      const targetTicks = actualTicks ?? measureTicks(timeSig);
      const rests = fillMeasureWithRests(targetTicks);

      // 1. Output sums to exactly target length
      const totalTicks = rests.reduce((sum, r) => sum + r.duration, 0);
      expect(totalTicks).toBe(targetTicks);

      // 2. Every rest has valid baseType and at most one dot
      for (const r of rests) {
        expect(['whole', 'half', 'quarter', 'eighth', '16th', '32nd']).toContain(r.baseType);
        expect(r.dots).toBeLessThanOrEqual(1);
      }

      // 3. Fewest events requirement (e.g. 3/4 produces exactly 1 dotted half rest)
      if (expectedCount !== undefined) {
        expect(rests).toHaveLength(expectedCount);
      }

      // 4. Must pass validateScore
      const score = createScore();
      const mDef = createMeasure(timeSig, 0, undefined, actualTicks);
      const part = createPart({ name: 'Flute', instrument: 'flute' });
      score.measures.push(mDef);
      score.parts.push(part);
      part.staves[0].measures[mDef.id] = {
        voices: [{ id: 'v1', voiceIndex: 1, events: rests }],
      };

      const problems = validateScore(score);
      const errors = problems.filter((p) => p.severity === 'error');
      expect(errors).toEqual([]);
    });
  });
});
