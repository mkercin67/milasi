// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-9: a slur is shaped by the noteheads of its OWN staff only (found while checking Beethoven Op. 18 No. 1).
import { describe, expect, it } from 'vitest';
import { layoutScore } from '../../src/layout/layoutScore';
import { layoutHairpins, layoutSlurs } from '../../src/layout/notations';
import { applyTemplate } from '../../src/core/ensembleCommands';
import { createEmptyScore } from '../../src/core/factory';
import { buildBeethovenOp18No1Mm1to8 } from '../fixtures/beethovenOp18No1Mm1to8';
import { applyMarks, fillStaffEvents } from '../fixtures/markedMeasures';

/** All y numbers of an SVG path made of "M x y" and "C x y, x y, x y" commands. */
function pathYs(d: string): number[] {
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  return nums.filter((_, i) => i % 2 === 1);
}

describe('M7c-9 slurs in an ensemble', () => {
  it('SE1: no slur of the string quartet is taller than 4 staff spaces, whatever the other staves hold', () => {
    const score = buildBeethovenOp18No1Mm1to8();
    const layout = layoutScore(score, { width: 90 });
    const slurs = layoutSlurs(score, layout);
    // A slur that crosses a system break comes back as two half slurs, so count distinct slurs.
    expect(new Set(slurs.map((s) => s.slurId)).size).toBe(31);
    for (const s of slurs) {
      const ys = pathYs(s.d);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(4);
    }
  });

  it('SE2: staccato dots of another staff do not stretch a cello slur over a bar line', () => {
    let score = structuredClone(
      applyTemplate('stringQuartet').apply(createEmptyScore({ measures: 4, timeSig: { num: 3, den: 4 } }))
    );
    const rest = 'r/2.';
    const lines = [
      ['F5/4! r/4 r/4', rest, rest, rest],
      [rest, rest, rest, rest],
      [rest, rest, rest, rest],
      ['(A3/2.', 'A3/2.)', rest, rest],
    ];
    const pending = lines.map((l, p) => fillStaffEvents(score, p, l));
    pending.forEach((pm) => {
      score = applyMarks(score, pm);
    });
    const slurs = layoutSlurs(score, layoutScore(score, { width: 90 }));
    expect(slurs).toHaveLength(1);
    const ys = pathYs(slurs[0].d);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(4);
  });

  it('HP1: a crescendo and the diminuendo that starts on its last note do not touch (gap of at least 0.6 sp)', () => {
    const score = buildBeethovenOp18No1Mm1to8();
    const layout = layoutScore(score, { width: 400 });
    const violinII = score.parts[1].staves[0];
    const cresc = violinII.hairpins!.find((h) => h.type === 'crescendo')!;
    const dim = violinII.hairpins!.find((h) => h.type === 'diminuendo')!;
    expect(cresc.endEventId).toBe(dim.startEventId);
    const items = layoutHairpins(score, layout);
    const first = items.filter((i) => i.slurId === dim.id)[0];
    const xs = (id: string, sys: number) =>
      items
        .filter((i) => i.slurId === id && i.systemIndex === sys)
        .flatMap((i) => i.d.match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_, k) => k % 2 === 0));
    const endOfCresc = Math.max(...xs(cresc.id, first.systemIndex));
    const startOfDim = Math.min(...xs(dim.id, first.systemIndex));
    expect(startOfDim - endOfCresc).toBeGreaterThanOrEqual(0.6);
  });
});
