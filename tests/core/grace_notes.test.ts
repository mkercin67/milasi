// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-3b part 1: grace notes in the model (belong to the following main note, no duration in the bar).
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { addGraceNote, clearGraceNotes, removeGraceNote } from '../../src/core/notationCommands';
import { deleteEvent, transposeRange } from '../../src/core/commands';
import { pasteEvents } from '../../src/core/clipboard';
import { validateScore } from '../../src/core/validate';
import type { GraceNote, NoteEvent, Score } from '../../src/core/model';
import type { RangeSelection } from '../../src/core/selection';

const G = (step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', octave = 5, kind: GraceNote['kind'] = 'acciaccatura'): GraceNote => ({
  kind,
  pitch: createPitch(step, octave, 0),
  baseType: '16th',
});

function setup(): { score: Score; ids: string[] } {
  const score = createEmptyScore({ numMeasures: 2 });
  const evs = [
    createNote({ pitches: [createPitch('E', 5, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('G', 5, 0)], baseType: 'quarter' }),
    createRest({ baseType: 'quarter' }),
    createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'quarter' }),
  ];
  score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events = evs;
  return { score, ids: evs.map((e) => e.id) };
}

function events(score: Score, m = 0) {
  return score.parts[0].staves[0].measures[score.measures[m].id].voices[0].events;
}

describe('grace notes, model and commands (M7c-3b)', () => {
  it('GN1: add appends in order, an index inserts, remove takes the last or the given one, clear drops all', () => {
    const { score, ids } = setup();
    let s = addGraceNote(ids[0], G('D')).apply(score);
    s = addGraceNote(ids[0], G('C')).apply(s);
    s = addGraceNote(ids[0], G('F'), 0).apply(s);
    expect((events(s)[0] as NoteEvent).graces!.map((g) => g.pitch.step)).toEqual(['F', 'D', 'C']);
    s = removeGraceNote(ids[0]).apply(s);
    expect((events(s)[0] as NoteEvent).graces!.map((g) => g.pitch.step)).toEqual(['F', 'D']);
    s = removeGraceNote(ids[0], 0).apply(s);
    expect((events(s)[0] as NoteEvent).graces!.map((g) => g.pitch.step)).toEqual(['D']);
    s = removeGraceNote(ids[0]).apply(s);
    expect((events(s)[0] as NoteEvent).graces).toBeUndefined();
    s = clearGraceNotes(ids[0]).apply(addGraceNote(ids[0], G('D')).apply(s));
    expect((events(s)[0] as NoteEvent).graces).toBeUndefined();
  });

  it('GN2: at most four grace notes; the fifth is refused', () => {
    const { score, ids } = setup();
    let s = score;
    for (let i = 0; i < 6; i++) s = addGraceNote(ids[0], G('D')).apply(s);
    expect((events(s)[0] as NoteEvent).graces).toHaveLength(4);
  });

  it('GN3: a rest and an unknown id are refused without changing the score', () => {
    const { score, ids } = setup();
    expect(addGraceNote(ids[2], G('D')).apply(score)).toBe(score);
    expect(addGraceNote('no-such-id', G('D')).apply(score)).toBe(score);
    expect(removeGraceNote(ids[0]).apply(score)).toBe(score);
  });

  it('GN4: commands do not mutate the input and copy the pitch', () => {
    const { score, ids } = setup();
    const before = JSON.stringify(score);
    const grace = G('D');
    const s = addGraceNote(ids[0], grace).apply(score);
    expect(JSON.stringify(score)).toBe(before);
    expect((events(s)[0] as NoteEvent).graces![0].pitch).not.toBe(grace.pitch);
  });

  it('GN5: grace notes take no time: the bar stays valid with graces on every note', () => {
    const { score, ids } = setup();
    let s = score;
    for (const id of [ids[0], ids[1], ids[3]]) s = addGraceNote(id, G('D')).apply(s);
    expect(validateScore(s).filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('GN6: validation rejects unknown kind, unsupported duration, more than four, bad pitch and graces on a rest', () => {
    const { score, ids } = setup();
    const base = addGraceNote(ids[0], G('D')).apply(score);
    const mutate = (fn: (n: NoteEvent) => void, onRest = false): Score => {
      const c = structuredClone(base);
      if (onRest) (events(c)[2] as unknown as { graces: unknown }).graces = [G('D')];
      else fn(events(c)[0] as NoteEvent);
      return c;
    };
    const bad = (s: Score) => validateScore(s).some((p) => p.code === 'invalid-grace-note');
    expect(bad(base)).toBe(false);
    expect(bad(mutate((n) => ((n.graces![0] as unknown as { kind: string }).kind = 'wobble')))).toBe(true);
    expect(bad(mutate((n) => ((n.graces![0] as unknown as { baseType: string }).baseType = 'quarter')))).toBe(true);
    expect(bad(mutate((n) => n.graces!.push(...[G('C'), G('D'), G('E'), G('F')])))).toBe(true);
    expect(bad(mutate((n) => ((n.graces![0].pitch as unknown as { step: string }).step = 'H')))).toBe(true);
    expect(bad(mutate(() => undefined, true))).toBe(true);
  });

  it('GN7: transposing a range moves the grace notes with their main note and respects the MIDI bounds', () => {
    const { score, ids } = setup();
    const s = addGraceNote(ids[0], G('D', 5)).apply(score);
    const range: RangeSelection = {
      kind: 'range',
      staffId: score.parts[0].staves[0].id,
      voiceIndex: 1,
      anchorId: ids[0],
      focusId: ids[1],
    };
    const up = transposeRange(range, 2).apply(s);
    const moved = (events(up)[0] as NoteEvent).graces![0].pitch;
    expect([moved.step, moved.octave]).toEqual(['E', 5]);
    const high = addGraceNote(ids[0], G('C', 8)).apply(s);
    let threw = false;
    try {
      transposeRange(range, 12).apply(high);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('GN8: deleting the main note removes its grace notes with it', () => {
    const { score, ids } = setup();
    const s = addGraceNote(ids[0], G('D')).apply(score);
    const d = deleteEvent(ids[0]).apply(s);
    expect(JSON.stringify(d)).not.toContain('acciaccatura');
  });

  it('GN9: copy and paste carry the grace notes (deep copy) and the ornament', () => {
    const { score, ids } = setup();
    const s = addGraceNote(ids[0], G('D', 5, 'appoggiatura')).apply(score);
    const src = events(s)[0] as NoteEvent;
    const withOrn: NoteEvent = { ...src, ornament: 'trill' };
    const pasted = pasteEvents(
      s,
      {
        staffId: s.parts[0].staves[0].id,
        voiceIndex: 1,
        startMeasureId: s.measures[1].id,
        startOffsetTicks: 0,
      },
      [withOrn]
    );
    const copy = events(pasted, 1)[0] as NoteEvent;
    expect(copy.graces).toEqual(src.graces);
    expect(copy.graces).not.toBe(src.graces);
    expect(copy.ornament).toBe('trill');
    expect(copy.id).not.toBe(src.id);
  });
});
