// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { enterNote, snapCursor } from '../../src/core/input';
import type { Score, ScoreEvent } from '../../src/core/model';
import type { ScoreCursor } from '../../src/core/input';

const setup = (events?: ScoreEvent[]) => {
  const score = createEmptyScore({ measures: 1 });
  const staff = score.parts[0].staves[0];
  const m = score.measures[0].id;
  if (events) staff.measures[m].voices[0].events = events;
  const cursor = (tick: number): ScoreCursor => ({ staffId: staff.id, voiceIndex: 1, measureId: m, tick });
  const eventsOf = (s: Score) => s.parts[0].staves[0].measures[m].voices[0].events;
  return { score, cursor, eventsOf };
};
const C5 = createPitch('C', 5);
const starts = (events: ScoreEvent[]) => {
  let t = 0;
  return events.map((e) => {
    const s = t;
    t += e.duration;
    return { kind: e.kind, start: s, duration: e.duration };
  });
};

describe('note entry inside a rest (M7b-6)', () => {
  it('R1: entering a 16th at tick 720 of a whole-rest measure keeps rests before and after, filling the measure exactly', () => {
    const { score, cursor, eventsOf } = setup();
    const next = enterNote(cursor(720), { baseType: '16th', pitch: C5 }).apply(score);
    const ev = starts(eventsOf(next));
    const note = ev.find((e) => e.kind === 'note');
    expect(note).toEqual({ kind: 'note', start: 720, duration: 240 });
    expect(ev.filter((e) => e.start < 720).every((e) => e.kind === 'rest')).toBe(true);
    expect(ev.filter((e) => e.start < 720).reduce((s, e) => s + e.duration, 0)).toBe(720);
    expect(ev.filter((e) => e.start > 720).every((e) => e.kind === 'rest')).toBe(true);
    const last = ev[ev.length - 1];
    expect(last.start + last.duration).toBe(3840);
    for (let i = 1; i < ev.length; i++) expect(ev[i].start).toBe(ev[i - 1].start + ev[i - 1].duration);
  });

  it('R2: entering inside a later rest of a partly filled measure puts the event after the earlier events', () => {
    const q = createNote({ pitches: [C5], baseType: 'quarter' });
    const { score, cursor, eventsOf } = setup([
      q,
      createRest({ baseType: 'quarter' }),
      createRest({ baseType: 'half' }),
    ]);
    const next = enterNote(cursor(1440), { baseType: 'eighth', pitch: C5 }).apply(score);
    const ev = starts(eventsOf(next));
    expect(ev[0]).toEqual({ kind: 'note', start: 0, duration: 960 });
    const note = ev.filter((e) => e.kind === 'note')[1];
    expect(note).toEqual({ kind: 'note', start: 1440, duration: 480 });
    const last = ev[ev.length - 1];
    expect(last.start + last.duration).toBe(3840);
    for (let i = 1; i < ev.length; i++) expect(ev[i].start).toBe(ev[i - 1].start + ev[i - 1].duration);
    expect(ev.filter((e) => e.start >= 960 && e.start < 1440).reduce((s, e) => s + e.duration, 0)).toBe(480);
  });

  it('R3: a tick that already is an event start behaves as before (no extra rests)', () => {
    const { score, cursor, eventsOf } = setup();
    const next = enterNote(cursor(0), { baseType: 'quarter', pitch: C5 }).apply(score);
    const ev = starts(eventsOf(next));
    expect(ev[0]).toEqual({ kind: 'note', start: 0, duration: 960 });
    expect(ev.slice(1).every((e) => e.kind === 'rest')).toBe(true);
    expect(ev.reduce((s, e) => s + e.duration, 0)).toBe(3840);
  });

  it('R4: snapCursor keeps a tick inside a rest only on request, and always snaps back inside a note', () => {
    const q = createNote({ pitches: [C5], baseType: 'quarter' });
    const { score, cursor } = setup([q, createRest({ baseType: 'quarter' }), createRest({ baseType: 'half' })]);
    expect(snapCursor(score, cursor(1200)).tick).toBe(960);
    expect(snapCursor(score, cursor(1200), { keepInsideRest: true }).tick).toBe(1200);
    expect(snapCursor(score, cursor(400), { keepInsideRest: true }).tick).toBe(0); // inside the note
  });
});
