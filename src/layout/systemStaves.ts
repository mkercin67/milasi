// SPDX-License-Identifier: GPL-3.0-or-later
import type { LayoutSystem } from './types';

/**
 * Vertical offset (staff spaces) of a staff's top line from the top line of the first staff of the
 * system. Zero for a single-staff system, for an unknown staff id and for the first staff.
 */
export function staffOffsetInSystem(system: LayoutSystem, staffId: string | undefined): number {
  const first = system.staves[0]; // staff-zero-ok: the first staff is the reference of every offset
  if (!first || !staffId) return 0;
  const own = system.staves.find((s) => s.id === staffId);
  return own ? own.y - first.y : 0;
}
