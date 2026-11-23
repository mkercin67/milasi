// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-6 step 2: the layout draws the staves of ALL parts as one system.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createGrandStaffScore, createNote, createPitch } from '../../src/core/factory';
import { applyTemplate } from '../../src/core/ensembleCommands';
import { layoutScore } from '../../src/layout/layoutScore';
import { validateScore } from '../../src/core/validate';
import { getGalleryCases } from '../../src/ui/galleryCases';
import type { Score } from '../../src/core/model';
import type { LayoutItem } from '../../src/layout/types';

const quartet = (): Score => applyTemplate('stringQuartet').apply(createEmptyScore({ numMeasures: 2 }));
const allStaffIds = (s: Score) => s.parts.flatMap((p) => p.staves.map((st) => st.id));

describe('M7c-6 ensemble layout (step 2)', () => {
  it('EL1: a string quartet system has four staves in part order', () => {
    const score = quartet();
    const r = layoutScore(score);
    expect(r.systems[0].staves.map((s) => s.id)).toEqual(allStaffIds(score));
  });

  it('EL2: staves are stacked downwards; the gap between parts is larger than inside a piano part', () => {
    const score = applyTemplate('voicePiano').apply(createEmptyScore({ numMeasures: 2 }));
    const ys = layoutScore(score).systems[0].staves.map((s) => s.y);
    expect(ys.length).toBe(3);
    const partGap = ys[1] - ys[0];
    const insideGap = ys[2] - ys[1];
    expect(partGap > insideGap).toBe(true);
    expect(insideGap).toBe(11);
  });

  it('EL3: a one-part grand staff keeps its staff pitch of 11 staff spaces', () => {
    const ys = layoutScore(createGrandStaffScore({ numMeasures: 2 })).systems[0].staves.map((s) => s.y);
    expect(ys[1] - ys[0]).toBe(11);
  });

  it('EL4: every staff gets five staff lines per system', () => {
    const score = quartet();
    const r = layoutScore(score);
    for (const id of allStaffIds(score)) {
      const lines = r.systems[0].items.filter((it) => it.id.includes('staffline') && it.staffId === id);
      expect(lines.length).toBe(5);
    }
  });

  it('EL5: each staff header shows the clef of its own part', () => {
    const score = quartet();
    const r = layoutScore(score);
    const clefOf = (staffId: string): string | undefined =>
      r.systems[0].items.find((it) => it.id.includes('clef-') && it.staffId === staffId)?.glyph;
    const ids = allStaffIds(score);
    expect(clefOf(ids[0])).toBe('gClef');
    expect(clefOf(ids[2])).toBe('cClef');
    expect(clefOf(ids[3])).toBe('fClef');
  });

  it('EL6: notes at the same beat of different parts share one x column', () => {
    const score = structuredClone(quartet()); // immer results are frozen
    const m0 = score.measures[0].id;
    const first = score.parts[0].staves[0];
    const last = score.parts[3].staves[0];
    first.measures[m0].voices[0].events = [createNote({ pitches: [createPitch('E', 5)], baseType: 'whole' })];
    last.measures[m0].voices[0].events = [createNote({ pitches: [createPitch('C', 3)], baseType: 'whole' })];
    const r = layoutScore(score);
    const head = (staffId: string): LayoutItem | undefined =>
      r.systems[0].items.find((it) => it.glyph?.startsWith('notehead') && it.staffId === staffId);
    const a = head(first.id);
    const b = head(last.id);
    expect(a !== undefined && b !== undefined).toBe(true);
    expect(a!.x).toBe(b!.x);
  });

  it('EL7: a single-staff score still has no staff ids and one container', () => {
    const r = layoutScore(createEmptyScore({ numMeasures: 2 }));
    expect(r.systems[0].staves.length).toBe(1);
  });

  it('EL8: the three ensemble gallery cards build valid scores with notes on every staff', () => {
    const ids = ['ensemble-string-quartet', 'ensemble-satb', 'ensemble-voice-piano'];
    const expectedStaves = [4, 4, 3];
    ids.forEach((id, i) => {
      const card = getGalleryCases().find((c) => c.id === id);
      expect(card !== undefined).toBe(true);
      const score = card!.build();
      expect(validateScore(score).filter((p) => p.severity === 'error').length).toBe(0);
      const staves = score.parts.flatMap((p) => p.staves);
      expect(staves.length).toBe(expectedStaves[i]);
      for (const st of staves) {
        const first = st.measures[score.measures[0].id].voices[0].events[0];
        expect(first.kind).toBe('note');
      }
    });
  });
});
