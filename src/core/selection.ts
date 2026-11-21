// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Core selection helpers and range computations.
 */

import { Score, ScoreEvent } from './model';
import { measureTicks } from './time';

export type Selection =
  | { kind: 'none' }
  | { kind: 'event'; id: string }
  | {
      kind: 'range';
      staffId: string;
      voiceIndex: 1 | 2 | 3 | 4;
      anchorId: string;
      focusId: string;
      /** M7a-5: the range covers every voice of the staff inside the tick span of the anchor..focus events. */
      allVoices?: boolean;
    };

export interface RangeSelection {
  kind?: 'range';
  staffId: string;
  voiceIndex: 1 | 2 | 3 | 4;
  anchorId: string;
  focusId: string;
  allVoices?: boolean;
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

interface TimedEvent {
  event: ScoreEvent;
  voiceIndex: 1 | 2 | 3 | 4;
  startTick: number;
  endTick: number;
}

/** Every event of a staff (all voices) with absolute start/end ticks counted from the first measure. */
function timedStaffEvents(score: Score, staffId: string): TimedEvent[] {
  const result: TimedEvent[] = [];
  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (staff.id !== staffId) continue;
      let measureStart = 0;
      for (const mDef of score.measures) {
        const staffMeasure = staff.measures[mDef.id];
        if (staffMeasure) {
          for (const voice of staffMeasure.voices) {
            let t = measureStart;
            for (const ev of voice.events) {
              result.push({ event: ev, voiceIndex: voice.voiceIndex, startTick: t, endTick: t + ev.duration });
              t += ev.duration;
            }
          }
        }
        measureStart += measureTicks(mDef.timeSig);
      }
    }
  }
  return result;
}

/**
 * Splits the events of a range into voices (ascending voice index, reading order inside a voice).
 * `leadTicks` is the distance between the start of the range span and the first event of that voice.
 */
export function voicesInRange(
  score: Score,
  range: RangeSelection
): Array<{ voiceIndex: 1 | 2 | 3 | 4; events: ScoreEvent[]; leadTicks: number }> {
  const events = eventsInRange(score, range);
  if (events.length === 0) return [];
  const timed = timedStaffEvents(score, range.staffId);
  const byId = new Map(timed.map((t) => [t.event.id, t]));
  const ids = new Set(events.map((e) => e.id));
  const selected = timed.filter((t) => ids.has(t.event.id));
  const spanStart = Math.min(...selected.map((t) => t.startTick));
  const voices = new Map<number, TimedEvent[]>();
  for (const t of selected) {
    const list = voices.get(t.voiceIndex);
    if (list) list.push(t);
    else voices.set(t.voiceIndex, [t]);
  }
  return [...voices.keys()]
    .sort((a, b) => a - b)
    .map((vi) => {
      const list = (voices.get(vi) ?? []).sort((a, b) => a.startTick - b.startTick);
      return {
        voiceIndex: vi as 1 | 2 | 3 | 4,
        events: list.map((t) => byId.get(t.event.id)!.event),
        leadTicks: list[0].startTick - spanStart,
      };
    });
}

/**
 * Returns all events in the specified range in reading order.
 * With `allVoices` the range covers every voice of the staff whose events START inside the tick span of
 * the anchor..focus events of the range voice (events are ordered by start tick, then voice).
 */
export function eventsInRange(
  score: Score,
  range: RangeSelection
): ScoreEvent[] {
  const single = singleVoiceEventsInRange(score, range);
  if (!range.allVoices || single.length === 0) return single;
  const timed = timedStaffEvents(score, range.staffId);
  const first = timed.find((t) => t.event.id === single[0].id);
  const last = timed.find((t) => t.event.id === single[single.length - 1].id);
  if (!first || !last) return single;
  return timed
    .filter((t) => t.startTick >= first.startTick && t.startTick < last.endTick)
    .sort((a, b) => a.startTick - b.startTick || a.voiceIndex - b.voiceIndex)
    .map((t) => t.event);
}

function singleVoiceEventsInRange(
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
      ...(current.allVoices ? { allVoices: true } : {}),
    };
  }

  return current;
}

/**
 * A range that selects every voice of one measure of a staff (M7a-5, Ctrl+Shift+A). The base voice is the
 * lowest voice that has events in the measure. Returns null when the measure has no events.
 */
export function measureAllVoicesRange(score: Score, staffId: string, measureId: string): RangeSelection | null {
  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (staff.id !== staffId) continue;
      const voices = [...(staff.measures[measureId]?.voices ?? [])]
        .filter((v) => v.events.length > 0)
        .sort((a, b) => a.voiceIndex - b.voiceIndex);
      if (voices.length === 0) return null;
      const base = voices[0];
      return {
        kind: 'range',
        staffId,
        voiceIndex: base.voiceIndex,
        anchorId: base.events[0].id,
        focusId: base.events[base.events.length - 1].id,
        allVoices: true,
      };
    }
  }
  return null;
}

/**
 * Returns measure range span and event count for a list of events.
 */
export function getRangeMeasureSpan(
  score: Score,
  events: ScoreEvent[]
): { startMeasureNumber: number; endMeasureNumber: number; count: number; measureCount: number } {
  if (events.length === 0) {
    return { startMeasureNumber: 1, endMeasureNumber: 1, count: 0, measureCount: 0 };
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

  const startMeasureNumber = minMeasureNumber === Infinity ? 1 : minMeasureNumber;
  const endMeasureNumber = maxMeasureNumber === -Infinity ? 1 : maxMeasureNumber;

  return {
    startMeasureNumber,
    endMeasureNumber,
    count: events.length,
    measureCount: endMeasureNumber - startMeasureNumber + 1,
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
