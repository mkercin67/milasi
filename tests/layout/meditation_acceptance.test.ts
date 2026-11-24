// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7c-9e-1 acceptance, Breidenbach "Méditation" for solo violoncello, mm. 13-21 (see the fixture header and
 * docs/review/m7c-9-meditation-gaps.md). Literal numbers on purpose.
 */
import { describe, expect, it } from 'vitest';
import type { Score, ScoreEvent } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { layoutScore } from '../../src/layout/layoutScore';
import { buildSchedule } from '../../src/playback/schedule';
import { buildBreidenbachMeditationMm13to21 } from '../fixtures/breidenbachMeditationMm13to21';

const name = (e: ScoreEvent): string =>
  e.kind === 'note'
    ? e.pitches.map((p) => `${p.step}${p.alter > 0 ? '#' : p.alter < 0 ? 'b' : ''}${p.octave}`).join('+')
    : 'r';
const events = (score: Score, measure: number): ScoreEvent[] =>
  score.parts[0].staves[0].measures[score.measures[measure].id].voices[0].events;

describe('M7c-9e-1 acceptance: Méditation, mm. 13-21', () => {
  it('ME1: one cello staff, E flat major, nine measures with the metres 4/4 4/4 4/4 4/4 4/4 3/4 4/4 2/4 4/4 and exact tick sums', () => {
    const score = buildBreidenbachMeditationMm13to21();
    expect(validateScore(score).filter((i) => i.severity === 'error')).toEqual([]);
    expect(score.parts).toHaveLength(1);
    expect(score.parts[0].instrument).toBe('cello');
    expect(score.measures).toHaveLength(9);
    expect(score.measures[0].keySig).toBe(-3);
    expect(score.measures.map((m) => `${m.timeSig.num}/${m.timeSig.den}`)).toEqual([
      '4/4', '4/4', '4/4', '4/4', '4/4', '3/4', '4/4', '2/4', '4/4',
    ]);
    const sums = score.measures.map((_, i) => events(score, i).reduce((t, e) => t + e.duration, 0));
    expect(sums).toEqual([3840, 3840, 3840, 3840, 3840, 2880, 3840, 1920, 3840]);
  });

  it('ME2: the notes match the edition (bass-clef double stops, then the sixths in the tenor clef)', () => {
    const score = buildBreidenbachMeditationMm13to21();
    expect(events(score, 0).map(name)).toEqual(['G2+Eb3']);
    expect(events(score, 1).map(name)).toEqual(['G2+E3']);
    expect(events(score, 3).map(name)).toEqual(['Eb3', 'Eb3', 'G3', 'C4']);
    expect(events(score, 4).map(name)).toEqual(['C#4+A4', 'C#4+A4']);
    expect(events(score, 5).map(name)).toEqual([
      'C#4+A4', 'B#3+G#4', 'B#3+G#4', 'B3+G4', 'B3+G4', 'B#3+G#4',
    ]);
    expect(events(score, 7).map(name)).toEqual(['C#4+A4', 'B#3+G#4', 'B#3+G#4', 'B3+G4']);
    expect(events(score, 8).map(name)).toEqual(['B3+G4', 'B3+G4']);
  });

  it('ME3: the clef changes to the tenor clef (C on line 4) at the start of m. 17', () => {
    const score = buildBreidenbachMeditationMm13to21();
    const st = score.parts[0].staves[0];
    expect(st.clef).toEqual({ sign: 'F', line: 4 });
    expect(st.clefChanges).toHaveLength(1);
    expect(st.clefChanges?.[0].measureId).toBe(score.measures[4].id);
    expect(st.clefChanges?.[0].tick).toBe(0);
    expect(st.clefChanges?.[0].clef).toEqual({ sign: 'C', line: 4 });
  });

  it('ME4: marks: pp in m. 14, f in m. 17, a slur m. 15 to the first quarter of m. 16, a crescendo to the last quarter of m. 16, three slurs in m. 18 and two in m. 20', () => {
    const score = buildBreidenbachMeditationMm13to21();
    expect((events(score, 1)[0] as { dynamic?: string }).dynamic).toBe('pp');
    expect((events(score, 4)[0] as { dynamic?: string }).dynamic).toBe('f');
    const st = score.parts[0].staves[0];
    expect(st.slurs).toHaveLength(6);
    expect(st.slurs?.[0].startEventId).toBe(events(score, 2)[0].id);
    expect(st.slurs?.[0].endEventId).toBe(events(score, 3)[0].id);
    expect(st.hairpins?.map((h) => h.type)).toEqual(['crescendo']);
    expect(st.hairpins?.[0].startEventId).toBe(events(score, 2)[0].id);
    expect(st.hairpins?.[0].endEventId).toBe(events(score, 3)[3].id);
  });

  it('ME5: layout produces only finite numbers', () => {
    const score = buildBreidenbachMeditationMm13to21();
    const items = layoutScore(score, { width: 90 }).systems.flatMap((s) => s.items);
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      for (const v of Object.values(i as unknown as Record<string, unknown>)) {
        if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('ME6: JSON round trip keeps the score and playback lasts 16.5 s at 120 with 42 sounding notes', () => {
    const score = buildBreidenbachMeditationMm13to21();
    expect(deserializeScore(serializeScore(score, 2))).toEqual(score);
    // Pitches per measure: 2, 2, 2, 4, 4, 12, 4, 8, 4 (every chord is a double stop).
    const written = score.measures.reduce((n, _, i) => n + events(score, i).reduce((k, e) => k + (e.kind === 'note' ? e.pitches.length : 0), 0), 0);
    expect(written).toBe(2 + 2 + 2 + 4 + 4 + 12 + 4 + 8 + 4);
    const sched = buildSchedule(score);
    expect(sched.totalSeconds).toBeCloseTo(16.5, 6);
    expect(sched.notes).toHaveLength(written);
  });
});
