// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Time and rhythmic calculations for ScoreForge.
 *
 * All temporal measurements in the core model use integer ticks to prevent
 * floating-point drift and rounding errors.
 */

import { BaseDurationType, RestEvent } from './model';

/** Pulses (ticks) per quarter note. Standard resolution: 960 ticks. */
export const PPQ = 960;

/** Mapping from base duration types to base ticks (relative to PPQ). */
const BASE_TICKS_MAP: Record<BaseDurationType, number> = {
  whole: PPQ * 4, // 3840 ticks
  half: PPQ * 2, // 1920 ticks
  quarter: PPQ, // 960 ticks
  eighth: PPQ / 2, // 480 ticks
  '16th': PPQ / 4, // 240 ticks
  '32nd': PPQ / 8, // 120 ticks
};

/** Candidate rest values with at most one dot, ordered from largest to smallest duration. */
const REST_CANDIDATES: Array<{ baseType: BaseDurationType; dots: 0 | 1; ticks: number }> = [
  { baseType: 'whole', dots: 1, ticks: 5760 },
  { baseType: 'whole', dots: 0, ticks: 3840 },
  { baseType: 'half', dots: 1, ticks: 2880 },
  { baseType: 'half', dots: 0, ticks: 1920 },
  { baseType: 'quarter', dots: 1, ticks: 1440 },
  { baseType: 'quarter', dots: 0, ticks: 960 },
  { baseType: 'eighth', dots: 1, ticks: 720 },
  { baseType: 'eighth', dots: 0, ticks: 480 },
  { baseType: '16th', dots: 1, ticks: 360 },
  { baseType: '16th', dots: 0, ticks: 240 },
  { baseType: '32nd', dots: 1, ticks: 180 },
  { baseType: '32nd', dots: 0, ticks: 120 },
];

/** Rhythmic descriptor for a single rest event. */
export interface RestDescriptor {
  baseType: BaseDurationType;
  dots: 0 | 1;
  duration: number;
}

/**
 * Decomposes an integer tick duration into the fewest valid rest values.
 * Every returned rest has a valid SMuFL baseType and at most one dot (dots <= 1).
 */
export function decomposeTicksToRests(targetTicks: number): RestDescriptor[] {
  if (targetTicks <= 0) return [];

  // Breadth-first search guarantees the fewest possible events.
  const queue: Array<{ rem: number; path: RestDescriptor[] }> = [{ rem: targetTicks, path: [] }];
  const visited = new Set<number>([targetTicks]);

  while (queue.length > 0) {
    const { rem, path } = queue.shift()!;
    for (const cand of REST_CANDIDATES) {
      if (cand.ticks === rem) {
        return [...path, { baseType: cand.baseType, dots: cand.dots, duration: cand.ticks }];
      }
      if (cand.ticks < rem) {
        const nextRem = rem - cand.ticks;
        if (!visited.has(nextRem)) {
          visited.add(nextRem);
          queue.push({
            rem: nextRem,
            path: [...path, { baseType: cand.baseType, dots: cand.dots, duration: cand.ticks }],
          });
        }
      }
    }
  }

  // Fallback for sub-32nd tick remainders (should not occur with standard notation PPQ=960)
  return [{ baseType: '32nd', dots: 0, duration: targetTicks }];
}

/**
 * Fills a measure duration with valid RestEvent objects.
 * Output duration sums to exactly targetTicks with the fewest events possible.
 */
export function fillMeasureWithRests(
  targetTicks: number,
  idGenerator?: (index: number) => string
): RestEvent[] {
  const descriptors = decomposeTicksToRests(targetTicks);
  return descriptors.map((d, idx) => ({
    id: idGenerator ? idGenerator(idx) : `rest-${idx}`,
    kind: 'rest',
    baseType: d.baseType,
    dots: d.dots,
    duration: d.duration,
    wholeMeasure: descriptors.length === 1 && d.baseType === 'whole' && d.dots === 0,
  }));
}

/**
 * Calculates the duration of an event in integer ticks.
 *
 * @param baseType - The fundamental note value (e.g. 'quarter', 'eighth').
 * @param dots - Number of augmentation dots (defaults to 0).
 * @param tuplet - Optional ratio of actual notes in the space of normal notes.
 * @returns Total duration in integer ticks.
 */
export function durationTicks(
  baseType: BaseDurationType,
  dots: number = 0,
  tuplet?: { actual: number; normal: number }
): number {
  const base = BASE_TICKS_MAP[baseType];
  if (base === undefined) {
    throw new Error(`Unknown base duration type: ${baseType}`);
  }

  let totalTicks = base;
  let dotAdd = base;

  for (let i = 0; i < dots; i++) {
    dotAdd = Math.floor(dotAdd / 2);
    totalTicks += dotAdd;
  }

  if (tuplet && tuplet.actual > 0) {
    totalTicks = Math.round((totalTicks * tuplet.normal) / tuplet.actual);
  }

  return totalTicks;
}

/**
 * Calculates the total duration of a measure in integer ticks based on its time signature.
 * Formula: num * (4 / den) * PPQ.
 *
 * @param timeSig - The time signature numerator and denominator.
 * @returns Measure length in integer ticks.
 */
export function measureTicks(timeSig: { num: number; den: number }): number {
  if (timeSig.den <= 0 || timeSig.num <= 0) {
    throw new Error(`Invalid time signature: ${timeSig.num}/${timeSig.den}`);
  }
  return Math.round((timeSig.num * 4 * PPQ) / timeSig.den);
}
