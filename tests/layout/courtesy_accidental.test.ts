// SPDX-License-Identifier: GPL-3.0-or-later
// Courtesy (cautionary) accidentals: printed on request, even where key and bar do not require them.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { toggleShowAccidental } from '../../src/core/notationCommands';
import { layoutScore } from '../../src/layout/layoutScore';
import type { Score } from '../../src/core/model';

function cSharpInD(): { score: Score; id: string } {
  const score = createEmptyScore({ numMeasures: 1, keySig: 2 } as never);
  const m0 = score.measures[0];
  m0.keySig = 2; // D major: F sharp, C sharp
  const evs = [
    createNote({ pitches: [createPitch('C', 5, 1)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('D', 5, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('E', 5, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('F', 5, 1)], baseType: 'quarter' }),
  ];
  score.parts[0].staves[0].measures[m0.id].voices[0].events = evs;
  return { score, id: evs[0].id };
}

function accGlyphs(score: Score): string[] {
  const layout = layoutScore(score, { width: 70 });
  return layout.systems[0].items
    .filter((it) => it.kind === 'glyph' && (it.glyph ?? '').startsWith('accidental') && it.eventId)
    .map((it) => it.glyph as string);
}

describe('courtesy accidentals', () => {
  it('A1: C sharp in D major prints no accidental by default', () => {
    expect(accGlyphs(cSharpInD().score)).toEqual([]);
  });

  it('A2: with the courtesy flag the sharp is printed before the note', () => {
    const { score, id } = cSharpInD();
    const s = toggleShowAccidental(id).apply(score);
    expect(accGlyphs(s)).toEqual(['accidentalSharp']);
  });

  it('A3: toggling twice removes the flag again', () => {
    const { score, id } = cSharpInD();
    const on = toggleShowAccidental(id).apply(score);
    const off = toggleShowAccidental(id).apply(on);
    expect(accGlyphs(off)).toEqual([]);
  });

  it('A4: a courtesy natural on a plain pitch (D) prints a natural sign', () => {
    const { score } = cSharpInD();
    const d = score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events[1];
    const s = toggleShowAccidental(d.id).apply(score);
    expect(accGlyphs(s)).toEqual(['accidentalNatural']);
  });

  it('A5: a courtesy accidental is flagged for the editor view, a required one is not', () => {
    const { score, id } = cSharpInD();
    const s = toggleShowAccidental(id).apply(score);
    const accs = layoutScore(s, { width: 70 }).systems[0].items.filter(
      (it) => it.kind === 'glyph' && (it.glyph ?? '').startsWith('accidental') && it.eventId
    );
    expect(accs).toHaveLength(1);
    expect(accs[0].courtesy).toBe(true);

    // a sharp that the key does not give is required, not courtesy
    const f = createEmptyScore({ numMeasures: 1 });
    const mid = f.measures[0].id;
    f.parts[0].staves[0].measures[mid].voices[0].events = [
      createNote({ pitches: [createPitch('F', 4, 1)], baseType: 'whole' }),
    ];
    const req = layoutScore(f, { width: 70 }).systems[0].items.filter(
      (it) => it.kind === 'glyph' && (it.glyph ?? '') === 'accidentalSharp' && it.eventId
    );
    expect(req).toHaveLength(1);
    expect(req[0].courtesy).toBeUndefined();
  });
});
