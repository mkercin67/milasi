// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import {
  advanceCursor,
  cycleVoice,
  enterNote,
  moveCursorToAdjacentMeasure,
  moveCursorToMeasureBoundary,
  moveCursorToScoreBoundary,
  ScoreCursor,
} from '../../src/core/input';
import { validateScore } from '../../src/core/validate';
import type { Score } from '../../src/core/model';

function cursorAt(
  score: Score,
  measureIndex: number,
  tick: number,
  voiceIndex: ScoreCursor['voiceIndex'] = 1
): ScoreCursor {
  return {
    staffId: score.parts[0].staves[0].id,
    measureId: score.measures[measureIndex].id,
    voiceIndex,
    tick,
  };
}

function enterQuarters(score: Score, start: ScoreCursor, pitches: string[]) {
  let cursor = start;
  for (const p of pitches) {
    score = enterNote(cursor, {
      baseType: 'quarter',
      dots: 0,
      pitch: { step: p[0] as never, octave: parseInt(p[1], 10), alter: 0 },
    }).apply(score);
    cursor = advanceCursor(score, cursor, 960);
  }
  return { score, cursor };
}

function voiceNames(score: Score, measureIndex: number, voiceIndex: number): string[] {
  const sm = score.parts[0].staves[0].measures[score.measures[measureIndex].id];
  const v = sm.voices.find((x) => x.voiceIndex === voiceIndex);
  if (!v) return [];
  return v.events.map((e) =>
    e.kind === 'note' ? `${e.pitches[0].step}${e.pitches[0].octave}` : 'rest'
  );
}

describe('Score-level cursor navigation (U2b)', () => {
  it('T2b-1: moveCursorToScoreBoundary start/end keep staff and voice', () => {
    const score = createEmptyScore({ measures: 3 });
    const c = cursorAt(score, 1, 960, 2);
    const start = moveCursorToScoreBoundary(score, c, 'start');
    expect(start).toEqual({ ...c, measureId: score.measures[0].id, tick: 0 });
    const end = moveCursorToScoreBoundary(score, c, 'end');
    expect(end).toEqual({ ...c, measureId: score.measures[2].id, tick: 3840 });
  });

  it('T2b-2: end boundary of a pickup (actualTicks) last measure uses its real length', () => {
    const score = createEmptyScore({ measures: 2 });
    score.measures[1] = { ...score.measures[1], actualTicks: 960 };
    const c = cursorAt(score, 0, 0);
    expect(moveCursorToScoreBoundary(score, c, 'end').tick).toBe(960);
    // Home/End of the current measure must agree
    const c2 = cursorAt(score, 1, 0);
    expect(moveCursorToMeasureBoundary(score, c2, 'end').tick).toBe(960);
  });

  it('T2b-3: moveCursorToAdjacentMeasure next/prev across three measures and edges', () => {
    const score = createEmptyScore({ measures: 3 });
    const ids = score.measures.map((m) => m.id);

    let c = cursorAt(score, 0, 1920);
    c = moveCursorToAdjacentMeasure(score, c, 'prev'); // inside -> own start
    expect([c.measureId, c.tick]).toEqual([ids[0], 0]);
    c = moveCursorToAdjacentMeasure(score, c, 'prev'); // first measure start stays
    expect([c.measureId, c.tick]).toEqual([ids[0], 0]);
    c = moveCursorToAdjacentMeasure(score, c, 'next');
    expect([c.measureId, c.tick]).toEqual([ids[1], 0]);
    c = moveCursorToAdjacentMeasure(score, c, 'next');
    expect([c.measureId, c.tick]).toEqual([ids[2], 0]);
    c = moveCursorToAdjacentMeasure(score, c, 'next'); // last measure -> append position
    expect([c.measureId, c.tick]).toEqual([ids[2], 3840]);
    c = moveCursorToAdjacentMeasure(score, c, 'prev'); // end -> start of same measure
    expect([c.measureId, c.tick]).toEqual([ids[2], 0]);
    c = moveCursorToAdjacentMeasure(score, c, 'prev');
    expect([c.measureId, c.tick]).toEqual([ids[1], 0]);
  });

  it('T2b-4: functions do not mutate the score or the input cursor', () => {
    const score = createEmptyScore({ measures: 2 });
    const c = cursorAt(score, 1, 960, 3);
    const snapshot = JSON.stringify(score);
    const cSnap = { ...c };
    moveCursorToScoreBoundary(score, c, 'start');
    moveCursorToAdjacentMeasure(score, c, 'prev');
    expect(JSON.stringify(score)).toBe(snapshot);
    expect(c).toEqual(cSnap);
  });

  it('T2b-5: unknown measure id returns an unchanged copy', () => {
    const score = createEmptyScore({ measures: 2 });
    const c: ScoreCursor = { ...cursorAt(score, 0, 480), measureId: 'nope' };
    expect(moveCursorToAdjacentMeasure(score, c, 'next')).toEqual(c);
    expect(moveCursorToAdjacentMeasure(score, c, 'prev')).toEqual(c);
  });

  it('T1b: two-voice entry over two measures with Ctrl+Home / Ctrl+Right (the reported drift case)', () => {
    let score = createEmptyScore({ measures: 2 });
    const m = score.measures.map((x) => x.id);

    // Voice 1: 4 quarters in measure 1, Ctrl+Right, 4 quarters in measure 2
    let r = enterQuarters(score, cursorAt(score, 0, 0), ['C5', 'D5', 'E5', 'F5']);
    score = r.score;
    // advanceCursor rolls into measure 2 by itself; Ctrl+Right from measure 1 reaches the same place
    let cursor = r.cursor;
    expect([cursor.measureId, cursor.tick]).toEqual([m[1], 0]);
    expect(moveCursorToAdjacentMeasure(score, cursorAt(score, 0, 3840), 'next')).toEqual(cursor);
    r = enterQuarters(score, cursor, ['G5', 'A5', 'B5', 'C6']);
    score = r.score;
    expect(r.cursor.measureId).toBe(m[1]);
    expect(r.cursor.tick).toBe(3840);

    // Ctrl+Home, Tab -> voice 2 at measure 1 tick 0
    cursor = moveCursorToScoreBoundary(score, r.cursor, 'start');
    cursor = cycleVoice(score, cursor, 'next');
    expect([cursor.measureId, cursor.tick, cursor.voiceIndex]).toEqual([m[0], 0, 2]);

    r = enterQuarters(score, cursor, ['C4', 'D4', 'E4', 'F4']);
    score = r.score;
    cursor = r.cursor;
    expect([cursor.measureId, cursor.tick, cursor.voiceIndex]).toEqual([m[1], 0, 2]);
    r = enterQuarters(score, cursor, ['G4', 'A4', 'B4', 'C5']);
    score = r.score;

    expect(voiceNames(score, 0, 1)).toEqual(['C5', 'D5', 'E5', 'F5']);
    expect(voiceNames(score, 0, 2)).toEqual(['C4', 'D4', 'E4', 'F4']);
    expect(voiceNames(score, 1, 1)).toEqual(['G5', 'A5', 'B5', 'C6']);
    expect(voiceNames(score, 1, 2)).toEqual(['G4', 'A4', 'B4', 'C5']);
    expect(validateScore(score).filter((e) => e.severity === 'error')).toHaveLength(0);
  });
});
