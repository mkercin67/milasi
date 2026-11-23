// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-6 step 3: braces, brackets and barline spans of ensembles.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createGrandStaffScore, createNote, createPitch } from '../../src/core/factory';
import { applyTemplate, setGroup } from '../../src/core/ensembleCommands';
import { barRules, groupMarks } from '../../src/layout/ensembleLayout';
import { layoutScore } from '../../src/layout/layoutScore';
import type { Score } from '../../src/core/model';
import type { LayoutItem } from '../../src/layout/types';

const make = (t: Parameters<typeof applyTemplate>[0]): Score => applyTemplate(t).apply(createEmptyScore({ numMeasures: 2 }));
const find = (items: LayoutItem[], id: string): LayoutItem | undefined => items.find((it) => it.id === id);

describe('M7c-6 ensemble groups (step 3)', () => {
  it('EG1: a through group draws ONE barline from the first to the last staff', () => {
    const score = make('stringQuartet');
    const r = layoutScore(score);
    const m0 = score.measures[0].id;
    const items = r.systems[0].items;
    const bar = find(items, `barline-${m0}`);
    expect(bar !== undefined).toBe(true);
    const bottom = find(items, 'sys-0-s3-staffline-4');
    expect(bar!.y2).toBe(bottom!.y);
    for (let k = 1; k < 4; k++) expect(find(items, `s${k}-barline-${m0}`)).toBeUndefined();
  });

  it('EG2: an individual group draws a barline per staff and a bracket over all of them', () => {
    const score = make('satb');
    const r = layoutScore(score);
    const m0 = score.measures[0].id;
    const items = r.systems[0].items;
    for (let k = 0; k < 4; k++) {
      const bar = find(items, k === 0 ? `barline-${m0}` : `s${k}-barline-${m0}`);
      expect(bar !== undefined).toBe(true);
      expect(bar!.y2! - bar!.y).toBe(4);
    }
    const bracket = find(items, 'sys-0-sys-bracket-0');
    expect(bracket !== undefined).toBe(true);
    expect(bracket!.spanStaffId).toBe(score.parts[3].staves[0].id);
    expect(find(items, 'sys-0-sys-brace')).toBeUndefined();
  });

  it('EG3: voice + piano: the voice has its own barline, the piano staves share one, the brace covers the piano only', () => {
    const score = make('voicePiano');
    const r = layoutScore(score);
    const m0 = score.measures[0].id;
    const items = r.systems[0].items;
    const voiceBar = find(items, `barline-${m0}`);
    expect(voiceBar!.y2! - voiceBar!.y).toBe(4);
    const pianoBar = find(items, `s1-barline-${m0}`);
    expect(pianoBar!.spanStaffId).toBe(score.parts[1].staves[1].id);
    expect(pianoBar!.y2! - pianoBar!.y).toBe(15);
    expect(find(items, `s2-barline-${m0}`)).toBeUndefined();
    expect(find(items, 'sys-0-sys-brace')).toBeUndefined();
    const brace = items.find((it) => it.glyph === 'brace');
    expect(brace!.scaleY).toBe(15 / 4);
    expect(brace!.staffId).toBe(score.parts[1].staves[0].id);
  });

  it('EG4: a mensurstrich group draws lines only in the gaps between staves', () => {
    let score = make('stringQuartet');
    score = setGroup(score.parts.map((p) => p.id), 'bracket', 'mensurstrich').apply(score);
    const r = layoutScore(score);
    const m0 = score.measures[0].id;
    const items = r.systems[0].items;
    const gap0 = find(items, `barline-${m0}`);
    const topOfStaff1 = find(items, 'sys-0-s1-staffline-0');
    const bottomOfStaff0 = find(items, 'sys-0-staffline-4');
    expect(gap0!.y).toBe(bottomOfStaff0!.y);
    expect(gap0!.y2).toBe(topOfStaff1!.y);
    expect(find(items, `s3-barline-${m0}`)).toBeUndefined();
  });

  it('EG5: nested groups: the inner mark sits to the right of the outer one', () => {
    let score = make('stringQuartet');
    const ids = score.parts.map((p) => p.id);
    score = setGroup([ids[0], ids[1]], 'bracket', 'through').apply(score);
    const marks = groupMarks(score);
    expect(marks.length).toBe(2);
    expect(marks[0].depth).toBe(0);
    expect(marks[1].depth).toBe(1);
    expect(marks[0].to).toBe(3);
    expect(marks[1].to).toBe(1);
  });

  it('EG6: a multi-staff part inside an outer group still gets its own brace', () => {
    const score = make('voicePiano');
    const ids = score.parts.map((p) => p.id);
    const wrapped = setGroup(ids, 'bracket', 'individual').apply({ ...score, groups: [] });
    const kinds = groupMarks(wrapped).map((m) => m.kind);
    expect(kinds.join(',')).toBe('bracket,brace');
  });

  it('EG7: a group with bracket none draws no mark; barline rules follow the smallest group', () => {
    const score = make('voicePiano');
    expect(groupMarks(score).map((m) => m.kind).join(',')).toBe('brace');
    expect(barRules(score).map((r) => r.mode).join(',')).toBe('own,start,skip');
  });

  it('EG8: skyline spacing moves a partial brace and barline with their staves', () => {
    const score = structuredClone(make('voicePiano'));
    const upper = score.parts[1].staves[0];
    upper.measures[score.measures[0].id].voices[0].events = [
      createNote({ pitches: [createPitch('C', 1)], baseType: 'whole' }),
    ];
    const r = layoutScore(score);
    const items = r.systems[0].items;
    const bottom = find(items, 'sys-0-s2-staffline-4');
    const brace = items.find((it) => it.glyph === 'brace');
    const bar = find(items, `s1-barline-${score.measures[0].id}`);
    expect(bottom!.y > 28).toBe(true);
    expect(brace!.y).toBe(bottom!.y);
    expect(bar!.y2).toBe(bottom!.y);
    const top = find(items, 'sys-0-s1-staffline-0');
    expect(brace!.y - brace!.scaleY! * 4).toBe(top!.y);
  });

  it('EG9: the single-part grand staff keeps its brace and through barline exactly as before', () => {
    const score = createGrandStaffScore({ numMeasures: 2 });
    const r = layoutScore(score);
    const brace = find(r.systems[0].items, 'sys-0-sys-brace');
    expect(brace!.y).toBe(15);
    expect(brace!.scaleY).toBe(15 / 4);
    expect(brace!.spanStaffId).toBeUndefined();
    const bar = find(r.systems[0].items, `barline-${score.measures[0].id}`);
    expect(bar!.y2).toBe(15);
    expect(bar!.spanStaffId).toBeUndefined();
  });
});
