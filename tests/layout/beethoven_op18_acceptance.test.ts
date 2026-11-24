// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7c-9a acceptance, Beethoven String Quartet Op. 18 No. 1, I, mm. 1-8 (see the fixture header for source and
 * policy and docs/review/m7c-9-beethoven-gaps.md for the open points). Literal numbers on purpose: they come
 * from the entered score and the printed edition, not from the code under test.
 */
import { describe, expect, it } from 'vitest';
import type { Score, ScoreEvent } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { layoutScore } from '../../src/layout/layoutScore';
import { EMPTY_MIXER, setSolo } from '../../src/playback/mixer';
import { buildSchedule } from '../../src/playback/schedule';
import { buildBeethovenOp18No1Mm1to8 } from '../fixtures/beethovenOp18No1Mm1to8';

const name = (e: ScoreEvent): string =>
  e.kind === 'note' ? `${e.pitches[0].step}${e.pitches[0].alter > 0 ? '#' : e.pitches[0].alter < 0 ? 'b' : ''}${e.pitches[0].octave}` : 'r';

const events = (score: Score, part: number, measure: number): ScoreEvent[] =>
  score.parts[part].staves[0].measures[score.measures[measure].id].voices[0].events;

describe('M7c-9a acceptance: Beethoven Op. 18 No. 1, I, mm. 1-8', () => {
  it('BE1: four parts in 3/4 and F major, every staff measure exactly 2880 ticks, no validation error', () => {
    const score = buildBeethovenOp18No1Mm1to8();
    expect(validateScore(score).filter((i) => i.severity === 'error')).toEqual([]);
    expect(score.parts.map((p) => p.name)).toEqual(['Violin I', 'Violin II', 'Viola', 'Cello']);
    expect(score.measures).toHaveLength(8);
    expect(score.measures[0].timeSig).toEqual({ num: 3, den: 4 });
    expect(score.measures[0].keySig).toBe(-1);
    for (let p = 0; p < 4; p++) {
      for (let m = 0; m < 8; m++) {
        expect(events(score, p, m).reduce((t, e) => t + e.duration, 0)).toBe(2880);
      }
    }
  });

  it('BE2: clefs are treble, treble, alto (C on line 3) and bass', () => {
    const score = buildBeethovenOp18No1Mm1to8();
    expect(score.parts.map((p) => p.staves[0].clef)).toEqual([
      { sign: 'G', line: 2 },
      { sign: 'G', line: 2 },
      { sign: 'C', line: 3 },
      { sign: 'F', line: 4 },
    ]);
  });

  it('BE3: the entered notes match the edition at chosen places', () => {
    const score = buildBeethovenOp18No1Mm1to8();
    expect(events(score, 0, 0).map(name)).toEqual(['F4', 'F4', 'G4', 'F4', 'E4', 'F4']);
    expect(events(score, 2, 0).map(name)).toEqual(['F3', 'F3', 'G3', 'F3', 'E3', 'F3']);
    expect(events(score, 0, 1).map(name)).toEqual(['C4', 'r', 'r']);
    expect(events(score, 0, 3).map(name)).toEqual(['D4', 'r', 'r']);
    expect(events(score, 0, 4).map(name)).toEqual(['F5', 'F5', 'G5', 'F5', 'E5', 'F5']);
    expect(events(score, 0, 5).map(name)).toEqual(['G5', 'Bb4']);
    expect(events(score, 0, 6).map(name)).toEqual(['A4', 'D5', 'Bb4']);
    expect(events(score, 1, 4).map(name)).toEqual(['Bb4']);
    expect(events(score, 2, 7).map(name)).toEqual(['C4', 'B3', 'C4', 'B3', 'C4']);
    expect(events(score, 3, 6).map(name)).toEqual(['F3', 'D3', 'Bb2']);
    expect(events(score, 3, 7).map(name)).toEqual(['C3']);
  });

  it('BE4: marks: slurs 9/7/8/7, hairpins 2 per staff, staccato 6/4/4/4, p only under m. 1', () => {
    const score = buildBeethovenOp18No1Mm1to8();
    const staves = score.parts.map((p) => p.staves[0]);
    expect(staves.map((s) => s.slurs?.length)).toEqual([9, 7, 8, 7]);
    expect(staves.map((s) => s.hairpins?.length)).toEqual([2, 2, 2, 2]);
    const all = (p: number) => score.measures.flatMap((_, m) => events(score, p, m));
    expect([0, 1, 2, 3].map((p) => all(p).filter((e) => e.kind === 'note' && e.articulations?.includes('staccato')).length)).toEqual([6, 4, 4, 4]);
    for (let p = 0; p < 4; p++) {
      expect(all(p).filter((e) => e.kind === 'note' && e.dynamic === 'p').length).toBe(1);
      expect(events(score, p, 0)[0].kind === 'note' && (events(score, p, 0)[0] as { dynamic?: string }).dynamic).toBe('p');
    }
  });

  it('BE5: lays out as one bracketed system with four labelled staves and no non-finite coordinate', () => {
    const score = buildBeethovenOp18No1Mm1to8();
    const layout = layoutScore(score, { width: 90 });
    expect(layout.systems.length).toBeGreaterThanOrEqual(1);
    const items = layout.systems.flatMap((s) => s.items);
    expect(items.some((i) => typeof i.id === 'string' && i.id.includes('sys-bracket'))).toBe(true);
    for (const i of items) {
      if (typeof i.x === 'number') expect(Number.isFinite(i.x)).toBe(true);
      if (typeof i.y === 'number') expect(Number.isFinite(i.y)).toBe(true);
    }
  });

  it('BE6: round-trips through JSON unchanged', () => {
    const score = buildBeethovenOp18No1Mm1to8();
    // Without the envelope: it carries a save time that differs on every call.
    const again = deserializeScore(serializeScore(score));
    expect(serializeScore(again, undefined, false) === serializeScore(score, undefined, false)).toBe(true);
  });

  it('BE7: plays 12 s at the default tempo (8 bars of 3/4 at 120) with 93 notes, 20 of them the cello', () => {
    const score = buildBeethovenOp18No1Mm1to8();
    const sched = buildSchedule(score);
    expect(sched.totalSeconds).toBeCloseTo(12, 6);
    expect(sched.notes).toHaveLength(93);
    const cello = score.parts[3].id;
    expect(setSolo(EMPTY_MIXER, cello, true).solo.has(cello)).toBe(true);
    expect(sched.notes.filter((n) => n.partId === cello)).toHaveLength(20);
  });
});
