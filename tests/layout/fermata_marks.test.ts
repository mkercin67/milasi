// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-2: fermata, breath mark, caesura. Playback ignores all of them until M11 (interactive pause).
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createGrandStaffScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { cycleFermata, setDynamic, togglePhraseMark } from '../../src/core/commands';
import { validateScore } from '../../src/core/validate';
import { layoutScore } from '../../src/layout/layoutScore';
import { buildNoteheadIndex, layoutDynamics, layoutFermatas } from '../../src/layout/notations';
import type { NoteEvent, Score } from '../../src/core/model';
import type { Selection } from '../../src/core/selection';

function melody(step: 'C' | 'A', octave: number): { score: Score; ids: string[] } {
  const score = createEmptyScore({ numMeasures: 1 });
  const m0 = score.measures[0].id;
  const evs = [
    createNote({ pitches: [createPitch(step, octave, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('E', 4, 0)], baseType: 'quarter' }),
    createRest({ baseType: 'half' }),
  ];
  score.parts[0].staves[0].measures[m0].voices[0].events = evs;
  return { score, ids: evs.map((e) => e.id) };
}

function marks(score: Score) {
  const layout = layoutScore(score, { width: 70 });
  return layoutFermatas(score, layout, buildNoteheadIndex(layout));
}

describe('fermata layout (M7c-2)', () => {
  it('F1: fermata above a stem-down note clears the staff and the stem', () => {
    const { score, ids } = melody('A', 4); // A4 stem down in 4/4 treble: stem goes below, head is high
    const s = cycleFermata(ids[0]).apply(score);
    const [m] = marks(s);
    expect(m.glyph).toBe('fermataAbove');
    expect(m.y).toBeLessThanOrEqual(-1.0);
  });

  it('F2: fermata above a stem-up note sits above the stem top', () => {
    const { score, ids } = melody('C', 4);
    const s = cycleFermata(ids[0]).apply(score);
    const layout = layoutScore(s, { width: 70 });
    const idx = buildNoteheadIndex(layout);
    const [m] = layoutFermatas(s, layout, idx);
    expect(m.y).toBeLessThanOrEqual(idx.get(ids[0])!.topY - 1.0 + 0.001);
  });

  it('F3: second press puts the fermata below the staff, never inside it', () => {
    const { score, ids } = melody('C', 4);
    const s = cycleFermata(ids[0]).apply(cycleFermata(ids[0]).apply(score));
    const [m] = marks(s);
    expect(m.glyph).toBe('fermataBelow');
    expect(m.y).toBeGreaterThanOrEqual(5.0);
  });

  it('F4: a rest can carry a fermata', () => {
    const { score, ids } = melody('C', 4);
    const s = cycleFermata(ids[2]).apply(score);
    const [m] = marks(s);
    expect(m.eventId).toBe(ids[2]);
    expect(m.glyph).toBe('fermataAbove');
  });

  it('F5: breath mark and caesura sit right of the event and above the staff', () => {
    const { score, ids } = melody('C', 4);
    const layout0 = layoutScore(score, { width: 70 });
    const nh = buildNoteheadIndex(layout0).get(ids[0])!;
    const s = togglePhraseMark(ids[1], 'caesura').apply(togglePhraseMark(ids[0], 'breath').apply(score));
    const out = marks(s);
    const breath = out.find((m) => m.glyph === 'breathMarkComma')!;
    const caesura = out.find((m) => m.glyph === 'caesura')!;
    expect(breath.x).toBeGreaterThan(nh.rightX);
    expect(breath.y).toBeLessThan(0);
    expect(caesura.eventId).toBe(ids[1]);
  });

  it('F6: toggling shows the new state without clearing caches', () => {
    const { score, ids } = melody('C', 4);
    expect(marks(score)).toEqual([]);
    const on = cycleFermata(ids[0]).apply(score);
    expect(marks(on)).toHaveLength(1);
    const off = cycleFermata(ids[0]).apply(cycleFermata(ids[0]).apply(on));
    expect(marks(off)).toEqual([]);
    expect(marks(on)).toHaveLength(1);
  });

  it('F7: on a range the next state of the first event is applied to all', () => {
    const { score, ids } = melody('C', 4);
    const staffId = score.parts[0].staves[0].id;
    const sel: Selection = { kind: 'range', staffId, voiceIndex: 1, anchorId: ids[0], focusId: ids[1] };
    const once = cycleFermata(sel).apply(score);
    expect(marks(once).map((m) => m.glyph)).toEqual(['fermataAbove', 'fermataAbove']);
  });

  it('F8: validation rejects unknown values', () => {
    const { score, ids } = melody('C', 4);
    const bad = JSON.parse(JSON.stringify(score)) as Score;
    const ev = bad.parts[0].staves[0].measures[bad.measures[0].id].voices[0].events[0] as NoteEvent;
    (ev as unknown as { fermata: string }).fermata = 'sideways';
    (ev as unknown as { phraseMark: string }).phraseMark = 'sigh';
    const codes = validateScore(bad).map((i) => i.code);
    expect(codes).toContain('invalid-fermata');
    expect(codes).toContain('invalid-phrase-mark');
    expect(ids.length).toBe(3);
  });

  it('F9: on the lower staff of a grand staff the marks follow that staff', () => {
    const score = createGrandStaffScore({ numMeasures: 1 });
    const m0 = score.measures[0].id;
    const low = createNote({ pitches: [createPitch('C', 3, 0)], baseType: 'quarter' });
    score.parts[0].staves[1].measures[m0].voices[0].events = [low];
    const s = togglePhraseMark(low.id, 'breath').apply(cycleFermata(low.id).apply(score));
    const out = marks(s);
    const fermata = out.find((m) => m.glyph === 'fermataAbove')!;
    const breath = out.find((m) => m.glyph === 'breathMarkComma')!;
    expect(breath.y).toBeGreaterThan(5); // lower staff top is 11
    expect(fermata.y).toBeGreaterThan(5);
  });

  it('F10: dynamic on the lower staff sits below that staff, not below the upper one', () => {
    const score = createGrandStaffScore({ numMeasures: 1 });
    const m0 = score.measures[0].id;
    const low = createNote({ pitches: [createPitch('C', 3, 0)], baseType: 'quarter' });
    score.parts[0].staves[1].measures[m0].voices[0].events = [low];
    const s = setDynamic(low.id, 'mf').apply(score);
    const layout = layoutScore(s, { width: 70 });
    const [d] = layoutDynamics(s, layout, buildNoteheadIndex(layout));
    expect(d.y).toBeGreaterThan(15);
  });
});
