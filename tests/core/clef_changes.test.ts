// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-5 part 1: clef changes inside a staff: model, clefAt, commands, validation.
import { describe, expect, it } from 'vitest';
import { clefAt, clefAtMeasureStart } from '../../src/core/clef';
import { createEmptyScore } from '../../src/core/factory';
import { deleteMeasure, removeClefChange, setClefChange } from '../../src/core/structureCommands';
import { validateScore } from '../../src/core/validate';
import type { Clef, Score } from '../../src/core/model';

const TREBLE: Clef = { sign: 'G', line: 2 };
const BASS: Clef = { sign: 'F', line: 4 };
const TENOR: Clef = { sign: 'C', line: 4 };

function base(): { score: Score; staffId: string; m: string[] } {
  const score = createEmptyScore({ numMeasures: 3 });
  return { score, staffId: score.parts[0].staves[0].id, m: score.measures.map((x) => x.id) };
}
const clefName = (c: Clef) => `${c.sign}${c.line}${c.octaveShift ?? ''}`;

describe('M7c-5 clef changes (part 1)', () => {
  it('CC1: without changes clefAt is the opening clef everywhere', () => {
    const { score, m } = base();
    const st = score.parts[0].staves[0];
    expect(clefName(clefAt(score, st, m[0], 0))).toBe('G2');
    expect(clefName(clefAt(score, st, m[2], 3000))).toBe('G2');
  });

  it('CC2: a change holds from its tick onwards, also in later measures', () => {
    const { score, staffId, m } = base();
    const s2 = setClefChange(staffId, m[1], 1920, BASS).apply(score);
    const st = s2.parts[0].staves[0];
    expect(clefName(clefAt(s2, st, m[0], 3000))).toBe('G2');
    expect(clefName(clefAt(s2, st, m[1], 1919))).toBe('G2');
    expect(clefName(clefAt(s2, st, m[1], 1920))).toBe('F4');
    expect(clefName(clefAt(s2, st, m[2], 0))).toBe('F4');
  });

  it('CC3: several changes are kept sorted and each holds until the next', () => {
    const { score, staffId, m } = base();
    let s = setClefChange(staffId, m[1], 960, TENOR).apply(score);
    s = setClefChange(staffId, m[2], 0, TREBLE).apply(s); // differs from tenor, so it is kept
    s = setClefChange(staffId, m[1], 0, BASS).apply(s);
    const st = s.parts[0].staves[0];
    expect((st.clefChanges ?? []).map((c) => `${c.measureId === m[1] ? 1 : 2}@${c.tick}`).join(',')).toBe('1@0,1@960,2@0');
    expect(clefName(clefAt(s, st, m[1], 500))).toBe('F4');
    expect(clefName(clefAt(s, st, m[1], 960))).toBe('C4');
    expect(clefName(clefAt(s, st, m[2], 100))).toBe('G2');
  });

  it('CC4: a change at tick 0 counts for the start of the measure', () => {
    const { score, staffId, m } = base();
    const s = setClefChange(staffId, m[1], 0, TENOR).apply(score);
    const st = s.parts[0].staves[0];
    expect(clefName(clefAtMeasureStart(s, st, m[0]))).toBe('G2');
    expect(clefName(clefAtMeasureStart(s, st, m[1]))).toBe('C4');
  });

  it('CC5: replacing a change, and a change to the clef already in force removes it', () => {
    const { score, staffId, m } = base();
    let s = setClefChange(staffId, m[1], 960, BASS).apply(score);
    s = setClefChange(staffId, m[1], 960, TENOR).apply(s);
    expect((s.parts[0].staves[0].clefChanges ?? []).length).toBe(1);
    expect(clefName((s.parts[0].staves[0].clefChanges ?? [])[0].clef)).toBe('C4');
    s = setClefChange(staffId, m[1], 960, TREBLE).apply(s); // treble is what holds before: the change goes away
    expect(s.parts[0].staves[0].clefChanges).toBeUndefined();
  });

  it('CC6: illegal input leaves the score untouched and the original is never modified', () => {
    const { score, staffId, m } = base();
    expect(setClefChange(staffId, m[0], 0, { sign: 'G', line: 3 }).apply(score)).toBe(score);
    expect(setClefChange(staffId, 'nope', 0, BASS).apply(score)).toBe(score);
    expect(setClefChange(staffId, m[0], 3840, BASS).apply(score)).toBe(score);
    expect(setClefChange(staffId, m[0], -1, BASS).apply(score)).toBe(score);
    expect(setClefChange(staffId, m[0], 1.5, BASS).apply(score)).toBe(score);
    const s2 = setClefChange(staffId, m[0], 960, BASS).apply(score);
    expect(score.parts[0].staves[0].clefChanges).toBeUndefined();
    expect(s2).not.toBe(score);
  });

  it('CC7: removeClefChange removes exactly that change', () => {
    const { score, staffId, m } = base();
    let s = setClefChange(staffId, m[0], 960, BASS).apply(score);
    s = setClefChange(staffId, m[1], 0, TENOR).apply(s);
    const s3 = removeClefChange(staffId, m[0], 960).apply(s);
    expect((s3.parts[0].staves[0].clefChanges ?? []).length).toBe(1);
    expect(removeClefChange(staffId, m[0], 5).apply(s)).toBe(s);
  });

  it('CC8: validation reports invalid clef changes', () => {
    const { score, staffId, m } = base();
    const good = setClefChange(staffId, m[1], 960, BASS).apply(score);
    expect(validateScore(good).some((p) => p.code === 'invalid-clef-change')).toBe(false);
    const cases: ((s: Score) => void)[] = [
      (s) => { s.parts[0].staves[0].clefChanges = [{ measureId: 'gone', tick: 0, clef: BASS }]; },
      (s) => { s.parts[0].staves[0].clefChanges = [{ measureId: m[0], tick: 99999, clef: BASS }]; },
      (s) => { s.parts[0].staves[0].clefChanges = [{ measureId: m[0], tick: 0, clef: { sign: 'G', line: 3 } }]; },
      (s) => { s.parts[0].staves[0].clefChanges = [{ measureId: m[0], tick: 0, clef: BASS }, { measureId: m[0], tick: 0, clef: TENOR }]; },
      (s) => { s.parts[0].staves[0].clefChanges = [{ measureId: m[1], tick: 0, clef: BASS }, { measureId: m[0], tick: 0, clef: TENOR }]; },
    ];
    for (const mutate of cases) {
      const bad = structuredClone(good);
      mutate(bad);
      expect(validateScore(bad).some((p) => p.code === 'invalid-clef-change')).toBe(true);
    }
  });

  it('CC9: deleting a measure removes the clef changes inside it', () => {
    const { score, staffId, m } = base();
    let s = setClefChange(staffId, m[1], 960, BASS).apply(score);
    s = setClefChange(staffId, m[2], 0, TENOR).apply(s);
    const after = deleteMeasure(1).apply(s);
    const changes = after.parts[0].staves[0].clefChanges ?? [];
    expect(changes.length).toBe(1);
    expect(changes[0].measureId).toBe(m[2]);
    expect(validateScore(after).some((p) => p.code === 'invalid-clef-change')).toBe(false);
  });
});
