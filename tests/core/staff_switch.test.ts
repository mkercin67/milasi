// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createGrandStaffScore, createNote, createPitch, createEmptyScore } from '../../src/core/factory';
import { moveCursorToStaff, type ScoreCursor } from '../../src/core/input';
import { staffPosition } from '../../src/core/staffLookup';
import type { Score } from '../../src/core/model';

function piano(): { score: Score; upper: string; lower: string; m1: string; m2: string } {
  const score = createGrandStaffScore({ measures: 2 });
  const [a, b] = score.parts[0].staves;
  const [d1, d2] = score.measures;
  a.measures[d1.id].voices[0].events = [0, 1, 2, 3].map(() => createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' }));
  b.measures[d1.id].voices[0].events = [
    createNote({ pitches: [createPitch('C', 3)], baseType: 'half' }),
    createNote({ pitches: [createPitch('G', 2)], baseType: 'half' }),
  ];
  return { score, upper: a.id, lower: b.id, m1: d1.id, m2: d2.id };
}

const cur = (staffId: string, measureId: string, tick: number, voiceIndex: ScoreCursor['voiceIndex'] = 1): ScoreCursor => ({
  staffId,
  measureId,
  tick,
  voiceIndex,
});

describe('moveCursorToStaff (M7b-3a)', () => {
  it('S1: down from the upper staff lands on the lower staff, same measure, voice and tick', () => {
    const { score, upper, lower, m1 } = piano();
    expect(moveCursorToStaff(score, cur(upper, m1, 0), 'down')).toEqual(cur(lower, m1, 0));
  });

  it('S2: a tick in the middle of a lower-staff event snaps back to that event start, never forward', () => {
    const { score, upper, lower, m1 } = piano();
    // upper staff quarter at tick 960 and 2880; the lower staff has halves starting at 0 and 1920.
    expect(moveCursorToStaff(score, cur(upper, m1, 960), 'down').tick).toBe(0);
    expect(moveCursorToStaff(score, cur(upper, m1, 2880), 'down')).toEqual(cur(lower, m1, 1920));
  });

  it('S3: up from the lower staff goes back to the upper staff', () => {
    const { score, upper, lower, m1 } = piano();
    expect(moveCursorToStaff(score, cur(lower, m1, 1920), 'up')).toEqual(cur(upper, m1, 1920));
  });

  it('S4: no wrap: up on the first staff and down on the last staff keep the cursor', () => {
    const { score, upper, lower, m1 } = piano();
    expect(moveCursorToStaff(score, cur(upper, m1, 960), 'up')).toEqual(cur(upper, m1, 960));
    expect(moveCursorToStaff(score, cur(lower, m1, 960), 'down')).toEqual(cur(lower, m1, 960));
  });

  it('S5: a single-staff score and an unknown staff id leave the cursor unchanged', () => {
    const single = createEmptyScore({ measures: 1 });
    const st = single.parts[0].staves[0];
    const m = single.measures[0].id;
    expect(moveCursorToStaff(single, cur(st.id, m, 0), 'down')).toEqual(cur(st.id, m, 0));
    expect(moveCursorToStaff(single, cur('nope', m, 480), 'up')).toEqual(cur('nope', m, 480));
  });

  it('S6: the voice index is kept; a missing voice on the target staff keeps the tick (virtual cursor)', () => {
    const { score, upper, lower, m1 } = piano();
    expect(moveCursorToStaff(score, cur(upper, m1, 960, 2), 'down')).toEqual(cur(lower, m1, 960, 2));
  });

  it('S7: switching staff never mutates the score', () => {
    const { score, upper, m1 } = piano();
    const before = JSON.stringify(score);
    moveCursorToStaff(score, cur(upper, m1, 960), 'down');
    expect(JSON.stringify(score)).toBe(before);
  });

  it('S8: staffPosition reports the index inside the part and the staff count', () => {
    const { score, upper, lower } = piano();
    expect(staffPosition(score, upper)).toEqual({ index: 1, total: 2 });
    expect(staffPosition(score, lower)).toEqual({ index: 2, total: 2 });
    expect(staffPosition(score, 'nope')).toBeUndefined();
    const single = createEmptyScore({ measures: 1 });
    expect(staffPosition(single, single.parts[0].staves[0].id)).toEqual({ index: 1, total: 1 });
  });
});
