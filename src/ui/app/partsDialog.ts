// SPDX-License-Identifier: GPL-3.0-or-later
/** Helpers of the Parts dialog (M7c-6): the group that covers every part of the score. */

import type { Score, StaffGroup } from '../../core/model';

/** The group naming exactly all parts of the score, if any (the dialog edits this one). */
export function allPartsGroup(score: Score): StaffGroup | undefined {
  if (score.parts.length < 2) return undefined;
  return score.groups.find(
    (g) => g.partIds.length === score.parts.length && score.parts.every((p) => g.partIds.includes(p.id))
  );
}
