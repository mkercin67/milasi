// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Layout and geometry computation for Dynamics, Articulations, and Slurs (Milestone 6b).
 *
 * Implements pure SMuFL placement rules in staff space coordinates with zero DOM reads:
 * - Articulations: placed on notehead side / opposite to stem; stacked vertically (staccato/tenuto
 *   closest, accent/marcato further); staccato snaps to staff spaces.
 * - Dynamics: placed below staff (y = 6.5) by default, centered horizontally on notehead.
 * - Slurs: cubic bezier curves avoiding intermediate noteheads by >= 0.5 spaces; splits into two
 *   half-slurs across system breaks.
 */

import { Score } from '../core/model';
import { NOTEHEAD_WIDTH } from './layoutScore';
import { isStaffMeasurePolyphonic } from './measureLayout';
import { LayoutItem, LayoutResult, StemDirection } from './types';

export interface SlurLayoutItem {
  id: string;
  slurId: string;
  systemIndex: number;
  d: string;
}

interface NoteheadInfo {
  eventId: string;
  systemIndex: number;
  x: number;
  y: number;
  minY: number;
  maxY: number;
  stemDirection: StemDirection;
  /** y of the top line of the staff the event sits on (system-relative; 0 for the first staff). */
  staffTop: number;
  /** Vertical extent of the event: noteheads, stem and ledger lines (rests: the rest glyph). */
  topY: number;
  bottomY: number;
  /** Right edge of the event (notehead or rest plus augmentation dots). */
  rightX: number;
  /** True when the entry describes a rest (no notehead). */
  isRest?: boolean;
}

/** Glyph extents (staff spaces, relative to the glyph origin) of rests, measured from Bravura. */
const REST_EXTENT: Record<string, { top: number; bottom: number; width: number }> = {
  restWhole: { top: 0, bottom: 0.55, width: 1.13 },
  restHalf: { top: -0.6, bottom: 0, width: 1.13 },
  restQuarter: { top: -1.5, bottom: 1.5, width: 1.08 },
  rest8th: { top: -0.7, bottom: 1.0, width: 1.0 },
  rest16th: { top: -0.72, bottom: 2.0, width: 1.28 },
  rest32nd: { top: -1.0, bottom: 3.0, width: 1.5 },
};

const DYNAMIC_GLYPHS: Record<string, string> = {
  pp: 'dynamicPP',
  p: 'dynamicPiano',
  mp: 'dynamicMP',
  mf: 'dynamicMF',
  f: 'dynamicForte',
  ff: 'dynamicFF',
  sfz: 'dynamicSforzato',
  fp: 'dynamicFortePiano',
};

/**
 * Lightweight deterministic operation counter for notation passes.
 * Zero overhead when enabled is false.
 */
export interface NotationOpCounter {
  enabled: boolean;
  itemVisits: number;
  mapLookups: number;
  reset(): void;
  get total(): number;
}

export const notationOpCounter: NotationOpCounter = {
  enabled: false,
  itemVisits: 0,
  mapLookups: 0,
  reset() {
    this.itemVisits = 0;
    this.mapLookups = 0;
  },
  get total() {
    return this.itemVisits + this.mapLookups;
  },
};

export function buildNoteheadIndex(layout: LayoutResult): Map<string, NoteheadInfo> {
  const map = new Map<string, NoteheadInfo>();
  const firstLineDir = new Map<string, StemDirection>();
  // Stems, ledger lines and dots may be visited before or after the notehead of their event.
  const extra = new Map<string, { top: number; bottom: number; right: number }>();
  const grow = (id: string, top: number, bottom: number, right: number) => {
    const e = extra.get(id);
    if (e) {
      e.top = Math.min(e.top, top);
      e.bottom = Math.max(e.bottom, bottom);
      e.right = Math.max(e.right, right);
    } else {
      extra.set(id, { top, bottom, right });
    }
  };

  const systems = layout.systems;
  const sysCount = systems.length;

  for (let sysIdx = 0; sysIdx < sysCount; sysIdx++) {
    const sys = systems[sysIdx];
    const items = sys.items;
    if (!items) continue;
    const len = items.length;
    const [baseStaff] = sys.staves ?? [];
    const staffTopOf = (staffId?: string): number => {
      if (!staffId || !baseStaff) return 0;
      const found = sys.staves.find((st) => st.id === staffId);
      return found ? found.y - baseStaff.y : 0;
    };

    for (let i = 0; i < len; i++) {
      if (notationOpCounter.enabled) notationOpCounter.itemVisits++;
      const it = items[i];
      const evId = it.eventId;
      if (!evId) continue;

      if (it.kind === 'glyph' && it.glyph?.startsWith('notehead')) {
        const entry = map.get(evId);
        if (!entry) {
          const dir = firstLineDir.get(evId);
          map.set(evId, {
            eventId: evId,
            systemIndex: sysIdx,
            x: it.x,
            y: it.y,
            minY: it.y,
            maxY: it.y,
            stemDirection: dir ?? (it.y >= 2.0 ? 'up' : 'down'),
            staffTop: staffTopOf(it.staffId),
            topY: it.y - 0.5,
            bottomY: it.y + 0.5,
            rightX: it.x + NOTEHEAD_WIDTH,
          });
        } else {
          if (it.y < entry.minY) entry.minY = it.y;
          if (it.y > entry.maxY) entry.maxY = it.y;
        }
        grow(evId, it.y - 0.5, it.y + 0.5, it.x + NOTEHEAD_WIDTH);
      } else if (it.kind === 'glyph' && it.glyph && REST_EXTENT[it.glyph]) {
        const r = REST_EXTENT[it.glyph];
        if (!map.has(evId)) {
          map.set(evId, {
            eventId: evId,
            systemIndex: sysIdx,
            x: it.x,
            y: it.y,
            minY: it.y,
            maxY: it.y,
            stemDirection: 'up',
            staffTop: staffTopOf(it.staffId),
            topY: it.y + r.top,
            bottomY: it.y + r.bottom,
            rightX: it.x + r.width,
            isRest: true,
          });
        }
      } else if (it.kind === 'glyph' && it.glyph === 'augmentationDot') {
        grow(evId, it.y - 0.2, it.y + 0.2, it.x + 0.4);
      } else if (it.kind === 'line') {
        grow(evId, Math.min(it.y, it.y2 ?? it.y), Math.max(it.y, it.y2 ?? it.y), it.x2 ?? it.x);
        // Only a vertical line is a stem. A horizontal one is a ledger line (it used to be read as "stem down",
        // which misplaced marks of notes with ledger lines, for example middle C).
        const isStem = it.y2 !== undefined && Math.abs(it.y2 - it.y) > 0.01;
        if (isStem && !firstLineDir.has(evId)) {
          const dir: StemDirection = (it.y2 as number) < it.y ? 'up' : 'down';
          firstLineDir.set(evId, dir);
          const entry = map.get(evId);
          if (entry) {
            entry.stemDirection = dir;
          }
        }
      }
    }
  }
  for (const [id, e] of extra) {
    const entry = map.get(id);
    if (!entry) continue;
    entry.topY = Math.min(entry.topY, e.top);
    entry.bottomY = Math.max(entry.bottomY, e.bottom);
    entry.rightX = Math.max(entry.rightX, e.right);
  }
  return map;
}

export function getNoteheadInfo(
  layout: LayoutResult,
  eventId: string,
  index?: Map<string, NoteheadInfo>
): NoteheadInfo | null {
  if (index) {
    return index.get(eventId) ?? null;
  }
  for (let sysIdx = 0; sysIdx < layout.systems.length; sysIdx++) {
    const sys = layout.systems[sysIdx];
    const items = sys.items ?? [];
    const noteheads = items.filter(
      (it) => it.eventId === eventId && it.kind === 'glyph' && it.glyph?.startsWith('notehead')
    );
    if (noteheads.length > 0) {
      const firstNh = noteheads[0];
      const ys = noteheads.map((n) => n.y);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      // Determine stem direction
      const stem = items.find((it) => it.eventId === eventId && it.kind === 'line');
      let stemDirection: StemDirection = firstNh.y >= 2.0 ? 'up' : 'down';
      if (stem && stem.y2 !== undefined) {
        stemDirection = stem.y2 < stem.y ? 'up' : 'down';
      }

      return {
        eventId,
        systemIndex: sysIdx,
        x: firstNh.x,
        y: firstNh.y,
        minY,
        maxY,
        stemDirection,
        staffTop: 0,
        topY: minY - 0.5,
        bottomY: maxY + 0.5,
        rightX: firstNh.x + NOTEHEAD_WIDTH,
      };
    }
  }
  return null;
}

/**
 * Computes layout items for note dynamics.
 */
export function layoutDynamics(
  score: Score,
  layout: LayoutResult,
  noteheadIndex?: Map<string, NoteheadInfo>
): LayoutItem[] {
  const items: LayoutItem[] = [];
  const index = noteheadIndex ?? buildNoteheadIndex(layout);
  const hasOverrides = score.overrides && Object.keys(score.overrides).length > 0;

  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (const mDef of score.measures) {
        const sm = staff.measures[mDef.id];
        if (!sm) continue;
        for (const v of sm.voices) {
          for (const ev of v.events) {
            if (ev.kind === 'note' && ev.dynamic) {
              const glyph = DYNAMIC_GLYPHS[ev.dynamic];
              if (!glyph) continue;

              if (notationOpCounter.enabled) notationOpCounter.mapLookups++;
              const nh = index.get(ev.id);
              if (!nh) continue;

              let dx = 0;
              let dy = 0;
              if (hasOverrides) {
                const overrideId = `${ev.id}-dynamic`;
                const override = score.overrides[overrideId] ?? score.overrides[ev.id];
                dx = override?.dx ?? 0;
                dy = override?.dy ?? 0;
              }

              // Default placement below staff (staff lines 0..4, so bottom + 2.5 = 6.5)
              const posX = nh.x + NOTEHEAD_WIDTH / 2 - 0.75 + dx;
              const posY = nh.staffTop + 6.5 + dy;

              items.push({
                id: `${ev.id}-dynamic`,
                eventId: ev.id,
                systemIndex: nh.systemIndex,
                kind: 'glyph',
                glyph,
                type: ev.dynamic,
                x: Number(posX.toFixed(2)),
                y: Number(posY.toFixed(2)),
              });
            }
          }
        }
      }
    }
  }

  return items;
}

/** Fermata glyph is 2.43 sp wide (Bravura 608 units at 250 units per space). */
const FERMATA_WIDTH = 2.43;
/** Distance between an event (or the staff) and a fermata or phrase mark, in staff spaces. */
const FERMATA_GAP = 1.0;
const PHRASE_MARK_GAP = 0.9;
const PHRASE_MARK_Y = -0.5;

/**
 * Computes layout items for fermatas, breath marks and caesuras (M7c-2).
 * Fermatas sit outside the staff and clear of stems; breath marks and caesuras sit above the staff, right of the event.
 */
export function layoutFermatas(
  score: Score,
  layout: LayoutResult,
  noteheadIndex?: Map<string, NoteheadInfo>
): LayoutItem[] {
  const items: LayoutItem[] = [];
  const index = noteheadIndex ?? buildNoteheadIndex(layout);
  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (const mDef of score.measures) {
        const sm = staff.measures[mDef.id];
        if (!sm) continue;
        for (const v of sm.voices) {
          for (const ev of v.events) {
            if (ev.kind !== 'note' && ev.kind !== 'rest') continue;
            if (!ev.fermata && !ev.phraseMark) continue;
            const nh = index.get(ev.id);
            if (!nh) continue;
            if (ev.fermata) {
              const centre = nh.x + (nh.rightX - nh.x) / 2;
              const above = ev.fermata === 'above';
              const y = above
                ? Math.min(nh.staffTop - FERMATA_GAP, nh.topY - FERMATA_GAP)
                : Math.max(nh.staffTop + 4 + FERMATA_GAP, nh.bottomY + FERMATA_GAP);
              items.push({
                id: `${ev.id}-fermata`,
                eventId: ev.id,
                systemIndex: nh.systemIndex,
                kind: 'glyph',
                glyph: above ? 'fermataAbove' : 'fermataBelow',
                type: 'fermata',
                x: Number((centre - FERMATA_WIDTH / 2).toFixed(2)),
                y: Number(y.toFixed(2)),
              });
            }
            if (ev.phraseMark) {
              items.push({
                id: `${ev.id}-phrase`,
                eventId: ev.id,
                systemIndex: nh.systemIndex,
                kind: 'glyph',
                glyph: ev.phraseMark === 'breath' ? 'breathMarkComma' : 'caesura',
                type: ev.phraseMark,
                x: Number((nh.rightX + PHRASE_MARK_GAP).toFixed(2)),
                y: Number((nh.staffTop + PHRASE_MARK_Y).toFixed(2)),
              });
            }
          }
        }
      }
    }
  }
  return items;
}

/** Tuplet number glyphs are 1.2 sp wide and 1.5 sp tall above their baseline (measured from Bravura). */
const TUPLET_NUMBER_WIDTH = 1.2;
const TUPLET_NUMBER_HEIGHT = 1.5;
const TUPLET_GAP = 0.6;

/**
 * Computes the number of each tuplet group (M7c-2b): the "3" of a triplet, centred over the group on the
 * stem side (above stems that point up, below stems that point down). A group is `actual` consecutive events
 * with the same ratio and value; the groups are complete by construction (see `planEnter`).
 * v1 draws the number only; a bracket for unbeamed groups is a documented gap.
 */
export function layoutTuplets(
  score: Score,
  layout: LayoutResult,
  noteheadIndex?: Map<string, NoteheadInfo>
): LayoutItem[] {
  const items: LayoutItem[] = [];
  const index = noteheadIndex ?? buildNoteheadIndex(layout);
  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (const mDef of score.measures) {
        const sm = staff.measures[mDef.id];
        if (!sm) continue;
        for (const v of sm.voices) {
          let run: Array<{ id: string; kind: string }> = [];
          let runKey = '';
          let runActual = 0;
          const flush = () => {
            run = [];
            runKey = '';
          };
          const emit = () => {
            const infos = run.map((r) => index.get(r.id));
            if (infos.some((i) => !i)) return;
            const first = infos[0]!;
            const last = infos[infos.length - 1]!;
            const firstNote = run.findIndex((r) => r.kind === 'note');
            const dir = firstNote >= 0 ? infos[firstNote]!.stemDirection : 'up';
            const above = dir === 'up';
            const centre = (first.x + last.rightX) / 2;
            const top = Math.min(...infos.map((i) => i!.topY));
            const bottom = Math.max(...infos.map((i) => i!.bottomY));
            const y = above ? top - TUPLET_GAP : bottom + TUPLET_GAP + TUPLET_NUMBER_HEIGHT;
            const glyph = `tuplet${runActual}`;
            items.push({
              id: `${run[0].id}-tuplet`,
              eventId: run[0].id,
              systemIndex: first.systemIndex,
              kind: 'glyph',
              glyph,
              type: 'tuplet',
              x: Number((centre - TUPLET_NUMBER_WIDTH / 2).toFixed(2)),
              y: Number(y.toFixed(2)),
            });
          };
          for (const ev of v.events) {
            const tp = ev.tuplet;
            if (!tp || tp.actual < 2 || tp.actual > 9) {
              flush();
              continue;
            }
            const key = `${tp.actual}:${tp.normal}:${ev.baseType}:${ev.dots}`;
            if (key !== runKey) {
              flush();
              runKey = key;
              runActual = tp.actual;
            }
            run.push({ id: ev.id, kind: ev.kind });
            if (run.length === runActual) {
              emit();
              flush();
            }
          }
        }
      }
    }
  }
  return items;
}

/**
 * Computes layout items for note articulations.
 */
export function layoutArticulations(
  score: Score,
  layout: LayoutResult,
  noteheadIndex?: Map<string, NoteheadInfo>
): LayoutItem[] {
  const items: LayoutItem[] = [];
  const index = noteheadIndex ?? buildNoteheadIndex(layout);
  const hasOverrides = score.overrides && Object.keys(score.overrides).length > 0;

  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (const mDef of score.measures) {
        const sm = staff.measures[mDef.id];
        if (!sm) continue;
        for (const v of sm.voices) {
          for (const ev of v.events) {
            if (ev.kind === 'note' && ev.articulations && ev.articulations.length > 0) {
              if (notationOpCounter.enabled) notationOpCounter.mapLookups++;
              const nh = index.get(ev.id);
              if (!nh) continue;

              // Placement direction: opposite to stem direction (notehead side)
              // If stem is up -> place below notehead (y > nh.maxY); if stem is down -> place above notehead (y < nh.minY)
              const placeAbove = nh.stemDirection === 'down';

              // Order from notehead outwards: staccato/tenuto closest, accent/marcato further
              const arts = ev.articulations;
              const sortedArts =
                arts.length <= 1
                  ? arts
                  : [...arts].sort((a, b) => {
                      const rankA = a === 'staccato' || a === 'tenuto' ? 1 : 2;
                      const rankB = b === 'staccato' || b === 'tenuto' ? 1 : 2;
                      return rankA - rankB;
                    });

              let currentOffset = 1.0;

              for (const art of sortedArts) {
                let glyph = '';
                if (art === 'staccato') {
                  glyph = placeAbove ? 'articStaccatoAbove' : 'articStaccatoBelow';
                } else if (art === 'tenuto') {
                  glyph = placeAbove ? 'articTenutoAbove' : 'articTenutoBelow';
                } else if (art === 'accent') {
                  glyph = placeAbove ? 'articAccentAbove' : 'articAccentBelow';
                } else if (art === 'marcato') {
                  glyph = placeAbove ? 'articMarcatoAbove' : 'articMarcatoBelow';
                }
                if (!glyph) continue;

                let targetY = placeAbove ? nh.minY - currentOffset : nh.maxY + currentOffset;

                // Avoid landing directly on staff lines (integer Y between 0 and 4): dots and tenuto
                // dashes sit in the spaces, never on a line.
                if ((art === 'staccato' || art === 'tenuto') && targetY >= -0.2 && targetY <= 4.2) {
                  const distFromInt = Math.abs(targetY - Math.round(targetY));
                  if (distFromInt < 0.25) {
                    targetY = placeAbove ? Math.round(targetY) - 0.5 : Math.round(targetY) + 0.5;
                  }
                }

                let dx = 0;
                let dy = 0;
                if (hasOverrides) {
                  const overrideId = `${ev.id}-artic-${art}`;
                  const override = score.overrides[overrideId] ?? score.overrides[ev.id];
                  dx = override?.dx ?? 0;
                  dy = override?.dy ?? 0;
                }

                const posX = nh.x + NOTEHEAD_WIDTH / 2 - 0.25 + dx;
                const posY = targetY + dy;

                items.push({
                  id: `${ev.id}-artic-${art}`,
                  eventId: ev.id,
                  systemIndex: nh.systemIndex,
                  kind: 'glyph',
                  glyph,
                  type: art,
                  x: Number(posX.toFixed(2)),
                  y: Number(posY.toFixed(2)),
                });

                currentOffset += 1.0;
              }
            }
          }
        }
      }
    }
  }

  return items;
}

/**
 * Creates a cubic Bezier curve string for a slur between (x1, y1) and (x2, y2).
 */
function createSlurCubicPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curvature: 'above' | 'below',
  peakYOffset: number = 1.2
): string {
  const dx = Math.abs(x2 - x1);
  const cpDistance = Math.min(dx * 0.25, 4.0);
  const sign = curvature === 'above' ? -1 : 1;

  const cp1x = Number((x1 + cpDistance).toFixed(2));
  const cp2x = Number((x2 - cpDistance).toFixed(2));
  const cp1y = Number((y1 + sign * peakYOffset).toFixed(2));
  const cp2y = Number((y2 + sign * peakYOffset).toFixed(2));

  // Tapered crescent outline using two cubic curves (outer and inner)
  const thickness = 0.22;
  const inCp1y = Number((cp1y - sign * thickness).toFixed(2));
  const inCp2y = Number((cp2y - sign * thickness).toFixed(2));

  const pX1 = Number(x1.toFixed(2));
  const pY1 = Number(y1.toFixed(2));
  const pX2 = Number(x2.toFixed(2));
  const pY2 = Number(y2.toFixed(2));

  return `M ${pX1} ${pY1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pX2} ${pY2} C ${cp2x} ${inCp2y}, ${cp1x} ${inCp1y}, ${pX1} ${pY1} Z`;
}

/** Open width of a hairpin at its wide end, in staff spaces. */
const HAIRPIN_OPENING = 1.2;
/** Thickness of each hairpin line, in staff spaces. */
const HAIRPIN_LINE = 0.13;

/** Two thin filled strips forming a hairpin segment between x1 (width w1) and x2 (width w2). */
function hairpinSegmentPath(x1: number, w1: number, x2: number, w2: number, y: number): string {
  const f = (n: number): string => String(Number(n.toFixed(2)));
  const t = HAIRPIN_LINE / 2;
  const strip = (ya: number, yb: number): string =>
    `M ${f(x1)} ${f(ya - t)} L ${f(x2)} ${f(yb - t)} L ${f(x2)} ${f(yb + t)} L ${f(x1)} ${f(ya + t)} Z`;
  return `${strip(y - w1 / 2, y - w2 / 2)} ${strip(y + w1 / 2, y + w2 / 2)}`;
}

/**
 * Baseline of the lowest text (note names, lyrics) under the staff between x1 and x2, or null when the
 * strip is free. A hairpin is moved below such text.
 */
function lowestTextBelowStaff(
  layout: LayoutResult,
  systemIndex: number,
  staffTop: number,
  x1: number,
  x2: number
): number | null {
  const sys = layout.systems[systemIndex];
  if (!sys) return null;
  let lowest: number | null = null;
  for (const it of sys.items) {
    if (it.kind !== 'text' || it.hidden) continue;
    if (it.x < x1 - 1.0 || it.x > x2 + 1.0) continue;
    if (it.y < staffTop + 4.5 || it.y > staffTop + 14) continue;
    lowest = lowest === null ? it.y : Math.max(lowest, it.y);
  }
  return lowest;
}

/**
 * Computes crescendo / diminuendo hairpins (M7c-2c). They sit below the staff on the dynamics line
 * and are returned in the slur item shape so the existing overlay drawing handles them.
 * A hairpin that crosses a system break is split; the opening continues across the break.
 */
export function layoutHairpins(
  score: Score,
  layout: LayoutResult,
  noteheadIndex?: Map<string, NoteheadInfo>
): SlurLayoutItem[] {
  const result: SlurLayoutItem[] = [];
  const index = noteheadIndex ?? buildNoteheadIndex(layout);

  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (!staff.hairpins || staff.hairpins.length === 0) continue;
      for (const h of staff.hairpins) {
        const a = index.get(h.startEventId);
        const b = index.get(h.endEventId);
        if (!a || !b) continue;
        const cresc = h.type === 'crescendo';
        const startX = a.x;
        const endX = b.x + NOTEHEAD_WIDTH;

        if (a.systemIndex === b.systemIndex) {
          const text = lowestTextBelowStaff(layout, a.systemIndex, a.staffTop, startX, endX);
          const y = Math.max(
            a.staffTop + 6.0,
            a.bottomY + 2.0,
            b.bottomY + 2.0,
            text === null ? 0 : text + 1.2
          );
          const d = hairpinSegmentPath(
            startX,
            cresc ? 0 : HAIRPIN_OPENING,
            endX,
            cresc ? HAIRPIN_OPENING : 0,
            y
          );
          result.push({ id: `hairpin-${h.id}`, slurId: h.id, systemIndex: a.systemIndex, d });
        } else {
          const sysA = layout.systems[a.systemIndex];
          const exitX = (sysA?.width ?? 70) - 1.0;
          const enterX = 4.0;
          const l1 = Math.max(0.1, exitX - startX);
          const l2 = Math.max(0.1, endX - enterX);
          const frac = l1 / (l1 + l2);
          const wMid = cresc ? HAIRPIN_OPENING * frac : HAIRPIN_OPENING * (1 - frac);
          const textA = lowestTextBelowStaff(layout, a.systemIndex, a.staffTop, startX, exitX);
          const textB = lowestTextBelowStaff(layout, b.systemIndex, b.staffTop, enterX, endX);
          const yA = Math.max(a.staffTop + 6.0, a.bottomY + 2.0, textA === null ? 0 : textA + 1.2);
          const yB = Math.max(b.staffTop + 6.0, b.bottomY + 2.0, textB === null ? 0 : textB + 1.2);
          result.push({
            id: `hairpin-${h.id}-part1`,
            slurId: h.id,
            systemIndex: a.systemIndex,
            d: hairpinSegmentPath(startX, cresc ? 0 : HAIRPIN_OPENING, exitX, wMid, yA),
          });
          result.push({
            id: `hairpin-${h.id}-part2`,
            slurId: h.id,
            systemIndex: b.systemIndex,
            d: hairpinSegmentPath(enterX, wMid, endX, cresc ? HAIRPIN_OPENING : 0, yB),
          });
        }
      }
    }
  }
  return result;
}

/**
 * Computes SVG slur paths for all slurs defined on the staff.
 */
export function layoutSlurs(
  score: Score,
  layout: LayoutResult,
  noteheadIndex?: Map<string, NoteheadInfo>,
  articulationItems?: LayoutItem[]
): SlurLayoutItem[] {
  const result: SlurLayoutItem[] = [];
  const index = noteheadIndex ?? buildNoteheadIndex(layout);
  // A slur passes OUTSIDE the articulations on its own side (staccato dots, tenuto, accents sit
  // between the notehead and the slur, as in engraved editions).
  const artItems = (articulationItems ?? layoutArticulations(score, layout, index)).filter(
    (it) => it.kind === 'glyph' && typeof it.glyph === 'string' && it.glyph.startsWith('artic')
  );
  const artsOnSide = (eventId: string, side: 'above' | 'below'): LayoutItem[] =>
    artItems.filter(
      (it) => it.eventId === eventId && it.glyph !== undefined && it.glyph.endsWith(side === 'above' ? 'Above' : 'Below')
    );

  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (!staff.slurs || staff.slurs.length === 0) continue;

      for (const slur of staff.slurs) {
        if (notationOpCounter.enabled) notationOpCounter.mapLookups += 2;
        const startNh = index.get(slur.startEventId);
        const endNh = index.get(slur.endEventId);
        if (!startNh || !endNh) continue;

        let startVoiceIndex = 1;
        let isPoly = false;
        for (const sm of Object.values(staff.measures)) {
          if (isStaffMeasurePolyphonic(sm)) isPoly = true;
          for (const v of sm.voices) {
            if (v.events.some((e) => e.id === slur.startEventId)) {
              startVoiceIndex = v.voiceIndex;
            }
          }
        }

        let curvature: 'above' | 'below';
        if (slur.placement) {
          curvature = slur.placement;
        } else if (isPoly) {
          // Rule RF: Voice 1/3 curves ABOVE, Voice 2/4 curves BELOW
          curvature = (startVoiceIndex === 1 || startVoiceIndex === 3) ? 'above' : 'below';
        } else {
          curvature = (startNh.stemDirection === 'up' && endNh.stemDirection === 'up' ? 'below' : 'above');
        }

        if (startNh.systemIndex === endNh.systemIndex) {
          // Single system slur
          const sysIdx = startNh.systemIndex;
          const sys = layout.systems[sysIdx];

          const startX = startNh.x + NOTEHEAD_WIDTH;
          const endX = endNh.x;
          let startY = curvature === 'below' ? startNh.maxY + 0.5 : startNh.minY - 0.5;
          let endY = curvature === 'below' ? endNh.maxY + 0.5 : endNh.minY - 0.5;
          for (const a of artsOnSide(slur.startEventId, curvature)) {
            startY = curvature === 'below' ? Math.max(startY, a.y + 0.8) : Math.min(startY, a.y - 0.8);
          }
          for (const a of artsOnSide(slur.endEventId, curvature)) {
            endY = curvature === 'below' ? Math.max(endY, a.y + 0.8) : Math.min(endY, a.y - 0.8);
          }

          // Sample intermediate notes on same system to ensure clearance >= 0.5 spaces
          let maxIntermediateDist = 1.2;
          if (sys) {
            for (const item of sys.items) {
              if (
                item.kind === 'glyph' &&
                item.glyph?.startsWith('notehead') &&
                item.x > startX &&
                item.x < endX
              ) {
                if (curvature === 'below') {
                  const neededDist = Math.max(0, item.y - Math.min(startY, endY) + 0.5);
                  maxIntermediateDist = Math.max(maxIntermediateDist, neededDist);
                } else {
                  const neededDist = Math.max(0, Math.max(startY, endY) - item.y + 0.5);
                  maxIntermediateDist = Math.max(maxIntermediateDist, neededDist);
                }
              }
            }
          }

          // Articulations of the notes in between (their x lies inside the slur span)
          for (const a of artItems) {
            if (a.systemIndex !== sysIdx || a.eventId === slur.startEventId || a.eventId === slur.endEventId) continue;
            if (a.x <= startX - 1.2 || a.x >= endX) continue;
            const g = a.glyph ?? '';
            if (!g.endsWith(curvature === 'above' ? 'Above' : 'Below')) continue;
            if (curvature === 'below') {
              maxIntermediateDist = Math.max(maxIntermediateDist, a.y - Math.min(startY, endY) + 0.8);
            } else {
              maxIntermediateDist = Math.max(maxIntermediateDist, Math.max(startY, endY) - a.y + 0.8);
            }
          }

          const pathD = createSlurCubicPath(startX, startY, endX, endY, curvature, maxIntermediateDist);
          result.push({
            id: `slur-${slur.id}`,
            slurId: slur.id,
            systemIndex: sysIdx,
            d: pathD,
          });
        } else {
          // Cross-system slur: split into two half-slurs
          const sysA = layout.systems[startNh.systemIndex];

          const startX = startNh.x + NOTEHEAD_WIDTH;
          const startY = curvature === 'below' ? startNh.maxY + 0.5 : startNh.minY - 0.5;
          const exitX = (sysA?.width ?? 70) - 1.0;
          const exitY = startY;

          const pathA = createSlurCubicPath(startX, startY, exitX, exitY, curvature, 1.2);
          result.push({
            id: `slur-${slur.id}-part1`,
            slurId: slur.id,
            systemIndex: startNh.systemIndex,
            d: pathA,
          });

          const enterX = 4.0; // Right after clef and key signature
          const endX = endNh.x;
          const endY = curvature === 'below' ? endNh.maxY + 0.5 : endNh.minY - 0.5;
          const enterY = endY;

          const pathB = createSlurCubicPath(enterX, enterY, endX, endY, curvature, 1.2);
          result.push({
            id: `slur-${slur.id}-part2`,
            slurId: slur.id,
            systemIndex: endNh.systemIndex,
            d: pathB,
          });
        }
      }
    }
  }

  return result;
}
