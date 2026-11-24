// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7b-5 acceptance, Mozart K. 545 mm. 1-7: the hand-entered excerpt (see the fixture header for the
 * source and policy) must lay out, play and round-trip correctly. Literal numbers on purpose: they
 * come from the entered score, not from the code under test.
 */
import { describe, expect, it } from 'vitest';
import type { Score, ScoreEvent } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { layoutScore } from '../../src/layout/layoutScore';
import { buildSchedule } from '../../src/playback/schedule';
import { buildK545Mm1to7 } from '../fixtures/mozartK545Mm1to7';

const pitchName = (p: { step: string; alter: number; octave: number }): string => `${p.step}${p.octave}`;

const events = (score: Score, staffIndex: number, measureIndex: number): ScoreEvent[] => {
  const staff = score.parts[0].staves[staffIndex];
  return staff.measures[score.measures[measureIndex].id].voices[0].events;
};

describe('M7b-5 acceptance: Mozart K. 545 mm. 1-7', () => {
  it('K1: the fixture is a valid grand staff of 7 measures, each exactly 3840 ticks in both hands, with default beaming', () => {
    const score = buildK545Mm1to7();
    expect(validateScore(score)).toEqual([]);
    expect(score.measures).toHaveLength(7);
    expect(score.layoutSettings?.beamGrouping).toBeUndefined();
    for (let staff = 0; staff < 2; staff++) {
      for (let m = 0; m < 7; m++) {
        expect(events(score, staff, m).reduce((t, e) => t + e.duration, 0)).toBe(3840);
      }
    }
  });

  it('K2: the entered notes match the edition: right-hand runs of mm. 5-7 and the left-hand chords of mm. 5-7', () => {
    const score = buildK545Mm1to7();
    const run = (m: number) => events(score, 0, m).map((e) => (e.kind === 'note' ? pitchName(e.pitches[0]) : 'r'));
    expect(run(4)).toHaveLength(15);
    expect(run(4)[0]).toBe('A4');
    expect(run(4)[7]).toBe('A5');
    expect(run(4)[14]).toBe('A4');
    expect(run(5)[0]).toBe('G4');
    expect(run(6)[14]).toBe('F4');
    const chords = [4, 5, 6].flatMap((m) =>
      events(score, 1, m)
        .filter((e) => e.kind === 'note' && e.pitches.length === 2)
        .map((e) => (e.kind === 'note' ? e.pitches.map(pitchName).join('+') : ''))
    );
    expect(chords).toEqual(['F3+C4', 'C3+C4', 'E3+C4', 'D3+C4', 'D3+B3']);
  });

  it('K3: the left hand of mm. 1-4 is an Alberti bass above the bass staff (C4 G4 E4 G4 ...)', () => {
    const score = buildK545Mm1to7();
    const names = (m: number) => events(score, 1, m).map((e) => (e.kind === 'note' ? pitchName(e.pitches[0]) : 'r')).join(' ');
    expect(names(0)).toBe('C4 G4 E4 G4 C4 G4 E4 G4');
    expect(names(1)).toBe('D4 G4 F4 G4 C4 G4 E4 G4');
    expect(names(2)).toBe('C4 A4 F4 A4 C4 G4 E4 G4');
    expect(names(3)).toBe('B3 G4 D4 G4 C4 G4 E4 G4');
  });

  it('K4: a two-note chord is drawn with two noteheads on the same x, one staff space-multiple apart', () => {
    const score = buildK545Mm1to7();
    const chord = events(score, 1, 4)[3];
    const layout = layoutScore(score, { width: 140 });
    const heads = layout.systems
      .flatMap((s) => s.items)
      .filter((i) => i.eventId === chord.id && i.glyph?.startsWith('notehead'));
    expect(heads).toHaveLength(2);
    expect(heads[0].x).toBeCloseTo(heads[1].x, 9);
    expect(Math.abs(heads[0].y - heads[1].y)).toBeCloseTo(2, 9); // F3 and C4: four steps
  });

  it('K5: playback lasts 14 s at 120 bpm and sounds 103 notes (every chord pitch counts)', () => {
    const sched = buildSchedule(buildK545Mm1to7());
    expect(sched.totalSeconds).toBeCloseTo(14, 9);
    expect(sched.notes).toHaveLength(103);
    const first = [...sched.notes].sort((a, b) => a.startSeconds - b.startSeconds)[0];
    expect(first.startSeconds).toBe(0);
  });

  it('K6: the excerpt survives save and load unchanged, including the chords', () => {
    const score = buildK545Mm1to7();
    const loaded = deserializeScore(serializeScore(score));
    expect(loaded.meta.composer).toBe('W. A. Mozart');
    expect(loaded.layoutSettings).toBeUndefined();
    for (let m = 0; m < 7; m++) {
      for (let staff = 0; staff < 2; staff++) {
        const sig = (s: Score) =>
          events(s, staff, m).map((e) =>
            e.kind === 'note' ? `${e.pitches.map(pitchName).join('+')}/${e.duration}` : `r/${e.duration}`
          );
        expect(sig(loaded)).toEqual(sig(score));
      }
    }
  });

  it('K7: the left hand starts in the treble clef and changes to the bass clef at the last quarter of m. 5', () => {
    const score = buildK545Mm1to7();
    const [treble, bass] = score.parts[0].staves;
    expect(treble.clef).toEqual({ sign: 'G', line: 2 });
    expect(bass.clef).toEqual({ sign: 'G', line: 2 });
    expect(bass.clefChanges).toEqual([{ measureId: score.measures[4].id, tick: 2880, clef: { sign: 'F', line: 4 } }]);
  });

  it('K8: the trill sits on the F5 eighth of m. 4 and on no other note', () => {
    const score = buildK545Mm1to7();
    const trilled = [0, 1].flatMap((st) =>
      score.measures.flatMap((_, m) => events(score, st, m).filter((e) => e.kind === 'note' && e.ornament === 'trill'))
    );
    expect(trilled).toHaveLength(1);
    expect(trilled[0].id).toBe(events(score, 0, 3)[1].id);
    expect(trilled[0].kind === 'note' && pitchName(trilled[0].pitches[0])).toBe('F5');
  });

  it('K9: the time signature is written as common time (C)', () => {
    const score = buildK545Mm1to7();
    expect(score.measures.every((m) => m.timeSig.num === 4 && m.timeSig.den === 4 && m.timeSigDisplay === 'common')).toBe(true);
  });

  it('K10: the right hand has two slurs: m. 2 from B4 to the quarter C5 and m. 4 from F5 (eighth) to F5 (last sixteenth)', () => {
    const score = buildK545Mm1to7();
    const slurs = score.parts[0].staves[0].slurs ?? [];
    expect(slurs).toHaveLength(2);
    expect(slurs[0].startEventId).toBe(events(score, 0, 1)[0].id);
    expect(slurs[0].endEventId).toBe(events(score, 0, 1)[3].id);
    expect(slurs[1].startEventId).toBe(events(score, 0, 3)[1].id);
    expect(slurs[1].endEventId).toBe(events(score, 0, 3)[3].id);
    expect(score.parts[0].staves[1].slurs ?? []).toHaveLength(0);
  });
});
