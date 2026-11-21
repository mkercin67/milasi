// SPDX-License-Identifier: GPL-3.0-or-later
// Derived note-name line (Do Re Mi / C D E): a score setting, never stored on events, separate from lyrics.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { setBeamGrouping, setShowNoteNames } from '../../src/core/commands';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { layoutScore } from '../../src/layout/layoutScore';
import type { NoteEvent, Score } from '../../src/core/model';
import type { NoteLabelStyle } from '../../src/layout/types';

function twoNotes(): Score {
  const score = createEmptyScore({ numMeasures: 2 });
  const m0 = score.measures[0].id;
  score.parts[0].staves[0].measures[m0].voices[0].events = [
    createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'quarter' }),
  ];
  return score;
}

function items(score: Score, style?: NoteLabelStyle) {
  return layoutScore(score, { width: 70, noteNameStyle: style }).items as Array<{
    id: string;
    text?: string;
    y?: number;
  }>;
}
const names = (score: Score, style?: NoteLabelStyle) =>
  items(score, style)
    .filter((it) => it.id.startsWith('note-name-'))
    .map((it) => it.text);

describe('Note-name layer (derived view, not lyrics)', () => {
  it('N1: off by default, no labels are drawn', () => {
    expect(names(twoNotes())).toEqual([]);
  });

  it('N2: on, solfège style (default) draws Do and Re', () => {
    const on = setShowNoteNames(true).apply(twoNotes());
    expect(names(on)).toEqual(['Do', 'Re']);
  });

  it('N3: letter style draws C and D', () => {
    const on = setShowNoteNames(true).apply(twoNotes());
    expect(names(on, 'letter')).toEqual(['C', 'D']);
  });

  it('N4: toggling and switching style always shows the current state (no stale cache)', () => {
    const base = twoNotes();
    const on = setShowNoteNames(true).apply(base);
    expect(names(on, 'solfege')).toEqual(['Do', 'Re']);
    expect(names(on, 'letter')).toEqual(['C', 'D']);
    expect(names(setShowNoteNames(false).apply(on))).toEqual([]);
    expect(names(on, 'solfege')).toEqual(['Do', 'Re']);
  });

  it('N5: lyrics stay on their own line and the command never touches events', () => {
    const score = twoNotes();
    const m0 = score.measures[0].id;
    const evs = score.parts[0].staves[0].measures[m0].voices[0].events as NoteEvent[];
    evs[0].lyrics = [{ verse: 1, text: 'Süt' }];
    const on = setShowNoteNames(true).apply(score);

    expect(on.parts).toBe(score.parts);
    const all = items(on);
    const lyric = all.find((it) => it.id.startsWith('lyric-text-'));
    const name = all.find((it) => it.id.startsWith('note-name-'));
    expect(lyric?.text).toBe('Süt');
    expect(name?.text).toBe('Do');
    expect(lyric!.y!).toBeGreaterThan(name!.y!);

    const off = items(setShowNoteNames(false).apply(on)).find((it) => it.id.startsWith('lyric-text-'));
    expect(off?.text).toBe('Süt');
  });

  it('N6: accidentals are spelled and chord tones are listed bottom to top', () => {
    const score = createEmptyScore({ numMeasures: 1 });
    const m0 = score.measures[0].id;
    score.parts[0].staves[0].measures[m0].voices[0].events = [
      createNote({ pitches: [createPitch('F', 4, 1)], baseType: 'quarter' }),
      createNote({
        pitches: [createPitch('G', 4, 0), createPitch('C', 4, 0), createPitch('E', 4, 0)],
        baseType: 'quarter',
      }),
      createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'half' }),
    ];
    const on = setShowNoteNames(true).apply(score);
    expect(names(on)).toEqual(['Fa♯', 'Do/Mi/Sol', 'Si♭']);
    expect(names(on, 'letter')).toEqual(['F♯', 'C/E/G', 'B♭']);
  });

  it('N7: polyphonic measures label every voice, stacked in voice order', () => {
    const score = createEmptyScore({ numMeasures: 1 });
    const m0 = score.measures[0].id;
    const up = createNote({ pitches: [createPitch('E', 5, 0)], baseType: 'half' });
    const low = createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'half' });
    score.parts[0].staves[0].measures[m0].voices = [
      { id: 'v1', voiceIndex: 1, events: [up, createNote({ pitches: [createPitch('F', 5, 0)], baseType: 'half' })] },
      { id: 'v2', voiceIndex: 2, events: [low, createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'half' })] },
    ];
    const on = setShowNoteNames(true).apply(score);
    const found = items(on).filter((it) => it.id.startsWith('note-name-'));
    expect(found.map((f) => f.text).sort()).toEqual(['Do', 'Fa', 'Mi', 'Re']);
    const mi = found.find((f) => f.text === 'Mi')!;
    const doo = found.find((f) => f.text === 'Do')!;
    expect(doo.y!).toBeGreaterThan(mi.y!);
  });

  it('N8: command stores the flag, removes it when off, keeps other layout settings', () => {
    const score = twoNotes();
    const on = setShowNoteNames(true).apply(score);
    expect(on.layoutSettings).toEqual({ showNoteNames: true });
    expect(setShowNoteNames(false).apply(on).layoutSettings).toBe(undefined);

    const both = setShowNoteNames(true).apply(setBeamGrouping('half-bar').apply(score));
    expect(both.layoutSettings).toEqual({ beamGrouping: 'half-bar', showNoteNames: true });
    expect(setShowNoteNames(false).apply(both).layoutSettings).toEqual({ beamGrouping: 'half-bar' });
  });

  it('N9: the setting is saved in the file and survives a round trip', () => {
    const full = createEmptyScore({ numMeasures: 1 });
    const m0 = full.measures[0].id;
    full.parts[0].staves[0].measures[m0].voices[0].events = [
      createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'half' }),
      createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'half' }),
    ];
    const on = setShowNoteNames(true).apply(full);
    const back = deserializeScore(serializeScore(on));
    expect(back.layoutSettings?.showNoteNames).toBe(true);
    expect(validateScore(back).filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('N10: validation rejects a non-boolean showNoteNames', () => {
    const bad = { ...twoNotes(), layoutSettings: { showNoteNames: 'yes' } } as unknown as Score;
    expect(validateScore(bad).some((p) => p.code === 'invalid-show-note-names')).toBe(true);
  });
});
