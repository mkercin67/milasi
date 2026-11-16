import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';
import { layoutTies } from '../../src/layout/ties';

describe('Milestone 6a: Tie Layout (src/layout/ties.ts)', () => {
  it('generates a curved crescent SVG path for notes tied on the same system', () => {
    const score = createEmptyScore({ measures: 1 });
    const staff = score.parts[0].staves[0];
    const mId = score.measures[0].id;

    const n1 = createNote({
      pitches: [{ step: 'G', octave: 4, alter: 0, tiedToNext: true }],
      baseType: 'quarter',
    });
    const n2 = createNote({
      pitches: [{ step: 'G', octave: 4, alter: 0 }],
      baseType: 'quarter',
    });
    staff.measures[mId].voices[0].events = [n1, n2];

    const layout = layoutScore(score, { width: 100 });
    const ties = layoutTies(score, layout);

    expect(ties).toHaveLength(1);
    expect(ties[0].systemIndex).toBe(0);
    // Must be a valid SVG path with M, Q, and Z (crescent shape)
    expect(ties[0].d).toMatch(/^M\s*[\d.-]+[\s,]+[\d.-]+.*Q.*Z$/);
  });

  it('splits tie into two half-ties across a system break', () => {
    // 5 measures wrapped into 2 systems
    const score = createEmptyScore({ measures: 5 });
    const staff = score.parts[0].staves[0];
    const m2Id = score.measures[2].id;
    const m3Id = score.measures[3].id;

    // Place tied note at the end of measure 2 (end of system 0) and next note at measure 3 (start of system 1)
    const nA = createNote({
      pitches: [{ step: 'C', octave: 5, alter: 0, tiedToNext: true }],
      baseType: 'quarter',
    });
    const nB = createNote({
      pitches: [{ step: 'C', octave: 5, alter: 0 }],
      baseType: 'quarter',
    });

    staff.measures[m2Id].voices[0].events = [nA];
    staff.measures[m3Id].voices[0].events = [nB];

    // Narrow layout width so m2 is on system 0 and m3 is on system 1
    const layout = layoutScore(score, { width: 30 });
    const ties = layoutTies(score, layout);

    // If systems differ, there must be 2 half-ties (one on system 0, one on system 1)
    const sys0 = ties.filter((t) => t.systemIndex === 0);
    const sys1 = ties.filter((t) => t.systemIndex === 1);
    expect(sys0.length).toBe(1);
    expect(sys1.length).toBe(1);
  });
});
