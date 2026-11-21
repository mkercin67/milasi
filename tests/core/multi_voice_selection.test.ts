// SPDX-License-Identifier: GPL-3.0-or-later
/** M7a-5: range selection, copy and paste across all voices of a staff. */
import { describe, expect, it } from 'vitest';
import {
  clipboardVoicesFromRange,
  deserializeClipboard,
  deserializeClipboardVoices,
  pasteVoices,
  serializeClipboard,
  serializeClipboardVoices,
} from '../../src/core/clipboard';
import { deleteRange } from '../../src/core/commands';
import { createGrandStaffScore, createNote, createPitch, newId } from '../../src/core/factory';
import type { BaseDurationType, Score, ScoreEvent } from '../../src/core/model';
import { eventsInRange, extendSelection, measureAllVoicesRange, voicesInRange } from '../../src/core/selection';
import { validateScore } from '../../src/core/validate';

const note = (step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A', baseType: BaseDurationType): ScoreEvent =>
  createNote({ pitches: [createPitch(step, 4, 0)], baseType });

/** Two-measure grand staff; the lower staff has voice 1 = four quarters (C D E F) and voice 2 = two halves (G A) in m. 1. */
function buildScore(): { score: Score; staffId: string; v1: ScoreEvent[]; v2: ScoreEvent[] } {
  const score = createGrandStaffScore({ measures: 2, timeSig: { num: 4, den: 4 } });
  const lower = score.parts[0].staves[1];
  const m1 = lower.measures[score.measures[0].id];
  const v1 = [note('C', 'quarter'), note('D', 'quarter'), note('E', 'quarter'), note('F', 'quarter')];
  const v2 = [note('G', 'half'), note('A', 'half')];
  m1.voices[0].events = v1;
  m1.voices.push({ id: newId(), voiceIndex: 2, events: v2 });
  return { score, staffId: lower.id, v1, v2 };
}

const sig = (events: ScoreEvent[]): string[] =>
  events.map((e) => (e.kind === 'note' ? `${e.pitches.map((p) => p.step + p.octave).join('+')}/${e.duration}` : `r/${e.duration}`));

describe('range with allVoices', () => {
  it('V1: covers every voice whose events start inside the tick span of the anchor..focus events', () => {
    const { score, staffId, v1, v2 } = buildScore();
    const range = { staffId, voiceIndex: 1 as const, anchorId: v1[0].id, focusId: v1[1].id };
    expect(eventsInRange(score, range).map((e) => e.id)).toEqual([v1[0].id, v1[1].id]);
    const all = eventsInRange(score, { ...range, allVoices: true }).map((e) => e.id);
    expect(all).toEqual([v1[0].id, v2[0].id, v1[1].id]); // G (half, starts at 0) yes; A (starts at 1920) no
  });

  it('V2: measureAllVoicesRange selects both voices of the whole measure (6 events)', () => {
    const { score, staffId } = buildScore();
    const range = measureAllVoicesRange(score, staffId, score.measures[0].id);
    expect(range).not.toBeNull();
    expect(range?.voiceIndex).toBe(1);
    expect(eventsInRange(score, range!)).toHaveLength(6);
    expect(measureAllVoicesRange(score, 'missing-staff', score.measures[0].id)).toBeNull();
  });

  it('V3: extending an allVoices range keeps the flag; a plain range stays single-voice', () => {
    const { score, staffId, v1 } = buildScore();
    const base = { kind: 'range' as const, staffId, voiceIndex: 1 as const, anchorId: v1[0].id, focusId: v1[0].id };
    const kept = extendSelection(score, { ...base, allVoices: true }, v1[2].id);
    expect(kept.kind === 'range' && kept.allVoices).toBe(true);
    const plain = extendSelection(score, base, v1[2].id);
    expect(plain.kind === 'range' && plain.allVoices).toBeFalsy();
  });

  it('V4: deleteRange with allVoices turns every selected event of both voices into rests', () => {
    const { score, staffId } = buildScore();
    const range = measureAllVoicesRange(score, staffId, score.measures[0].id)!;
    const after = deleteRange(range).apply(score);
    const m1 = after.parts[0].staves[1].measures[score.measures[0].id];
    for (const voice of m1.voices) expect(voice.events.every((e) => e.kind === 'rest')).toBe(true);
    expect(validateScore(after)).toEqual([]);
  });
});

describe('multi-voice clipboard', () => {
  it('V5: voicesInRange lists the voices in ascending order with their events', () => {
    const { score, staffId } = buildScore();
    const range = measureAllVoicesRange(score, staffId, score.measures[0].id)!;
    const voices = voicesInRange(score, range);
    expect(voices.map((v) => [v.voiceIndex, v.events.length, v.leadTicks])).toEqual([
      [1, 4, 0],
      [2, 2, 0],
    ]);
  });

  it('V6: version 2 round-trips; the old single-voice format and version 2 do not read as each other', () => {
    const { score, staffId, v1 } = buildScore();
    const voices = clipboardVoicesFromRange(score, measureAllVoicesRange(score, staffId, score.measures[0].id)!);
    const text = serializeClipboardVoices(voices);
    expect(deserializeClipboardVoices(text)?.map((v) => v.voiceIndex)).toEqual([1, 2]);
    expect(deserializeClipboard(text)).toBeNull();
    const legacy = serializeClipboard(v1);
    expect(deserializeClipboardVoices(legacy)).toBeNull();
    expect(deserializeClipboard(legacy)).toHaveLength(4);
  });

  it('V7: copying measure 1 (both voices) and pasting it at the start of measure 2 reproduces both voices', () => {
    const { score, staffId } = buildScore();
    const voices = clipboardVoicesFromRange(score, measureAllVoicesRange(score, staffId, score.measures[0].id)!);
    const pasted = pasteVoices(score, { staffId, startMeasureId: score.measures[1].id, startOffsetTicks: 0 }, voices);
    const lower = pasted.parts[0].staves[1];
    const m1 = lower.measures[score.measures[0].id];
    const m2 = lower.measures[score.measures[1].id];
    expect(m2.voices.map((v) => v.voiceIndex)).toEqual([1, 2]);
    for (const vi of [0, 1]) expect(sig(m2.voices[vi].events)).toEqual(sig(m1.voices[vi].events));
    expect(m2.voices[0].events.map((e) => e.id)).not.toEqual(m1.voices[0].events.map((e) => e.id)); // new ids
    expect(validateScore(pasted)).toEqual([]);
  });

  it('V8: a voice that starts later than the span gets leading rests so its offset survives', () => {
    const { score, staffId, v1 } = buildScore();
    // Range: voice 1 events 2..3 (ticks 960..2880); voice 2 has A (start 1920) inside, G (start 0) outside.
    const range = { staffId, voiceIndex: 1 as const, anchorId: v1[1].id, focusId: v1[2].id, allVoices: true };
    const voices = clipboardVoicesFromRange(score, range);
    const second = voices.find((v) => v.voiceIndex === 2)!;
    expect(sig(second.events)).toEqual(['r/960', 'A4/1920']);
  });
});
