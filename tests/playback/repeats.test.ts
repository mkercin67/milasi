import { describe, expect, it } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import { expandRepeats } from '../../src/playback/repeats';
import { buildSchedule } from '../../src/playback/schedule';
import { produce } from 'immer';

describe('Milestone 6d: Repeats and Voltas Linear Playback (expandRepeats)', () => {
  it('FAILING-FIRST: repeats a section between repeatStart and repeatEnd once', () => {
    let score = createEmptyScore({ numMeasures: 5 });
    // Structure: m0 -> |: m1 -> m2 :| -> m3 -> m4
    score = produce(score, (draft) => {
      draft.measures[1].repeatStart = true;
      draft.measures[2].repeatEnd = true;
    });

    const expanded = expandRepeats(score);
    const measureIndices = expanded.map((entry) => entry.measureIndex);
    // Expected pass 1: 0, 1, 2; pass 2: 1, 2; continue: 3, 4
    expect(measureIndices).toEqual([0, 1, 2, 1, 2, 3, 4]);
  });

  it('repeats from measure 0 when repeatEnd has no preceding repeatStart', () => {
    let score = createEmptyScore({ numMeasures: 4 });
    // Structure: m0 -> m1 :| -> m2 -> m3
    score = produce(score, (draft) => {
      draft.measures[1].repeatEnd = true;
    });

    const expanded = expandRepeats(score);
    const measureIndices = expanded.map((entry) => entry.measureIndex);
    // Expected pass 1: 0, 1; pass 2: 0, 1; continue: 2, 3
    expect(measureIndices).toEqual([0, 1, 0, 1, 2, 3]);
  });

  it('handles 1st and 2nd volta endings correctly (skipping volta 1 on pass 2)', () => {
    let score = createEmptyScore({ numMeasures: 5 });
    // Structure: m0 -> |: m1 -> m2 (volta 1, :|) -> m3 (volta 2) -> m4
    score = produce(score, (draft) => {
      draft.measures[1].repeatStart = true;
      draft.measures[2].volta = { number: 1 };
      draft.measures[2].repeatEnd = true;
      draft.measures[3].volta = { number: 2 };
    });

    const expanded = expandRepeats(score);
    const measureIndices = expanded.map((entry) => entry.measureIndex);
    // Expected pass 1: 0, 1, 2; pass 2 jumps back to 1, skips 2 (volta 1), plays 3 (volta 2), then 4
    expect(measureIndices).toEqual([0, 1, 2, 1, 3, 4]);
  });

  it('handles multi-measure voltas correctly', () => {
    let score = createEmptyScore({ numMeasures: 7 });
    // Structure: |: m0 -> m1 (volta 1) -> m2 (volta 1, :|) -> m3 (volta 2) -> m4 (volta 2) -> m5 -> m6
    score = produce(score, (draft) => {
      draft.measures[0].repeatStart = true;
      draft.measures[1].volta = { number: 1 };
      draft.measures[2].volta = { number: 1 };
      draft.measures[2].repeatEnd = true;
      draft.measures[3].volta = { number: 2 };
      draft.measures[4].volta = { number: 2 };
    });

    const expanded = expandRepeats(score);
    const measureIndices = expanded.map((entry) => entry.measureIndex);
    // Expected: 0, 1, 2, 0, 3, 4, 5, 6
    expect(measureIndices).toEqual([0, 1, 2, 0, 3, 4, 5, 6]);
  });

  it('handles combined repeat back-to-back repeats', () => {
    let score = createEmptyScore({ numMeasures: 4 });
    // Structure: m0 :| |: m1 :| -> m2 -> m3
    score = produce(score, (draft) => {
      draft.measures[0].repeatEnd = true;
      draft.measures[1].repeatStart = true;
      draft.measures[1].repeatEnd = true;
    });

    const expanded = expandRepeats(score);
    expect(expanded.length).toBeGreaterThan(score.measures.length);
  });

  it('buildSchedule produces more scheduled notes when repeats exist', () => {
    let score = createEmptyScore({ numMeasures: 2 });
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;
    score = produce(score, (draft) => {
      draft.measures[0].repeatStart = true;
      draft.measures[1].repeatEnd = true;
      draft.parts[0].staves[0].measures[m0Id].voices[0].events = [
        { id: 'n1', kind: 'note', baseType: 'whole', dots: 0, duration: 3840, pitches: [{ step: 'C', octave: 4, alter: 0 }], articulations: [] },
      ];
      draft.parts[0].staves[0].measures[m1Id].voices[0].events = [
        { id: 'n2', kind: 'note', baseType: 'whole', dots: 0, duration: 3840, pitches: [{ step: 'D', octave: 4, alter: 0 }], articulations: [] },
      ];
    });

    const schedule = buildSchedule(score);
    // 2 measures of whole notes repeated = 4 scheduled notes
    expect(schedule.notes.length).toBe(4);
  });
});
