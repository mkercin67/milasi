// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Pure clipboard operations, serialization, duration splitting and pasting.
 */

import { createMeasure, createNote, createRest, newId } from './factory';
import { BaseDurationType, NoteEvent, Pitch, Score, ScoreEvent, Voice } from './model';
import { fillMeasureWithRests, measureTicks } from './time';
import { findStaff, firstStaff } from './staffLookup';
import type { RangeSelection } from './selection';
import { voicesInRange } from './selection';

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

/** One voice of a multi-voice clipboard (M7a-5). Leading rests carry the offset of a voice that starts later. */
export interface ClipboardVoice {
  voiceIndex: 1 | 2 | 3 | 4;
  events: ScoreEvent[];
}

export interface ClipboardPayloadV2 {
  app: 'scoreforge-clip';
  version: 2;
  voices: ClipboardVoice[];
}

let memoryVoices: ClipboardVoice[] | null = null;

/** Remembers the last multi-voice copy (null when the last copy was a single-voice copy). */
export function setMemoryClipboardVoices(voices: ClipboardVoice[] | null): void {
  memoryVoices = voices ? JSON.parse(JSON.stringify(voices)) : null;
}

export function getMemoryClipboardVoices(): ClipboardVoice[] | null {
  return memoryVoices ? JSON.parse(JSON.stringify(memoryVoices)) : null;
}

export function serializeClipboardVoices(voices: ClipboardVoice[]): string {
  const payload: ClipboardPayloadV2 = { app: 'scoreforge-clip', version: 2, voices };
  return JSON.stringify(payload);
}

/** Reads a version 2 payload; anything else (including the version 1 single-voice format) gives null. */
export function deserializeClipboardVoices(json: string): ClipboardVoice[] | null {
  try {
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.app === 'scoreforge-clip' &&
      parsed.version === 2 &&
      Array.isArray(parsed.voices) &&
      parsed.voices.every(
        (v: ClipboardVoice) => v && [1, 2, 3, 4].includes(v.voiceIndex) && Array.isArray(v.events)
      )
    ) {
      return parsed.voices as ClipboardVoice[];
    }
  } catch {
    // Malformed JSON
  }
  return null;
}

/**
 * Builds the clipboard voices of a range selection. A voice whose first event starts after the start of the
 * span gets leading rests, so every voice pastes with the right offset.
 */
export function clipboardVoicesFromRange(score: Score, range: RangeSelection): ClipboardVoice[] {
  return voicesInRange(score, range).map((v) => {
    const lead: ScoreEvent[] = [];
    for (const unit of decomposeStandardUnits(v.leadTicks)) {
      lead.push(createRest({ baseType: ticksToBaseType(unit) }));
    }
    return { voiceIndex: v.voiceIndex, events: [...lead, ...v.events] };
  });
}

/**
 * Pastes every voice of a multi-voice clipboard at the target position, each into its own voice index.
 * `placedEventIds` receives the first and last placed event id of the lowest voice (for the new selection).
 */
export function pasteVoices(
  score: Score,
  target: { staffId: string; startMeasureId: string; startOffsetTicks: number },
  voices: ClipboardVoice[],
  placedEventIds?: string[]
): Score {
  let next = score;
  voices.forEach((v, i) => {
    const placed: string[] = [];
    next = pasteEvents(next, { ...target, voiceIndex: v.voiceIndex }, v.events, placed);
    if (i === 0 && placedEventIds) placedEventIds.push(...placed);
  });
  return next;
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
  target: { staffId: string; voiceIndex: 1 | 2 | 3 | 4; startMeasureId: string; startOffsetTicks: number },
  pastedEvents: ScoreEvent[],
  placedEventIds?: string[]
): Score {
  if (pastedEvents.length === 0) return score;

  const nextScore: Score = JSON.parse(JSON.stringify(score));
  const staff = findStaff(nextScore, target.staffId) ?? firstStaff(nextScore);
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
        const hadFinal = lastM?.endBarline === 'final';
        if (hadFinal && lastM) {
          lastM.endBarline = 'single';
        }
        const newM = createMeasure(lastM.timeSig, lastM.keySig, undefined, undefined, hadFinal ? 'final' : 'single');
        nextScore.measures.push(newM);
        const newDur = measureTicks(newM.timeSig);
        for (const p of nextScore.parts) {
          for (const st of p.staves) {
            const vList: Voice[] = [
              {
                id: newId(),
                voiceIndex: 1,
                events: [createRest({ baseType: 'whole', duration: newDur, wholeMeasure: true })],
              },
            ];
            if (target.voiceIndex !== 1) {
              vList.push({
                id: newId(),
                voiceIndex: target.voiceIndex,
                events: fillMeasureWithRests(newDur),
              });
              vList.sort((a, b) => a.voiceIndex - b.voiceIndex);
            }
            st.measures[newM.id] = { voices: vList };
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

    const targetVoiceIndex = target.voiceIndex;
    let voice = staffMeasure.voices.find((v) => v.voiceIndex === targetVoiceIndex);
    if (!voice) {
      // S3: If the target measure lacks that voice, create it with D3 semantics:
      // initial rests filling [0, totalMTicks) via fillMeasureWithRests, sorted by voiceIndex.
      voice = {
        id: newId(),
        voiceIndex: targetVoiceIndex,
        events: fillMeasureWithRests(totalMTicks),
      };
      staffMeasure.voices.push(voice);
      staffMeasure.voices.sort((a, b) => a.voiceIndex - b.voiceIndex);
    }

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
