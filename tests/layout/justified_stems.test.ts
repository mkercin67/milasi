// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, newId } from '../../src/core/factory';
import type { Score, ScoreEvent } from '../../src/core/model';
import { layoutScore } from '../../src/layout/layoutScore';
import type { LayoutItem, LayoutSystem } from '../../src/layout/types';

type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
type Base = 'quarter' | 'eighth' | 'half';
const n = (step: Step, octave: number, baseType: Base = 'quarter', dots = 0): ScoreEvent =>
  createNote({ pitches: [createPitch(step, octave)], baseType, dots });

/** Eight measures; measures 0-5 single voice, 6-7 two voices. Narrow width => several justified systems. */
function buildScore(): Score {
  const score = createEmptyScore({ measures: 8 });
  const staff = score.parts[0].staves[0];
  score.measures.forEach((m, i) => {
    if (i < 6) {
      // 1 + 1 + 1.5 + 0.5 beats = one full 4/4 measure.
      staff.measures[m.id].voices[0].events = [
        n('C', 4), // ledger line below the staff, stem up
        n('B', 5), // stem down
        n('E', 5, 'quarter', 1), // dotted
        n('G', 4, 'eighth'), // flag
      ];
    } else {
      staff.measures[m.id].voices = [
        { id: newId(), voiceIndex: 1, events: [n('E', 5), n('F', 5), n('G', 5), n('A', 5)] },
        { id: newId(), voiceIndex: 2, events: [n('C', 4, 'half'), n('G', 3, 'half')] },
      ];
    }
  });
  return score;
}

function stemOffsets(sys: LayoutSystem): number[] {
  const byId = new Map<string, LayoutItem>(sys.items.map((it) => [it.id, it]));
  const out: number[] = [];
  for (const it of sys.items) {
    if (!it.id.endsWith('-stem') || !it.eventId) continue;
    const head = byId.get(it.eventId);
    if (head) out.push(it.x - head.x);
  }
  return out;
}

describe('Justified systems keep stems, dots and flags at a fixed offset from the notehead', () => {
  it('J1: stem x is exactly the notehead edge (offset 0 or 1.18 sp) in every system, stretched or not', () => {
    const layout = layoutScore(buildScore(), { width: 70 });
    expect(layout.systems.length).toBeGreaterThan(2);
    let checked = 0;
    for (const sys of layout.systems) {
      for (const off of stemOffsets(sys)) {
        const ok = Math.abs(off) < 1e-6 || Math.abs(off - 1.18) < 1e-6;
        expect(ok, `stem offset ${off}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('J2: a stem-up stem is drawn on the right edge of its notehead even at a large stretch ratio', () => {
    // One 4/4 measure per system forces a big stretch on every non-last system.
    const score = createEmptyScore({ measures: 3 });
    const staff = score.parts[0].staves[0];
    score.measures.forEach((m) => {
      staff.measures[m.id].voices[0].events = [n('C', 4), n('D', 4), n('E', 4), n('F', 4)];
    });
    const layout = layoutScore(score, { width: 40 });
    const sys = layout.systems[0];
    const head = sys.items.find((it) => it.id === staff.measures[score.measures[0].id].voices[0].events[0].id)!;
    const stem = sys.items.find((it) => it.id === `${head.id}-stem`)!;
    expect(stem.x - head.x).toBeCloseTo(1.18, 6);
  });

  it('J3: augmentation dots keep a fixed 1.48 sp offset from the notehead', () => {
    const layout = layoutScore(buildScore(), { width: 70 });
    let dots = 0;
    for (const sys of layout.systems) {
      const byId = new Map<string, LayoutItem>(sys.items.map((it) => [it.id, it]));
      for (const it of sys.items) {
        if (!/-dot-\d+-0$/.test(it.id) || !it.eventId) continue;
        const head = byId.get(it.eventId);
        if (!head) continue;
        expect(it.x - head.x).toBeCloseTo(1.48, 6);
        dots++;
      }
    }
    expect(dots).toBeGreaterThan(2);
  });

  it('J4: a displaced second-interval notehead (voice 2) stays one notehead width from its partner', () => {
    const score = createEmptyScore({ measures: 3 });
    const staff = score.parts[0].staves[0];
    const ids: Array<[string, string]> = [];
    score.measures.forEach((m) => {
      const a = n('E', 5, 'half');
      const b = n('D', 5, 'half');
      ids.push([a.id, b.id]);
      staff.measures[m.id].voices = [
        { id: newId(), voiceIndex: 1, events: [a, n('E', 5, 'half')] },
        { id: newId(), voiceIndex: 2, events: [b, n('D', 5, 'half')] },
      ];
    });
    const layout = layoutScore(score, { width: 40 });
    const sys = layout.systems[0];
    const [aId, bId] = ids[0];
    const a = sys.items.find((it) => it.id === aId)!;
    const b = sys.items.find((it) => it.id === bId)!;
    expect(b.x - a.x).toBeCloseTo(1.18, 6);
  });
});
