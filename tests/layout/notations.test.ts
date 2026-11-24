// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';
import { layoutArticulations, layoutDynamics, layoutSlurs } from '../../src/layout/notations';

describe('Milestone 6b Layout: Dynamics, Articulations, Slurs (src/layout/notations.ts)', () => {
  it('positions dynamics centered on notehead and below the staff by default', () => {
    const score = createEmptyScore({ timeSig: { num: 4, den: 4 }, measures: 1 });
    const staff = score.parts[0].staves[0];
    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter', dynamic: 'f' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter', dynamic: 'pp' });
    const n4 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
    staff.measures[score.measures[0].id].voices[0].events = [n1, n2, n3, n4];

    const layout = layoutScore(score, { width: 70 });
    const dynamics = layoutDynamics(score, layout);

    expect(dynamics).toHaveLength(2);
    expect(dynamics[0].glyph).toBe('dynamicForte');
    expect(dynamics[0].y).toBe(6.5);
    expect(dynamics[1].glyph).toBe('dynamicPP');
    expect(dynamics[1].y).toBe(6.5);
  });

  it('DY1: a dynamic under a chord with a note on a second ledger line below the staff sits under that note', () => {
    const score = createEmptyScore({ timeSig: { num: 4, den: 4 }, measures: 1 });
    const staff = score.parts[0].staves[0];
    // A3 is two spaces below the bottom line (head spans y 5.5 to 6.5): the default baseline 6.5 would touch it (8.1 = 6.5 + 1.6 clearance).
    const chord = createNote({
      pitches: [createPitch('A', 3), createPitch('D', 4), createPitch('F', 4, 1)],
      baseType: 'quarter',
      dynamic: 'p',
    });
    const plain = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter', dynamic: 'f' });
    staff.measures[score.measures[0].id].voices[0].events = [
      chord,
      plain,
      createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' }),
    ];
    const dynamics = layoutDynamics(score, layoutScore(score, { width: 70 }));
    expect(dynamics.find((d) => d.eventId === chord.id)?.y).toBe(8.1);
    // A note with one ledger line (C4) keeps the default position, as before.
    expect(dynamics.find((d) => d.eventId === plain.id)?.y).toBe(6.5);
  });

  it('stacks multiple articulations in correct order (staccato/tenuto closest, accent/marcato outwards)', () => {
    const score = createEmptyScore({ timeSig: { num: 4, den: 4 }, measures: 1 });
    const staff = score.parts[0].staves[0];
    // Stem up note (C4, y=4.0): articulations go below notehead (y > 4.0)
    const n1 = createNote({
      pitches: [createPitch('C', 4)],
      baseType: 'quarter',
      articulations: ['accent', 'staccato'],
    });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const n4 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
    staff.measures[score.measures[0].id].voices[0].events = [n1, n2, n3, n4];

    const layout = layoutScore(score, { width: 70 });
    const arts = layoutArticulations(score, layout);

    expect(arts).toHaveLength(2);
    // Staccato (closest) has smaller Y distance from notehead than accent (further)
    const staccatoItem = arts.find((a) => a.glyph?.includes('Staccato'));
    const accentItem = arts.find((a) => a.glyph?.includes('Accent'));
    expect(staccatoItem).toBeDefined();
    expect(accentItem).toBeDefined();
    // Staccato (closest) is closer to the notehead than accent (further outwards)
    const nhY = layout.systems[0].items.find((it) => it.eventId === n1.id && it.glyph?.startsWith('notehead'))!.y;
    expect(Math.abs(staccatoItem!.y - nhY)).toBeLessThan(Math.abs(accentItem!.y - nhY));
  });

  it('generates a curved bezier slur for notes on the same system', () => {
    const score = createEmptyScore({ timeSig: { num: 4, den: 4 }, measures: 1 });
    const staff = score.parts[0].staves[0];
    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const n4 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
    staff.measures[score.measures[0].id].voices[0].events = [n1, n2, n3, n4];
    staff.slurs = [{ id: 'slur-1', startEventId: n1.id, endEventId: n3.id }];

    const layout = layoutScore(score, { width: 70 });
    const slurs = layoutSlurs(score, layout);

    expect(slurs).toHaveLength(1);
    expect(slurs[0].d).toMatch(/^M [0-9.]+ [0-9.]+ C/);
    expect(slurs[0].systemIndex).toBe(0);
  });

  it('splits slur into two half-slurs across a system break', () => {
    const score = createEmptyScore({ timeSig: { num: 4, den: 4 }, measures: 2 });
    const staff = score.parts[0].staves[0];
    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' });
    const n2 = createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' });
    staff.measures[score.measures[0].id].voices[0].events = [n1];
    staff.measures[score.measures[1].id].voices[0].events = [n2];
    staff.slurs = [{ id: 'slur-break', startEventId: n1.id, endEventId: n2.id }];

    // Very narrow width to force system break between measures
    const layout = layoutScore(score, { width: 15 });
    expect(layout.systems.length).toBeGreaterThanOrEqual(2);

    const slurs = layoutSlurs(score, layout);
    expect(slurs).toHaveLength(2);
    expect(slurs[0].systemIndex).toBe(0);
    expect(slurs[1].systemIndex).toBe(1);
  });
});
