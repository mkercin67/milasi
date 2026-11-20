// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  alignStaffColumns,
  DEFAULT_MIN_COLUMN_GAP,
  type StaffColumns,
} from '../../src/layout/columnAlignment';

function staff(entries: Array<[number, number]>, width: number, centered = false): StaffColumns {
  return { positions: new Map(entries), width, centered };
}

// Deterministic PRNG so failures are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function randomStaff(r: () => number, tickPool: number[]): StaffColumns {
  const own = tickPool.filter(() => r() < 0.6);
  if (!own.includes(0)) own.unshift(0);
  let x = 0.8 + r() * 1.2;
  const entries: Array<[number, number]> = [];
  for (const t of own) {
    entries.push([t, x]);
    x += DEFAULT_MIN_COLUMN_GAP + r() * 4;
  }
  return staff(entries, x + r());
}

describe('alignStaffColumns (M7b-1a)', () => {
  it('T1: events on the same tick get the same unified x, no staff loses room (worked example)', () => {
    // Staff 1: columns at 0, 480, 960. Staff 2: wide column at 0 (accidental), then 960.
    const s1 = staff([[0, 0.8], [480, 3.4], [960, 6.0]], 9);
    const s2 = staff([[0, 2.0], [960, 8.5]], 12);
    const r = alignStaffColumns([s1, s2]);
    expect(r.columnX.get(0)).toBeCloseTo(2.0, 9);
    // staff 1 keeps 2.6 between col 0 and 480 and 2.6 between 480 and 960
    expect(r.columnX.get(480)! - r.columnX.get(0)!).toBeGreaterThanOrEqual(2.6 - 1e-9);
    expect(r.columnX.get(960)! - r.columnX.get(480)!).toBeGreaterThanOrEqual(2.6 - 1e-9);
    // staff 2 keeps 6.5 between col 0 and 960
    expect(r.columnX.get(960)! - r.columnX.get(0)!).toBeGreaterThanOrEqual(6.5 - 1e-9);
    // shifts reproduce the unified positions
    for (const [t, d] of r.shifts[0]) expect(s1.positions.get(t)! + d).toBeCloseTo(r.columnX.get(t)!, 9);
    for (const [t, d] of r.shifts[1]) expect(s2.positions.get(t)! + d).toBeCloseTo(r.columnX.get(t)!, 9);
  });

  it('T2: a single staff is left unchanged when its own gaps are >= minGap', () => {
    const s = staff([[0, 0.8], [960, 4.1], [1920, 7.9]], 11);
    const r = alignStaffColumns([s]);
    for (const d of r.shifts[0].values()) expect(d).toBeCloseTo(0, 9);
    expect(r.width).toBeCloseTo(11, 9);
  });

  it('T3: measure width is the same number for every staff and covers each staff tail', () => {
    const s1 = staff([[0, 1.0], [960, 5.0]], 9);
    const s2 = staff([[0, 3.0], [960, 5.5]], 8.5);
    const r = alignStaffColumns([s1, s2]);
    // staff 2 pushes column 0 to 3.0, so staff 1's column 960 moves to >= 7.0 and the tail follows
    expect(r.width).toBeGreaterThanOrEqual(r.columnX.get(960)! + (9 - 5.0) - 1e-9);
    expect(r.width).toBeGreaterThanOrEqual(r.columnX.get(960)! + (8.5 - 5.5) - 1e-9);
  });

  it('T4: a staff holding only a whole-measure rest does not constrain columns and is centred', () => {
    const notes = staff([[0, 0.8], [960, 4.0], [1920, 7.0], [2880, 10.0]], 13);
    const rest = staff([[0, 5.0]], 8, true);
    const r = alignStaffColumns([notes, rest]);
    expect(r.columnX.get(960)).toBeCloseTo(4.0, 9);
    expect(r.width).toBeCloseTo(13, 9);
    expect(r.centeredShift[1]).toBeCloseTo((13 - 8) / 2, 9);
    expect(r.shifts[1].size).toBe(0);
  });

  it('T5: minimum global gap is enforced between columns owned by different staves', () => {
    const s1 = staff([[0, 1.0]], 5);
    const s2 = staff([[480, 1.1]], 5);
    const r = alignStaffColumns([s1, s2]);
    expect(r.columnX.get(480)! - r.columnX.get(0)!).toBeGreaterThanOrEqual(DEFAULT_MIN_COLUMN_GAP - 1e-9);
  });

  it('T6: property test, 200 random multi-staff measures keep all alignment invariants', () => {
    const pool = [0, 240, 480, 720, 960, 1440, 1920, 2400, 2880, 3360];
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed);
      const n = 2 + Math.floor(r() * 3);
      const staves = Array.from({ length: n }, () => randomStaff(r, pool));
      const res = alignStaffColumns(staves);

      const sorted = [...res.columnX.keys()].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect(res.columnX.get(sorted[i])! - res.columnX.get(sorted[i - 1])!).toBeGreaterThanOrEqual(
          DEFAULT_MIN_COLUMN_GAP - 1e-9
        );
      }
      staves.forEach((s, si) => {
        const own = [...s.positions.keys()].sort((a, b) => a - b);
        let prevD = -Infinity;
        own.forEach((t, k) => {
          const d = res.shifts[si].get(t)!;
          expect(d).toBeGreaterThanOrEqual(-1e-9);
          expect(d).toBeGreaterThanOrEqual(prevD - 1e-9);
          prevD = d;
          expect(s.positions.get(t)! + d).toBeCloseTo(res.columnX.get(t)!, 9);
          if (k > 0) {
            const p = own[k - 1];
            const asked = s.positions.get(t)! - s.positions.get(p)!;
            expect(res.columnX.get(t)! - res.columnX.get(p)!).toBeGreaterThanOrEqual(asked - 1e-9);
          }
        });
        const last = own[own.length - 1];
        expect(res.width).toBeGreaterThanOrEqual(res.columnX.get(last)! + (s.width - s.positions.get(last)!) - 1e-9);
      });
    }
  });
});
