// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Clef glyphs and clef changes inside a measure (M7c-5).
 *
 * A clef change inside a staff is drawn as a small clef (scale 0.75) just before the first event that it affects. A change
 * at the very start of a measure is drawn by the PREVIOUS measure at its end ("trailing" clef, before the barline); when a
 * system break falls there, that is the warning clef at the end of the system (Gould, Behind Bars).
 */
import { Clef } from '../core/model';
import { LayoutItem } from './types';
import { MeasureItemEntry } from './layoutPrimitives';

export const CLEF_CHANGE_SCALE = 0.75;
/** Horizontal room of a small clef, in staff spaces (glyph width 2.8 * 0.75 plus a gap). */
export const CLEF_CHANGE_WIDTH = 2.4;

/** A clef change inside a measure: from `tick` (> 0, relative to the first event) the clef holds. */
export interface ClefChangeAt {
  tick: number;
  clef: Clef;
}

/** Clef information one measure needs besides its opening clef. */
export interface MeasureClefInfo {
  /** Changes inside the measure, sorted by tick. */
  changes: ClefChangeAt[];
  /** Clef that opens the next measure when it differs from the clef at the end of this one (drawn before the barline). */
  trailing?: Clef;
}

/** SMuFL glyph of a clef, including the octave clefs. */
export function clefGlyphName(clef: Clef): string {
  if (clef.sign === 'C') return 'cClef';
  const base = clef.sign === 'F' ? 'fClef' : 'gClef';
  if (clef.octaveShift === -1) return `${base}8vb`;
  if (clef.octaveShift === 1) return `${base}8va`;
  return base;
}

/** Y of the clef sign: it sits on its own staff line (1 = bottom line). */
export function clefLineY(clef: Clef): number {
  return 4 - (clef.line - 1);
}

/** The clef that holds at `tick` of a measure that opens with `start` and has the given inner changes. */
export function clefForTick(start: Clef, changes: readonly ClefChangeAt[] | undefined, tick: number): Clef {
  let current = start;
  if (!changes) return current;
  for (const c of changes) {
    if (c.tick <= tick) current = c.clef;
    else break;
  }
  return current;
}

/** A small clef item at `x`. */
export function clefChangeItem(id: string, clef: Clef, x: number): LayoutItem {
  return { id, kind: 'glyph', glyph: clefGlyphName(clef), x, y: clefLineY(clef), glyphScale: CLEF_CHANGE_SCALE };
}

/**
 * Draws every pending change with tick <= `tick` at `relX`, one after the other, and returns the new index and x.
 * Used by the monophonic and the polyphonic measure layout.
 */
export function advanceClefChanges(
  changes: readonly ClefChangeAt[],
  from: number,
  tick: number,
  relX: number,
  idBase: string,
  out: MeasureItemEntry[]
): { next: number; relX: number } {
  let next = from;
  let x = relX;
  while (next < changes.length && changes[next].tick <= tick) {
    const c = changes[next];
    out.push({ item: clefChangeItem(`clefchange-${idBase}-${c.tick}`, c.clef, x) });
    x += CLEF_CHANGE_WIDTH;
    next++;
  }
  return { next, relX: x };
}

/** Cache key part of the clef information of a measure ('' when there is none). */
export function clefInfoKey(info: MeasureClefInfo | undefined): string {
  if (!info) return '';
  const k = (c: Clef) => `${c.sign}${c.line}${c.octaveShift ?? ''}`;
  const ch = info.changes.map((c) => `${c.tick}${k(c.clef)}`).join('.');
  return `_cc${ch}${info.trailing ? `_tr${k(info.trailing)}` : ''}`;
}
