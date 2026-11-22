// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-3: ornaments (trill, mordent, inverted mordent, turn): model, toggle command, validation, layout.
// Playback ignores ornaments until M11; nothing here is about sound.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { cycleFermata, toggleArticulation, toggleOrnament } from '../../src/core/notationCommands';
import { validateScore } from '../../src/core/validate';
import { layoutScore } from '../../src/layout/layoutScore';
import { layoutArticulations, layoutFermatas, layoutOrnaments } from '../../src/layout/notations';
import type { NoteEvent, Score } from '../../src/core/model';
import type { Selection } from '../../src/core/selection';

function setup(): { score: Score; ids: string[]; sel: Selection } {
  const score = createEmptyScore({ numMeasures: 1 });
  const m0 = score.measures[0].id;
  const evs = [
    createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('D', 5, 0)], baseType: 'quarter' }),
    createRest({ baseType: 'quarter' }),
    createNote({ pitches: [createPitch('G', 5, 0)], baseType: 'quarter' }),
  ];
  const staff = score.parts[0].staves[0];
  staff.measures[m0].voices[0].events = evs;
  const sel: Selection = {
    kind: 'range',
    staffId: staff.id,
    voiceIndex: 1,
    anchorId: evs[0].id,
    focusId: evs[2].id,
  };
  return { score, ids: evs.map((e) => e.id), sel };
}

function events(score: Score) {
  return score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events;
}

describe('ornaments (M7c-3)', () => {
  it('O1: toggle sets, the same ornament removes, another replaces', () => {
    const { score, ids } = setup();
    const a = toggleOrnament(ids[0], 'trill').apply(score);
    expect((events(a)[0] as NoteEvent).ornament).toBe('trill');
    const b = toggleOrnament(ids[0], 'turn').apply(a);
    expect((events(b)[0] as NoteEvent).ornament).toBe('turn');
    const c = toggleOrnament(ids[0], 'turn').apply(b);
    expect((events(c)[0] as NoteEvent).ornament).toBeUndefined();
  });

  it('O2: a range sets the ornament on the notes and skips the rest', () => {
    const { score, sel } = setup();
    const a = toggleOrnament(sel, 'mordent').apply(score);
    const evs = events(a);
    expect((evs[0] as NoteEvent).ornament).toBe('mordent');
    expect((evs[1] as NoteEvent).ornament).toBe('mordent');
    expect('ornament' in evs[2]).toBe(false);
    expect((evs[3] as NoteEvent).ornament).toBeUndefined();
  });

  it('O3: the command does not mutate the input score', () => {
    const { score, ids } = setup();
    const before = JSON.stringify(score);
    toggleOrnament(ids[0], 'trill').apply(score);
    expect(JSON.stringify(score)).toBe(before);
  });

  it('O4: validation accepts the four values and rejects unknown values and ornaments on rests', () => {
    const { score, ids } = setup();
    for (const o of ['trill', 'mordent', 'invertedMordent', 'turn'] as const) {
      const s = toggleOrnament(ids[0], o).apply(score);
      expect(validateScore(s).some((p) => p.code === 'invalid-ornament')).toBe(false);
    }
    const bad = structuredClone(toggleOrnament(ids[0], 'trill').apply(score));
    (events(bad)[0] as unknown as { ornament: string }).ornament = 'wobble';
    expect(validateScore(bad).some((p) => p.code === 'invalid-ornament')).toBe(true);
    const onRest = structuredClone(score);
    (events(onRest)[2] as unknown as { ornament: string }).ornament = 'trill';
    expect(validateScore(onRest).some((p) => p.code === 'invalid-ornament')).toBe(true);
  });

  it('O5: each ornament is drawn with its SMuFL glyph above the staff and the note', () => {
    const { score, ids } = setup();
    const glyphs: Record<string, string> = {
      trill: 'ornamentTrill',
      mordent: 'ornamentMordent',
      invertedMordent: 'ornamentShortTrill',
      turn: 'ornamentTurn',
    };
    for (const [o, glyph] of Object.entries(glyphs)) {
      const s = toggleOrnament(ids[1], o as 'trill').apply(score);
      const layout = layoutScore(s, { width: 70 });
      const items = layoutOrnaments(s, layout);
      expect(items).toHaveLength(1);
      expect(items[0].glyph).toBe(glyph);
      expect(items[0].eventId).toBe(ids[1]);
      // staff top line is y = 0 in the system; the baseline of the sign is above it
      expect(items[0].y as number).toBeLessThanOrEqual(-1);
    }
  });

  it('O6: a fermata above on the same note sits above the ornament', () => {
    const { score, ids } = setup();
    const withOrn = toggleOrnament(ids[1], 'trill').apply(score);
    const withBoth = cycleFermata(ids[1]).apply(withOrn);
    const layout = layoutScore(withBoth, { width: 70 });
    const orn = layoutOrnaments(withBoth, layout)[0];
    const fer = layoutFermatas(withBoth, layout)[0];
    const onlyFermata = cycleFermata(ids[1]).apply(score);
    const plain = layoutFermatas(onlyFermata, layoutScore(onlyFermata, { width: 70 }))[0];
    expect(fer.y as number).toBeLessThan(orn.y as number);
    expect(fer.y as number).toBeLessThan(plain.y as number);
  });

  it('O7: an accent above the note pushes the ornament higher when the articulation items are given', () => {
    const { score, ids } = setup();
    const s = toggleOrnament(ids[1], 'trill').apply(toggleArticulation(ids[1], 'accent').apply(score));
    const layout = layoutScore(s, { width: 70 });
    const artic = layoutArticulations(s, layout);
    const withoutArtic = layoutOrnaments(s, layout)[0];
    const withArtic = layoutOrnaments(s, layout, undefined, artic)[0];
    const accentAbove = artic.find((a) => a.eventId === ids[1] && (a.glyph ?? '').endsWith('Above'));
    expect(accentAbove).toBeDefined();
    expect(withArtic.y as number).toBeLessThanOrEqual(withoutArtic.y as number);
    expect(withArtic.y as number).toBeLessThan(accentAbove!.y as number);
  });
});
