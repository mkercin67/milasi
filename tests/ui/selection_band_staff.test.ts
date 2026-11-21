// SPDX-License-Identifier: GPL-3.0-or-later
/** A range selection in the lower staff of a grand staff is tinted in that staff, not in the first one. */
import { describe, expect, it } from 'vitest';
import { layoutScore } from '../../src/layout/layoutScore';
import { computeSelectionBands } from '../../src/ui/scoreView/selectionBands';
import { buildBwv772Mm1to7 } from '../fixtures/bwv772Mm1to7';

describe('selection bands in a grand staff', () => {
  const score = buildBwv772Mm1to7();
  const layout = layoutScore(score, { width: 140 });
  const visible = new Set(layout.systems.map((s) => s.index));
  const [upper, lower] = score.parts[0].staves;
  const firstId = (st: typeof lower) => st.measures[score.measures[0].id].voices[0].events[0].id;

  it('S1: events of the lower staff give a band with staffIndex 1 and a positive offset', () => {
    const bands = computeSelectionBands(layout, new Set([firstId(lower)]), visible);
    expect(bands).toHaveLength(1);
    expect(bands[0].staffIndex).toBe(1);
    expect(bands[0].staffOffset).toBeGreaterThan(4);
  });

  it('S2: events of the upper staff give staffIndex 0 and offset 0; both staves give two bands', () => {
    const up = computeSelectionBands(layout, new Set([firstId(upper)]), visible);
    expect(up.map((b) => [b.staffIndex, b.staffOffset])).toEqual([[0, 0]]);
    const both = computeSelectionBands(layout, new Set([firstId(upper), firstId(lower)]), visible);
    expect(both.map((b) => b.staffIndex).sort()).toEqual([0, 1]);
  });
});
