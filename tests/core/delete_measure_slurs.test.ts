// SPDX-License-Identifier: GPL-3.0-or-later
// Deleting a measure must not leave slurs that point at its events.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { deleteMeasure } from '../../src/core/structureCommands';
import { validateScore } from '../../src/core/validate';

describe('deleteMeasure and slurs', () => {
  it('D1: a slur ending in the deleted measure is removed, no validation error remains', () => {
    const score = createEmptyScore({ numMeasures: 2 });
    const staff = score.parts[0].staves[0];
    const [m0, m1] = score.measures;
    const a = createNote({ pitches: [createPitch('B', 4, 0)], baseType: 'quarter' });
    const b = createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'quarter' });
    staff.measures[m0.id].voices[0].events = [a, ...staff.measures[m0.id].voices[0].events.slice(1)];
    staff.measures[m1.id].voices[0].events = [b, ...staff.measures[m1.id].voices[0].events.slice(1)];
    staff.slurs = [{ id: 's1', startEventId: a.id, endEventId: b.id } as never];
    const after = deleteMeasure(1).apply(score);
    expect(after.parts[0].staves[0].slurs ?? []).toHaveLength(0);
    expect(validateScore(after).filter((p) => p.code.includes('slur'))).toHaveLength(0);
  });
});
