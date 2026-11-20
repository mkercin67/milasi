// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { createEmptyScore, createGrandStaffScore, createNote, createPitch } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';
import { resolvePointerStaff, xToEntryCursor } from '../../src/layout/pointerCursor';
import { staffOffsetInSystem } from '../../src/layout/systemStaves';

function quiet<T>(fn: () => T): T {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

describe('mouse staff resolution (M7b-3b)', () => {
  it('P1: resolvePointerStaff picks the nearest staff by y, the midpoint tie goes to the upper staff', () => {
    const score = createGrandStaffScore({ measures: 2 });
    const layout = quiet(() => layoutScore(score, { width: 100 }));
    const sys = layout.systems[0];
    const [upper, lower] = sys.staves;
    const offLower = staffOffsetInSystem(sys, lower.id);
    expect(resolvePointerStaff(layout, sys.y + 2)?.staffId).toBe(upper.id);
    expect(resolvePointerStaff(layout, sys.y + offLower + 2)?.staffId).toBe(lower.id);
    const mid = sys.y + 2 + offLower / 2;
    expect(resolvePointerStaff(layout, mid)?.staffId).toBe(upper.id);
    expect(resolvePointerStaff(layout, mid + 0.01)?.staffId).toBe(lower.id);
    expect(resolvePointerStaff(layout, mid)?.staffOffset).toBe(0);
  });

  it('P2: a single-staff system yields no staffId', () => {
    const score = createEmptyScore({ measures: 2 });
    const layout = quiet(() => layoutScore(score, { width: 100 }));
    const r = resolvePointerStaff(layout, layout.systems[0].y + 2);
    expect(r?.staffId).toBeUndefined();
    expect(r?.staffOffset).toBe(0);
  });

  it('P3: with several systems the pointer resolves to the nearest staff of the nearest system', () => {
    const score = createGrandStaffScore({ measures: 12 });
    const layout = quiet(() => layoutScore(score, { width: 40 }));
    expect(layout.systems.length).toBeGreaterThan(1);
    const s1 = layout.systems[1];
    const r = resolvePointerStaff(layout, s1.y + staffOffsetInSystem(s1, s1.staves[1].id) + 2);
    expect(r?.system).toBe(s1);
    expect(r?.staffId).toBe(s1.staves[1].id);
  });

  it('P4: xToEntryCursor returns the requested staff, and a sparse lower staff still allows a click at an upper-staff column', () => {
    const score = createGrandStaffScore({ measures: 1 });
    const part = score.parts[0];
    const mid = score.measures[0].id;
    const q = (s: 'C' | 'D' | 'E' | 'F') => createNote({ pitches: [createPitch(s, 5)], baseType: 'quarter' });
    part.staves[0].measures[mid].voices[0].events = [q('C'), q('D'), q('E'), q('F')];
    const layout = quiet(() => layoutScore(score, { width: 100 }));
    const heads = layout.systems[0].items.filter((i) => i.kind === 'glyph' && i.eventId && i.staffId === part.staves[0].id);
    const lastX = Math.max(...heads.map((i) => i.x));
    const r = xToEntryCursor(layout, score, 0, lastX + 0.5, 1, part.staves[1].id);
    expect(r?.staffId).toBe(part.staves[1].id);
    expect(r?.tick).toBe(960 * 3);
    expect(r?.columnX).not.toBeNull();
  });
});
