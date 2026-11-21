// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Musical beam grouping logic per measure voice.
 *
 * Pure functions operating strictly on core event data and integer ticks (PPQ = 960).
 */

import { BaseDurationType, BeamGroupingMode, MeasureDef, ScoreEvent } from '../core/model';
import { PPQ } from '../core/time';

export type TimeSig = MeasureDef['timeSig'];

/** Contiguous group of beamable note events within one beat/tuplet unit. */
export interface BeamGroup {
  eventIds: string[];
}

/** Checks whether a base duration type requires a flag / can be beamed. */
export function isBeamableBaseType(baseType: BaseDurationType): boolean {
  return baseType === 'eighth' || baseType === '16th' || baseType === '32nd';
}

/** Returns the maximum beam level required for a note duration (1=8th, 2=16th, 3=32nd). */
export function getBeamLevelCount(baseType: BaseDurationType): number {
  if (baseType === '32nd') return 3;
  if (baseType === '16th') return 2;
  if (baseType === 'eighth') return 1;
  return 0;
}

/**
 * Returns the beat subdivision length in integer ticks used for beam grouping boundaries.
 *
 * Rules:
 * - x/4 (2/4, 3/4, 4/4, etc.): quarter-note beat (PPQ = 960 ticks).
 * - Compound x/8 (6/8, 9/8, 12/8, etc.): dotted-quarter beat (3 eighths = 1440 ticks).
 * - 3/8: whole measure dotted-quarter (1440 ticks).
 * - x/2 (2/2, etc.): half-note beat (2 * PPQ = 1920 ticks).
 * - Fallback: denominator unit length in ticks.
 */
export function getBeatTicksForTimeSig(timeSig: TimeSig): number {
  const { num, den } = timeSig;
  if (den <= 0 || num <= 0) {
    return PPQ;
  }
  if (den === 4) {
    return PPQ;
  }
  if (den === 2) {
    return PPQ * 2;
  }
  if (den === 8) {
    if (num === 3 || (num >= 6 && num % 3 === 0)) {
      return (PPQ / 2) * 3; // dotted quarter = 1440 ticks
    }
    return PPQ / 2;
  }
  return Math.max(1, Math.round((4 * PPQ) / den));
}

function getTupletKey(ev: ScoreEvent): string | null {
  if (!ev.tuplet) return null;
  return `${ev.tuplet.actual}:${ev.tuplet.normal}`;
}

/**
 * Indices (0 or 1) of the two-beat windows of a 4/4 measure that consist of eighth notes only and
 * are exactly filled by them (ticks [w*2*PPQ, (w+1)*2*PPQ)). Empty for every other meter.
 */
function findEighthWindows(voiceEvents: ScoreEvent[], timeSig: TimeSig): Set<number> {
  const out = new Set<number>();
  if (timeSig.num !== 4 || timeSig.den !== 4) return out;
  const windowTicks = 2 * PPQ;
  const perWindow = new Map<number, { ok: boolean; sum: number; first: number }>();
  let tick = 0;
  for (const ev of voiceEvents) {
    const w = Math.floor(tick / windowTicks);
    const info = perWindow.get(w) ?? { ok: true, sum: 0, first: tick };
    if (ev.kind !== 'note' || ev.baseType !== 'eighth' || ev.tuplet) info.ok = false;
    info.sum += ev.duration;
    perWindow.set(w, info);
    tick += ev.duration;
  }
  for (const [w, info] of perWindow) {
    if (info.ok && info.first === w * windowTicks && info.sum === windowTicks) out.add(w);
  }
  return out;
}

/**
 * Computes beam groups for a single voice within a single measure.
 *
 * Rules:
 * 1. Only note events (single or chord) with baseType 'eighth' | '16th' | '32nd' qualify.
 *    Rests and quarter/longer notes break the current group.
 * 2. Never crosses a beat boundary (matched strictly by event START TICK).
 * 3. Events of matching tuplet ratio group together; mixing tuplet and non-tuplet breaks.
 * 4. A group requires at least 2 events; isolated beamable notes keep their flags.
 *
 * Mode 'half-bar' (4/4 only, M7b-7): a two-beat window whose events are ALL eighth notes
 * (same non-tuplet key, no rests, covering the window exactly) forms one group; any other window
 * falls back to the per-beat rule. Groups never cross the half-bar boundary.
 */
export function groupBeams(
  voiceEvents: ScoreEvent[],
  timeSig: TimeSig,
  mode: BeamGroupingMode = 'beat'
): BeamGroup[] {
  const beatTicks = getBeatTicksForTimeSig(timeSig);
  const mergedWindows = mode === 'half-bar' ? findEighthWindows(voiceEvents, timeSig) : new Set<number>();
  const groups: BeamGroup[] = [];

  let currentIds: string[] = [];
  let currentBeat = -1;
  let currentTupletKey: string | null = null;

  const flushGroup = () => {
    if (currentIds.length >= 2) {
      groups.push({ eventIds: currentIds });
    }
    currentIds = [];
    currentBeat = -1;
    currentTupletKey = null;
  };

  let runningTick = 0;

  for (let i = 0; i < voiceEvents.length; i++) {
    const ev = voiceEvents[i];
    const startTick = runningTick;
    runningTick += ev.duration;

    if (ev.kind !== 'note' || !isBeamableBaseType(ev.baseType)) {
      flushGroup();
      continue;
    }

    const rawBeat = Math.floor(startTick / beatTicks);
    const eventBeat = mergedWindows.has(Math.floor(rawBeat / 2)) ? Math.floor(rawBeat / 2) * 2 : rawBeat;
    const tupletKey = getTupletKey(ev);

    if (currentIds.length > 0 && (eventBeat !== currentBeat || tupletKey !== currentTupletKey)) {
      flushGroup();
    }
    // A tuplet group is one beam group of `actual` notes (two sixteenth triplets in a beat are two groups)
    if (ev.tuplet && currentIds.length >= ev.tuplet.actual) {
      flushGroup();
    }

    if (currentIds.length === 0) {
      currentBeat = eventBeat;
      currentTupletKey = tupletKey;
    }
    currentIds.push(ev.id);
  }

  flushGroup();
  return groups;
}
