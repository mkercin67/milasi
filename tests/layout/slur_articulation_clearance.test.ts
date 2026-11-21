// SPDX-License-Identifier: GPL-3.0-or-later
// A slur passes outside the articulations on its side (staccato dots sit between head and slur).
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { toggleArticulation } from '../../src/core/commands';
import { layoutScore } from '../../src/layout/layoutScore';
import { buildNoteheadIndex, layoutArticulations, layoutSlurs } from '../../src/layout/notations';
import type { Score } from '../../src/core/model';

function build(withStaccato: boolean): Score {
  let score = createEmptyScore({ numMeasures: 1 });
  const m0 = score.measures[0].id;
  const evs = ['A', 'B', 'A', 'B'].map((s) =>
    createNote({ pitches: [createPitch(s as 'A' | 'B', 4, 0)], baseType: 'quarter' })
  );
  const staff = score.parts[0].staves[0];
  staff.measures[m0].voices[0].events = evs;
  staff.slurs = [{ id: 'sl1', startEventId: evs[0].id, endEventId: evs[3].id } as never];
  if (withStaccato) for (const e of evs) score = toggleArticulation(e.id, 'staccato').apply(score);
  return score;
}

/** y of the slur apex (t = 0.5 of the first cubic) from the path string. */
function apexY(d: string): number {
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const [, y0, , c1y, , c2y, , y1] = n;
  return (y0 + 3 * c1y + 3 * c2y + y1) / 8;
}

describe('slur and articulations', () => {
  it('S1: with staccato dots on its side the slur lies above every dot', () => {
    const score = build(true);
    const layout = layoutScore(score, { width: 70 });
    const idx = buildNoteheadIndex(layout);
    const arts = layoutArticulations(score, layout, idx);
    const [slur] = layoutSlurs(score, layout, idx, arts);
    const topDot = Math.min(...arts.map((a) => a.y));
    expect(apexY(slur.d)).toBeLessThan(topDot - 0.3);
  });

  it('S2: without articulations the slur is unchanged (stays close to the heads)', () => {
    const plain = build(false);
    const layout = layoutScore(plain, { width: 70 });
    const [a] = layoutSlurs(plain, layout);
    const dotted = build(true);
    const layout2 = layoutScore(dotted, { width: 70 });
    const [b] = layoutSlurs(dotted, layout2);
    expect(apexY(b.d)).toBeLessThan(apexY(a.d));
  });
});

describe('tenuto placement', () => {
  it('T1: a tenuto dash never sits on a staff line', () => {
    let score = createEmptyScore({ numMeasures: 1 });
    const m0 = score.measures[0].id;
    const evs = ['D', 'E', 'F', 'G'].map((s) =>
      createNote({ pitches: [createPitch(s as 'D' | 'E' | 'F' | 'G', 5, 0)], baseType: 'quarter' })
    );
    score.parts[0].staves[0].measures[m0].voices[0].events = evs;
    for (const e of evs) score = toggleArticulation(e.id, 'tenuto').apply(score);
    const layout = layoutScore(score, { width: 70 });
    const arts = layoutArticulations(score, layout, buildNoteheadIndex(layout));
    expect(arts.length).toBe(4);
    for (const a of arts) {
      if (a.y >= -0.2 && a.y <= 4.2) {
        expect(Math.abs(a.y - Math.round(a.y))).toBeGreaterThanOrEqual(0.25);
      }
    }
  });
});
