// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import { findStaff, firstStaff } from '../../src/core/staffLookup';
import type { Score, Staff } from '../../src/core/model';

function twoStaffScore(): { score: Score; treble: Staff; bass: Staff } {
  const score = createEmptyScore({ measures: 2 });
  const treble = score.parts[0].staves[0];
  const bass: Staff = { id: 'staff-bass', clef: { sign: 'F', line: 4 }, measures: {} };
  score.parts[0].staves.push(bass);
  return { score, treble, bass };
}

describe('staffLookup (M7b-0)', () => {
  it('findStaff returns the staff with that id, also the second one', () => {
    const { score, treble, bass } = twoStaffScore();
    expect(findStaff(score, treble.id)).toBe(treble);
    expect(findStaff(score, bass.id)).toBe(bass);
  });

  it('findStaff searches every part', () => {
    const { score, bass } = twoStaffScore();
    const part2 = { ...score.parts[0], id: 'part-2', staves: [bass] };
    score.parts[0].staves = score.parts[0].staves.filter((s) => s.id !== bass.id);
    score.parts.push(part2);
    expect(findStaff(score, bass.id)).toBe(bass);
  });

  it('findStaff returns undefined for unknown, empty or missing ids', () => {
    const { score } = twoStaffScore();
    expect(findStaff(score, 'nope')).toBeUndefined();
    expect(findStaff(score, '')).toBeUndefined();
    expect(findStaff(score, undefined)).toBeUndefined();
    expect(findStaff(score, null)).toBeUndefined();
  });

  it('firstStaff is the first staff of the first part and tolerates an empty score', () => {
    const { score, treble } = twoStaffScore();
    expect(firstStaff(score)).toBe(treble);
    expect(firstStaff({ ...score, parts: [] })).toBeUndefined();
  });
});
