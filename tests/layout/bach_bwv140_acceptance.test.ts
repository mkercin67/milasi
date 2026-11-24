// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7c-9b acceptance, J. S. Bach BWV 140/7 chorale, mm. 1-6 (see the fixture header and
 * docs/review/m7c-9-bach-gaps.md). Literal numbers on purpose.
 */
import { describe, expect, it } from 'vitest';
import type { Score, ScoreEvent } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { layoutScore } from '../../src/layout/layoutScore';
import { buildSchedule } from '../../src/playback/schedule';
import { buildBachBwv140KeyboardMm1to6, buildBachBwv140Mm1to6 } from '../fixtures/bachBwv140Mm1to6';

const name = (e: ScoreEvent): string =>
  e.kind === 'note' ? `${e.pitches[0].step}${e.pitches[0].alter > 0 ? '#' : e.pitches[0].alter < 0 ? 'b' : ''}${e.pitches[0].octave}` : 'r';

const events = (score: Score, part: number, measure: number): ScoreEvent[] =>
  score.parts[part].staves[0].measures[score.measures[measure].id].voices[0].events;

describe('M7c-9b acceptance: Bach BWV 140/7, mm. 1-6', () => {
  it('BA1: SATB in 4/4 and E flat major, every staff measure exactly 3840 ticks, no validation error', () => {
    const score = buildBachBwv140Mm1to6();
    expect(validateScore(score).filter((i) => i.severity === 'error')).toEqual([]);
    expect(score.parts.map((p) => p.name)).toEqual(['Soprano', 'Alto', 'Tenor', 'Bass']);
    expect(score.measures).toHaveLength(6);
    expect(score.measures[0].keySig).toBe(-3);
    for (let p = 0; p < 4; p++) {
      for (let m = 0; m < 6; m++) {
        expect(events(score, p, m).reduce((t, e) => t + e.duration, 0)).toBe(3840);
      }
    }
  });

  it('BA2: the entered notes match the edition at chosen places', () => {
    const score = buildBachBwv140Mm1to6();
    expect(events(score, 0, 0).map(name)).toEqual(['Eb4', 'G4', 'Bb4', 'Bb4']);
    expect(events(score, 1, 0).map(name)).toEqual(['Bb3', 'Eb4', 'G4', 'F4']);
    expect(events(score, 2, 1).map(name)).toEqual(['Eb4', 'Bb3', 'Bb3', 'A3']);
    expect(events(score, 3, 0).map(name)).toEqual(['Eb3', 'Eb3', 'G3', 'Bb3', 'Ab3']);
    expect(events(score, 3, 5).map(name)).toEqual(['Bb2', 'r', 'Eb3', 'Db3']);
    expect(events(score, 0, 2).map(name)).toEqual(['Bb4', 'r', 'Bb4']);
  });

  it('BA3: the fermatas sit on the half notes of mm. 3 and 6 in all four voices, nowhere else', () => {
    const score = buildBachBwv140Mm1to6();
    for (let p = 0; p < 4; p++) {
      const marked: string[] = [];
      for (let m = 0; m < 6; m++) {
        events(score, p, m).forEach((e, i) => {
          if (e.fermata) marked.push(`${m + 1}.${i}`);
        });
      }
      expect(marked).toEqual(['3.0', '6.0']);
    }
  });

  it('BA4: the bass of m. 1 is tied (half note to eighth) and the alto of m. 5 is tied (quarter to eighth)', () => {
    const score = buildBachBwv140Mm1to6();
    const tied = (p: number, m: number) =>
      events(score, p, m).filter((e) => e.kind === 'note' && e.pitches.some((x) => x.tiedToNext)).length;
    expect(tied(3, 0)).toBe(1);
    expect(tied(1, 4)).toBe(1);
    expect(tied(0, 0) + tied(2, 0) + tied(3, 1)).toBe(0);
  });

  it('BA5: lays out with four staves and no non-finite coordinate', () => {
    const layout = layoutScore(buildBachBwv140Mm1to6(), { width: 90 });
    expect(layout.systems.length).toBeGreaterThanOrEqual(1);
    for (const i of layout.systems.flatMap((s) => s.items)) {
      if (typeof i.x === 'number') expect(Number.isFinite(i.x)).toBe(true);
      if (typeof i.y === 'number') expect(Number.isFinite(i.y)).toBe(true);
    }
  });

  it('BA6: round-trips through JSON unchanged', () => {
    const score = buildBachBwv140Mm1to6();
    const again = deserializeScore(serializeScore(score));
    expect(serializeScore(again, undefined, false) === serializeScore(score, undefined, false)).toBe(true);
  });

  it('BA7: plays 12 s at the default tempo (6 bars of 4/4 at 120) with 90 notes (92 written, the two ties merged)', () => {
    const sched = buildSchedule(buildBachBwv140Mm1to6());
    expect(sched.totalSeconds).toBeCloseTo(12, 6);
    expect(sched.notes).toHaveLength(90);
  });

  it('BA8: keyboard layout: one grand-staff part, two voices per staff, every voice exactly 3840 ticks', () => {
    const score = buildBachBwv140KeyboardMm1to6();
    expect(validateScore(score).filter((i) => i.severity === 'error')).toEqual([]);
    expect(score.parts).toHaveLength(1);
    expect(score.parts[0].staves).toHaveLength(2);
    for (const staff of score.parts[0].staves) {
      for (const m of score.measures) {
        const voices = staff.measures[m.id].voices;
        expect(voices.map((v) => v.voiceIndex)).toEqual([1, 2]);
        for (const v of voices) expect(v.events.reduce((t, e) => t + e.duration, 0)).toBe(3840);
      }
    }
  });

  it('BA9: keyboard layout: same notes as the SATB version, fermata above the upper and below the lower staff', () => {
    const score = buildBachBwv140KeyboardMm1to6();
    const voice = (st: number, v: number, m: number) =>
      score.parts[0].staves[st].measures[score.measures[m].id].voices[v - 1].events;
    expect(voice(0, 1, 3).map(name)).toEqual(['Eb5', 'Bb4', 'Eb5', 'F5', 'G5']);
    expect(voice(0, 2, 4).map(name)).toEqual(['Bb4', 'C5', 'C5', 'Bb4', 'A4']);
    expect(voice(1, 1, 1).map(name)).toEqual(['Eb4', 'Bb3', 'Bb3', 'A3']);
    expect(voice(1, 2, 3).map(name)).toEqual(['G3', 'Ab3', 'G3', 'F3', 'Eb3', 'Eb4']);
    expect(voice(0, 1, 2)[0].fermata).toBe('above');
    expect(voice(0, 2, 2)[0].fermata).toBeUndefined();
    expect(voice(1, 2, 5)[0].fermata).toBe('below');
    expect(voice(1, 1, 5)[0].fermata).toBeUndefined();
  });

  it('BA10: keyboard layout lays out (two staves, no non-finite coordinate), round-trips and plays like the SATB version', () => {
    const score = buildBachBwv140KeyboardMm1to6();
    for (const i of layoutScore(score, { width: 90 }).systems.flatMap((s) => s.items)) {
      if (typeof i.x === 'number') expect(Number.isFinite(i.x)).toBe(true);
      if (typeof i.y === 'number') expect(Number.isFinite(i.y)).toBe(true);
    }
    const again = deserializeScore(serializeScore(score));
    expect(serializeScore(again, undefined, false) === serializeScore(score, undefined, false)).toBe(true);
    expect(buildSchedule(score).notes).toHaveLength(90);
  });
});
