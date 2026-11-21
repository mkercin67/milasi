// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-1: time-signature symbols (C for 4/4, cut sign for 2/2) as a per-measure display setting.
import { describe, expect, it } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import { appendMeasure } from '../../src/core/input';
import { insertMeasure, setTimeSignature } from '../../src/core/commands';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { layoutScore } from '../../src/layout/layoutScore';
import type { Score } from '../../src/core/model';

type Item = { id: string; glyph?: string; y?: number };
const glyphs = (s: Score): string[] =>
  (layoutScore(s, { width: 70 }).items as Item[])
    .map((i) => i.glyph ?? '')
    .filter((g) => g.startsWith('timeSig'));

function score3(): Score {
  return createEmptyScore({ numMeasures: 3 });
}
const firstId = (s: Score) => s.measures[0].id;

describe('Time-signature symbols (M7c-1)', () => {
  it('T1: digits by default, no symbol', () => {
    const g = glyphs(score3());
    expect(g).toEqual(['timeSig4', 'timeSig4']);
  });

  it('T2: 4/4 with display common draws the C sign once and no digits', () => {
    const base = score3();
    const s = setTimeSignature(firstId(base), { num: 4, den: 4 }, 'score', 'common').apply(base);
    expect(glyphs(s)).toEqual(['timeSigCommon']);
    const sym = (layoutScore(s, { width: 70 }).items as Item[]).find((i) => i.glyph === 'timeSigCommon')!;
    expect(sym.y).toBe(2);
  });

  it('T3: 2/2 with display cut draws the cut sign', () => {
    const base = score3();
    const s = setTimeSignature(firstId(base), { num: 2, den: 2 }, 'score', 'cut').apply(base);
    expect(glyphs(s)).toEqual(['timeSigCutCommon']);
  });

  it('T4: a symbol that does not fit the signature is stored as digits (absent field)', () => {
    const base = score3();
    const a = setTimeSignature(firstId(base), { num: 3, den: 4 }, 'score', 'common').apply(base);
    const b = setTimeSignature(firstId(base), { num: 4, den: 4 }, 'score', 'cut').apply(base);
    expect(a.measures.every((m) => m.timeSigDisplay === undefined)).toBe(true);
    expect(b.measures.every((m) => m.timeSigDisplay === undefined)).toBe(true);
  });

  it('T5: switching the display always shows the current state (no stale cache)', () => {
    const base = score3();
    const c = setTimeSignature(firstId(base), { num: 4, den: 4 }, 'score', 'common').apply(base);
    expect(glyphs(base)).toEqual(['timeSig4', 'timeSig4']);
    expect(glyphs(c)).toEqual(['timeSigCommon']);
    expect(glyphs(base)).toEqual(['timeSig4', 'timeSig4']);
    expect(glyphs(c)).toEqual(['timeSigCommon']);
  });

  it('T6: added measures keep the display, so C is not redrawn as digits', () => {
    const base = score3();
    let s = setTimeSignature(firstId(base), { num: 4, den: 4 }, 'score', 'common').apply(base);
    s = appendMeasure().apply(s);
    s = insertMeasure(0).apply(s);
    expect(s.measures.every((m) => m.timeSigDisplay === 'common')).toBe(true);
    expect(glyphs(s)).toEqual(['timeSigCommon']);
  });

  it('T7: a later change of display is drawn at the measure where it changes', () => {
    const base = score3();
    let s = setTimeSignature(firstId(base), { num: 4, den: 4 }, 'score', 'common').apply(base);
    s = setTimeSignature(s.measures[2].id, { num: 4, den: 4 }, 'from-here', 'numeric').apply(s);
    expect(glyphs(s)).toEqual(['timeSigCommon', 'timeSig4', 'timeSig4']);
  });

  it('T8: validation warns on a mismatch and rejects an unknown value', () => {
    const s = score3();
    const warn = { ...s, measures: s.measures.map((m, i) => (i === 0 ? { ...m, timeSigDisplay: 'cut' as const } : m)) };
    expect(validateScore(warn).some((p) => p.code === 'time-sig-display-mismatch' && p.severity === 'warning')).toBe(true);
    const bad = {
      ...s,
      measures: s.measures.map((m, i) => (i === 0 ? { ...m, timeSigDisplay: 'round' } : m)),
    } as unknown as Score;
    expect(validateScore(bad).some((p) => p.code === 'invalid-time-sig-display')).toBe(true);
  });

  it('T9: the display is saved in the file and survives a round trip', () => {
    const base = score3();
    const s = setTimeSignature(firstId(base), { num: 4, den: 4 }, 'score', 'common').apply(base);
    const back = deserializeScore(serializeScore(s));
    expect(back.measures[0].timeSigDisplay).toBe('common');
  });
});
