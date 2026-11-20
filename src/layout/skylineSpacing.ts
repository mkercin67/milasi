// SPDX-License-Identifier: GPL-3.0-or-later
import type { LayoutItem, LayoutStaff, LayoutSystem } from './types';
import { getItemRect } from './mouse';

/** Smallest gap between the bottom line of one staff and the top line of the next (M7b-1, approved). */
export const MIN_STAFF_GAP_SP = 7.0;
/** Clear space kept between the lowest item of the upper staff and the highest of the lower staff. */
export const SKYLINE_PADDING_SP = 1.5;

interface Extent {
  x1: number;
  x2: number;
  /** Distance beyond the staff line (staff spaces), always > 0. */
  ext: number;
}

/** Items that span the whole system (brace, through barlines): they never take part in the skyline. */
function isSystemSpanItem(it: LayoutItem): boolean {
  return it.glyph === 'brace' || (it.kind === 'line' && it.staffId === undefined);
}

/** Parts of the items that stick out BELOW the bottom line (`bottomY`, system-relative). */
function belowExtents(items: LayoutItem[], bottomY: number): Extent[] {
  const out: Extent[] = [];
  for (const it of items) {
    if (it.hidden || isSystemSpanItem(it)) continue;
    const r = getItemRect(it);
    if (r.y2 > bottomY) out.push({ x1: r.x1, x2: r.x2, ext: r.y2 - bottomY });
  }
  return out;
}

/** Parts of the items that stick out ABOVE the top line (`topY`, system-relative). */
function aboveExtents(items: LayoutItem[], topY: number): Extent[] {
  const out: Extent[] = [];
  for (const it of items) {
    if (it.hidden || isSystemSpanItem(it)) continue;
    const r = getItemRect(it);
    if (r.y1 < topY) out.push({ x1: r.x1, x2: r.x2, ext: topY - r.y1 });
  }
  return out;
}

/**
 * Gap (bottom line of the upper staff to top line of the lower staff) that keeps the lowest items
 * of the upper staff and the highest items of the lower staff `padding` apart wherever they
 * overlap horizontally. A staff body counts as extent 0 over its whole width, so a single sticking-out
 * item is cleared against the other staff's lines too. The result is NOT clamped to the minimum gap.
 */
export function neededStaffGap(
  upperItems: LayoutItem[],
  upperBottomY: number,
  lowerItems: LayoutItem[],
  lowerTopY: number,
  padding: number = SKYLINE_PADDING_SP
): number {
  const below = belowExtents(upperItems, upperBottomY);
  const above = aboveExtents(lowerItems, lowerTopY);
  let need = padding;
  for (const b of below) need = Math.max(need, b.ext + padding);
  for (const a of above) need = Math.max(need, a.ext + padding);
  for (const b of below) {
    for (const a of above) {
      if (b.x1 < a.x2 && a.x1 < b.x2) need = Math.max(need, b.ext + a.ext + padding);
    }
  }
  return need;
}

function shifted(item: LayoutItem, dy: number): LayoutItem {
  return {
    ...item,
    y: item.y + dy,
    ...(item.y2 !== undefined ? { y2: item.y2 + dy } : {}),
    ...(item.points ? { points: item.points.map((p) => ({ ...p, y: p.y + dy })) } : {}),
  };
}

/**
 * Grows the gaps between the staves of every multi-staff system where the content needs it
 * (M7b-4). Layout items arrive at the base offsets (gap `MIN_STAFF_GAP_SP`); items of staff k+1
 * and below are moved down by the accumulated extra gap, the through barlines and the brace are
 * stretched, `LayoutStaff.y` and `LayoutSystem.height` are updated and every later system moves
 * down by the extra height of the systems above it. Items are copied, never mutated, because
 * system item objects are shared with the system layout cache.
 *
 * @param spanBottomBase system-relative y of the bottom line of the last staff at the base offsets.
 * @returns the total extra height added over all systems (staff spaces).
 */
export function applySkylineSpacing(systems: LayoutSystem[], spanBottomBase: number): number {
  let carried = 0;
  for (const sys of systems) {
    sys.y += carried;
    const staves = sys.staves;
    if (staves.length < 2) continue;
    const top0 = staves[0].y; // staff-zero-ok: the first staff is the reference of every offset
    const shifts: number[] = [0];
    for (let k = 1; k < staves.length; k++) {
      const upperTop = staves[k - 1].y - top0;
      const lowerTop = staves[k].y - top0;
      const gap = lowerTop - (upperTop + 4);
      // Base positions (before any shift): extents are measured against the unshifted lines.
      const need = neededStaffGap(staves[k - 1].items, upperTop + 4, staves[k].items, lowerTop);
      shifts.push(shifts[k - 1] + Math.max(0, need - gap));
    }
    const total = shifts[shifts.length - 1];
    if (total <= 0) continue;

    const map = new Map<LayoutItem, LayoutItem>();
    const staffIndexById = new Map(staves.map((st, k) => [st.id, k] as const));
    const spanBottom = spanBottomBase + total;
    const move = (it: LayoutItem): LayoutItem => {
      const hit = map.get(it);
      if (hit) return hit;
      let next = it;
      const k = it.staffId !== undefined ? staffIndexById.get(it.staffId) : undefined;
      if (it.glyph === 'brace') {
        next = { ...it, y: spanBottom, scaleY: spanBottom / 4 };
      } else if (it.staffId === undefined && it.kind === 'line' && it.y2 === spanBottomBase) {
        next = { ...it, y2: spanBottom };
      } else if (k !== undefined && shifts[k] > 0) {
        next = shifted(it, shifts[k]);
      }
      map.set(it, next);
      return next;
    };

    sys.items = sys.items.map(move);
    sys.staves = staves.map((st: LayoutStaff, k) => ({
      ...st,
      y: st.y + shifts[k],
      items: st.items.map(move),
    }));
    sys.height += total;
    carried += total;
  }
  return carried;
}
