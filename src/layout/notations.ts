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
}

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

function getNoteheadInfo(layout: LayoutResult, eventId: string): NoteheadInfo | null {
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
      };
    }
  }
  return null;
}

/**
 * Computes layout items for note dynamics.
 */
export function layoutDynamics(score: Score, layout: LayoutResult): LayoutItem[] {
  const items: LayoutItem[] = [];

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

              const nh = getNoteheadInfo(layout, ev.id);
              if (!nh) continue;

              const overrideId = `${ev.id}-dynamic`;
              const override = score.overrides[overrideId] ?? score.overrides[ev.id];
              const dx = override?.dx ?? 0;
              const dy = override?.dy ?? 0;

              // Default placement below staff (staff lines 0..4, so bottom + 2.5 = 6.5)
              const posX = nh.x + NOTEHEAD_WIDTH / 2 - 0.75 + dx;
              const posY = 6.5 + dy;

              items.push({
                id: overrideId,
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

/**
 * Computes layout items for note articulations.
 */
export function layoutArticulations(score: Score, layout: LayoutResult): LayoutItem[] {
  const items: LayoutItem[] = [];

  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (const mDef of score.measures) {
        const sm = staff.measures[mDef.id];
        if (!sm) continue;
        for (const v of sm.voices) {
          for (const ev of v.events) {
            if (ev.kind === 'note' && ev.articulations && ev.articulations.length > 0) {
              const nh = getNoteheadInfo(layout, ev.id);
              if (!nh) continue;

              // Placement direction: opposite to stem direction (notehead side)
              // If stem is up -> place below notehead (y > nh.maxY); if stem is down -> place above notehead (y < nh.minY)
              const placeAbove = nh.stemDirection === 'down';

              // Order from notehead outwards: staccato/tenuto closest, accent/marcato further
              const sortedArts = [...ev.articulations].sort((a, b) => {
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

                // Avoid landing directly on staff lines (integer Y between 0 and 4)
                if (art === 'staccato' && targetY >= -0.2 && targetY <= 4.2) {
                  const distFromInt = Math.abs(targetY - Math.round(targetY));
                  if (distFromInt < 0.25) {
                    targetY = placeAbove ? Math.round(targetY) - 0.5 : Math.round(targetY) + 0.5;
                  }
                }

                const overrideId = `${ev.id}-artic-${art}`;
                const override = score.overrides[overrideId] ?? score.overrides[ev.id];
                const dx = override?.dx ?? 0;
                const dy = override?.dy ?? 0;

                const posX = nh.x + NOTEHEAD_WIDTH / 2 - 0.25 + dx;
                const posY = targetY + dy;

                items.push({
                  id: overrideId,
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

/**
 * Computes SVG slur paths for all slurs defined on the staff.
 */
export function layoutSlurs(score: Score, layout: LayoutResult): SlurLayoutItem[] {
  const result: SlurLayoutItem[] = [];

  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (!staff.slurs || staff.slurs.length === 0) continue;

      for (const slur of staff.slurs) {
        const startNh = getNoteheadInfo(layout, slur.startEventId);
        const endNh = getNoteheadInfo(layout, slur.endEventId);
        if (!startNh || !endNh) continue;

        const curvature: 'above' | 'below' =
          slur.placement ?? (startNh.stemDirection === 'up' && endNh.stemDirection === 'up' ? 'below' : 'above');

        if (startNh.systemIndex === endNh.systemIndex) {
          // Single system slur
          const sysIdx = startNh.systemIndex;
          const sys = layout.systems[sysIdx];

          const startX = startNh.x + NOTEHEAD_WIDTH;
          const endX = endNh.x;
          const startY = curvature === 'below' ? startNh.maxY + 0.5 : startNh.minY - 0.5;
          const endY = curvature === 'below' ? endNh.maxY + 0.5 : endNh.minY - 0.5;

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
