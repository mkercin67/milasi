// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { autoSolfege, clearLyrics } from '../../src/core/commands';
import type { NoteEvent, Score } from '../../src/core/model';

function scoreWithLyrics(): { score: Score; ids: string[] } {
  const score = createEmptyScore({ numMeasures: 1 });
  const m0 = score.measures[0].id;
  const notes = (['C', 'D', 'E', 'F'] as const).map((s) =>
    createNote({ pitches: [createPitch(s, 4, 0)], baseType: 'quarter' })
  );
  score.parts[0].staves[0].measures[m0].voices[0].events = notes;
  const marked = autoSolfege(score.id).apply(score);
  // a second verse typed by the user
  const evs = marked.parts[0].staves[0].measures[m0].voices[0].events as NoteEvent[];
  const withVerse2 = JSON.parse(JSON.stringify(marked)) as Score;
  (withVerse2.parts[0].staves[0].measures[m0].voices[0].events as NoteEvent[]).forEach((e) => {
    e.lyrics = [...(e.lyrics ?? []), { verse: 2, text: 'la' }];
  });
  return { score: withVerse2, ids: evs.map((e) => e.id) };
}
const lyricsOf = (s: Score) =>
  (s.parts[0].staves[0].measures[s.measures[0].id].voices[0].events as NoteEvent[]).map((e) => e.lyrics);

describe('clearLyrics', () => {
  it('Y1: with no selection it removes every verse of every note in the score', () => {
    const { score } = scoreWithLyrics();
    const cleared = clearLyrics({ kind: 'none' }).apply(score);
    expect(lyricsOf(cleared)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('Y2: with a selected note only that note loses its lyrics', () => {
    const { score, ids } = scoreWithLyrics();
    const cleared = clearLyrics({ kind: 'event', id: ids[1] }).apply(score);
    const l = lyricsOf(cleared);
    expect(l[1]).toBe(undefined);
    expect(l[0]).toEqual([
      { verse: 1, text: 'Do' },
      { verse: 2, text: 'la' },
    ]);
    expect(l[2]?.length).toBe(2);
  });

  it('Y3: it leaves everything else alone and does not copy an unchanged score', () => {
    const empty = createEmptyScore({ numMeasures: 1 });
    expect(clearLyrics({ kind: 'event', id: 'missing' }).apply(empty)).toBe(empty);
    const { score } = scoreWithLyrics();
    const cleared = clearLyrics({ kind: 'none' }).apply(score);
    expect(cleared.measures).toBe(score.measures);
    expect(cleared.layoutSettings).toBe(score.layoutSettings);
  });
});
