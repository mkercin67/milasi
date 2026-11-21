// SPDX-License-Identifier: GPL-3.0-or-later
import type { Id, Score, Staff } from './model';

/**
 * Finds a staff by id in any part of the score.
 * This is the way to reach "the staff the cursor is on".
 */
export function findStaff(score: Score, staffId: Id | undefined | null): Staff | undefined {
  if (!staffId) return undefined;
  for (const part of score.parts) {
    const staff = part.staves.find((s) => s.id === staffId);
    if (staff) return staff;
  }
  return undefined;
}

/**
 * The first staff of the first part.
 *
 * This is the ONLY place that may index `parts[0].staves[0]`. Callers that use it still assume a
 * single-staff score; they are counted by scripts/checkStaffZeroUsage.mjs against a ceiling that
 * may only shrink; the M7b acceptance audit left only missing-id fallbacks, the default cursor and
 * the single-staff clef (docs/design/m7b-staff-ratchet.json, docs/design/m7b-grand-staff.md B6).
 */
export function firstStaff(score: Score): Staff | undefined {
  return score.parts[0]?.staves[0]; // staff-zero-ok: the single definition of the legacy default staff
}

/**
 * All staves of the first part (a grand staff is one part with several staves).
 * Layout draws exactly this set as one system until multi-part scores (M7c).
 */
export function firstPartStaves(score: Score): Staff[] {
  return score.parts[0]?.staves ?? []; // staff-zero-ok: the single definition of the layout part
}

/**
 * Position of a staff inside its part (1-based) and the number of staves of that part,
 * for the status bar ("Porte 1/2"). Undefined for an unknown staff id.
 */
export function staffPosition(
  score: Score,
  staffId: Id | undefined | null
): { index: number; total: number } | undefined {
  if (!staffId) return undefined;
  for (const part of score.parts) {
    const i = part.staves.findIndex((s) => s.id === staffId);
    if (i >= 0) return { index: i + 1, total: part.staves.length };
  }
  return undefined;
}
