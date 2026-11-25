// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import { defaultPageSetup, mmToStaffSpaces, pageGeometry, resolvePageSetup } from '../../src/core/pageSetup';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';

describe('M7d-1: page setup model', () => {
  it('PG1: a score without page setup resolves to A4 portrait, 15 mm margins, 7 mm staff height', () => {
    const score = createEmptyScore({ measures: 1 });
    expect(score.pageSetup).toBeUndefined();
    expect(resolvePageSetup(score)).toEqual({
      paper: 'A4',
      orientation: 'portrait',
      marginsMm: { top: 15, bottom: 15, left: 15, right: 15 },
      staffHeightMm: 7,
    });
  });

  it('PG2: one staff space is 1.75 mm at 7 mm staff height (so 15 mm is 8.571 sp)', () => {
    expect(mmToStaffSpaces(1.75, 7)).toBe(1);
    expect(mmToStaffSpaces(15, 7)).toBeCloseTo(8.5714, 4);
    expect(mmToStaffSpaces(15, 5)).toBeCloseTo(12, 6);
  });

  it('PG3: A4 portrait is 120 x 169.71 sp with a printable area of 102.857 x 152.571 sp', () => {
    const g = pageGeometry(defaultPageSetup());
    expect(g?.widthSp).toBeCloseTo(120, 6);
    expect(g?.heightSp).toBeCloseTo(169.7143, 4);
    expect(g?.printableWidthSp).toBeCloseTo(102.8571, 4);
    expect(g?.printableHeightSp).toBeCloseTo(152.5714, 4);
  });

  it('PG4: landscape swaps width and height; A5 and Letter have their own sizes; a custom size needs both numbers', () => {
    const land = pageGeometry({ ...defaultPageSetup(), orientation: 'landscape' });
    expect(land?.widthSp).toBeCloseTo(169.7143, 4);
    expect(land?.heightSp).toBeCloseTo(120, 6);
    expect(pageGeometry({ ...defaultPageSetup(), paper: 'A5' })?.widthSp).toBeCloseTo(84.5714, 4);
    expect(pageGeometry({ ...defaultPageSetup(), paper: 'Letter' })?.heightSp).toBeCloseTo(159.6571, 4);
    expect(pageGeometry({ ...defaultPageSetup(), paper: 'custom' })).toBeUndefined();
    expect(pageGeometry({ ...defaultPageSetup(), paper: 'custom', widthMm: 100, heightMm: 200 })?.widthSp).toBeCloseTo(57.1429, 4);
  });

  it('PG5: validateScore accepts the defaults and rejects a setup that cannot make a page', () => {
    const score = createEmptyScore({ measures: 1 });
    const errors = (s: typeof score) => validateScore(s).filter((i) => i.code === 'invalid-page-setup');
    expect(errors({ ...score, pageSetup: defaultPageSetup() })).toHaveLength(0);
    expect(errors({ ...score, pageSetup: { ...defaultPageSetup(), staffHeightMm: 1 } })).toHaveLength(1);
    expect(errors({ ...score, pageSetup: { ...defaultPageSetup(), paper: 'custom' } })).toHaveLength(1);
    expect(errors({ ...score, pageSetup: { ...defaultPageSetup(), marginsMm: { top: 15, bottom: 15, left: 100, right: 100 } } })).toHaveLength(1);
  });

  it('PG6: page setup and systemBreakBefore survive a JSON round trip', () => {
    const score = createEmptyScore({ measures: 3 });
    const withSetup = {
      ...score,
      pageSetup: { ...defaultPageSetup(), paper: 'A5' as const, orientation: 'landscape' as const },
      measures: score.measures.map((m, i) => (i === 2 ? { ...m, systemBreakBefore: true } : m)),
    };
    const back = deserializeScore(serializeScore(withSetup, 2));
    expect(back.pageSetup).toEqual(withSetup.pageSetup);
    expect(back.measures.map((m) => m.systemBreakBefore === true)).toEqual([false, false, true]);
  });
});
