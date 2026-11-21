// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { autoSolfege } from '../../src/core/commands';
import { layoutScore } from '../../src/layout/layoutScore';
import type { NoteEvent, Score } from '../../src/core/model';

function scoreWithTwoNotes(): Score {
  const score = createEmptyScore({ numMeasures: 2 });
  const m0 = score.measures[0].id;
  const v = score.parts[0].staves[0].measures[m0].voices[0];
  v.events = [
    createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'quarter' }),
  ];
  return score;
}

function lyricTexts(score: Score): string[] {
  return layoutScore(score, { width: 70 })
    .items.filter((it) => it.id.startsWith('lyric-text-'))
    .map((it) => (it as { text: string }).text);
}

describe('Lyrics invalidate the layout caches (regression: syllables appeared only after F5)', () => {
  it('L1: auto-solfege after a first layout shows syllables without clearing caches', () => {
    const score = scoreWithTwoNotes();
    expect(lyricTexts(score)).toEqual([]);

    const withSolfege = autoSolfege(score.id).apply(score);
    expect(lyricTexts(withSolfege)).toEqual(['Do', 'Re']);
  });

  it('L2: removing the syllables again hides them (no stale cached layout)', () => {
    const score = scoreWithTwoNotes();
    const withSolfege = autoSolfege(score.id).apply(score);
    expect(lyricTexts(withSolfege)).toEqual(['Do', 'Re']);

    const cleared = produce(withSolfege, (d) => {
      const m0 = d.measures[0].id;
      for (const ev of d.parts[0].staves[0].measures[m0].voices[0].events) {
        delete (ev as NoteEvent).lyrics;
      }
    });
    expect(lyricTexts(cleared)).toEqual([]);
  });
});
