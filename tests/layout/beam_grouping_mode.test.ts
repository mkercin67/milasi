// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import type { BaseDurationType, ScoreEvent } from '../../src/core/model';
import { setBeamGrouping } from '../../src/core/commands';
import { groupBeams } from '../../src/layout/beams';
import { layoutScore } from '../../src/layout/layoutScore';

const note = (baseType: BaseDurationType, step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B' = 'C'): ScoreEvent =>
  createNote({ pitches: [createPitch(step, 4)], baseType });
const eighths = (count: number): ScoreEvent[] => Array.from({ length: count }, () => note('eighth'));
const sizes = (groups: Array<{ eventIds: string[] }>): number[] => groups.map((g) => g.eventIds.length);
const FOUR_FOUR = { num: 4, den: 4 };

describe('M7b-7: beam grouping mode', () => {
  it('G1: 4/4 with eight eighths gives two groups of 4 by half bar and four groups of 2 by beat', () => {
    const events = eighths(8);
    expect(sizes(groupBeams(events, FOUR_FOUR, 'half-bar'))).toEqual([4, 4]);
    expect(sizes(groupBeams(events, FOUR_FOUR, 'beat'))).toEqual([2, 2, 2, 2]);
    expect(sizes(groupBeams(events, FOUR_FOUR))).toEqual([2, 2, 2, 2]);
  });

  it('G2: a half bar window that holds a rest falls back to pairs (8th 8th quarter-rest)', () => {
    const events = [note('eighth'), note('eighth'), createRest({ baseType: 'quarter' }), ...eighths(4)];
    // Window 0 = 8th 8th rest -> pair; window 1 = four eighths -> one group of 4.
    expect(sizes(groupBeams(events, FOUR_FOUR, 'half-bar'))).toEqual([2, 4]);
  });

  it('G3: a window with 16ths keeps beat grouping inside the window', () => {
    const events = [
      note('eighth'),
      note('eighth'),
      note('16th'),
      note('16th'),
      note('16th'),
      note('16th'),
      ...eighths(4),
    ];
    expect(sizes(groupBeams(events, FOUR_FOUR, 'half-bar'))).toEqual([2, 4, 4]);
  });

  it('G4: other meters ignore the mode (3/4, 6/8, 2/2)', () => {
    expect(sizes(groupBeams(eighths(6), { num: 3, den: 4 }, 'half-bar'))).toEqual([2, 2, 2]);
    expect(sizes(groupBeams(eighths(6), { num: 6, den: 8 }, 'half-bar'))).toEqual([3, 3]);
    expect(sizes(groupBeams(eighths(8), { num: 2, den: 2 }, 'half-bar'))).toEqual(
      sizes(groupBeams(eighths(8), { num: 2, den: 2 }, 'beat'))
    );
  });

  it('G5: tuplet eighths are never merged across a half bar window', () => {
    const triplet = (): ScoreEvent =>
      createNote({ pitches: [createPitch('C', 4)], baseType: 'eighth', tuplet: { actual: 3, normal: 2 } });
    // Six triplet eighths fill window 0 exactly (6 x 320 = 1920) but must stay per beat.
    const events = [triplet(), triplet(), triplet(), triplet(), triplet(), triplet(), ...eighths(4)];
    expect(sizes(groupBeams(events, FOUR_FOUR, 'beat'))).toEqual([3, 3, 2, 2]);
    expect(sizes(groupBeams(events, FOUR_FOUR, 'half-bar'))).toEqual([3, 3, 4]);
  });

  it('G6: switching the mode on the same score changes the beam groups (no stale cached measure)', () => {
    const score = createEmptyScore({ measures: 1 });
    const mDef = score.measures[0];
    const voice = score.parts[0].staves[0].measures[mDef.id].voices[0];
    voice.events = eighths(8);
    const countGroups = (s: typeof score): number => {
      const layout = layoutScore(s, { width: 120 });
      return new Set(
        layout.systems[0].items.filter((it) => it.kind === 'beam' && it.level === 1).map((it) => it.beamGroupId)
      ).size;
    };
    expect(countGroups(score)).toBe(4);
    const halfBar = setBeamGrouping('half-bar').apply(score);
    expect(countGroups(halfBar)).toBe(2);
    expect(countGroups(setBeamGrouping('beat').apply(halfBar))).toBe(4);
  });

  it('G8: with a 4-note group every stem ends exactly on the single primary beam line', () => {
    const score = createEmptyScore({ measures: 1 });
    const mDef = score.measures[0];
    const events = [note('eighth', 'G'), note('eighth', 'A'), note('eighth', 'B'), note('eighth', 'C'), ...eighths(4)];
    score.parts[0].staves[0].measures[mDef.id].voices[0].events = events;
    const layout = layoutScore(setBeamGrouping('half-bar').apply(score), { width: 120 });
    const items = layout.systems[0].items;
    const beams = items.filter((it) => it.kind === 'beam' && it.level === 1);
    expect(beams).toHaveLength(2);
    const first = beams[0];
    const pts = first.points!;
    const yOnBeam = (x: number): number => pts[0].y + ((pts[1].y - pts[0].y) * (x - pts[0].x)) / (pts[1].x - pts[0].x);
    for (const id of first.eventIds!) {
      const stem = items.find((it) => it.id === `${id}-stem`)!;
      expect(stem.y2).toBeCloseTo(yOnBeam(stem.x), 6);
    }
  });
});
