// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-3b part 4: playback timing of grace notes ("v1 convention": they take their time from the main note).
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { addGraceNote } from '../../src/core/notationCommands';
import { buildSchedule, graceTicks } from '../../src/playback/schedule';
import type { GraceNote, Score } from '../../src/core/model';

const G = (step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', kind: GraceNote['kind']): GraceNote => ({
  kind,
  pitch: createPitch(step, 5, 0),
  baseType: '16th',
});

// 120 bpm, quarter = 0.5 s; one bar of four quarter notes E5 G5 C5 C5 (E5 is the main note)
function setup(): { score: Score; ids: string[] } {
  const score = createEmptyScore({ numMeasures: 1 });
  const evs = [
    createNote({ pitches: [createPitch('E', 5, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('G', 5, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'quarter' }),
  ];
  score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events = evs;
  return { score, ids: evs.map((e) => e.id) };
}

describe('grace note playback (M7c-3b, v1 convention)', () => {
  it('GP1: graceTicks: an acciaccatura is at most a 32nd, an appoggiatura takes half of the main note, shared', () => {
    expect(graceTicks([{ kind: 'acciaccatura' }], 960)).toEqual([120]);
    expect(graceTicks([{ kind: 'appoggiatura' }], 960)).toEqual([480]);
    expect(graceTicks([{ kind: 'appoggiatura' }, { kind: 'appoggiatura' }], 960)).toEqual([240, 240]);
    // a short main note limits an acciaccatura too: share = 240 / 2 = 120, 240 / 4 = 60
    expect(graceTicks([{ kind: 'acciaccatura' }, { kind: 'acciaccatura' }], 240)).toEqual([60, 60]);
  });

  it('GP2: without grace notes the schedule is unchanged', () => {
    const { score } = setup();
    const notes = buildSchedule(score).notes;
    expect(notes).toHaveLength(4);
    expect(notes.map((n) => n.startSeconds)).toEqual([0, 0.5, 1, 1.5]);
    expect(notes.map((n) => n.durationSeconds)).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('GP3: an acciaccatura sounds first for a 32nd and the main note ends where it always did', () => {
    const { score, ids } = setup();
    const s = addGraceNote(ids[0], G('D', 'acciaccatura')).apply(score);
    const notes = buildSchedule(s).notes;
    expect(notes).toHaveLength(5);
    const grace = notes[0];
    const main = notes[1];
    expect(grace.startSeconds).toBe(0);
    expect(grace.durationSeconds).toBeCloseTo(0.0625, 6); // 120 ticks at 0.5 s per 960
    expect(main.startSeconds).toBeCloseTo(0.0625, 6);
    expect(main.startSeconds + main.durationSeconds).toBeCloseTo(0.5, 6);
    // the notes after it do not move
    expect(notes.slice(2).map((n) => n.startSeconds)).toEqual([0.5, 1, 1.5]);
  });

  it('GP4: an appoggiatura takes half of the main note', () => {
    const { score, ids } = setup();
    const s = addGraceNote(ids[0], G('F', 'appoggiatura')).apply(score);
    const notes = buildSchedule(s).notes;
    expect(notes[0].durationSeconds).toBeCloseTo(0.25, 6);
    expect(notes[1].startSeconds).toBeCloseTo(0.25, 6);
    expect(notes[1].durationSeconds).toBeCloseTo(0.25, 6);
  });

  it('GP5: two grace notes sound one after the other in written order, before the main note', () => {
    const { score, ids } = setup();
    let s = addGraceNote(ids[0], G('C', 'acciaccatura')).apply(score);
    s = addGraceNote(ids[0], G('D', 'acciaccatura')).apply(s);
    const notes = buildSchedule(s).notes;
    expect(notes.slice(0, 3).map((n) => n.midi)).toEqual([72, 74, 76]); // C5 D5 E5
    expect(notes[1].startSeconds).toBeCloseTo(notes[0].startSeconds + notes[0].durationSeconds, 6);
    expect(notes[2].startSeconds).toBeCloseTo(notes[1].startSeconds + notes[1].durationSeconds, 6);
  });

  it('GP6: the grace notes belong to the main note, so the highlight follows it', () => {
    const { score, ids } = setup();
    const s = addGraceNote(ids[0], G('D', 'acciaccatura')).apply(score);
    const notes = buildSchedule(s).notes;
    expect(notes[0].eventId).toBe(ids[0]);
    expect(buildSchedule(s).eventTimes.get(ids[0])).toEqual({ startSeconds: 0, endSeconds: 0.5 });
  });
});
