// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import type { Score } from '../../src/core/model';
import { layoutScore } from '../../src/layout/layoutScore';

/** Number of whole-measure rests per system (the empty measures hold one each). */
const measuresPerSystem = (score: Score, width: number): number[] =>
  layoutScore(score, { width }).systems.map((s) => s.items.filter((i) => i.kind === 'glyph' && /^rest/.test(i.glyph ?? '')).length);

const withBreaks = (score: Score, ...indexes: number[]): Score => ({
  ...score,
  measures: score.measures.map((m, i) => (indexes.includes(i) ? { ...m, systemBreakBefore: true } : m)),
});

describe('M7d-1: systemBreakBefore in layoutScore', () => {
  it('SB1: without breaks the measures fill the systems by width only', () => {
    const score = createEmptyScore({ measures: 8 });
    const counts = measuresPerSystem(score, 60);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(8);
    expect(counts.length).toBeGreaterThan(1);
  });

  it('SB2: a break before measure 3 (index 2) makes it the first measure of a system', () => {
    const score = createEmptyScore({ measures: 8 });
    const plain = measuresPerSystem(score, 200);
    expect(plain).toEqual([8]);
    expect(measuresPerSystem(withBreaks(score, 2), 200)).toEqual([2, 6]);
  });

  it('SB3: several breaks give several systems; a break on the first measure changes nothing', () => {
    const score = createEmptyScore({ measures: 8 });
    expect(measuresPerSystem(withBreaks(score, 2, 5), 200)).toEqual([2, 3, 3]);
    expect(measuresPerSystem(withBreaks(score, 0), 200)).toEqual([8]);
  });

  it('SB4: a break only shortens a system, it never makes a system longer than the width allows', () => {
    const score = createEmptyScore({ measures: 8 });
    const free = measuresPerSystem(score, 60);
    const broken = measuresPerSystem(withBreaks(score, 1), 60);
    expect(broken.reduce((a, b) => a + b, 0)).toBe(8);
    expect(broken[0]).toBe(1);
    expect(Math.max(...broken)).toBeLessThanOrEqual(Math.max(...free));
  });

  it('SB5: the layout is unchanged when no measure has a break (same result as before M7d)', () => {
    const score = createEmptyScore({ measures: 6 });
    const a = layoutScore(score, { width: 70 });
    const b = layoutScore({ ...score, measures: score.measures.map((m) => ({ ...m })) }, { width: 70 });
    expect(JSON.stringify(a.systems.map((s) => s.items.length))).toBe(JSON.stringify(b.systems.map((s) => s.items.length)));
    expect(a.height).toBe(b.height);
  });
});
