// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-7 step 3: the space below lyrics (2.5 sp to the next staff) and the SATB lyric corridor.
import { describe, expect, it } from 'vitest';
import { setLyrics } from '../../src/core/commands';
import { applyTemplate } from '../../src/core/ensembleCommands';
import { createEmptyScore, createGrandStaffScore, createNote, createPitch } from '../../src/core/factory';
import type { Score } from '../../src/core/model';
import { layoutScore } from '../../src/layout/layoutScore';
import { getItemRect } from '../../src/layout/mouse';
import type { LayoutItem } from '../../src/layout/types';

/** SATB with four quarter notes per staff in measure 1 and `verses` verses on the soprano notes. */
function satb(verses: number): Score {
  let score = structuredClone(applyTemplate('satb').apply(createEmptyScore({ numMeasures: 2 })));
  const m0 = score.measures[0].id;
  const sopranoIds: string[] = [];
  score.parts.forEach((p, k) => {
    const notes = [0, 1, 2, 3].map(() => createNote({ pitches: [createPitch('C', k < 2 ? 5 : 3)], baseType: 'quarter' }));
    p.staves[0].measures[m0].voices[0].events = notes;
    if (k === 0) sopranoIds.push(...notes.map((n) => n.id));
  });
  for (let v = 1; v <= verses; v++) {
    sopranoIds.forEach((id, i) => {
      score = setLyrics(id, `s${v}${'-'.repeat(i % 2)}`, v).apply(score);
    });
  }
  return score;
}
const sys0 = (s: Score): LayoutItem[] => layoutScore(s, { width: 100 }).systems[0].items;
const staffTop = (items: LayoutItem[], k: number): number => items.find((i) => i.id === `sys-0-s${k}-staffline-0`)!.y;
const staffTop0 = (items: LayoutItem[]): number => items.find((i) => i.id === 'sys-0-staffline-0')!.y;
const lyricsOf = (items: LayoutItem[], staffId: string) => items.filter((i) => i.id.includes('lyric-') && i.staffId === staffId);

describe('M7c-7 lyric clearance and corridor (step 3)', () => {
  it('LC1: with three verses the next staff starts at least 2.5 sp below the lowest lyric', () => {
    const score = satb(3);
    const items = sys0(score);
    const lowest = Math.max(...lyricsOf(items, score.parts[0].staves[0].id).map((i) => getItemRect(i).y2));
    expect(staffTop(items, 1) - lowest >= 2.5 - 1e-6).toBe(true);
  });

  it('LC2: more verses push the lower staves further down', () => {
    const one = staffTop(sys0(satb(1)), 1) - staffTop0(sys0(satb(1)));
    const three = staffTop(sys0(satb(3)), 1) - staffTop0(sys0(satb(3)));
    expect(three > one).toBe(true);
  });

  it('LC3: one verse fits in the normal gap between parts (no growth)', () => {
    const items = sys0(satb(1));
    expect(staffTop(items, 1) - staffTop0(items)).toBe(13);
  });

  it('LC4: individual barlines never touch a lyric box', () => {
    const score = satb(3);
    const items = sys0(score);
    const barlines = items.filter((i) => i.kind === 'line' && i.id.includes('barline-') && !i.id.includes('sys-start'));
    expect(barlines.length > 0).toBe(true);
    const lyrics = items.filter((i) => i.id.includes('lyric-'));
    expect(lyrics.length > 0).toBe(true);
    for (const b of barlines) {
      const bx = b.x;
      const by1 = Math.min(b.y, b.y2 ?? b.y);
      const by2 = Math.max(b.y, b.y2 ?? b.y);
      for (const l of lyrics) {
        const r = getItemRect(l);
        const overlapsX = bx >= r.x1 && bx <= r.x2;
        const overlapsY = by2 > r.y1 && by1 < r.y2;
        expect(overlapsX && overlapsY).toBe(false);
      }
    }
  });

  it('LC5: a grand staff without lyrics keeps its 7 sp gap', () => {
    const score = createGrandStaffScore({ numMeasures: 2 });
    const items = layoutScore(score, { width: 100 }).systems[0].items;
    expect(staffTop(items, 1) - staffTop0(items)).toBe(11);
  });
});
