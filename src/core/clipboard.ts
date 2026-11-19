// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Pure clipboard operations, serialization, duration splitting and pasting.
 */

import { createMeasure, createNote, createRest, newId } from './factory';
import { BaseDurationType, NoteEvent, Pitch, Score, ScoreEvent } from './model';
import { measureTicks } from './time';

export interface ClipboardPayload {
  app: 'scoreforge-clip';
  version: 1;
  events: ScoreEvent[];
}

/** In-memory clipboard fallback if navigator.clipboard is unavailable. */
export let memoryClipboard: ScoreEvent[] = [];

export function setMemoryClipboard(events: ScoreEvent[]): void {
  memoryClipboard = JSON.parse(JSON.stringify(events));
}

export function getMemoryClipboard(): ScoreEvent[] {
  return JSON.parse(JSON.stringify(memoryClipboard));
}

export function serializeClipboard(events: ScoreEvent[]): string {
  const payload: ClipboardPayload = {
    app: 'scoreforge-clip',
    version: 1,
    events,
  };
  return JSON.stringify(payload);
}

export function deserializeClipboard(json: string): ScoreEvent[] | null {
  try {
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.app === 'scoreforge-clip' &&
      parsed.version === 1 &&
      Array.isArray(parsed.events)
    ) {
      return parsed.events as ScoreEvent[];
    }
  } catch {
    // Malformed JSON
  }
  return null;
}

const STANDARD_UNITS: number[] = [3840, 1920, 960, 480, 240, 120];

/**
 * Decomposes a tick count into standard non-dotted duration units.
 */
function decomposeStandardUnits(ticks: number): number[] {
  const units: number[] = [];
  let remaining = ticks;
  for (const unit of STANDARD_UNITS) {
    while (remaining >= unit) {
      units.push(unit);
      remaining -= unit;
    }
  }
  return units;
}

/**
 * Splits duration across barlines into standard non-dotted durations with tie flags.
 */
export function splitDuration(
  ticks: number,
  offsetTicks: number,
  measureTicksTotal: number
): Array<{ ticks: number; tieToNext: boolean }> {
  const result: Array<{ ticks: number; tieToNext: boolean }> = [];
  let remainingTicks = ticks;
  let currentOffset = offsetTicks;

  while (remainingTicks > 0) {
    const spaceInMeasure = measureTicksTotal - currentOffset;
    const chunkTicks = Math.min(remainingTicks, spaceInMeasure);
    const subUnits = decomposeStandardUnits(chunkTicks);

    for (const u of subUnits) {
      result.push({ ticks: u, tieToNext: true });
    }

    remainingTicks -= chunkTicks;
    currentOffset = 0; // Next measure starts at offset 0
  }

  // The very last segment does not tie to a next segment
  if (result.length > 0) {
    result[result.length - 1].tieToNext = false;
  }

  return result;
}

function ticksToBaseType(ticks: number): BaseDurationType {
  switch (ticks) {
    case 3840:
      return 'whole';
    case 1920:
      return 'half';
    case 960:
      return 'quarter';
    case 480:
      return 'eighth';
    case 240:
      return '16th';
    case 120:
      return '32nd';
    default:
      if (ticks >= 3840) return 'whole';
      if (ticks >= 1920) return 'half';
      if (ticks >= 960) return 'quarter';
      if (ticks >= 480) return 'eighth';
      if (ticks >= 240) return '16th';
      return '32nd';
  }
}

/**
 * Pastes events at target position, splitting across barlines with ties and appending measures as needed.
 */
export function pasteEvents(
  score: Score,
  target: { staffId: string; voiceId?: string; voiceIndex?: 1 | 2 | 3 | 4; startMeasureId: string; startOffsetTicks: number },
  pastedEvents: ScoreEvent[],
  placedEventIds?: string[]
): Score {
  if (pastedEvents.length === 0) return score;

  const nextScore: Score = JSON.parse(JSON.stringify(score));
  const staff = nextScore.parts[0]?.staves.find((s) => s.id === target.staffId) ?? nextScore.parts[0]?.staves[0];
  if (!staff) return score;

  let startMIdx = nextScore.measures.findIndex((m) => m.id === target.startMeasureId);
  if (startMIdx === -1) startMIdx = 0;

  // Flatten pasted events into concrete tied slices per measure
  let curMIdx = startMIdx;
  let curOffset = target.startOffsetTicks;

  // Map from measureIndex -> Array of newly placed events
  const measureAdditions = new Map<number, ScoreEvent[]>();

  for (const origEv of pastedEvents) {
    const mDef = nextScore.measures[curMIdx];
    const mTicks = mDef ? measureTicks(mDef.timeSig) : 3840;

    const splits = splitDuration(origEv.duration, curOffset, mTicks);

    for (let sIdx = 0; sIdx < splits.length; sIdx++) {
      const split = splits[sIdx];
      const bType = ticksToBaseType(split.ticks);

      // Append measures if needed
      while (curMIdx >= nextScore.measures.length) {
        const lastM = nextScore.measures[nextScore.measures.length - 1];
        const newM = createMeasure(lastM.timeSig, lastM.keySig);
        nextScore.measures.push(newM);
        const newDur = measureTicks(newM.timeSig);
        for (const p of nextScore.parts) {
          for (const st of p.staves) {
            st.measures[newM.id] = {
              voices: [
                {
                  id: newId(),
                  voiceIndex: (target.voiceIndex ?? 1) as 1 | 2 | 3 | 4,
                  events: [createRest({ baseType: 'whole', duration: newDur, wholeMeasure: true })],
                },
              ],
            };
          }
        }
      }

      let newEv: ScoreEvent;
      if (origEv.kind === 'note') {
        const newPitches: Pitch[] = origEv.pitches.map((p) => ({
          ...p,
          tiedToNext: split.tieToNext ? true : p.tiedToNext,
        }));
        newEv = createNote({
          pitches: newPitches,
          baseType: bType,
          dots: 0,
          dynamic: sIdx === 0 ? origEv.dynamic : undefined,
          articulations: origEv.articulations ? [...origEv.articulations] : undefined,
        });
        if (split.tieToNext) {
          (newEv as NoteEvent).tiedToNext = true;
        }
      } else {
        newEv = createRest({
          baseType: bType,
          duration: split.ticks,
          dots: 0,
        });
      }

      if (placedEventIds) {
        placedEventIds.push(newEv.id);
      }

      if (!measureAdditions.has(curMIdx)) {
        measureAdditions.set(curMIdx, []);
      }
      measureAdditions.get(curMIdx)!.push(newEv);

      curOffset += split.ticks;
      const curMTicks = measureTicks(nextScore.measures[curMIdx].timeSig);
      if (curOffset >= curMTicks) {
        curMIdx++;
        curOffset = 0;
      }
    }
  }

  // Now reconstruct each affected measure's events
  for (let mIdx = startMIdx; mIdx <= curMIdx; mIdx++) {
    if (mIdx >= nextScore.measures.length) break;
    const mDef = nextScore.measures[mIdx];
    const totalMTicks = measureTicks(mDef.timeSig);

    const staffMeasure = staff.measures[mDef.id];
    if (!staffMeasure) continue;

    const voice =
      target.voiceIndex !== undefined
        ? staffMeasure.voices.find((v) => v.voiceIndex === target.voiceIndex)
        : (target.voiceId ? staffMeasure.voices.find((v) => v.id === target.voiceId) : null) ??
          staffMeasure.voices.find((v) => v.voiceIndex === 1);
    if (!voice) continue;

    const existing = voice.events;
    const additions = measureAdditions.get(mIdx) ?? [];
    if (additions.length === 0) continue;

    const pasteStart = mIdx === startMIdx ? target.startOffsetTicks : 0;
    const pasteDur = additions.reduce((acc, e) => acc + e.duration, 0);
    const pasteEnd = pasteStart + pasteDur;

    // Events before pasteStart
    const beforeEvents: ScoreEvent[] = [];
    let t = 0;
    for (const ev of existing) {
      if (t + ev.duration <= pasteStart) {
        beforeEvents.push(ev);
        t += ev.duration;
      } else if (t < pasteStart) {
        // Event overlaps pasteStart: split it into remaining before part
        const beforeTicks = pasteStart - t;
        const subUnits = decomposeStandardUnits(beforeTicks);
        for (const u of subUnits) {
          if (ev.kind === 'note') {
            beforeEvents.push(createNote({ pitches: [...ev.pitches], baseType: ticksToBaseType(u) }));
          } else {
            beforeEvents.push(createRest({ baseType: ticksToBaseType(u), duration: u }));
          }
        }
        t += ev.duration;
      } else {
        t += ev.duration;
      }
    }

    // Existing events after pasteEnd: preserve them!
    const afterEvents: ScoreEvent[] = [];
    let curT = 0;
    for (const ev of existing) {
      const evStart = curT;
      const evEnd = curT + ev.duration;
      curT += ev.duration;

      if (evStart >= pasteEnd) {
        afterEvents.push(ev);
      } else if (evEnd > pasteEnd) {
        const remTicks = evEnd - pasteEnd;
        const subUnits = decomposeStandardUnits(remTicks);
        for (const u of subUnits) {
          if (ev.kind === 'note') {
            afterEvents.push(createNote({ pitches: [...ev.pitches], baseType: ticksToBaseType(u) }));
          } else {
            afterEvents.push(createRest({ baseType: ticksToBaseType(u), duration: u }));
          }
        }
      }
    }

    // If total duration is less than measureTicks, pad with rests
    const curTotalTicks = [...beforeEvents, ...additions, ...afterEvents].reduce((acc, e) => acc + e.duration, 0);
    if (curTotalTicks < totalMTicks) {
      const remainingTicks = totalMTicks - curTotalTicks;
      const subUnits = decomposeStandardUnits(remainingTicks);
      for (const u of subUnits) {
        afterEvents.push(createRest({ baseType: ticksToBaseType(u), duration: u }));
      }
    }

    voice.events = [...beforeEvents, ...additions, ...afterEvents];
  }

  return nextScore;
}
