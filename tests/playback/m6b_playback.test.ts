// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { buildSchedule } from '../../src/playback/schedule';

describe('Milestone 6b: Playback Dynamics, Articulations, and Legato Slurs', () => {
  it('applies dynamics velocities including sfz and fp and persists forward in voice', () => {
    const score = createEmptyScore({ timeSig: { num: 4, den: 4 }, measures: 2 });
    const staff = score.parts[0].staves[0];
    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter', dynamic: 'pp' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }); // should inherit pp (0.25)
    const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter', dynamic: 'sfz' }); // 0.95
    const n4 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter', dynamic: 'fp' }); // 0.85
    staff.measures[score.measures[0].id].voices[0].events = [n1, n2, n3, n4];

    const sched = buildSchedule(score);
    expect(sched.notes[0].velocity).toBeCloseTo(0.25, 2);
    expect(sched.notes[1].velocity).toBeCloseTo(0.25, 2);
    expect(sched.notes[2].velocity).toBeCloseTo(0.95, 2);
    expect(sched.notes[3].velocity).toBeCloseTo(0.85, 2);
  });

  it('applies articulations: staccato halves duration, tenuto full duration and +0.05 velocity, accent +0.15, marcato +0.25 and 0.75 duration', () => {
    const score = createEmptyScore({ timeSig: { num: 4, den: 4 }, measures: 1 });
    const staff = score.parts[0].staves[0];
    const nStaccato = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter', articulations: ['staccato'] });
    const nTenuto = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter', articulations: ['tenuto'] });
    const nAccent = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter', articulations: ['accent'] });
    const nMarcato = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter', articulations: ['marcato'] });
    staff.measures[score.measures[0].id].voices[0].events = [nStaccato, nTenuto, nAccent, nMarcato];

    const sched = buildSchedule(score);
    // At 120 bpm, quarter note is 0.5s
    expect(sched.notes[0].durationSeconds).toBeCloseTo(0.25, 2); // staccato
    expect(sched.notes[1].durationSeconds).toBeCloseTo(0.5, 2); // tenuto full
    expect(sched.notes[1].velocity).toBeCloseTo(0.75, 2); // default 0.7 + 0.05
    expect(sched.notes[2].velocity).toBeCloseTo(0.85, 2); // default 0.7 + 0.15
    expect(sched.notes[3].velocity).toBeCloseTo(0.95, 2); // default 0.7 + 0.25
    expect(sched.notes[3].durationSeconds).toBeCloseTo(0.375, 2); // 0.5 * 0.75
  });

  it('applies slur legato to covered notes: overlaps by 10ms into next note and staccato does not shorten', () => {
    const score = createEmptyScore({ timeSig: { num: 4, den: 4 }, measures: 1 });
    const staff = score.parts[0].staves[0];
    const n1 = createNote({
      pitches: [createPitch('C', 4)],
      baseType: 'quarter',
      articulations: ['staccato'],
    });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const n4 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
    staff.measures[score.measures[0].id].voices[0].events = [n1, n2, n3, n4];
    staff.slurs = [{ id: 'slur-1', startEventId: n1.id, endEventId: n2.id }];

    const sched = buildSchedule(score);
    // At 120 bpm, quarter note is 0.5s.
    // n1 is slurred to n2 with staccato: expect full duration + 10 ms overlap (0.510s) and NO staccato shortening.
    expect(sched.notes[0].durationSeconds).toBeCloseTo(0.510, 3);
    // n2 is the terminal note of the slur: expect full duration (0.500s)
    expect(sched.notes[1].durationSeconds).toBeCloseTo(0.500, 3);
    // n3 and n4 are outside the slur: expect 0.5s
    expect(sched.notes[2].durationSeconds).toBeCloseTo(0.500, 3);
    expect(sched.notes[3].durationSeconds).toBeCloseTo(0.500, 3);

    console.log('[buildSchedule RAW OUTPUT for slurred pair with staccato]:');
    console.log(JSON.stringify(sched.notes.slice(0, 2), null, 2));
  });
});
