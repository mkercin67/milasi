// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-7 step 2: verses 2 and above are drawn, each on its own line.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, newId } from '../../src/core/factory';
import { setLyrics } from '../../src/core/commands';
import type { NoteEvent, Score } from '../../src/core/model';
import { layoutScore } from '../../src/layout/layoutScore';
import type { LayoutItem } from '../../src/layout/types';

function base(measures = 2): { score: Score; ids: string[] } {
  const score = createEmptyScore({ numMeasures: measures });
  const notes = [0, 1, 2, 3].map((i) => createNote({ pitches: [createPitch('CDEF'[i] as 'C', 4)], baseType: 'quarter' }));
  score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events = notes;
  const rest = [0, 1].map(() => createNote({ pitches: [createPitch('G', 4)], baseType: 'half' }));
  if (measures > 1) score.parts[0].staves[0].measures[score.measures[1].id].voices[0].events = rest;
  return { score, ids: [...notes, ...rest].map((n) => n.id) };
}
const items = (s: Score): LayoutItem[] => layoutScore(s, { width: 100 }).systems[0].items;
const find = (list: LayoutItem[], id: string) => list.find((i) => i.id === id);

describe('M7c-7 verse layout (step 2)', () => {
  it('LL1: verse 1 keeps its ids and its height of 6.8 sp', () => {
    const { score, ids } = base();
    const it = find(items(setLyrics(ids[0], 'Süt', 1).apply(score)), `lyric-text-${ids[0]}`);
    expect(it?.text).toBe('Süt');
    expect(it?.y).toBe(6.8);
  });

  it('LL2: every verse is on its own line, 2 sp apart, with its own ids', () => {
    const { score, ids } = base();
    let s = setLyrics(ids[0], 'one', 1).apply(score);
    s = setLyrics(ids[0], 'two', 2).apply(s);
    s = setLyrics(ids[0], 'three', 3).apply(s);
    const list = items(s);
    expect(find(list, `lyric-text-${ids[0]}`)?.y).toBe(6.8);
    expect(find(list, `lyric-v2-text-${ids[0]}`)?.text).toBe('two');
    expect(find(list, `lyric-v2-text-${ids[0]}`)?.y).toBe(8.8);
    expect(find(list, `lyric-v3-text-${ids[0]}`)?.y).toBe(10.8);
    expect(find(list, `lyric-v2-text-${ids[0]}`)?.eventId).toBe(ids[0]);
  });

  it('LL3: a verse keeps its height in a measure that has no other verse', () => {
    const { score, ids } = base();
    const s = setLyrics(ids[4], 'x', 2).apply(score);
    expect(find(items(s), `lyric-v2-text-${ids[4]}`)?.y).toBe(8.8);
  });

  it('LL4: hyphens are placed per verse, between the syllables of that verse', () => {
    const { score, ids } = base();
    let s = setLyrics(ids[0], 'a-', 1).apply(score);
    s = setLyrics(ids[1], 'b', 1).apply(s);
    s = setLyrics(ids[0], 'x-', 2).apply(s);
    s = setLyrics(ids[2], 'y', 2).apply(s);
    const list = items(s);
    const x = (id: string) => find(list, id)!.x;
    expect(x(`lyric-hyphen-${ids[0]}`)).toBe((x(`lyric-text-${ids[0]}`) + x(`lyric-text-${ids[1]}`)) / 2);
    expect(x(`lyric-v2-hyphen-${ids[0]}`)).toBe((x(`lyric-v2-text-${ids[0]}`) + x(`lyric-v2-text-${ids[2]}`)) / 2);
  });

  it('LL5: a melisma extender of verse 2 ignores the syllables of verse 1', () => {
    const { score, ids } = base();
    let s = setLyrics(ids[0], 'a', 1).apply(score);
    s = setLyrics(ids[1], 'b', 1).apply(s);
    s = setLyrics(ids[0], 'x_', 2).apply(s);
    const list = items(s);
    const v1 = setLyrics(ids[0], 'a_', 1).apply(setLyrics(ids[1], 'b', 1).apply(score));
    const ext1 = find(items(v1), `lyric-extender-${ids[0]}`)!;
    const ext2 = find(list, `lyric-v2-extender-${ids[0]}`)!;
    // verse 1 stops before "b" on the second note; verse 2 runs on through the rest of the measure
    expect(ext2.x2! > ext1.x2!).toBe(true);
  });

  it('LL6: a long syllable in verse 3 widens the column like one in verse 1', () => {
    const { score, ids } = base();
    const narrow = layoutScore(score, { width: 100 }).systems[0].items.find((i) => i.eventId === ids[1] && i.glyph?.startsWith('notehead'))!.x;
    const wide = layoutScore(setLyrics(ids[0], 'Wunderbarlich', 3).apply(score), { width: 100 }).systems[0].items.find(
      (i) => i.eventId === ids[1] && i.glyph?.startsWith('notehead')
    )!.x;
    expect(wide > narrow).toBe(true);
  });

  it('LL7: voices of one staff stack their verse lines in voice, then verse order', () => {
    const { score, ids } = base(1);
    const s0 = structuredClone(score);
    const staff = s0.parts[0].staves[0];
    const m = s0.measures[0].id;
    const v2Notes = [0, 1].map(() => createNote({ pitches: [createPitch('E', 3)], baseType: 'half' }));
    staff.measures[m].voices.push({ id: newId(), voiceIndex: 2, events: v2Notes });
    let s = setLyrics(ids[0], 'one', 1).apply(s0);
    s = setLyrics(ids[0], 'two', 2).apply(s);
    s = setLyrics(v2Notes[0].id, 'low', 1).apply(s);
    const list = items(s);
    const a = find(list, `lyric-text-${ids[0]}`)!.y;
    const b = find(list, `lyric-v2-text-${ids[0]}`)!.y;
    const c = find(list, `lyric-text-${v2Notes[0].id}`)!.y;
    expect(Math.abs(b - a - 2) < 1e-9).toBe(true);
    expect(c > b).toBe(true);
  });

  it('LL8: a lyric with an invalid verse number is not drawn', () => {
    const { score, ids } = base();
    const s = structuredClone(score);
    const n = s.parts[0].staves[0].measures[s.measures[0].id].voices[0].events[0] as NoteEvent;
    n.lyrics = [{ verse: 9, text: 'zz' }];
    expect(items(s).some((i) => i.id.includes(`text-${ids[0]}`))).toBe(false);
  });
});
