// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7c-9c acceptance, Schubert "An die Musik" D. 547, mm. 1-5 (see the fixture header and
 * docs/review/m7c-9-schubert-gaps.md). Literal numbers on purpose.
 */
import { describe, expect, it } from 'vitest';
import type { Score, ScoreEvent } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { layoutScore } from '../../src/layout/layoutScore';
import { buildSchedule } from '../../src/playback/schedule';
import { buildSchubertD547Mm1to5 } from '../fixtures/schubertD547Mm1to5';

// 11 voice notes + 115 right-hand + 12 left-hand notes + 1 grace note, counted by hand from the edition.
const N_NOTES = 139;
const name = (e: ScoreEvent): string =>
  e.kind === 'note'
    ? e.pitches.map((p) => `${p.step}${p.alter > 0 ? '#' : p.alter < 0 ? 'b' : ''}${p.octave}`).join('+')
    : 'r';
const events = (score: Score, part: number, staff: number, measure: number): ScoreEvent[] =>
  score.parts[part].staves[staff].measures[score.measures[measure].id].voices[0].events;
const lyric = (e: ScoreEvent, verse: number): string | undefined =>
  e.kind === 'note' ? e.lyrics?.find((l) => l.verse === verse)?.text : undefined;

describe('M7c-9c acceptance: Schubert D. 547, mm. 1-5', () => {
  it('SC1: voice and piano (two staves), D major, cut time, start repeat at m. 3, every staff measure exactly 3840 ticks', () => {
    const score = buildSchubertD547Mm1to5();
    expect(validateScore(score).filter((i) => i.severity === 'error')).toEqual([]);
    expect(score.parts.map((p) => p.staves.length)).toEqual([1, 2]);
    expect(score.measures).toHaveLength(5);
    expect(score.measures[0].keySig).toBe(2);
    expect(score.measures[0].timeSig).toEqual({ num: 2, den: 2 });
    expect(score.measures[0].timeSigDisplay).toBe('cut');
    expect(score.measures.map((m) => m.repeatStart === true)).toEqual([false, false, true, false, false]);
    for (const [p, s] of [[0, 0], [1, 0], [1, 1]]) {
      for (let m = 0; m < 5; m++) {
        expect(events(score, p, s, m).reduce((t, e) => t + e.duration, 0)).toBe(3840);
      }
    }
  });

  it('SC2: the entered notes match the edition at chosen places', () => {
    const score = buildSchubertD547Mm1to5();
    expect(events(score, 0, 0, 2).map(name)).toEqual(['r', 'A4', 'D5', 'D5']);
    expect(events(score, 0, 0, 3).map(name)).toEqual(['F#4', 'B4']);
    expect(events(score, 0, 0, 4).map(name)).toEqual(['D4', 'D4', 'F#4', 'E4', 'D4', 'E4']);
    expect(events(score, 1, 0, 0).map(name)).toEqual(Array(8).fill('A3+D4+F#4'));
    expect(events(score, 1, 0, 1).map(name)).toEqual([
      'A3+D4+A4', 'A3+D4+A4', 'A3+D4+A4', 'A3+D4+A4', 'A3+C#4+G4', 'A3+C#4+G4', 'G3+A3+C#4+E4', 'G3+A3+C#4+E4',
    ]);
    expect(events(score, 1, 0, 2)[0] && name(events(score, 1, 0, 2)[0])).toBe('F#3+A3+D4');
    expect(events(score, 1, 1, 1).map(name)).toEqual(['F#2', 'A2', 'A1']);
    expect(events(score, 1, 1, 3).map(name)).toEqual(['r', 'F#2', 'B2', 'G#2']);
  });

  it('SC3: lyrics, verse 1 and verse 2, under the same notes', () => {
    const score = buildSchubertD547Mm1to5();
    const v = [...events(score, 0, 0, 2), ...events(score, 0, 0, 3), ...events(score, 0, 0, 4)].filter((e) => e.kind === 'note');
    expect(v.map((e) => lyric(e, 1))).toEqual(['Du', 'hol-', 'de', 'Kunst,', 'in', 'wie', 'viel', 'grau-', 'en_', undefined, undefined]);
    expect(v.map((e) => lyric(e, 2))).toEqual(['Oft', 'hat', 'ein', 'Seuf-', 'zer,', 'dei-', 'ner', "Harf'", 'ent-', 'flos-', 'sen,']);
  });

  it('SC4: marks: p under m. 1, pp under m. 3, four staccato dots, slurs 2 in the voice and 2 in the left hand, one grace note, one short diminuendo hairpin in the right hand', () => {
    const score = buildSchubertD547Mm1to5();
    expect((events(score, 1, 0, 0)[0] as { dynamic?: string }).dynamic).toBe('p');
    expect((events(score, 1, 0, 2)[0] as { dynamic?: string }).dynamic).toBe('pp');
    const lh = [0, 1, 2, 3, 4].flatMap((m) => events(score, 1, 1, m));
    expect(lh.filter((e) => e.kind === 'note' && e.articulations?.includes('staccato')).length).toBe(4);
    expect(score.parts[0].staves[0].slurs?.length).toBe(2);
    expect(score.parts[1].staves[1].slurs?.length).toBe(2);
    expect(score.parts[1].staves[0].hairpins?.map((h) => h.type)).toEqual(['diminuendo']);
    expect(score.parts[1].staves[0].hairpins?.[0].startEventId).toBe(events(score, 1, 0, 1)[0].id);
    expect(score.parts[1].staves[0].hairpins?.[0].endEventId).toBe(events(score, 1, 0, 1)[1].id);
    const first = events(score, 0, 0, 4)[0];
    expect(first.kind === 'note' && first.graces?.length).toBe(1);
  });

  it('SC5: lays out (no non-finite coordinate, two lyric lines), round-trips through JSON', () => {
    const score = buildSchubertD547Mm1to5();
    for (const i of layoutScore(score, { width: 90 }).systems.flatMap((s) => s.items)) {
      if (typeof i.x === 'number') expect(Number.isFinite(i.x)).toBe(true);
      if (typeof i.y === 'number') expect(Number.isFinite(i.y)).toBe(true);
    }
    const again = deserializeScore(serializeScore(score));
    expect(serializeScore(again, undefined, false) === serializeScore(score, undefined, false)).toBe(true);
  });

  it('SC6: plays 10 s at the default tempo (5 bars of 2/2 at 120) with 139 notes', () => {
    const sched = buildSchedule(buildSchubertD547Mm1to5());
    expect(sched.totalSeconds).toBeCloseTo(10, 6);
    expect(sched.notes).toHaveLength(N_NOTES);
  });
});
