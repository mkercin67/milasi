// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-6 step 1: ensemble commands (parts, groups, templates) and group validation.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { addPart, applyTemplate, movePart, removeGroup, removePart, setGroup } from '../../src/core/ensembleCommands';
import { validateScore } from '../../src/core/validate';
import type { Score } from '../../src/core/model';

const base = (): Score => createEmptyScore({ numMeasures: 3 });
const names = (s: Score) => s.parts.map((p) => p.name).join(',');
const codes = (s: Score) => validateScore(s).map((p) => p.code);

describe('M7c-6 ensemble commands (step 1)', () => {
  it('E1: addPart appends a part with a rest-filled staff in every measure and a fresh MIDI channel', () => {
    const s = addPart('viola').apply(base());
    expect(s.parts.length).toBe(2);
    const p = s.parts[1];
    expect(p.name).toBe('Viola');
    expect(p.staves[0].clef.sign).toBe('C');
    expect(Object.keys(p.staves[0].measures).length).toBe(3);
    expect(p.midiChannel === s.parts[0].midiChannel).toBe(false);
    expect(codes(s)).toEqual([]);
  });

  it('E2: addPart after a given part inserts there; unknown preset or part changes nothing', () => {
    let s = addPart('cello').apply(base());
    s = addPart('viola', s.parts[0].id).apply(s);
    expect(names(s)).toBe('Treble,Viola,Cello');
    const before = s;
    expect(addPart('nope').apply(before)).toBe(before);
    expect(addPart('viola', 'missing').apply(before)).toBe(before);
  });

  it('E3: a piano preset creates one part with two staves (treble, bass)', () => {
    const s = addPart('piano').apply(base());
    const p = s.parts[1];
    expect(p.staves.length).toBe(2);
    expect(p.staves[0].clef.sign).toBe('G');
    expect(p.staves[1].clef.sign).toBe('F');
  });

  it('E4: removePart removes the part and cleans groups; the last part cannot be removed', () => {
    let s = applyTemplate('stringQuartet').apply(base());
    expect(s.parts.length).toBe(4);
    const gone = s.parts[1].id;
    s = removePart(gone).apply(s);
    expect(s.parts.length).toBe(3);
    expect(s.groups[0].partIds.includes(gone)).toBe(false);
    expect(s.groups[0].partIds.length).toBe(3);
    const single = base();
    expect(removePart(single.parts[0].id).apply(single)).toBe(single);
  });

  it('E5: removePart drops a group that became empty', () => {
    let s = addPart('piano').apply(base());
    s = setGroup([s.parts[1].id], 'brace', 'through').apply(s);
    expect(s.groups.length).toBe(1);
    s = removePart(s.parts[1].id).apply(s);
    expect(s.groups.length).toBe(0);
  });

  it('E6: movePart swaps neighbours and stops at the ends', () => {
    let s = addPart('cello').apply(base());
    s = movePart(s.parts[1].id, -1).apply(s);
    expect(names(s)).toBe('Cello,Treble');
    const same = movePart(s.parts[0].id, -1).apply(s);
    expect(same).toBe(s);
  });

  it('E7: setGroup needs existing adjacent parts, replaces a group over the same parts and refuses crossings', () => {
    let s = applyTemplate('satb').apply(base());
    const ids = s.parts.map((p) => p.id);
    expect(s.groups.length).toBe(1);
    s = setGroup(ids, 'brace', 'through').apply(s);
    expect(s.groups.length).toBe(1);
    expect(s.groups[0].bracket).toBe('brace');
    const nested = setGroup([ids[0], ids[1]], 'bracket', 'through').apply(s);
    expect(nested.groups.length).toBe(2);
    const crossingGroup = setGroup([ids[1], ids[2]], 'bracket', 'through').apply(nested);
    expect(crossingGroup).toBe(nested);
    expect(setGroup([ids[0], ids[2]], 'bracket', 'through').apply(s)).toBe(s);
    expect(setGroup(['missing'], 'bracket', 'through').apply(s)).toBe(s);
  });

  it('E8: removeGroup removes by id', () => {
    const s = applyTemplate('satb').apply(base());
    const s2 = removeGroup(s.groups[0].id).apply(s);
    expect(s2.groups.length).toBe(0);
    expect(removeGroup('missing').apply(s2)).toBe(s2);
  });

  it('E9: applyTemplate replaces an empty score: SATB has four parts, a bracket group with individual barlines', () => {
    const s = applyTemplate('satb').apply(base());
    expect(names(s)).toBe('Soprano,Alto,Tenor,Bass');
    expect(s.groups.length).toBe(1);
    expect(s.groups[0].bracket).toBe('bracket');
    expect(s.groups[0].barlineSpan).toBe('individual');
    expect(new Set(s.parts.map((p) => p.midiChannel)).size).toBe(4);
    expect(s.parts[2].staves[0].clef.octaveShift).toBe(-1);
    expect(codes(s)).toEqual([]);
  });

  it('E10: applyTemplate on a score with music keeps it and adds the template parts', () => {
    const score = base();
    const st = score.parts[0].staves[0];
    const mid = score.measures[0].id;
    st.measures[mid].voices[0].events = [
      createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' }),
    ];
    const s = applyTemplate('voicePiano').apply(score);
    expect(names(s)).toBe('Treble,Voice,Piano');
    expect(s.parts[0].staves[0].measures[mid].voices[0].events[0].kind).toBe('note');
    expect(s.groups.length).toBe(2);
    expect(codes(s)).toEqual([]);
  });

  it('E11: string quartet and voice+piano templates have the documented groups', () => {
    const q = applyTemplate('stringQuartet').apply(base());
    expect(q.groups[0].barlineSpan).toBe('through');
    expect(q.parts[2].staves[0].clef.line).toBe(3);
    const vp = applyTemplate('voicePiano').apply(base());
    expect(vp.groups.map((g) => g.bracket).join(',')).toBe('none,brace');
    expect(vp.parts[1].staves.length).toBe(2);
  });

  it('E12: pickup measures get rests of the pickup length in new parts', () => {
    const score = base();
    score.measures[0].actualTicks = 960;
    const s = addPart('violin').apply(score);
    const ev = s.parts[1].staves[0].measures[s.measures[0].id].voices[0].events;
    expect(ev.reduce((a, e) => a + e.duration, 0)).toBe(960);
  });

  it('E13: validation rejects empty, crossing and non-adjacent groups', () => {
    const s = applyTemplate('satb').apply(base());
    const ids = s.parts.map((p) => p.id);
    const empty: Score = { ...s, groups: [{ id: 'g', partIds: [], bracket: 'bracket', barlineSpan: 'through' }] };
    expect(codes(empty).includes('group-empty')).toBe(true);
    const cross: Score = {
      ...s,
      groups: [
        { id: 'a', partIds: [ids[0], ids[1]], bracket: 'bracket', barlineSpan: 'through' },
        { id: 'b', partIds: [ids[1], ids[2]], bracket: 'bracket', barlineSpan: 'through' },
      ],
    };
    expect(codes(cross).includes('group-crossing')).toBe(true);
    const gap: Score = { ...s, groups: [{ id: 'c', partIds: [ids[0], ids[2]], bracket: 'bracket', barlineSpan: 'through' }] };
    expect(codes(gap).includes('group-not-adjacent')).toBe(true);
  });
});
