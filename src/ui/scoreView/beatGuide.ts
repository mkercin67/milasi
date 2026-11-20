// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * UI-layer Beat Guide and Pending Slot calculations.
 *
 * Uses existing layout event columns to map musical ticks to visual X coordinates
 * via monotonic piecewise linear interpolation with zero layout passes.
 */

import { BaseDurationType, Score } from '../../core/model';
import { durationTicks, measureTicks, PPQ } from '../../core/time';
import { LayoutResult, LayoutSystem } from '../../layout/types';
import { firstStaff } from '../../core/staffLookup';

export interface BeatTickMark {
  beatNumber: number;
  tick: number;
  x: number; // in staff spaces
}

export interface BeatGuideData {
  systemIndex: number;
  sysY: number;
  beatMarks: BeatTickMark[];
  pendingBand: {
    x: number;
    width: number;
    y: number;
    height: number;
  } | null;
  coincidentLineX: number | null; // staff spaces
}

export interface AnchorPoint {
  tick: number;
  x: number;
}

/**
 * Maps a musical tick in a measure to a visual X coordinate in staff spaces
 * using linear interpolation between layout event columns.
 *
 * Boundary rules:
 * - If tick <= first anchor: linear extrapolation / interpolation from (0, measureStartX + 0.8).
 * - If tick >= last anchor: linear extrapolation / interpolation to (mLength, endBarlineX - 0.5).
 */
export function tickToVisualX(
  tick: number,
  anchors: AnchorPoint[],
  mLength: number,
  measureStartX: number,
  endBarlineX: number
): number {
  if (anchors.length === 0) {
    const fraction = Math.max(0, Math.min(1, tick / mLength));
    return measureStartX + 0.8 + fraction * Math.max(1, endBarlineX - measureStartX - 1.3);
  }

  // Exact tick match
  for (const a of anchors) {
    if (Math.abs(a.tick - tick) < 0.001) {
      return a.x;
    }
  }

  // Before first anchor
  if (tick < anchors[0].tick) {
    const startX = measureStartX + 0.8;
    const t0 = 0;
    const t1 = anchors[0].tick;
    const x0 = startX;
    const x1 = anchors[0].x;
    if (t1 <= t0) return x0;
    return x0 + ((tick - t0) / (t1 - t0)) * (x1 - x0);
  }

  // After last anchor
  const lastA = anchors[anchors.length - 1];
  if (tick > lastA.tick) {
    const endX = endBarlineX - 0.5;
    const t0 = lastA.tick;
    const t1 = mLength;
    const x0 = lastA.x;
    const x1 = endX;
    if (t1 <= t0) return x0;
    return x0 + ((tick - t0) / (t1 - t0)) * (x1 - x0);
  }

  // Between two adjacent anchors
  for (let i = 0; i < anchors.length - 1; i++) {
    const a0 = anchors[i];
    const a1 = anchors[i + 1];
    if (tick >= a0.tick && tick <= a1.tick) {
      const fraction = (tick - a0.tick) / (a1.tick - a0.tick);
      return a0.x + fraction * (a1.x - a0.x);
    }
  }

  return anchors[0].x;
}

/**
 * Computes Beat Guide tick marks, pending slot rectangle, and coincident voice lines
 * from existing layout systems without initiating a new layout pass.
 */
export function computeBeatGuide(
  layout: LayoutResult,
  score: Score,
  measureId: string | undefined,
  cursorTick: number,
  activeVoiceIndex: 1 | 2 | 3 | 4,
  activeDuration: BaseDurationType,
  activeDots: number
): BeatGuideData | null {
  if (!measureId || layout.systems.length === 0) return null;

  const mDef = score.measures.find((m) => m.id === measureId);
  if (!mDef) return null;

  // 1. Locate system containing measureId
  let targetSystem: LayoutSystem | null = null;
  let systemIndex = 0;
  for (let i = 0; i < layout.systems.length; i++) {
    const sys = layout.systems[i];
    if (sys.items.some((it) => it.id.startsWith(`barline-${measureId}`))) {
      targetSystem = sys;
      systemIndex = i;
      break;
    }
  }
  if (!targetSystem) {
    targetSystem = layout.systems[0];
    systemIndex = 0;
  }

  // Find measure start and end X
  const isFirstMeasureInScore = score.measures[0]?.id === measureId;
  const endBarline = targetSystem.items.find(
    (it) => it.id === `barline-${measureId}` || it.id === `barline-${measureId}-thin`
  );
  const endBarlineX = endBarline ? endBarline.x : targetSystem.width;

  let measureStartX = 0;
  const earlierBarlines = targetSystem.items
    .filter((it) => it.id.startsWith('barline-') && it.x < endBarlineX - 0.1)
    .sort((a, b) => b.x - a.x);

  if (earlierBarlines.length > 0) {
    measureStartX = earlierBarlines[0].x + (earlierBarlines[0].thickness ?? 0.16);
  } else {
    const headerItems = targetSystem.items.filter(
      (it) =>
        it.id.startsWith('sys-') ||
        it.id.startsWith('clef-') ||
        it.id.startsWith('keysig-') ||
        (isFirstMeasureInScore && it.id.startsWith('timesig-'))
    );
    measureStartX = headerItems.reduce((max, it) => Math.max(max, it.x + (it.width ?? 1.2)), 0);
  }

  const mLength = measureTicks(mDef.timeSig);

  // 2. Extract event column anchor points from layout items in this measure
  const staff = firstStaff(score);
  const sm = staff?.measures[measureId];
  const tickToXMap = new Map<number, number>();

  if (sm && sm.voices) {
    for (const voice of sm.voices) {
      let t = 0;
      for (const ev of voice.events) {
        const evGlyphs = targetSystem.items
          .filter((it) => it.eventId === ev.id)
          .sort((a, b) => a.x - b.x);
        if (evGlyphs.length > 0) {
          const gx = evGlyphs[0].x;
          if (!tickToXMap.has(t)) {
            tickToXMap.set(t, gx);
          } else {
            // Keep earliest glyph column
            tickToXMap.set(t, Math.min(tickToXMap.get(t)!, gx));
          }
        }
        t += ev.duration;
      }
    }
  }

  // Anchor at 0 if not present
  if (!tickToXMap.has(0)) {
    tickToXMap.set(0, measureStartX + 0.8);
  }

  const anchors: AnchorPoint[] = Array.from(tickToXMap.entries())
    .map(([tick, x]) => ({ tick, x }))
    .sort((a, b) => a.tick - b.tick);

  // 3. Compute beat tick marks
  const beatMarks: BeatTickMark[] = [];
  const ts = mDef.timeSig;
  const isCompound = (ts.num === 6 || ts.num === 9 || ts.num === 12) && ts.den === 8;

  if (isCompound) {
    // Dotted-quarter pulses: 1440 ticks each
    const pulses = ts.num / 3;
    for (let p = 0; p < pulses; p++) {
      const bTick = p * 1440;
      const x = tickToVisualX(bTick, anchors, mLength, measureStartX, endBarlineX);
      beatMarks.push({ beatNumber: p + 1, tick: bTick, x });
    }
  } else {
    const ticksPerBeat = (4 / ts.den) * PPQ;
    for (let b = 0; b < ts.num; b++) {
      const bTick = b * ticksPerBeat;
      const x = tickToVisualX(bTick, anchors, mLength, measureStartX, endBarlineX);
      beatMarks.push({ beatNumber: b + 1, tick: bTick, x });
    }
  }

  // 4. Compute pending slot band
  const durTicks = durationTicks(activeDuration, activeDots);
  const bandStartTick = cursorTick;
  const bandEndTick = Math.min(mLength, cursorTick + durTicks);

  const startX = tickToVisualX(bandStartTick, anchors, mLength, measureStartX, endBarlineX);
  const endX = tickToVisualX(bandEndTick, anchors, mLength, measureStartX, endBarlineX);

  const pendingBand = {
    x: startX,
    width: Math.max(0.4, endX - startX),
    y: targetSystem.y - 0.5,
    height: 5.0,
  };

  // 5. Coincident event vertical guide line
  let coincidentLineX: number | null = null;
  if (sm && sm.voices) {
    for (const voice of sm.voices) {
      if (voice.voiceIndex !== activeVoiceIndex) {
        let t = 0;
        for (const ev of voice.events) {
          if (t === cursorTick && ev.kind === 'note') {
            coincidentLineX = tickToVisualX(cursorTick, anchors, mLength, measureStartX, endBarlineX);
            break;
          }
          t += ev.duration;
        }
        if (coincidentLineX !== null) break;
      }
    }
  }

  return {
    systemIndex,
    sysY: targetSystem.y,
    beatMarks,
    pendingBand,
    coincidentLineX,
  };
}
