// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-2b: tuplet (triplet) entry. A group is always complete: the entered event plus its sibling rests.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { setPickup } from '../../src/core/commands';
import { advanceCursor, enterNote, enterRest, planEnter, ScoreCursor } from '../../src/core/input';
import { validateScore } from '../../src/core/validate';
import type { Score, ScoreEvent } from '../../src/core/model';

const T32 = { actual: 3, normal: 2 };

function base() {
  const score = createEmptyScore({ numMeasures: 2 });
  const staffId = score.parts[0].staves[0].id;
  const m0 = score.measures[0].id;
  const cursor: ScoreCursor = { staffId, voiceIndex: 1, measureId: m0, tick: 0 };
  return { score, staffId, m0, cursor };
}
const events = (s: Score, i = 0): ScoreEvent[] => s.parts[0].staves[0].measures[s.measures[i].id].voices[0].events;
const total = (s: Score, i = 0) => events(s, i).reduce((n, e) => n + e.duration, 0);
const pitch = createPitch('E', 5, 0);

describe('tuplet entry', () => {
  it('TU1: the first triplet sixteenth creates a complete group of three 160-tick events', () => {
    const { score, cursor } = base();
    const out = enterNote(cursor, { baseType: '16th', pitch, tuplet: T32 }).apply(score);
    const evs = events(out);
    expect(evs.slice(0, 3).map((e) => [e.kind, e.duration])).toEqual([['note', 160], ['rest', 160], ['rest', 160]]);
    expect(evs.slice(0, 3).every((e) => e.tuplet?.actual === 3 && e.tuplet?.normal === 2)).toBe(true);
    expect(total(out)).toBe(3840);
  });

  it('TU2: the next two entries replace the sibling rests, the group stays three events', () => {
    let { score, cursor } = base();
    for (let i = 0; i < 3; i++) {
      score = enterNote(cursor, { baseType: '16th', pitch, tuplet: T32 }).apply(score);
      cursor = advanceCursor(score, cursor, 160);
    }
    const evs = events(score);
    expect(evs.slice(0, 3).map((e) => e.kind)).toEqual(['note', 'note', 'note']);
    expect(evs.slice(0, 3).map((e) => e.duration)).toEqual([160, 160, 160]);
    expect(cursor.tick).toBe(480);
    expect(total(score)).toBe(3840);
    expect(validateScore(score).filter((p) => p.code.includes('tuplet'))).toEqual([]);
  });

  it('TU3: the opening bar of Barge BWV 1030 fills exactly 3840 ticks with two triplet groups', () => {
    let { score, cursor } = base();
    const seq: Array<['eighth' | 'quarter' | '16th', boolean]> = [
      ['eighth', false], ['quarter', false], ['16th', true], ['16th', true], ['16th', true],
      ['eighth', false], ['quarter', false], ['16th', true], ['16th', true], ['16th', true],
    ];
    for (const [bt, tup] of seq) {
      const spec = { baseType: bt, pitch, ...(tup ? { tuplet: T32 } : {}) };
      score = enterNote(cursor, spec).apply(score);
      cursor = advanceCursor(score, cursor, bt === 'eighth' ? 480 : bt === 'quarter' ? 960 : 160);
    }
    expect(events(score).every((e) => e.kind === 'note')).toBe(true);
    expect(total(score)).toBe(3840);
    expect(validateScore(score).filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('TU4: a plain note cannot overwrite a tuplet slot', () => {
    const { score, cursor } = base();
    const withGroup = enterNote(cursor, { baseType: '16th', pitch, tuplet: T32 }).apply(score);
    const plan = planEnter(withGroup, cursor, { kind: 'note', baseType: '16th', pitch });
    expect(plan.ok).toBe(false);
  });

  it('TU5: a group that does not fit before the barline is rejected', () => {
    const { score, cursor } = base();
    const late = { ...cursor, tick: 3840 - 240 };
    expect(planEnter(score, late, { kind: 'note', baseType: '16th', pitch, tuplet: T32 }).ok).toBe(false);
    const fits = { ...cursor, tick: 3840 - 480 };
    expect(planEnter(score, fits, { kind: 'note', baseType: '16th', pitch, tuplet: T32 }).ok).toBe(true);
  });

  it('TU6: a triplet rest entry also makes a complete group', () => {
    const { score, cursor } = base();
    const out = enterRest(cursor, { baseType: 'eighth', tuplet: T32 }).apply(score);
    expect(events(out).slice(0, 3).map((e) => [e.kind, e.duration])).toEqual([['rest', 320], ['rest', 320], ['rest', 320]]);
    expect(total(out)).toBe(3840);
  });

  it('TU7: validation warns about an incomplete group and rejects a wrong duration', () => {
    const { score, m0 } = base();
    const lonely = createNote({ pitches: [pitch], baseType: '16th', tuplet: T32 });
    const out = JSON.parse(JSON.stringify(score)) as Score;
    out.parts[0].staves[0].measures[m0].voices[0].events = [lonely, createRest({ baseType: 'half' })];
    const codes = validateScore(out).map((p) => p.code);
    expect(codes).toContain('incomplete-tuplet');
    const broken = JSON.parse(JSON.stringify(score)) as Score;
    const bad = createNote({ pitches: [pitch], baseType: '16th', tuplet: T32 });
    bad.duration = 240;
    broken.parts[0].staves[0].measures[m0].voices[0].events = [bad];
    expect(validateScore(broken).map((p) => p.code)).toContain('tuplet-duration-mismatch');
  });

  it('TU8: entry in a pickup measure respects the pickup length', () => {
    const { score, cursor, m0 } = base();
    const pk = setPickup(m0, 960).apply(score);
    expect(planEnter(pk, { ...cursor, tick: 0 }, { kind: 'note', baseType: 'half', pitch }).ok).toBe(false);
    expect(planEnter(pk, { ...cursor, tick: 480 }, { kind: 'note', baseType: 'eighth', pitch }).ok).toBe(true);
  });
});
