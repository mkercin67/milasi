// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Pointer drag thresholds, snapping, axis-lock, and cursor positioning helpers.
 */

import { LayoutResult } from './types';
import { Score } from '../core/model';
import { measureTicks as timeSigTicks } from '../core/time';
import type { ScoreCursor } from '../core/input';

/**
 * Checks if a pointer movement exceeds the drag initiation threshold (default 4px).
 *
 * @param dxPx - Horizontal displacement in pixels.
 * @param dyPx - Vertical displacement in pixels.
 * @param thresholdPx - Distance threshold in pixels (defaults to 4).
 * @returns True if Euclidean distance >= thresholdPx.
 */
export function isDragPastThreshold(dxPx: number, dyPx: number, thresholdPx = 4): boolean {
  return Math.hypot(dxPx, dyPx) >= thresholdPx;
}

/**
 * Snaps a drag offset in staff spaces to 0.25 space increments.
 *
 * @param offsetSpaces - Raw offset in staff spaces.
 * @param noSnap - When true (e.g. Alt held), snapping is bypassed.
 * @returns Snapped offset in staff spaces.
 */
export function snapDragOffset(offsetSpaces: number, noSnap: boolean): number {
  if (noSnap) return offsetSpaces;
  const snapped = Math.round(offsetSpaces * 4) / 4;
  return snapped === 0 ? 0 : snapped;
}

/**
 * Constrains a 2D drag offset to the dominant axis if axis-lock is enabled.
 *
 * @param dx - Horizontal offset in staff spaces.
 * @param dy - Vertical offset in staff spaces.
 * @param lockAxis - When true (e.g. Shift held), locks movement to dominant axis.
 * @returns Constrained { dx, dy } offset.
 */
export function applyAxisLock(
  dx: number,
  dy: number,
  lockAxis: boolean
): { dx: number; dy: number } {
  if (!lockAxis) return { dx, dy };
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { dx, dy: 0 };
  }
  return { dx: 0, dy };
}

/**
 * Maps a pointer horizontal coordinate (x in staff spaces) in a system to the
 * corresponding cursor position (measureId, tick).
 *
 * Rules:
 * 1. Returns the start tick of the event under the pointer.
 * 2. If the pointer is between events, returns the start tick of the NEXT event to the right.
 * 3. If beyond the last event in the measure, returns the end-of-measure tick.
 *
 * @param layout - Rendered layout result.
 * @param systemIndex - Index of the target system.
 * @param x - Pointer X coordinate in staff spaces relative to the system left.
 * @param score - Optional score model (falls back to layout.score).
 * @param options - `allVoices: true` resolves the tick from the event columns of ALL voices in
 *   the measure (used by note entry, where the active voice may be empty or rest-only). Without
 *   it the legacy behaviour (voice 1 only) is kept for selection clicks.
 * @returns Cursor position { measureId, tick }, or null if system not found.
 */
export function xToCursor(
  layout: LayoutResult,
  systemIndex: number,
  x: number,
  score?: Score,
  options?: { allVoices?: boolean }
): { measureId: string; tick: number } | null {
  const system = layout.systems[systemIndex];
  if (!system) return null;

  const effectiveScore = score ?? layout.score;

  // 1. Find all barlines in this system to delimit measure boundaries
  const barlines: Array<{ measureId: string; x: number }> = [];
  for (const item of system.items) {
    if (item.kind === 'line' && item.id.startsWith('barline-') && !item.id.includes('staffline')) {
      const measureId = item.id.replace('barline-', '').replace('-thin', '');
      barlines.push({ measureId, x: item.x });
    }
  }
  barlines.sort((a, b) => a.x - b.x);

  if (barlines.length === 0) return null;

  // Find system header end (clef, keySig, timeSig)
  const headerItems = system.items.filter(
    (it) =>
      it.id.startsWith('sys-') ||
      it.id.startsWith('clef-') ||
      it.id.startsWith('keysig-') ||
      it.id.startsWith('timesig-')
  );
  const headerEndX = headerItems.reduce((max, it) => Math.max(max, it.x + (it.width ?? 1.2)), 0);

  // Build measure boundaries
  interface MeasureBounds {
    measureId: string;
    startX: number;
    endX: number;
  }
  const measureBounds: MeasureBounds[] = [];
  let curStart = headerEndX;

  for (let i = 0; i < barlines.length; i++) {
    const bl = barlines[i];
    measureBounds.push({
      measureId: bl.measureId,
      startX: curStart,
      endX: bl.x,
    });
    curStart = bl.x;
  }

  // Find which measure contains x
  let targetMeasure = measureBounds[0];
  if (x < measureBounds[0].startX) {
    targetMeasure = measureBounds[0];
  } else if (x >= measureBounds[measureBounds.length - 1].endX) {
    targetMeasure = measureBounds[measureBounds.length - 1];
  } else {
    for (const mb of measureBounds) {
      if (x >= mb.startX && x < mb.endX) {
        targetMeasure = mb;
        break;
      }
    }
  }

  if (!effectiveScore) {
    return { measureId: targetMeasure.measureId, tick: 0 };
  }

  // 2. Identify events and ticks in the target measure
  const staff = effectiveScore.parts[0]?.staves[0];
  const sm = staff?.measures[targetMeasure.measureId];
  const voice = sm?.voices.find((v) => v.voiceIndex === 1);
  const mDef = effectiveScore.measures.find((m) => m.id === targetMeasure.measureId);
  const measureTicks = mDef ? (mDef.actualTicks ?? timeSigTicks(mDef.timeSig)) : timeSigTicks({ num: 4, den: 4 });

  if (options?.allVoices) {
    return {
      measureId: targetMeasure.measureId,
      tick: columnFromAllVoices(system, sm?.voices ?? [], x).tick,
    };
  }

  if (!voice || voice.events.length === 0) {
    return { measureId: targetMeasure.measureId, tick: 0 };
  }

  // If all events in the measure are rests, clicking anywhere in the measure targets tick 0
  if (voice.events.every((ev) => ev.kind === 'rest')) {
    return { measureId: targetMeasure.measureId, tick: 0 };
  }

  let curTick = 0;
  for (let i = 0; i < voice.events.length; i++) {
    const ev = voice.events[i];
    const evStartTick = curTick;
    curTick += ev.duration;

    const isLastEvent = i === voice.events.length - 1;

    // Find visual elements belonging to this event in the system
    const evItems = system.items.filter((it) => it.eventId === ev.id && !it.hidden);
    if (evItems.length === 0) continue;

    const maxX = Math.max(...evItems.map((it) => it.x2 ?? it.x + (it.width ?? 1.2)));

    // If pointer is inside or before this event, this is the matched event
    if (x <= maxX) {
      return { measureId: targetMeasure.measureId, tick: evStartTick };
    }

    // If this is the last event and it's a rest, its space extends to the end of the measure
    if (isLastEvent && ev.kind === 'rest' && x <= targetMeasure.endX) {
      return { measureId: targetMeasure.measureId, tick: evStartTick };
    }
  }

  // Beyond all events: end-of-measure tick
  return { measureId: targetMeasure.measureId, tick: measureTicks };
}

type VoiceLike = { events: Array<{ id: string; kind: string; duration: number }> };

/**
 * Picks the beat column under x from the event columns of every voice that contains sounding
 * events. Voices made only of rests (for example a freshly created voice) follow the other
 * voices instead of swallowing the click. Right of the last column the LAST column is used
 * (a complete measure has no free slot after its last beat). If every voice is rests only the
 * answer is tick 0 with no column.
 */
function columnFromAllVoices(
  system: LayoutResult['systems'][number],
  voices: VoiceLike[],
  x: number
): { tick: number; columnX: number | null } {
  const active = voices.filter((v) => v.events.some((e) => e.kind !== 'rest'));
  if (active.length === 0) return { tick: 0, columnX: null };

  const columns = new Map<number, { maxX: number; minX: number }>();
  for (const v of active) {
    let tick = 0;
    for (const ev of v.events) {
      const start = tick;
      tick += ev.duration;
      const items = system.items.filter((it) => it.eventId === ev.id && !it.hidden);
      if (items.length === 0) continue;
      const maxX = Math.max(...items.map((it) => it.x2 ?? it.x + (it.width ?? 1.2)));
      const minX = Math.min(...items.map((it) => it.x));
      const prev = columns.get(start);
      columns.set(start, {
        maxX: Math.max(prev?.maxX ?? -Infinity, maxX),
        minX: Math.min(prev?.minX ?? Infinity, minX),
      });
    }
  }
  const ticks = [...columns.keys()].sort((a, b) => a - b);
  if (ticks.length === 0) return { tick: 0, columnX: null };
  for (const start of ticks) {
    if (x <= (columns.get(start) as { maxX: number }).maxX) {
      return { tick: start, columnX: (columns.get(start) as { minX: number }).minX };
    }
  }
  const last = ticks[ticks.length - 1];
  return { tick: last, columnX: (columns.get(last) as { minX: number }).minX };
}

/**
 * Cursor for mouse note entry: the clicked measure and tick (from all voices' columns) in the
 * ACTIVE voice, plus the x of that beat column (null when the measure holds only rests).
 * The voice does not need to exist yet; entry creates it (M7a-2b D3).
 */
export function xToEntryCursor(
  layout: LayoutResult,
  score: Score,
  systemIndex: number,
  x: number,
  voiceIndex: ScoreCursor['voiceIndex']
): (ScoreCursor & { columnX: number | null }) | null {
  const staffId = score.parts[0]?.staves[0]?.id;
  if (!staffId) return null;
  const found = xToCursor(layout, systemIndex, x, score, { allVoices: true });
  if (!found) return null;
  const sm = score.parts[0].staves[0].measures[found.measureId];
  const system = layout.systems[systemIndex];
  const columnX = system ? columnFromAllVoices(system, sm?.voices ?? [], x).columnX : null;
  return { staffId, voiceIndex, measureId: found.measureId, tick: found.tick, columnX };
}
