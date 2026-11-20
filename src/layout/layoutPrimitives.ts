// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Core engraving constants, dimension calculations, and measurement structures.
 */

import { BaseDurationType } from '../core/model';
import { LayoutItem, StemDirection } from './types';

// Standard engraving dimensions in staff spaces
export const NOTEHEAD_WIDTH = 1.18;
export const STEM_LENGTH = 3.5;
export const STEM_THICKNESS = 0.12;
export const STAFF_LINE_THICKNESS = 0.13;
export const LEDGER_EXTENSION = 0.4;
export const LEDGER_THICKNESS = 0.16;
export const BARLINE_THICKNESS = 0.16;
export const THICK_BARLINE_THICKNESS = 0.5;

/**
 * Returns estimated layout width for a single item in staff spaces.
 */
export function getItemWidth(item: LayoutItem): number {
  if (item.kind === 'text') {
    return 0;
  }
  if (item.kind === 'beam' && item.points && item.points.length > 0) {
    const maxX = Math.max(...item.points.map((p) => p.x));
    return Math.max(0, maxX - item.x);
  }
  if (item.kind === 'line') {
    if (item.x2 !== undefined) {
      return Math.max(0, item.x2 - item.x);
    }
    return item.thickness ?? BARLINE_THICKNESS;
  }
  if (item.kind === 'glyph' && item.glyph) {
    if (item.glyph === 'gClef' || item.glyph === 'fClef') return 2.8;
    if (item.glyph === 'noteheadWhole') return 1.5;
    if (item.glyph.startsWith('notehead')) return NOTEHEAD_WIDTH;
    if (item.glyph.startsWith('accidental')) return 1.0;
    if (item.glyph.startsWith('timeSig')) return 1.2;
    if (item.glyph.startsWith('flag')) return 1.2;
    if (item.glyph.startsWith('rest')) return 1.2;
    if (item.glyph === 'augmentationDot') return 0.5;
    return 1.0;
  }
  return 1.0;
}

export interface MeasureItemEntry {
  item: LayoutItem;
  /** If this item is a ledger line attached to a note, relative offset to note center */
  ledgerNoteRelativeX?: number;
  /**
   * x (measure-relative) of the event column this item hangs on (stem, flag, dot, accidental,
   * displaced notehead, ledger line). System justification stretches the ANCHOR only; the item
   * keeps its fixed offset from it, so a stem stays on its notehead edge at any stretch ratio.
   */
  anchorX?: number;
}

const EVENT_ATTACHED_ID = /-(stem|flag|acc-\d+|dot-(\d+-)?\d+|pitch-\d+|ledger-.+)$/;

/**
 * Marks every item that is physically attached to an event (notehead, stem, flag, dots,
 * accidentals, ledger lines) with the x of that event's column. Spanning items such as lyric
 * extenders are left alone: they must stretch with the distance between columns.
 */
export function applyEventAnchors(
  entries: MeasureItemEntry[],
  anchors: ReadonlyMap<string, number>
): void {
  for (const entry of entries) {
    const eventId = entry.item.eventId;
    if (eventId === undefined) continue;
    const anchor = anchors.get(eventId);
    if (anchor === undefined) continue;
    const id = entry.item.id;
    if (id === eventId || (id.startsWith(eventId) && EVENT_ATTACHED_ID.test(id.slice(eventId.length)))) {
      entry.anchorX = anchor;
    }
  }
}

/** Metadata captured per measure for a beam group, independent of system stretching/overrides. */
export interface MeasureBeamGroupMeta {
  beamGroupId: string;
  stemDir: StemDirection;
  events: Array<{
    eventId: string;
    baseType: BaseDurationType;
    stepPositions: number[];
    startTick: number;
  }>;
}

/**
 * Cross-staff alignment inputs for ONE staff-measure (Milestone 7b-1b, see columnAlignment.ts).
 * Without it a measure is laid out exactly as a single-staff measure.
 */
export interface MeasureAlignment {
  /** tick (relative to the measure start, no pickup offset) -> cumulative shift of that column. */
  shifts: ReadonlyMap<number, number>;
  /** Shift of a centred whole-measure rest (0 for every other staff). */
  centeredShift: number;
  /** x (relative to the measure start) at which the content must end, just before the barline. */
  contentEndX: number;
}

export interface MeasureLayoutChunk {
  measureDefId: string;
  items: MeasureItemEntry[];
  naturalWidth: number;
  barlineItemIndex: number;
  beamGroups: MeasureBeamGroupMeta[];
  cacheKey?: string;
  /** tick (no pickup offset) -> x of the notehead/rest column, relative to the measure start. */
  columns?: Map<number, number>;
  /** True when the staff-measure holds only a whole-measure rest (centred, constrains nothing). */
  centered?: boolean;
  /** x just before the barline; naturalWidth - contentEndX is the barline tail. */
  contentEndX?: number;
}

export function createTimeSigItems(
  startX: number,
  timeSig: { num: number; den: number }
): { items: LayoutItem[]; width: number } {
  const items: LayoutItem[] = [];
  const numStr = timeSig.num.toString();
  const denStr = timeSig.den.toString();

  let curX = startX;
  for (let i = 0; i < numStr.length; i++) {
    items.push({
      id: `timesig-num-${i}`,
      kind: 'glyph',
      glyph: `timeSig${numStr[i]}`,
      x: curX,
      y: 1.0,
    });
    items.push({
      id: `timesig-den-${i}`,
      kind: 'glyph',
      glyph: `timeSig${denStr[i]}`,
      x: curX,
      y: 3.0,
    });
    curX += 1.4;
  }

  return { items, width: curX - startX + 0.8 };
}
