import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { expandRepeats } from '../../src/playback/repeats';
import { buildSchedule } from '../../src/playback/schedule';
import { validateScore } from '../../src/core/validate';
import { setTempo } from '../../src/core/commands';

describe('Milestone 6d: Repeats Playback and Validation Specs', () => {
  it('FAILING-FIRST: reference score expands to measures 1..4 twice and 5..8 twice (16 measures total)', () => {
    const score = createEmptyScore({ numMeasures: 8, timeSig: { num: 2, den: 4 } });
    (score.measures[3] as any).repeatEnd = true;
    (score.measures[4] as any).repeatStart = true;
    (score.measures[7] as any).repeatEnd = true;

    const expanded = expandRepeats(score);
    const measureIndices = expanded.map((m) => score.measures.findIndex((orig) => orig.id === m.id) + 1);

    expect(measureIndices).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 5, 6, 7, 8]);
    expect(expanded.length).toBe(16);
  });

  it('FAILING-FIRST: score with two voltas plays volta 1 on pass 1, volta 2 on pass 2', () => {
    // 4 measures: m1, m2 (start repeat), m3 (volta 1, end repeat), m4 (volta 2)
    const score = createEmptyScore({ numMeasures: 4, timeSig: { num: 2, den: 4 } });
    (score.measures[1] as any).repeatStart = true;
    (score.measures[2] as any).repeatEnd = true;
    (score.measures[2] as any).volta = { number: 1 };
    (score.measures[3] as any).volta = { number: 2 };

    const expanded = expandRepeats(score);
    const measureIndices = expanded.map((m) => score.measures.findIndex((orig) => orig.id === m.id) + 1);

    // Expected: 1, 2, 3 (volta 1), 2, 4 (volta 2)
    expect(measureIndices).toEqual([1, 2, 3, 2, 4]);
  });

  it('FAILING-FIRST: handles a repeat across a tie without crashing or hanging', () => {
    const score = createEmptyScore({ numMeasures: 2, timeSig: { num: 2, den: 4 } });
    (score.measures[1] as any).repeatEnd = true;

    const n1 = createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'half' });
    n1.tiedToNext = true;
    const n2 = createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'half' });
    score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events = [n1];
    score.parts[0].staves[0].measures[score.measures[1].id].voices[0].events = [n2];

    const schedule = buildSchedule(score);
    expect(schedule.totalSeconds).toBeGreaterThan(0);
    expect(schedule.notes.length).toBeGreaterThan(0);
  });

  it('FAILING-FIRST: reapplies tempo change inside a repeat on pass 2', () => {
    const score = createEmptyScore({ numMeasures: 2, timeSig: { num: 2, den: 4 } });
    (score.measures[1] as any).repeatEnd = true;
    // Measure 1 tempo 120 bpm; Measure 2 tempo 60 bpm
    const withTempo = setTempo(score.measures[1].id, { bpm: 60, beatUnit: 1.0 }).apply(score);

    const schedule = buildSchedule(withTempo);
    // Measure 1 (120 bpm): 1s. Measure 2 (60 bpm): 2s.
    // Pass 1: 1s + 2s = 3s. Pass 2: 1s + 2s = 3s. Total = 6s.
    expect(schedule.totalSeconds).toBeCloseTo(6.0, 1);
  });

  it('FAILING-FIRST: nested repeats without closing are rejected with a validation warning/error', () => {
    const score = createEmptyScore({ numMeasures: 6, timeSig: { num: 2, den: 4 } });
    (score.measures[1] as any).repeatStart = true;
    (score.measures[2] as any).repeatStart = true; // Nested repeat start without closing previous!
    (score.measures[4] as any).repeatEnd = true;

    const issues = validateScore(score);
    const hasNestedError = issues.some((iss) => iss.message.includes('nested repeat') || iss.code === 'nested-repeat');
    expect(hasNestedError).toBe(true);
  });
});
