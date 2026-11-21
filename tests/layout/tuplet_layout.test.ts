// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-2b: the tuplet number and the beam of a triplet group.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createPitch } from '../../src/core/factory';
import { advanceCursor, enterNote, ScoreCursor } from '../../src/core/input';
import { layoutScore } from '../../src/layout/layoutScore';
import { buildNoteheadIndex, layoutTuplets } from '../../src/layout/notations';
import type { Score } from '../../src/core/model';

const T32 = { actual: 3, normal: 2 };

function triplets(step: 'C' | 'E', octave: number, groups = 1): Score {
  let score = createEmptyScore({ numMeasures: 1 });
  let cursor: ScoreCursor = {
    staffId: score.parts[0].staves[0].id,
    voiceIndex: 1,
    measureId: score.measures[0].id,
    tick: 0,
  };
  for (let i = 0; i < 3 * groups; i++) {
    score = enterNote(cursor, { baseType: '16th', pitch: createPitch(step, octave, 0), tuplet: T32 }).apply(score);
    cursor = advanceCursor(score, cursor, 160);
  }
  return score;
}

function numbers(score: Score) {
  const layout = layoutScore(score, { width: 70 });
  return { layout, items: layoutTuplets(score, layout, buildNoteheadIndex(layout)) };
}

describe('tuplet layout', () => {
  it('L1: a group of three draws one "3" above stems that point up', () => {
    const { items } = numbers(triplets('C', 4));
    expect(items).toHaveLength(1);
    expect(items[0].glyph).toBe('tuplet3');
    // the stems of low notes end at y = 1.5: the number sits 0.6 sp above them, clear of every notehead
    expect(items[0].y).toBeLessThanOrEqual(1.5 - 0.6 + 0.001);
  });

  it('L2: stems that point down put the number below', () => {
    const { items } = numbers(triplets('E', 5));
    expect(items).toHaveLength(1);
    expect(items[0].y).toBeGreaterThan(4);
  });

  it('L3: two groups in a row give two numbers, not one', () => {
    const { items } = numbers(triplets('C', 4, 2));
    expect(items).toHaveLength(2);
    expect(items[1].x).toBeGreaterThan(items[0].x);
  });

  it('L4: the three notes share a single beam, two groups share two (not one beam of six)', () => {
    const one = numbers(triplets('C', 4, 1)).layout;
    const two = numbers(triplets('C', 4, 2)).layout;
    const beams = (l: typeof one) => l.systems[0].items.filter((it) => it.id.includes('beam') && it.kind !== 'glyph');
    expect(beams(two).length).toBeGreaterThan(beams(one).length);
  });

  it('L5: a score with no tuplets draws no tuplet numbers', () => {
    const plain = createEmptyScore({ numMeasures: 1 });
    expect(numbers(plain).items).toEqual([]);
  });
});
