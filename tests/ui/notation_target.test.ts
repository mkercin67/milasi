// SPDX-License-Identifier: GPL-3.0-or-later
// Input mode: marks go to the note just entered when nothing is selected.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { resolveNotationTarget } from '../../src/ui/editor/notationTarget';
import type { ScoreCursor } from '../../src/core/input';

function setup() {
  const score = createEmptyScore({ numMeasures: 1 });
  const m0 = score.measures[0].id;
  const a = createNote({ pitches: [createPitch('B', 4, 0)], baseType: 'eighth' });
  const b = createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'eighth' });
  score.parts[0].staves[0].measures[m0].voices[0].events = [a, b];
  const cursor: ScoreCursor = {
    staffId: score.parts[0].staves[0].id,
    voiceIndex: 1,
    measureId: m0,
    tick: a.duration + b.duration,
  };
  return { score, a, b, cursor };
}

describe('resolveNotationTarget', () => {
  it('G1: input mode, nothing selected: the note before the cursor', () => {
    const { score, b, cursor } = setup();
    expect(resolveNotationTarget(score, { kind: 'none' }, null, 'input', cursor)).toEqual({ kind: 'event', id: b.id });
  });

  it('G2: select mode, nothing selected: no target (no surprise edits)', () => {
    const { score, cursor } = setup();
    expect(resolveNotationTarget(score, { kind: 'none' }, null, 'select', cursor)).toBeNull();
  });

  it('G3: an explicit selection wins over the cursor', () => {
    const { score, a, cursor } = setup();
    expect(resolveNotationTarget(score, { kind: 'event', id: a.id }, null, 'input', cursor)).toEqual({
      kind: 'event',
      id: a.id,
    });
  });

  it('G4: the single selected event id is used before the cursor', () => {
    const { score, a, cursor } = setup();
    expect(resolveNotationTarget(score, { kind: 'none' }, a.id, 'input', cursor)).toEqual({ kind: 'event', id: a.id });
  });

  it('G6: a stale selection (event no longer in the score) falls back to the note before the cursor', () => {
    const { score, b, cursor } = setup();
    expect(resolveNotationTarget(score, { kind: 'event', id: 'gone' }, 'gone', 'input', cursor)).toEqual({
      kind: 'event',
      id: b.id,
    });
  });

  it('G5: cursor at the start of the score: nothing was entered, no target', () => {
    const { score, cursor } = setup();
    expect(resolveNotationTarget(score, { kind: 'none' }, null, 'input', { ...cursor, tick: 0 })).toBeNull();
  });
});
