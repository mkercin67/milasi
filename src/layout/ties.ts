/**
 * Layout and geometry computation for ties.
 *
 * Implements smooth SVG bezier tie curves (crescent shape):
 * - Same system: spans from notehead A to notehead B, curving away from stem direction.
 * - System break: splits into two half-ties (leaving right margin of sys A, entering from left margin of sys B).
 */

import { NoteEvent, Score } from '../core/model';
import { NOTEHEAD_WIDTH } from './layoutScore';
import { LayoutResult } from './types';

export interface TieLayoutItem {
  id: string;
  systemIndex: number;
  d: string;
}

interface NoteheadPos {
  systemIndex: number;
  x: number;
  y: number;
  stemDirection: 'up' | 'down';
}

function findNoteheadPos(layout: LayoutResult, eventId: string): NoteheadPos | null {
  for (let sysIdx = 0; sysIdx < layout.systems.length; sysIdx++) {
    const sys = layout.systems[sysIdx];
    const items = sys.items ?? [];
    const nh = items.find(
      (it) => it.eventId === eventId && it.kind === 'glyph' && it.glyph?.startsWith('notehead')
    );
    if (nh) {
      // Find stem to determine direction
      const stem = items.find((it) => it.eventId === eventId && it.kind === 'line');
      let stemDirection: 'up' | 'down' = nh.y >= 2.0 ? 'up' : 'down';
      if (stem && stem.y2 !== undefined) {
        stemDirection = stem.y2 < stem.y ? 'up' : 'down';
      }
      return {
        systemIndex: sysIdx,
        x: nh.x,
        y: nh.y,
        stemDirection,
      };
    }
  }
  return null;
}

/**
 * Creates a tapered crescent bezier SVG path between (x1, y1) and (x2, y2).
 */
function createCrescentPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stemDirection: 'up' | 'down'
): string {
  const dx = Math.abs(x2 - x1);
  const midX = Number(((x1 + x2) / 2).toFixed(2));
  const baseMidY = (y1 + y2) / 2;
  const depth = Math.max(0.5, Math.min(1.4, dx * 0.12));
  const thickness = 0.42;

  let ctrlYOuter: number;
  let ctrlYInner: number;

  if (stemDirection === 'up') {
    // Stem up -> curve downward (below notehead)
    ctrlYOuter = Number((baseMidY + depth).toFixed(2));
    ctrlYInner = Number((baseMidY + depth - thickness).toFixed(2));
  } else {
    // Stem down -> curve upward (above notehead)
    ctrlYOuter = Number((baseMidY - depth).toFixed(2));
    ctrlYInner = Number((baseMidY - depth + thickness).toFixed(2));
  }

  const pX1 = Number(x1.toFixed(2));
  const pY1 = Number(y1.toFixed(2));
  const pX2 = Number(x2.toFixed(2));
  const pY2 = Number(y2.toFixed(2));

  return `M ${pX1} ${pY1} Q ${midX} ${ctrlYOuter} ${pX2} ${pY2} Q ${midX} ${ctrlYInner} ${pX1} ${pY1} Z`;
}

/**
 * Computes SVG tie path items for all tied notes in the score.
 */
export function layoutTies(score: Score, layout: LayoutResult): TieLayoutItem[] {
  const ties: TieLayoutItem[] = [];

  for (const part of score.parts) {
    for (const staff of part.staves) {
      // Collect all notes in staff in score order
      const allNotes: Array<{ event: NoteEvent; measureIndex: number }> = [];
      for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
        const mDef = score.measures[mIdx];
        const sm = staff.measures[mDef.id];
        if (!sm) continue;
        for (const v of sm.voices) {
          for (const ev of v.events) {
            if (ev.kind === 'note') {
              allNotes.push({ event: ev, measureIndex: mIdx });
            }
          }
        }
      }

      for (let nIdx = 0; nIdx < allNotes.length; nIdx++) {
        const { event: sourceNote } = allNotes[nIdx];
        const isTied = sourceNote.tiedToNext || sourceNote.pitches.some((p) => p.tiedToNext);
        if (!isTied) continue;

        // Find next note with matching pitch
        for (let nextIdx = nIdx + 1; nextIdx < allNotes.length; nextIdx++) {
          const { event: targetNote } = allNotes[nextIdx];
          const hasMatchingPitch = sourceNote.pitches.some((sp) =>
            targetNote.pitches.some(
              (tp) => tp.step === sp.step && tp.octave === sp.octave && tp.alter === sp.alter
            )
          );

          if (hasMatchingPitch) {
            const posA = findNoteheadPos(layout, sourceNote.id);
            const posB = findNoteheadPos(layout, targetNote.id);

            if (posA && posB) {
              const stemDir = posA.stemDirection;
              const yOffset = stemDir === 'up' ? 0.35 : -0.35;

              if (posA.systemIndex === posB.systemIndex) {
                // Same system
                const x1 = posA.x + NOTEHEAD_WIDTH * 0.9;
                const y1 = posA.y + yOffset;
                const x2 = posB.x - 0.1;
                const y2 = posB.y + yOffset;

                const pathD = createCrescentPath(x1, y1, x2, y2, stemDir);
                ties.push({
                  id: `tie_${sourceNote.id}_${targetNote.id}`,
                  systemIndex: posA.systemIndex,
                  d: pathD,
                });
              } else {
                // System break: split into two half-ties!
                const sysA = layout.systems[posA.systemIndex];

                const sysAWidth = sysA ? sysA.width : 80;
                // Half-tie 1: leaves notehead A to right margin
                const x1A = posA.x + NOTEHEAD_WIDTH * 0.9;
                const y1A = posA.y + yOffset;
                const x2A = sysAWidth - 0.5;
                const y2A = y1A;
                const pathA = createCrescentPath(x1A, y1A, x2A, y2A, stemDir);
                ties.push({
                  id: `tie_${sourceNote.id}_break_a`,
                  systemIndex: posA.systemIndex,
                  d: pathA,
                });

                // Half-tie 2: enters from left margin to notehead B
                const x1B = 6.0; // Left margin after clef / armör
                const x2B = posB.x - 0.1;
                const y1B = posB.y + yOffset;
                const y2B = y1B;
                const pathB = createCrescentPath(x1B, y1B, x2B, y2B, stemDir);
                ties.push({
                  id: `tie_${sourceNote.id}_break_b`,
                  systemIndex: posB.systemIndex,
                  d: pathB,
                });
              }
            }
            break; // Matched first following note
          }
        }
      }
    }
  }

  return ties;
}
