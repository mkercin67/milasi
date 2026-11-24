// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7c-9e-2 acceptance, Breidenbach "Méditation", mm. 148-153 (see the fixture header and
 * docs/review/m7c-9-meditation-gaps.md). Literal numbers on purpose.
 */
import { describe, expect, it } from 'vitest';
import type { Score, ScoreEvent } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { layoutScore } from '../../src/layout/layoutScore';
import { buildSchedule } from '../../src/playback/schedule';
import { buildBreidenbachMeditationMm148to153 } from '../fixtures/breidenbachMeditationMm148to153';

const name = (e: ScoreEvent): string =>
  e.kind === 'note'
    ? e.pitches.map((p) => `${p.step}${p.alter > 0 ? '#' : p.alter < 0 ? 'b' : ''}${p.octave}`).join('+') + `/${e.duration}`
    : `r/${e.duration}`;
const events = (score: Score, measure: number): ScoreEvent[] =>
  score.parts[0].staves[0].measures[score.measures[measure].id].voices[0].events;
const accented = (e: ScoreEvent): boolean => e.kind === 'note' && (e.articulations ?? []).includes('accent');

describe('M7c-9e-2 acceptance: Méditation, mm. 148-153', () => {
  it('MD1: six measures of 4/4 in E flat major, bass clef, every measure exactly 3840 ticks', () => {
    const score = buildBreidenbachMeditationMm148to153();
    expect(validateScore(score).filter((i) => i.severity === 'error')).toEqual([]);
    expect(score.measures).toHaveLength(6);
    expect(score.measures[0].keySig).toBe(-3);
    expect(score.parts[0].staves[0].clef).toEqual({ sign: 'F', line: 4 });
    for (let m = 0; m < 6; m++) {
      expect(score.measures[m].timeSig).toEqual({ num: 4, den: 4 });
      expect(events(score, m).reduce((t, e) => t + e.duration, 0)).toBe(3840);
    }
  });

  it('MD2: the notes and rests match the edition', () => {
    const score = buildBreidenbachMeditationMm148to153();
    expect(events(score, 0).map(name)).toEqual(['C2/960', 'r/960', 'D4/960', 'r/960']);
    expect(events(score, 1).map(name)).toEqual(['C2/960', 'r/960', 'C4/1920']);
    expect(events(score, 2).map(name)).toEqual(['C4/1920', 'C4/960', 'D4/960']);
    expect(events(score, 3).map(name)).toEqual(['G4/3840']);
    expect(events(score, 4).map(name)).toEqual(['r/1920', 'C4/960', 'D4/960']);
    expect(events(score, 5).map(name)).toEqual(['G4/3840']);
  });

  it('MD3: the clef changes to the tenor clef (C on line 4) in the middle of m. 150', () => {
    const st = buildBreidenbachMeditationMm148to153().parts[0].staves[0];
    expect(st.clefChanges).toHaveLength(1);
    expect(st.clefChanges?.[0].tick).toBe(1920);
    expect(st.clefChanges?.[0].clef).toEqual({ sign: 'C', line: 4 });
  });

  it('MD4: marks: ff in m. 148, p in m. 151, four accents, a tie over the barline m. 149 to m. 150, two slurs, one diminuendo from the m. 149 half note to the last quarter of m. 150', () => {
    const score = buildBreidenbachMeditationMm148to153();
    expect((events(score, 0)[0] as { dynamic?: string }).dynamic).toBe('ff');
    expect((events(score, 3)[0] as { dynamic?: string }).dynamic).toBe('p');
    expect([0, 1, 2, 3, 4, 5].map((m) => events(score, m).filter(accented).length)).toEqual([2, 2, 0, 0, 0, 0]);
    const tied = events(score, 1)[2];
    expect(tied.kind === 'note' && tied.pitches[0].tiedToNext).toBe(true);
    const st = score.parts[0].staves[0];
    expect(st.slurs).toHaveLength(2);
    expect(st.hairpins?.map((h) => h.type)).toEqual(['diminuendo']);
    expect(st.hairpins?.[0].startEventId).toBe(events(score, 1)[2].id);
    expect(st.hairpins?.[0].endEventId).toBe(events(score, 2)[2].id);
  });

  it('MD5: layout has only finite numbers; JSON round trip is equal; playback is 12 s at 120 with 10 sounding notes (the tie merges two)', () => {
    const score = buildBreidenbachMeditationMm148to153();
    for (const i of layoutScore(score, { width: 90 }).systems.flatMap((s) => s.items)) {
      for (const v of Object.values(i as unknown as Record<string, unknown>)) {
        if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      }
    }
    expect(deserializeScore(serializeScore(score, 2))).toEqual(score);
    const sched = buildSchedule(score);
    expect(sched.totalSeconds).toBeCloseTo(12, 6);
    expect(sched.notes).toHaveLength(10);
  });
});
