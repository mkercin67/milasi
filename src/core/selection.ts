// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Core selection helpers and range computations.
 */

import { Score, ScoreEvent } from './model';

export type Selection =
  | { kind: 'none' }
  | { kind: 'event'; id: string }
  | {
      kind: 'range';
      staffId: string;
      voiceIndex: 1 | 2 | 3 | 4;
      anchorId: string;
      focusId: string;
    };

export interface RangeSelection {
  kind?: 'range';
  staffId: string;
  voiceIndex: 1 | 2 | 3 | 4;
  anchorId: string;
  focusId: string;
}

/**
 * Finds the staff, measure, and voice location of an event by ID.
 */
export function findEventContext(
  score: Score,
  eventId: string
): {
  staffId: string;
  measureId: string;
  measureIndex: number;
  voiceIndex: 1 | 2 | 3 | 4;
  eventIndex: number;
} | null {
  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
        const mDef = score.measures[mIdx];
        const staffMeasure = staff.measures[mDef.id];
        if (!staffMeasure) continue;
        for (const voice of staffMeasure.voices) {
          const evIdx = voice.events.findIndex((e) => e.id === eventId);
          if (evIdx !== -1) {
            const vIndex = voice.voiceIndex;
            return {
              staffId: staff.id,
              measureId: mDef.id,
              measureIndex: mIdx,
              voiceIndex: vIndex,
              eventIndex: evIdx,
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Returns all events in a specific voice across all measures in score reading order.
 * Follows voiceIndex (1..4) strictly across measures per Rule R3.
 */
export function getOrderedVoiceEvents(
  score: Score,
  staffId: string,
  targetVoiceIndex: number = 1
): Array<{ event: ScoreEvent; measureId: string; measureIndex: number }> {
  const result: Array<{ event: ScoreEvent; measureId: string; measureIndex: number }> = [];

  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (staff.id !== staffId) continue;
      for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
        const mDef = score.measures[mIdx];
        const staffMeasure = staff.measures[mDef.id];
        if (!staffMeasure) continue;
        for (const voice of staffMeasure.voices) {
          if (voice.voiceIndex !== targetVoiceIndex) continue;
          for (const ev of voice.events) {
            result.push({ event: ev, measureId: mDef.id, measureIndex: mIdx });
          }
        }
      }
    }
  }

  return result;
}

/**
 * Returns all events in the specified range in reading order.
 */
export function eventsInRange(
  score: Score,
  range: RangeSelection
): ScoreEvent[] {
  const anchorCtx = findEventContext(score, range.anchorId);
  const vIndex = range.voiceIndex ?? (anchorCtx ? anchorCtx.voiceIndex : 1);
  const ordered = getOrderedVoiceEvents(score, range.staffId, vIndex);
  const anchorIdx = ordered.findIndex((item) => item.event.id === range.anchorId);
  const focusIdx = ordered.findIndex((item) => item.event.id === range.focusId);

  if (anchorIdx === -1 || focusIdx === -1) {
    return [];
  }

  const startIdx = Math.min(anchorIdx, focusIdx);
  const endIdx = Math.max(anchorIdx, focusIdx);

  return ordered.slice(startIdx, endIdx + 1).map((item) => item.event);
}

/**
 * Extends or creates a range selection towards targetEventId.
 */
export function extendSelection(
  score: Score,
  current: Selection,
  targetEventId: string
): Selection {
  const targetCtx = findEventContext(score, targetEventId);
  if (!targetCtx) return current;

  if (current.kind === 'none') {
    return {
      kind: 'range',
      staffId: targetCtx.staffId,
      voiceIndex: targetCtx.voiceIndex,
      anchorId: targetEventId,
      focusId: targetEventId,
    };
  }

  if (current.kind === 'event') {
    const anchorCtx = findEventContext(score, current.id);
    if (!anchorCtx || anchorCtx.staffId !== targetCtx.staffId || anchorCtx.voiceIndex !== targetCtx.voiceIndex) {
      return {
        kind: 'range',
        staffId: targetCtx.staffId,
        voiceIndex: targetCtx.voiceIndex,
        anchorId: targetEventId,
        focusId: targetEventId,
      };
    }
    return {
      kind: 'range',
      staffId: targetCtx.staffId,
      voiceIndex: anchorCtx.voiceIndex,
      anchorId: current.id,
      focusId: targetEventId,
    };
  }

  if (current.kind === 'range') {
    const anchorCtx = findEventContext(score, current.anchorId);
    if (!anchorCtx || anchorCtx.staffId !== targetCtx.staffId || anchorCtx.voiceIndex !== targetCtx.voiceIndex) {
      return {
        kind: 'range',
        staffId: targetCtx.staffId,
        voiceIndex: targetCtx.voiceIndex,
        anchorId: targetEventId,
        focusId: targetEventId,
      };
    }
    return {
      kind: 'range',
      staffId: current.staffId,
      voiceIndex: anchorCtx.voiceIndex,
      anchorId: current.anchorId,
      focusId: targetEventId,
    };
  }

  return current;
}

/**
 * Returns measure range span and event count for a list of events.
 */
export function getRangeMeasureSpan(
  score: Score,
  events: ScoreEvent[]
): { startMeasureNumber: number; endMeasureNumber: number; count: number } {
  if (events.length === 0) {
    return { startMeasureNumber: 1, endMeasureNumber: 1, count: 0 };
  }

  const eventIds = new Set(events.map((e) => e.id));
  let minMeasureNumber = Infinity;
  let maxMeasureNumber = -Infinity;

  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
        const mDef = score.measures[mIdx];
        const staffMeasure = staff.measures[mDef.id];
        if (!staffMeasure) continue;
        for (const voice of staffMeasure.voices) {
          for (const ev of voice.events) {
            if (eventIds.has(ev.id)) {
              const mNum = mIdx + 1;
              if (mNum < minMeasureNumber) minMeasureNumber = mNum;
              if (mNum > maxMeasureNumber) maxMeasureNumber = mNum;
            }
          }
        }
      }
    }
  }

  return {
    startMeasureNumber: minMeasureNumber === Infinity ? 1 : minMeasureNumber,
    endMeasureNumber: maxMeasureNumber === -Infinity ? 1 : maxMeasureNumber,
    count: events.length,
  };
}


/**
 * Checks whether an event exists in the score.
 */
export function eventExists(score: Score, eventId: string): boolean {
  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (const mDef of score.measures) {
        const sm = staff.measures[mDef.id];
        if (!sm) continue;
        for (const v of sm.voices) {
          if (v.events.some((e) => e.id === eventId)) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Returns the next or previous event ID in reading order on a staff, restricted to the active voice.
 */
export function nextEventId(
  score: Score,
  staffId: string,
  currentId: string | null,
  direction: 'prev' | 'next',
  targetVoiceIndex?: 1 | 2 | 3 | 4
): string | null {
  const staff = score.parts.flatMap((p) => p.staves).find((s) => s.id === staffId);
  if (!staff) return null;

  const currentCtx = currentId ? findEventContext(score, currentId) : null;
  const vIndex = targetVoiceIndex ?? currentCtx?.voiceIndex ?? 1;
  const ordered = getOrderedVoiceEvents(score, staffId, vIndex);

  if (ordered.length === 0) return null;

  if (!currentId) {
    return direction === 'next' ? ordered[0].event.id : ordered[ordered.length - 1].event.id;
  }

  const idx = ordered.findIndex((item) => item.event.id === currentId);
  if (idx === -1) {
    return direction === 'next' ? ordered[0].event.id : ordered[ordered.length - 1].event.id;
  }

  if (direction === 'next') {
    return idx < ordered.length - 1 ? ordered[idx + 1].event.id : ordered[idx].event.id;
  } else {
    return idx > 0 ? ordered[idx - 1].event.id : ordered[idx].event.id;
  }
}
