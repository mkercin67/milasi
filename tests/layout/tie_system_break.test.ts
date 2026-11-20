// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createGrandStaffScore, createNote, createPitch } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';
import { layoutTies } from '../../src/layout/ties';

/** x of the start and end point of a crescent path "M x1 y Q cx cy x2 y Q ... Z". */
function endpointsX(d: string): { x1: number; x2: number } {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  return { x1: nums[0], x2: nums[4] };
}

describe('Ties across a system break', () => {
  it('T1: the entering half-tie of a grand staff starts right of the clef and has a visible length', () => {
    const score = createGrandStaffScore({ measures: 8 });
    const bass = score.parts[0].staves[1];
    for (const m of score.measures) {
      bass.measures[m.id].voices[0].events = [
        createNote({ pitches: [createPitch('C', 3)], baseType: 'quarter', tiedToNext: true }),
        createNote({ pitches: [createPitch('D', 3)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('E', 3)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('C', 3)], baseType: 'quarter', tiedToNext: true }),
      ];
    }
    const layout = layoutScore(score, { width: 70 });
    expect(layout.systems.length).toBeGreaterThan(1);
    const ties = layoutTies(score, layout);
    const entering = ties.filter((t) => t.id.endsWith('_break_b'));
    expect(entering.length).toBeGreaterThan(0);
    for (const t of entering) {
      const { x1, x2 } = endpointsX(t.d);
      // Clef advance is 0.4 + 2.8 = 3.2 sp; its ink is narrower, so 3.0 still clears the glyph.
      expect(x1, 'starts right of the clef').toBeGreaterThanOrEqual(3.0);
      // 0.8 sp is the minimum length; allow float rounding (0.7999999999999998 occurs).
      expect(x2 - x1, 'forward and visible').toBeGreaterThanOrEqual(0.8 - 1e-9);
    }
  });
});
