// SPDX-License-Identifier: GPL-3.0-or-later
// Setting a pickup measure must not leave rests that run past the new measure length.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { setPickup } from '../../src/core/commands';
import { measureTicks } from '../../src/core/time';
import type { Score } from '../../src/core/model';

function barge(): Score {
  const score = createEmptyScore({ numMeasures: 2 });
  const m0 = score.measures[0].id;
  // eighth rest, eighth B4, then quarter rest, quarter rest, quarter rest (what a full 4/4 measure looked like)
  score.parts[0].staves[0].measures[m0].voices[0].events = [
    createRest({ baseType: 'eighth' }),
    createNote({ pitches: [createPitch('B', 4, 0)], baseType: 'eighth' }),
    createRest({ baseType: 'quarter' }),
    createRest({ baseType: 'half' }),
  ];
  return score;
}
const total = (s: Score, i: number) =>
  s.parts[0].staves[0].measures[s.measures[i].id].voices[0].events.reduce((n, e) => n + e.duration, 0);

describe('setPickup refits the measure', () => {
  it('K1: a quarter-note pickup is stored on the measure', () => {
    const s = barge();
    const out = setPickup(s.measures[0].id, 960).apply(s);
    expect(out.measures[0].actualTicks).toBe(960);
  });

  it('K2: the voice then fills exactly the pickup length', () => {
    const s = barge();
    const out = setPickup(s.measures[0].id, 960).apply(s);
    expect(total(out, 0)).toBe(960);
    const kinds = out.parts[0].staves[0].measures[out.measures[0].id].voices[0].events.map((e) => e.kind);
    expect(kinds).toEqual(['rest', 'note']);
  });

  it('K3: removing the pickup fills the measure with rests again', () => {
    const s = barge();
    const on = setPickup(s.measures[0].id, 960).apply(s);
    const off = setPickup(on.measures[0].id, null).apply(on);
    expect(off.measures[0].actualTicks).toBeUndefined();
    expect(total(off, 0)).toBe(measureTicks(off.measures[0].timeSig));
  });

  it('K4: notes that already run past the new length are never deleted', () => {
    const score = createEmptyScore({ numMeasures: 1 });
    const m0 = score.measures[0].id;
    score.parts[0].staves[0].measures[m0].voices[0].events = [
      createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'half' }),
    ];
    const out = setPickup(m0, 960).apply(score);
    expect(total(out, 0)).toBe(1920);
  });

  it('K5: an empty measure becomes a pickup of rests of the right length', () => {
    const score = createEmptyScore({ numMeasures: 1 });
    const out = setPickup(score.measures[0].id, 960).apply(score);
    expect(total(out, 0)).toBe(960);
  });
});
