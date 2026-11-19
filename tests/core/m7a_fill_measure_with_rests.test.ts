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
  function testDecomposition(timeSig: { num: number; den: number }, actualTicks?: number, expectedCount?: number) {
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
  }

  it('decomposes correctly and validates for 2/4', () => {
    testDecomposition({ num: 2, den: 4 });
  });

  it('decomposes correctly and validates for 3/4', () => {
    testDecomposition({ num: 3, den: 4 }, undefined, 1);
  });

  it('decomposes correctly and validates for 4/4', () => {
    testDecomposition({ num: 4, den: 4 }, undefined, 1);
  });

  it('decomposes correctly and validates for 6/8', () => {
    testDecomposition({ num: 6, den: 8 }, undefined, 1);
  });

  it('decomposes correctly and validates for 5/8', () => {
    testDecomposition({ num: 5, den: 8 });
  });

  it('decomposes correctly and validates for 7/8', () => {
    testDecomposition({ num: 7, den: 8 });
  });

  it('decomposes correctly and validates for 9/16', () => {
    testDecomposition({ num: 9, den: 16 });
  });

  it('decomposes correctly and validates for pickup measure with actualTicks', () => {
    testDecomposition({ num: 4, den: 4 }, 960, 1);
  });
});
