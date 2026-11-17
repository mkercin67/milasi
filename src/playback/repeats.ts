/**
 * Linear playback scheduling and repeat expansion for ScoreForge.
 *
 * Implements Section A of Milestone 6d: expandRepeats linearizes measures
 * taking into account repeat start/end barlines and 1st / 2nd volta endings.
 */

import { MeasureDef, Score } from '../core/model';

export interface ExpandedMeasureEntry {
  measureIndex: number;
  measureDef: MeasureDef;
  pass: number;
}

/**
 * Linearizes a Score's measures for playback, expanding repeats and voltas.
 *
 * @param score - The score to linearize.
 * @returns Array of expanded measure entries in chronological playback order.
 */
export function expandRepeats(score: Score): ExpandedMeasureEntry[] {
  const result: ExpandedMeasureEntry[] = [];
  const measures = score.measures;
  if (!measures || measures.length === 0) {
    return result;
  }

  let i = 0;
  let currentRepeatStart = 0;
  let pass = 1;
  const maxIterations = measures.length * 4; // Safety against infinite loops
  let iterations = 0;

  while (i < measures.length && iterations++ < maxIterations) {
    const m = measures[i];

    // Check if this measure marks the start of a repeated section
    if (m.repeat === 'start' || m.repeat === 'both') {
      currentRepeatStart = i;
    }

    // Handle voltas based on current pass
    if (m.volta) {
      if (pass === 1 && m.volta.number === 2) {
        // Skip volta 2 during pass 1
        i++;
        continue;
      }
      if (pass === 2 && m.volta.number === 1) {
        // Skip volta 1 during pass 2
        i++;
        continue;
      }
    }

    // Emit this measure for playback
    result.push({
      measureIndex: i,
      measureDef: m,
      pass,
    });

    // Check if this measure marks the end of a repeated section
    if (m.repeat === 'end' || m.repeat === 'both') {
      if (pass === 1) {
        // Jump back to repeat start for second pass
        i = currentRepeatStart;
        pass = 2;
        continue;
      } else {
        // Already repeated pass 2, reset pass to 1 for subsequent sections
        pass = 1;
        if (m.repeat === 'both') {
          currentRepeatStart = i + 1;
        } else {
          currentRepeatStart = i + 1;
        }
      }
    }

    i++;
  }

  return result;
}
