// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-7 step 1: verse range, validation and command guards for multi-verse lyrics.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { clearLyrics, pasteLyrics, setLyrics } from '../../src/core/commands';
import { isValidLyricVerse, MAX_LYRIC_VERSES } from '../../src/core/model';
import type { NoteEvent, Score } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';

function base(): { score: Score; ids: string[] } {
  const score = createEmptyScore({ numMeasures: 1 });
  const notes = [0, 1, 2, 3].map(() => createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }));
  score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events = notes;
  return { score, ids: notes.map((n) => n.id) };
}
const lyricsOf = (s: Score, i: number) =>
  (s.parts[0].staves[0].measures[s.measures[0].id].voices[0].events[i] as NoteEvent).lyrics;
const codes = (s: Score) => validateScore(s).map((p) => p.code);

describe('M7c-7 lyric verses (step 1)', () => {
  it('LV1: verses 1 to 8 are valid, everything else is not', () => {
    expect(MAX_LYRIC_VERSES).toBe(8);
    expect(isValidLyricVerse(1) && isValidLyricVerse(8)).toBe(true);
    expect([0, 9, -1, 1.5, NaN, '2', undefined, null].some((v) => isValidLyricVerse(v))).toBe(false);
  });

  it('LV2: setLyrics keeps every verse of a note separate', () => {
    const { score, ids } = base();
    let s = setLyrics(ids[0], 'Süt', 1).apply(score);
    s = setLyrics(ids[0], 'Bir', 2).apply(s);
    s = setLyrics(ids[0], 'Üç', 3).apply(s);
    expect(lyricsOf(s, 0)).toEqual([
      { verse: 1, text: 'Süt' },
      { verse: 2, text: 'Bir' },
      { verse: 3, text: 'Üç' },
    ]);
    s = setLyrics(ids[0], undefined, 2).apply(s);
    expect(lyricsOf(s, 0)).toEqual([
      { verse: 1, text: 'Süt' },
      { verse: 3, text: 'Üç' },
    ]);
  });

  it('LV3: setLyrics and pasteLyrics ignore a verse outside 1..8', () => {
    const { score, ids } = base();
    expect(setLyrics(ids[0], 'x', 0).apply(score)).toBe(score);
    expect(setLyrics(ids[0], 'x', 9).apply(score)).toBe(score);
    expect(pasteLyrics(ids[0], 'a b c', score, 12).apply(score)).toBe(score);
  });

  it('LV4: pasteLyrics fills one verse and leaves the others alone', () => {
    const { score, ids } = base();
    let s = pasteLyrics(ids[0], 'a b c d', score, 1).apply(score);
    s = pasteLyrics(ids[1], 'x y', s, 2).apply(s);
    expect(lyricsOf(s, 0)).toEqual([{ verse: 1, text: 'a' }]);
    expect(lyricsOf(s, 1)).toEqual([
      { verse: 1, text: 'b' },
      { verse: 2, text: 'x' },
    ]);
    expect(lyricsOf(s, 2)).toEqual([
      { verse: 1, text: 'c' },
      { verse: 2, text: 'y' },
    ]);
    expect(lyricsOf(s, 3)).toEqual([{ verse: 1, text: 'd' }]);
  });

  it('LV5: validation rejects a bad verse number and two syllables for one verse', () => {
    const { score, ids } = base();
    expect(codes(setLyrics(ids[0], 'a', 2).apply(score))).toEqual([]);
    const bad = structuredClone(score);
    const n = bad.parts[0].staves[0].measures[bad.measures[0].id].voices[0].events[0] as NoteEvent;
    n.lyrics = [{ verse: 9, text: 'a' }];
    expect(codes(bad).includes('invalid-lyric-verse')).toBe(true);
    n.lyrics = [
      { verse: 2, text: 'a' },
      { verse: 2, text: 'b' },
    ];
    expect(codes(bad).includes('invalid-lyric-verse')).toBe(true);
  });

  it('LV6: clearLyrics removes every verse', () => {
    const { score, ids } = base();
    let s = setLyrics(ids[0], 'a', 1).apply(score);
    s = setLyrics(ids[0], 'b', 2).apply(s);
    s = clearLyrics({ kind: 'none' }).apply(s);
    expect(lyricsOf(s, 0)).toBeUndefined();
  });
});
