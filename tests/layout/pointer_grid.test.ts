// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { createGrandStaffScore, createNote, createPitch } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';
import { getSystemMeasureBounds } from '../../src/layout/mouse';
import { MIN_GRID_SLOT_SP, gridSlotInMeasure, xToEntryCursor } from '../../src/layout/pointerCursor';

function quiet<T>(fn: () => T): T {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

const SIXTEENTH = 240;
/** Design values (M7b-6) as literals on purpose: the tests must not follow the constants. */
const LEAD_IN_SP = 1.2;

describe('mouse position in an empty measure (M7b-6)', () => {
  it('M1: gridSlotInMeasure cuts the span into floor(measure / step) equal slots and picks the nearest slot start', () => {
    // 4/4 = 3840 ticks, span 10..50 (40 sp)
    expect(gridSlotInMeasure(10, 50, 10.0, 3840, SIXTEENTH)).toEqual({ tick: 0, x: 10 });
    expect(gridSlotInMeasure(10, 50, 11.2, 3840, SIXTEENTH).tick).toBe(0); // 0.48 slot: nearest start is slot 0
    expect(gridSlotInMeasure(10, 50, 11.3, 3840, SIXTEENTH).tick).toBe(SIXTEENTH); // 0.52 slot: nearest start is slot 1
    const third = gridSlotInMeasure(10, 50, 17.6, 3840, SIXTEENTH); // slot starts every 2.5 sp: 17.5 is slot 3
    expect(third.tick).toBe(3 * SIXTEENTH);
    expect(third.x).toBeCloseTo(10 + (720 / 3840) * 40, 9);
    expect(gridSlotInMeasure(10, 50, 49.9, 3840, SIXTEENTH).tick).toBe(15 * SIXTEENTH);
    expect(gridSlotInMeasure(10, 50, 1000, 3840, SIXTEENTH).tick).toBe(15 * SIXTEENTH); // clamps right
    expect(gridSlotInMeasure(10, 50, -5, 3840, SIXTEENTH).tick).toBe(0); // clamps left
  });

  it('M2: the step follows the active note value; a step longer than the measure gives one slot', () => {
    expect(gridSlotInMeasure(0, 40, 21, 3840, 960).tick).toBe(2 * 960); // quarter: 4 slots of 10 sp
    expect(gridSlotInMeasure(0, 40, 39, 3840, 1920).tick).toBe(1920); // half: 2 slots
    expect(gridSlotInMeasure(0, 40, 39, 3840, 7680)).toEqual({ tick: 0, x: 0 }); // longer than the measure
    expect(gridSlotInMeasure(5, 5, 5, 3840, 960)).toEqual({ tick: 0, x: 5 }); // degenerate span
  });

  it('M3: with a wide enough slot (quarter notes) an empty grand-staff measure maps x to the grid slot, in either staff, with its x on the same scale', () => {
    const score = createGrandStaffScore({ measures: 2 });
    const layout = quiet(() => layoutScore(score, { width: 100 }));
    const sys = layout.systems[0];
    const b = getSystemMeasureBounds(sys)[0];
    const origin = b.leftBound + LEAD_IN_SP;
    expect((b.rightBound - origin) / 4).toBeGreaterThanOrEqual(MIN_GRID_SLOT_SP);
    const x = origin + (b.rightBound - origin) * (2.3 / 4); // nearest start: slot 2
    for (const st of score.parts[0].staves) {
      const r = xToEntryCursor(layout, score, 0, x, 1, st.id, 960);
      expect(r?.staffId).toBe(st.id);
      expect(r?.measureId).toBe(score.measures[0].id);
      expect(r?.tick).toBe(2 * 960);
      expect(r?.columnX).toBeCloseTo(origin + (b.rightBound - origin) * (2 / 4), 9);
    }
  });

  it('M7: sixteenth slots of an empty measure are narrower than the mouse can aim at: every click stays on the first beat (no rest in front of the note)', () => {
    const score = createGrandStaffScore({ measures: 2 });
    const layout = quiet(() => layoutScore(score, { width: 100 }));
    const b = getSystemMeasureBounds(layout.systems[0])[0];
    expect((b.rightBound - b.leftBound - LEAD_IN_SP) / 16).toBeLessThan(MIN_GRID_SLOT_SP);
    for (const f of [0, 0.1, 0.3, 0.6, 0.95]) {
      const x = b.leftBound + (b.rightBound - b.leftBound) * f;
      for (const st of score.parts[0].staves) {
        const r = xToEntryCursor(layout, score, 0, x, 1, st.id, SIXTEENTH);
        expect(r?.tick).toBe(0);
        expect(r?.columnX).toBeNull();
      }
    }
  });

  it('M4: without a grid step (old callers) an empty measure still answers tick 0 with no column', () => {
    const score = createGrandStaffScore({ measures: 2 });
    const layout = quiet(() => layoutScore(score, { width: 100 }));
    const b = getSystemMeasureBounds(layout.systems[0])[0];
    const r = xToEntryCursor(layout, score, 0, b.rightBound - 0.1, 1);
    expect(r?.tick).toBe(0);
    expect(r?.columnX).toBeNull();
  });

  it('M5: a measure with sounding events keeps using its event columns, the grid is ignored', () => {
    const score = createGrandStaffScore({ measures: 2 });
    const m0 = score.measures[0].id;
    const q = (s: 'C' | 'D' | 'E' | 'F') => createNote({ pitches: [createPitch(s, 5)], baseType: 'quarter' });
    score.parts[0].staves[0].measures[m0].voices[0].events = [q('C'), q('D'), q('E'), q('F')];
    const layout = quiet(() => layoutScore(score, { width: 100 }));
    const heads = layout.systems[0].items.filter((i) => i.kind === 'glyph' && i.eventId && i.staffId === score.parts[0].staves[0].id);
    const rightEdge = getSystemMeasureBounds(layout.systems[0])[0].rightBound;
    const lastX = Math.max(...heads.filter((i) => i.x < rightEdge).map((i) => i.x));
    const r = xToEntryCursor(layout, score, 0, lastX + 0.3, 1, score.parts[0].staves[1].id, SIXTEENTH);
    expect(r?.tick).toBe(960 * 3);
    expect(r?.columnX).not.toBeNull();
  });

});
