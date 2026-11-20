// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { createEmptyScore, createNote, createPitch, newId } from '../../src/core/factory';
import type { Score, ScoreEvent, Staff } from '../../src/core/model';
import { layoutScore } from '../../src/layout/layoutScore';
import { resolvePointerStaff } from '../../src/layout/pointerCursor';
import { getItemRect } from '../../src/layout/mouse';
import { MIN_STAFF_GAP_SP } from '../../src/layout/skylineSpacing';
import type { LayoutItem, LayoutSystem } from '../../src/layout/types';

type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
const note = (step: Step, octave: number, baseType: 'quarter' | 'whole' = 'quarter') =>
  createNote({ pitches: [createPitch(step, octave)], baseType });
const rest = (e: ScoreEvent) => ({ ...e, id: newId() });

/** Grand staff built from explicit event lists per measure (a missing list keeps the whole rest). */
function grand(upper: Array<ScoreEvent[] | undefined>, lower: Array<ScoreEvent[] | undefined>, measures: number): Score {
  const score = createEmptyScore({ measures });
  const part = score.parts[0];
  const bass: Staff = { id: newId(), clef: { sign: 'F', line: 4 }, measures: {}, slurs: [] };
  score.measures.forEach((m, i) => {
    const base = part.staves[0].measures[m.id].voices[0].events;
    if (upper[i]) part.staves[0].measures[m.id].voices[0].events = upper[i] as ScoreEvent[];
    bass.measures[m.id] = {
      voices: [{ id: newId(), voiceIndex: 1, events: lower[i] ?? base.map(rest) }],
    };
  });
  part.staves.push(bass);
  return score;
}

function quiet<T>(fn: () => T): T {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

/** Padding of the design (M7b-4 S2), a literal on purpose: the test must not follow the constant. */
const PADDING_SP = 1.5;
const gapOf = (sys: LayoutSystem) => sys.staves[1].y - sys.staves[0].y - 4;
const inStaff = (sys: LayoutSystem, k: number) => sys.items.filter((i) => i.staffId === sys.staves[k].id && !i.hidden && i.glyph !== 'brace');

/** Low notes in the treble staff and very high notes in the bass staff at the same beats. */
const collidingUpper = () => [note('C', 3), note('C', 3), note('C', 3), note('C', 3)];
const collidingLower = () => [note('C', 5), note('C', 5), note('C', 5), note('C', 5)];

describe('skyline spacing between staves (M7b-4)', () => {
  it('K1: a normal piano score keeps the minimum gap of 7.0 sp (staff pitch 11)', () => {
    const score = grand(
      [[note('C', 5), note('D', 5), note('E', 5), note('F', 5)]],
      [[note('C', 3), note('G', 2), note('C', 3), note('G', 2)]],
      2
    );
    const sys = quiet(() => layoutScore(score, { width: 100 })).systems[0];
    expect(gapOf(sys)).toBe(MIN_STAFF_GAP_SP);
    expect(sys.height).toBe(6 + 11);
  });

  it('K2: colliding low treble and high bass notes grow the gap and no items of the two staves overlap', () => {
    const score = grand([collidingUpper()], [collidingLower()], 2);
    const sys = quiet(() => layoutScore(score, { width: 100 })).systems[0];
    expect(gapOf(sys)).toBeGreaterThan(MIN_STAFF_GAP_SP);
    for (const a of inStaff(sys, 0)) {
      const ra = getItemRect(a);
      for (const b of inStaff(sys, 1)) {
        const rb = getItemRect(b);
        const overlapX = ra.x1 < rb.x2 && rb.x1 < ra.x2;
        if (overlapX) expect(ra.y2 + PADDING_SP).toBeLessThanOrEqual(rb.y1 + 1e-9);
      }
    }
  });

  it('K3: only the system with the collision grows; the stacking of systems follows the real heights', () => {
    const measures = 8;
    const upper: Array<ScoreEvent[] | undefined> = Array(measures).fill(undefined);
    const lower: Array<ScoreEvent[] | undefined> = Array(measures).fill(undefined);
    upper[0] = collidingUpper();
    lower[0] = collidingLower();
    const score = grand(upper, lower, measures);
    const layout = quiet(() => layoutScore(score, { width: 50 }));
    expect(layout.systems.length).toBeGreaterThan(1);
    const [s0, s1] = layout.systems;
    expect(gapOf(s0)).toBeGreaterThan(MIN_STAFF_GAP_SP);
    expect(gapOf(s1)).toBe(MIN_STAFF_GAP_SP);
    const extra = gapOf(s0) - MIN_STAFF_GAP_SP;
    // Base step is spacing 10 + 4 + 11; the grown first system pushes the second one down by `extra`.
    expect(s1.y - s0.y).toBeCloseTo(10 + 4 + 11 + extra, 6);
    const last = layout.systems[layout.systems.length - 1];
    expect(layout.height).toBeGreaterThanOrEqual(last.y + last.height);
  });

  it('K4: items far apart horizontally do not grow the gap (only overlapping extents count)', () => {
    const upper = [note('C', 3), createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' })];
    const upperEvents: ScoreEvent[] = [
      upper[0],
      { ...rest(note('C', 5)), kind: 'rest' } as ScoreEvent,
      { ...rest(note('C', 5)), kind: 'rest' } as ScoreEvent,
      { ...rest(note('C', 5)), kind: 'rest' } as ScoreEvent,
    ];
    const lowerEvents: ScoreEvent[] = [
      { ...rest(note('C', 5)), kind: 'rest' } as ScoreEvent,
      { ...rest(note('C', 5)), kind: 'rest' } as ScoreEvent,
      { ...rest(note('C', 5)), kind: 'rest' } as ScoreEvent,
      note('C', 5),
    ];
    const score = grand([upperEvents], [lowerEvents], 2);
    const sys = quiet(() => layoutScore(score, { width: 100 })).systems[0];
    expect(gapOf(sys)).toBe(MIN_STAFF_GAP_SP);
  });

  it('K5: through barlines and the brace follow the grown span; pointer staff resolution and staff lines use the final offsets', () => {
    const score = grand([collidingUpper()], [collidingLower()], 2);
    const layout = quiet(() => layoutScore(score, { width: 100 }));
    const sys = layout.systems[0];
    const off1 = sys.staves[1].y - sys.staves[0].y;
    expect(off1).toBeGreaterThan(11);
    const brace = sys.items.find((i) => i.glyph === 'brace') as LayoutItem;
    expect(brace.y).toBeCloseTo(off1 + 4, 6);
    expect((brace.scaleY as number) * 4).toBeCloseTo(off1 + 4, 6);
    const through = sys.items.filter((i) => i.kind === 'line' && i.id.startsWith('barline'));
    expect(through.length).toBeGreaterThan(0);
    for (const b of through) expect(b.y2).toBeCloseTo(off1 + 4, 6);
    const line0 = sys.items.find((i) => i.id === `sys-${sys.index}-s1-staffline-0`) as LayoutItem;
    expect(line0.y).toBeCloseTo(off1, 6);
    // pointer in the middle of the lower staff resolves to it, 6.5 sp above resolves to the upper staff
    expect(resolvePointerStaff(layout, sys.y + off1 + 2)?.staffId).toBe(sys.staves[1].id);
    expect(resolvePointerStaff(layout, sys.y + 2)?.staffId).toBe(sys.staves[0].id);
  });

  it('K6: layout stays deterministic and does not mutate cached items (second layout equals the first)', () => {
    const score = grand([collidingUpper()], [collidingLower()], 2);
    const a = quiet(() => layoutScore(score, { width: 100 }));
    const b = quiet(() => layoutScore(score, { width: 100 }));
    expect(JSON.stringify(b.systems.map((s) => s.items))).toBe(JSON.stringify(a.systems.map((s) => s.items)));
    expect(gapOf(b.systems[0])).toBe(gapOf(a.systems[0]));
  });
});
