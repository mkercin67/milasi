// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-3b part 3: what the keys do while grace entry is on (pure decision logic, no React).
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { graceDuration, graceKeyResult } from '../../src/ui/editor/graceEntry';
import type { KeyEventLike } from '../../src/ui/keymap';
import type { NoteEvent, Score } from '../../src/core/model';

const key = (code: string, extra: Partial<KeyEventLike> = {}): KeyEventLike => ({
  code,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...extra,
});

function setup(keySig = 0): { score: Score; id: string } {
  const score = createEmptyScore({ numMeasures: 1 });
  score.measures[0].keySig = keySig;
  const note = createNote({ pitches: [createPitch('E', 5, 0)], baseType: 'quarter' });
  score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events = [
    note,
    createNote({ pitches: [createPitch('G', 5, 0)], baseType: 'quarter' }),
  ];
  return { score, id: note.id };
}

function run(score: Score, r: ReturnType<typeof graceKeyResult>): Score {
  if (r.kind !== 'command') throw new Error(`expected a command, got ${r.kind}`);
  return r.command.apply(score);
}
const first = (s: Score) => s.parts[0].staves[0].measures[s.measures[0].id].voices[0].events[0] as NoteEvent;

describe('grace note entry keys (M7c-3b)', () => {
  it('GE1: a letter adds a grace note of the chosen kind, in the octave nearest to the main note', () => {
    const { score, id } = setup();
    const s = run(score, graceKeyResult(score, id, 'acciaccatura', 'quarter', key('KeyD')));
    const g = first(s).graces![0];
    expect(g.kind).toBe('acciaccatura');
    expect([g.pitch.step, g.pitch.octave, g.pitch.alter]).toEqual(['D', 5, 0]);
    const low = run(score, graceKeyResult(score, id, 'appoggiatura', 'quarter', key('KeyB')));
    expect([first(low).graces![0].pitch.step, first(low).graces![0].pitch.octave]).toEqual(['B', 4]);
  });

  it('GE2: the key signature gives the accidental (F is F sharp in D major)', () => {
    const { score, id } = setup(2);
    const s = run(score, graceKeyResult(score, id, 'acciaccatura', 'quarter', key('KeyF')));
    expect(first(s).graces![0].pitch.alter).toBe(1);
  });

  it('GE3: the grace duration follows the input duration when legal, otherwise a sixteenth', () => {
    expect(graceDuration('eighth')).toBe('eighth');
    expect(graceDuration('16th')).toBe('16th');
    expect(graceDuration('32nd')).toBe('32nd');
    expect(graceDuration('quarter')).toBe('16th');
    expect(graceDuration('whole')).toBe('16th');
    const { score, id } = setup();
    const s = run(score, graceKeyResult(score, id, 'acciaccatura', 'eighth', key('KeyD')));
    expect(first(s).graces![0].baseType).toBe('eighth');
  });

  it('GE4: Shift+Up and Shift+Down move the last grace note by a semitone, within two accidentals', () => {
    const { score, id } = setup();
    let s = run(score, graceKeyResult(score, id, 'acciaccatura', 'quarter', key('KeyD')));
    s = run(s, graceKeyResult(s, id, 'acciaccatura', 'quarter', key('ArrowUp', { shiftKey: true })));
    expect(first(s).graces![0].pitch.alter).toBe(1);
    s = run(s, graceKeyResult(s, id, 'acciaccatura', 'quarter', key('ArrowUp', { shiftKey: true })));
    s = run(s, graceKeyResult(s, id, 'acciaccatura', 'quarter', key('ArrowUp', { shiftKey: true })));
    expect(first(s).graces![0].pitch.alter).toBe(2);
    s = run(s, graceKeyResult(s, id, 'acciaccatura', 'quarter', key('ArrowDown', { shiftKey: true })));
    expect(first(s).graces![0].pitch.alter).toBe(1);
  });

  it('GE5: Backspace removes the last grace note; with none left the key is left to the normal handler', () => {
    const { score, id } = setup();
    let s = run(score, graceKeyResult(score, id, 'acciaccatura', 'quarter', key('KeyD')));
    s = run(s, graceKeyResult(s, id, 'acciaccatura', 'quarter', key('KeyC')));
    s = run(s, graceKeyResult(s, id, 'acciaccatura', 'quarter', key('Backspace')));
    expect(first(s).graces!.map((g) => g.pitch.step)).toEqual(['D']);
    const none = graceKeyResult(score, id, 'acciaccatura', 'quarter', key('ArrowUp', { shiftKey: true }));
    expect(none.kind).toBe('ignore');
  });

  it('GE6: the fifth grace note is refused with a limit result', () => {
    const { score, id } = setup();
    let s = score;
    for (let i = 0; i < 4; i++) s = run(s, graceKeyResult(s, id, 'acciaccatura', 'quarter', key('KeyD')));
    expect(graceKeyResult(s, id, 'acciaccatura', 'quarter', key('KeyD')).kind).toBe('limit');
  });

  it('GE7: Escape leaves the mode; other keys, modified keys, Shift+letter and an off mode are ignored', () => {
    const { score, id } = setup();
    expect(graceKeyResult(score, id, 'acciaccatura', 'quarter', key('Escape')).kind).toBe('exit');
    expect(graceKeyResult(score, id, 'acciaccatura', 'quarter', key('ArrowLeft')).kind).toBe('ignore');
    expect(graceKeyResult(score, id, 'acciaccatura', 'quarter', key('KeyD', { ctrlKey: true })).kind).toBe('ignore');
    expect(graceKeyResult(score, id, 'acciaccatura', 'quarter', key('KeyD', { shiftKey: true })).kind).toBe('ignore');
    expect(graceKeyResult(score, id, null, 'quarter', key('KeyD')).kind).toBe('ignore');
    expect(graceKeyResult(score, null, 'acciaccatura', 'quarter', key('KeyD')).kind).toBe('ignore');
    expect(graceKeyResult(score, 'no-such-id', 'acciaccatura', 'quarter', key('KeyD')).kind).toBe('ignore');
  });
});
