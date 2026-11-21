// SPDX-License-Identifier: GPL-3.0-or-later
// Lyrics in polyphonic measures: each voice with verse-1 text gets its own line, stacked in voice order.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { setShowNoteNames } from '../../src/core/commands';
import { layoutScore } from '../../src/layout/layoutScore';
import type { NoteEvent, Score } from '../../src/core/model';

function polyScore(): Score {
  const score = createEmptyScore({ numMeasures: 1 });
  const m0 = score.measures[0].id;
  const a = createNote({ pitches: [createPitch('E', 5, 0)], baseType: 'half' });
  const b = createNote({ pitches: [createPitch('F', 5, 0)], baseType: 'half' });
  const c = createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'half' });
  const d = createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'half' });
  (a as NoteEvent).lyrics = [{ verse: 1, text: 'Süt' }];
  (b as NoteEvent).lyrics = [{ verse: 1, text: 'iç' }];
  (c as NoteEvent).lyrics = [{ verse: 1, text: 'la' }];
  score.parts[0].staves[0].measures[m0].voices = [
    { id: 'v1', voiceIndex: 1, events: [a, b] },
    { id: 'v2', voiceIndex: 2, events: [c, d] },
  ];
  return score;
}
type Item = { id: string; text?: string; y?: number };
const lyricItems = (s: Score) =>
  (layoutScore(s, { width: 70 }).items as Item[]).filter((it) => it.id.startsWith('lyric-text-'));

describe('Lyrics in polyphonic measures', () => {
  it('P1: every voice with verse-1 text is drawn', () => {
    expect(lyricItems(polyScore()).map((i) => i.text).sort()).toEqual(['Süt', 'iç', 'la']);
  });

  it('P2: voices are stacked in voice order (voice 2 below voice 1)', () => {
    const items = lyricItems(polyScore());
    const v1 = items.find((i) => i.text === 'Süt')!;
    const v2 = items.find((i) => i.text === 'la')!;
    expect(v2.y!).toBeGreaterThan(v1.y!);
  });

  it('P3: with note names on, lyrics sit below the name lines', () => {
    const s = setShowNoteNames(true).apply(polyScore());
    const all = layoutScore(s, { width: 70 }).items as Item[];
    const lowestName = Math.max(...all.filter((i) => i.id.startsWith('note-name-')).map((i) => i.y!));
    const highestLyric = Math.min(...all.filter((i) => i.id.startsWith('lyric-text-')).map((i) => i.y!));
    expect(highestLyric).toBeGreaterThan(lowestName);
  });
});
