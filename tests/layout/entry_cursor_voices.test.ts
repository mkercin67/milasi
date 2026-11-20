// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';
import { xToCursor, xToEntryCursor } from '../../src/layout/pointerCursor';
import type { Score, NoteEvent, RestEvent } from '../../src/core/model';

function quarters(...steps: string[]): NoteEvent[] {
  return steps.map((s) =>
    createNote({ pitches: [createPitch(s as never, 4)], baseType: 'quarter' })
  );
}

function setVoices(
  score: Score,
  measureIndex: number,
  voices: Array<{ voiceIndex: 1 | 2 | 3 | 4; events: Array<NoteEvent | RestEvent> }>
) {
  const id = score.measures[measureIndex].id;
  score.parts[0].staves[0].measures[id] = {
    voices: voices.map((v) => ({ id: `v${v.voiceIndex}-${measureIndex}`, voiceIndex: v.voiceIndex, events: v.events })),
  };
}

function eventX(layout: ReturnType<typeof layoutScore>, eventId: string): number {
  const it = layout.systems[0].items.find((i) => i.eventId === eventId && i.kind === 'glyph');
  if (!it) throw new Error('event glyph not found');
  return it.x;
}

describe('Mouse entry cursor over several voices (M7a-4 fix)', () => {
  it('T4b: voice 1 rests only, voice 2 has four quarters -> clicking the third note gives tick 1920', () => {
    const score = createEmptyScore({ measures: 2 });
    const v2 = quarters('C', 'D', 'E', 'F');
    setVoices(score, 0, [
      { voiceIndex: 1, events: [createRest({ baseType: 'whole' })] },
      { voiceIndex: 2, events: v2 },
    ]);
    const layout = layoutScore(score, { width: 100 });
    const c = xToEntryCursor(layout, score, 0, eventX(layout, v2[2].id), 2);
    expect(c).not.toBeNull();
    expect(c!.measureId).toBe(score.measures[0].id);
    expect(c!.tick).toBe(1920);
    expect(c!.voiceIndex).toBe(2);
  });

  it('T5b: voice 1 has four quarters, voice 2 does not exist -> beat clicks give the voice-1 beat in voice 2', () => {
    const score = createEmptyScore({ measures: 2 });
    const v1 = quarters('C', 'D', 'E', 'F');
    setVoices(score, 0, [{ voiceIndex: 1, events: v1 }]);
    const layout = layoutScore(score, { width: 100 });
    [0, 960, 1920, 2880].forEach((tick, i) => {
      const c = xToEntryCursor(layout, score, 0, eventX(layout, v1[i].id), 2);
      expect(c).toMatchObject({ voiceIndex: 2, tick });
      expect(c!.measureId).toBe(score.measures[0].id);
    });
  });

  it('T6b: a rest-only voice 2 does not swallow clicks (voice 1 notes decide the beat)', () => {
    const score = createEmptyScore({ measures: 2 });
    const v1 = quarters('C', 'D', 'E', 'F');
    setVoices(score, 0, [
      { voiceIndex: 1, events: v1 },
      { voiceIndex: 2, events: [createRest({ baseType: 'whole' })] },
    ]);
    const layout = layoutScore(score, { width: 100 });
    const c = xToEntryCursor(layout, score, 0, eventX(layout, v1[2].id), 2);
    expect(c!.tick).toBe(1920);
  });

  it('T7b: all voices rests only -> tick 0 across the whole measure', () => {
    const score = createEmptyScore({ measures: 2 });
    setVoices(score, 0, [
      { voiceIndex: 1, events: [createRest({ baseType: 'half' }), createRest({ baseType: 'half' })] },
      { voiceIndex: 2, events: [createRest({ baseType: 'whole' })] },
    ]);
    const layout = layoutScore(score, { width: 100 });
    const b0 = layout.systems[0].items.find((i) => i.id === `barline-${score.measures[0].id}`)!;
    for (const x of [1, b0.x / 2, b0.x - 0.2]) {
      expect(xToEntryCursor(layout, score, 0, x, 2)!.tick).toBe(0);
    }
  });

  it('T8b: pickup measure (actualTicks 960) end of measure uses the real length, not 4/4', () => {
    const score = createEmptyScore({ measures: 2 });
    score.measures[0] = { ...score.measures[0], actualTicks: 960 };
    setVoices(score, 0, [{ voiceIndex: 1, events: quarters('C') }]);
    const layout = layoutScore(score, { width: 100 });
    const b0 = layout.systems[0].items.find((i) => i.id === `barline-${score.measures[0].id}`)!;
    const c = xToCursor(layout, 0, b0.x - 0.2, score);
    expect(c!.tick).toBe(960);
  });

  it('T9b: legacy xToCursor (no options) still looks at voice 1 only', () => {
    const score = createEmptyScore({ measures: 2 });
    const v2 = quarters('C', 'D', 'E', 'F');
    setVoices(score, 0, [
      { voiceIndex: 1, events: [createRest({ baseType: 'whole' })] },
      { voiceIndex: 2, events: v2 },
    ]);
    const layout = layoutScore(score, { width: 100 });
    expect(xToCursor(layout, 0, eventX(layout, v2[2].id), score)!.tick).toBe(0);
  });

  it('T10b: right of the last note of a complete measure the LAST beat is used, never the end tick', () => {
    const score = createEmptyScore({ measures: 2 });
    const v1 = quarters('C', 'D', 'E', 'F');
    const v2 = quarters('G', 'A', 'B', 'C');
    setVoices(score, 0, [
      { voiceIndex: 1, events: v1 },
      { voiceIndex: 2, events: v2 },
    ]);
    const layout = layoutScore(score, { width: 100 });
    const b0 = layout.systems[0].items.find((i) => i.id === `barline-${score.measures[0].id}`)!;
    const c = xToEntryCursor(layout, score, 0, b0.x - 0.2, 2);
    expect(c!.tick).toBe(2880);
    expect(c!.measureId).toBe(score.measures[0].id);
  });

  it('T11b: columnX is the left edge of the shared beat column, equal for both voices', () => {
    const score = createEmptyScore({ measures: 2 });
    const v1 = quarters('C', 'D', 'E', 'F');
    const v2 = quarters('G', 'A', 'B', 'C');
    setVoices(score, 0, [
      { voiceIndex: 1, events: v1 },
      { voiceIndex: 2, events: v2 },
    ]);
    const layout = layoutScore(score, { width: 100 });
    const x = eventX(layout, v1[1].id);
    const a = xToEntryCursor(layout, score, 0, x, 1);
    const b = xToEntryCursor(layout, score, 0, x, 2);
    expect(a!.tick).toBe(960);
    expect(a!.columnX).not.toBeNull();
    expect(a!.columnX).toBeCloseTo(b!.columnX as number, 6);
    expect(a!.columnX as number).toBeLessThanOrEqual(x + 1e-9);
  });

  it('T12b: a measure with rests only has no column (columnX null)', () => {
    const score = createEmptyScore({ measures: 2 });
    const layout = layoutScore(score, { width: 100 });
    const c = xToEntryCursor(layout, score, 0, 5, 2);
    expect(c!.columnX).toBeNull();
    expect(c!.tick).toBe(0);
  });
});
