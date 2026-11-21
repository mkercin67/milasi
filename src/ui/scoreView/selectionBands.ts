// SPDX-License-Identifier: GPL-3.0-or-later
import type { LayoutResult } from '../../layout/types';

/** One tinted band of a range selection: a system, a staff of that system and its horizontal extent (staff spaces). */
export interface SelectionBand {
  systemIndex: number;
  staffIndex: number;
  /** Vertical offset of the staff from the first staff of the system, in staff spaces. */
  staffOffset: number;
  minX: number;
  maxX: number;
}

/**
 * Computes one band per (system, staff) holding selected events, so that a selection in the lower
 * staff of a grand staff is tinted there and not in the first staff.
 */
export function computeSelectionBands(
  layout: LayoutResult,
  selectedEventIds: ReadonlySet<string>,
  visibleSystemIndices: ReadonlySet<number>
): SelectionBand[] {
  const bands: SelectionBand[] = [];
  if (selectedEventIds.size === 0) return bands;
  for (const sys of layout.systems) {
    if (!visibleSystemIndices.has(sys.index)) continue;
    const [baseStaff] = sys.staves;
    const byStaff = new Map<number, { minX: number; maxX: number }>();
    for (const it of sys.items) {
      if (!it.eventId || !selectedEventIds.has(it.eventId)) continue;
      const found = it.staffId ? sys.staves.findIndex((st) => st.id === it.staffId) : 0;
      const si = found >= 0 ? found : 0;
      const x1 = it.x - 0.4;
      const x2 = (it.x2 ?? it.x) + 1.2 + 0.4;
      const cur = byStaff.get(si);
      if (cur) {
        cur.minX = Math.min(cur.minX, x1);
        cur.maxX = Math.max(cur.maxX, x2);
      } else {
        byStaff.set(si, { minX: x1, maxX: x2 });
      }
    }
    for (const [si, ext] of byStaff) {
      const staffOffset = sys.staves[si] && baseStaff ? sys.staves[si].y - baseStaff.y : 0;
      bands.push({ systemIndex: sys.index, staffIndex: si, staffOffset, minX: ext.minX, maxX: ext.maxX });
    }
  }
  return bands;
}
