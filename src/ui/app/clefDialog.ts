// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Decisions behind the clef dialog (M7c-4 / M7c-5): which staff and place it works on, which clef is in force there, and
 * which command applies the choice. Pure functions so they can be tested without React.
 */
import { clefAt } from '../../core/clef';
import { Command, setClefChange, setStaffClef } from '../../core/commands';
import { Clef, Score, Staff } from '../../core/model';
import { findEventContext } from '../../core/selection';
import { findStaff } from '../../core/staffLookup';

/** 'staff' = the whole staff (opening clef); 'from-note' = from the selected note onwards. */
export type ClefScope = 'staff' | 'from-note';

export interface ClefDialogTarget {
  staff: Staff;
  /** Place of the selected note; absent when nothing is selected (then only the whole staff can be changed). */
  place?: { measureId: string; measureIndex: number; tick: number };
}

/** The staff of the selected note (first staff when nothing is selected) and the place of that note. */
export function clefDialogTarget(score: Score, selectedEventId: string | undefined): ClefDialogTarget | null {
  const ctx = selectedEventId ? findEventContext(score, selectedEventId) : null;
  const staff = (ctx ? findStaff(score, ctx.staffId) : undefined) ?? score.parts.flatMap((p) => p.staves)[0];
  if (!staff) return null;
  return {
    staff,
    place: ctx ? { measureId: ctx.measureId, measureIndex: ctx.measureIndex, tick: ctx.tick } : undefined,
  };
}

/** The clef in force for the chosen scope: the opening clef of the staff, or the clef at the selected note. */
export function clefInForce(score: Score, target: ClefDialogTarget, scope: ClefScope): Clef {
  if (scope === 'from-note' && target.place) return clefAt(score, target.staff, target.place.measureId, target.place.tick);
  return target.staff.clef;
}

/**
 * The command that applies `clef` for the chosen scope. 'from-note' at the very first note of the score is the same as
 * changing the opening clef, so it uses setStaffClef; elsewhere it adds (or, for the clef already in force, removes) a clef change.
 */
export function buildClefCommand(target: ClefDialogTarget, scope: ClefScope, clef: Clef): Command {
  if (scope === 'from-note' && target.place && !(target.place.measureIndex === 0 && target.place.tick === 0)) {
    return setClefChange(target.staff.id, target.place.measureId, target.place.tick, clef);
  }
  return setStaffClef(target.staff.id, clef);
}
