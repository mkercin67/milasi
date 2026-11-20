// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Cross-staff column alignment (Milestone 7b-1, docs/design/m7b-grand-staff.md B2).
 *
 * Pure math, no layout types. Every staff of a measure is first laid out on its own; this module
 * then decides where each beat column goes so that events that start on the same tick share the
 * same x on every staff, WITHOUT shrinking any staff's own spacing.
 *
 * Model: for a staff `s` and a start tick `t`, `a_s(t)` is the staff-local x of the notehead (or
 * rest) column, relative to the measure start. Between two consecutive own columns p < t the staff
 * needs at least `a_s(t) - a_s(p)` of room (accidentals, displaced noteheads, lyrics are encoded
 * in those differences). The unified position X(t) is the longest-path solution of
 *
 *   X(t) = max( X(prev global tick) + minGap,
 *               max over staves s owning t of  X(p_s) + a_s(t) - a_s(p_s) )   (p_s = previous own tick)
 *
 * with X(t) = a_s(t) as the lower bound for a staff's first column. Consequences, all asserted by
 * tests: X(t) >= a_s(t); the per-staff shift d_s(t) = X(t) - a_s(t) is >= 0 and never decreases
 * along a staff; no staff gets less room than it asked for.
 */

export interface StaffColumns {
  /** tick -> staff-local x of the notehead/rest column, relative to the measure start. */
  positions: ReadonlyMap<number, number>;
  /** Natural width of this staff-measure (distance from measure start to its barline). */
  width: number;
  /**
   * True when the staff-measure holds nothing but a whole-measure rest. Such a staff does not
   * constrain any column and its rest is centred in the unified width instead.
   */
  centered?: boolean;
}

export interface ColumnAlignment {
  /** Unified x of every global column, keyed by tick. */
  columnX: Map<number, number>;
  /**
   * Per input staff: tick -> amount the staff's column must move right (d_s(t) >= 0).
   * Only ticks the staff owns appear. Empty for centred staves.
   */
  shifts: Array<Map<number, number>>;
  /** Unified measure width (same for every staff). */
  width: number;
  /** Per input staff: extra width a centred rest must be moved by, (width - own width) / 2. */
  centeredShift: number[];
}

export const DEFAULT_MIN_COLUMN_GAP = 1.5;

export function alignStaffColumns(
  staves: readonly StaffColumns[],
  minGap: number = DEFAULT_MIN_COLUMN_GAP
): ColumnAlignment {
  const ticks = new Set<number>();
  for (const s of staves) {
    if (s.centered) continue;
    for (const t of s.positions.keys()) ticks.add(t);
  }
  const globalTicks = [...ticks].sort((a, b) => a - b);

  // Sorted own ticks per staff, for "previous own tick" lookups.
  const ownTicks = staves.map((s) =>
    s.centered ? [] : [...s.positions.keys()].sort((a, b) => a - b)
  );
  const ownIndex = staves.map(() => 0);

  const columnX = new Map<number, number>();
  let prevGlobalX: number | null = null;

  for (const t of globalTicks) {
    let x: number = prevGlobalX === null ? -Infinity : prevGlobalX + minGap;
    staves.forEach((s, si) => {
      if (s.centered) return;
      const a = s.positions.get(t);
      if (a === undefined) return;
      const idx = ownTicks[si].indexOf(t, ownIndex[si]);
      ownIndex[si] = idx;
      if (idx === 0) {
        x = Math.max(x, a);
      } else {
        const p = ownTicks[si][idx - 1];
        x = Math.max(x, (columnX.get(p) as number) + a - (s.positions.get(p) as number));
      }
    });
    columnX.set(t, x);
    prevGlobalX = x;
  }

  const shifts = staves.map((s) => {
    const m = new Map<number, number>();
    if (s.centered) return m;
    for (const [t, a] of s.positions) m.set(t, (columnX.get(t) as number) - a);
    return m;
  });

  let width = 0;
  staves.forEach((s, si) => {
    width = Math.max(width, s.width);
    const own = ownTicks[si];
    if (s.centered || own.length === 0) return;
    const last = own[own.length - 1];
    const tail = s.width - (s.positions.get(last) as number);
    width = Math.max(width, (columnX.get(last) as number) + tail);
  });

  const centeredShift = staves.map((s) => (s.centered ? (width - s.width) / 2 : 0));

  return { columnX, shifts, width, centeredShift };
}
