// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import {
  advanceCursor,
  cycleVoice,
  enterNote,
  moveCursor,
  moveCursorToMeasureBoundary,
  ScoreCursor,
} from '../../src/core/input';
import { validateScore } from '../../src/core/validate';
import { History } from '../../src/core/commands';

describe('Voice Entry Navigation (T1 - T5)', () => {
  it('T1: keyboard-only two-voice measure enters quarters in voice 1, Home, Tab, then quarters in voice 2', () => {
    let score = createEmptyScore({ measures: 1 });
    const staffId = score.parts[0].staves[0].id;
    const measureId = score.measures[0].id;

    // Start in input mode at Voice 1, tick 0
    let cursor: ScoreCursor = {
      staffId,
      measureId,
      voiceIndex: 1,
      tick: 0,
    };

    // Voice 1: Enter C5, D5, E5, F5 (quarter notes = 960 ticks)
    const pitchesV1 = ['C5', 'D5', 'E5', 'F5'];
    for (const p of pitchesV1) {
      const cmd = enterNote(cursor, {
        baseType: 'quarter',
        dots: 0,
        pitch: { step: p[0] as any, octave: parseInt(p[1], 10), alter: 0 },
      });
      score = cmd.apply(score);
      cursor = advanceCursor(score, cursor, 960);
    }

    // After 4 quarters, cursor is at measure end (tick 3840)
    expect(cursor.tick).toBe(3840);
    expect(cursor.voiceIndex).toBe(1);

    // Home: move to start of measure (tick 0)
    cursor = moveCursorToMeasureBoundary(score, cursor, 'start');
    expect(cursor.tick).toBe(0);
    expect(cursor.voiceIndex).toBe(1);

    // Tab: cycle to Voice 2 (tick remains 0)
    cursor = cycleVoice(score, cursor, 'next');
    expect(cursor.tick).toBe(0);
    expect(cursor.voiceIndex).toBe(2);

    // Voice 2: Enter C4, D4, E4, F4 (quarter notes)
    const pitchesV2 = ['C4', 'D4', 'E4', 'F4'];
    for (const p of pitchesV2) {
      const cmd = enterNote(cursor, {
        baseType: 'quarter',
        dots: 0,
        pitch: { step: p[0] as any, octave: parseInt(p[1], 10), alter: 0 },
      });
      score = cmd.apply(score);
      cursor = advanceCursor(score, cursor, 960);
    }

    // Verify validateScore passes with 0 errors
    const errors = validateScore(score);
    expect(errors.filter((e) => e.severity === 'error')).toHaveLength(0);

    // Verify voice 1 events
    const sm = score.parts[0].staves[0].measures[measureId];
    const v1 = sm.voices.find((v) => v.voiceIndex === 1);
    expect(v1).toBeDefined();
    expect(v1!.events).toHaveLength(4);
    let t = 0;
    for (let i = 0; i < 4; i++) {
      const ev = v1!.events[i];
      expect(ev.kind).toBe('note');
      expect(t).toBe(i * 960);
      if (ev.kind === 'note') {
        expect(ev.pitches[0].step).toBe(pitchesV1[i][0]);
        expect(ev.pitches[0].octave).toBe(parseInt(pitchesV1[i][1], 10));
      }
      t += ev.duration;
    }

    // Verify voice 2 events
    const v2 = sm.voices.find((v) => v.voiceIndex === 2);
    expect(v2).toBeDefined();
    expect(v2!.events).toHaveLength(4);
    t = 0;
    for (let i = 0; i < 4; i++) {
      const ev = v2!.events[i];
      expect(ev.kind).toBe('note');
      expect(t).toBe(i * 960);
      if (ev.kind === 'note') {
        expect(ev.pitches[0].step).toBe(pitchesV2[i][0]);
        expect(ev.pitches[0].octave).toBe(parseInt(pitchesV2[i][1], 10));
      }
      t += ev.duration;
    }
  });

  it('T2: reverse order enters voice 2 notes first, Home, Shift+Tab, then voice 1 notes', () => {
    let score = createEmptyScore({ measures: 1 });
    const staffId = score.parts[0].staves[0].id;
    const measureId = score.measures[0].id;

    // Tab first to Voice 2 at tick 0
    let cursor: ScoreCursor = {
      staffId,
      measureId,
      voiceIndex: 1,
      tick: 0,
    };
    cursor = cycleVoice(score, cursor, 'next');
    expect(cursor.voiceIndex).toBe(2);
    expect(cursor.tick).toBe(0);

    // Voice 2: Enter 4 quarters (C4, D4, E4, F4)
    const pitchesV2 = ['C4', 'D4', 'E4', 'F4'];
    for (const p of pitchesV2) {
      const cmd = enterNote(cursor, {
        baseType: 'quarter',
        dots: 0,
        pitch: { step: p[0] as any, octave: parseInt(p[1], 10), alter: 0 },
      });
      score = cmd.apply(score);
      cursor = advanceCursor(score, cursor, 960);
    }
    expect(cursor.tick).toBe(3840);

    // Home to start of measure
    cursor = moveCursorToMeasureBoundary(score, cursor, 'start');
    expect(cursor.tick).toBe(0);

    // Shift+Tab back to Voice 1
    cursor = cycleVoice(score, cursor, 'prev');
    expect(cursor.voiceIndex).toBe(1);
    expect(cursor.tick).toBe(0);

    // Voice 1: Enter 4 quarters (C5, D5, E5, F5)
    const pitchesV1 = ['C5', 'D5', 'E5', 'F5'];
    for (const p of pitchesV1) {
      const cmd = enterNote(cursor, {
        baseType: 'quarter',
        dots: 0,
        pitch: { step: p[0] as any, octave: parseInt(p[1], 10), alter: 0 },
      });
      score = cmd.apply(score);
      cursor = advanceCursor(score, cursor, 960);
    }

    const errors = validateScore(score);
    expect(errors.filter((e) => e.severity === 'error')).toHaveLength(0);

    const sm = score.parts[0].staves[0].measures[measureId];
    expect(sm.voices.find((v) => v.voiceIndex === 1)!.events).toHaveLength(4);
    expect(sm.voices.find((v) => v.voiceIndex === 2)!.events).toHaveLength(4);
  });

  it('T3: mid-measure navigation with Left arrow moves back to beat 1 without touching existing notes', () => {
    let score = createEmptyScore({ measures: 1 });
    const staffId = score.parts[0].staves[0].id;
    const measureId = score.measures[0].id;

    // Voice 1: Enter two quarters (C5 at tick 0, D5 at tick 960)
    let cursor: ScoreCursor = { staffId, measureId, voiceIndex: 1, tick: 0 };
    let cmd = enterNote(cursor, {
      baseType: 'quarter',
      dots: 0,
      pitch: { step: 'C', octave: 5, alter: 0 },
    });
    score = cmd.apply(score);
    cursor = advanceCursor(score, cursor, 960);

    cmd = enterNote(cursor, {
      baseType: 'quarter',
      dots: 0,
      pitch: { step: 'D', octave: 5, alter: 0 },
    });
    score = cmd.apply(score);
    cursor = advanceCursor(score, cursor, 960);

    // Cursor is at tick 1920 (beat 3)
    expect(cursor.tick).toBe(1920);

    // Press Left arrow once -> moves to D5 start (tick 960)
    cursor = moveCursor(score, cursor, 'prev');
    expect(cursor.tick).toBe(960);

    // Press Left arrow second time -> moves to C5 start (tick 0)
    cursor = moveCursor(score, cursor, 'prev');
    expect(cursor.tick).toBe(0);

    // Press Tab -> switch to Voice 2 at tick 0
    cursor = cycleVoice(score, cursor, 'next');
    expect(cursor.voiceIndex).toBe(2);
    expect(cursor.tick).toBe(0);

    // Enter quarter C4 in Voice 2
    cmd = enterNote(cursor, {
      baseType: 'quarter',
      dots: 0,
      pitch: { step: 'C', octave: 4, alter: 0 },
    });
    score = cmd.apply(score);

    // Voice 1 notes must be untouched: C5 at 0, D5 at 960, rests after
    const sm = score.parts[0].staves[0].measures[measureId];
    const v1 = sm.voices.find((v) => v.voiceIndex === 1);
    expect(v1!.events[0].kind).toBe('note');
    if (v1!.events[0].kind === 'note') {
      expect(v1!.events[0].pitches[0].step).toBe('C');
    }
    expect(v1!.events[1].kind).toBe('note');
    if (v1!.events[1].kind === 'note') {
      expect(v1!.events[1].pitches[0].step).toBe('D');
    }
  });

  it('T4: Left and Right navigation on missing voice stops at first event and append position without creating events', () => {
    let score = createEmptyScore({ measures: 1 });
    const staffId = score.parts[0].staves[0].id;
    const measureId = score.measures[0].id;

    // Missing voice: Voice 2 in measure 1
    let cursor: ScoreCursor = { staffId, measureId, voiceIndex: 2, tick: 0 };

    // At first event position (tick 0), Left arrow does nothing
    const afterLeft = moveCursor(score, cursor, 'prev');
    expect(afterLeft.tick).toBe(0);
    expect(afterLeft.voiceIndex).toBe(2);

    // Right arrow moves to append position (tick 3840 = measure end)
    const afterRight = moveCursor(score, cursor, 'next');
    expect(afterRight.tick).toBe(3840);
    expect(afterRight.voiceIndex).toBe(2);

    // Right arrow at append position stops at append position
    const afterSecondRight = moveCursor(score, afterRight, 'next');
    expect(afterSecondRight.tick).toBe(3840);

    // Left arrow from append position returns to tick 0
    const backLeft = moveCursor(score, afterSecondRight, 'prev');
    expect(backLeft.tick).toBe(0);

    // Verify no events were created in voice 2
    const sm = score.parts[0].staves[0].measures[measureId];
    const v2 = sm.voices.find((v) => v.voiceIndex === 2);
    expect(v2).toBeUndefined();
  });

  it('T5: undo and redo restore cursor voiceIndex and tick for every new key path', () => {
    let score = createEmptyScore({ measures: 1 });
    const staffId = score.parts[0].staves[0].id;
    const measureId = score.measures[0].id;
    const history = new History(score);

    const pastCursors: ScoreCursor[] = [];
    const futureCursors: ScoreCursor[] = [];

    // Enter C5 in Voice 1
    let cursor: ScoreCursor = { staffId, measureId, voiceIndex: 1, tick: 0 };
    pastCursors.push({ ...cursor });
    let cmd = enterNote(cursor, {
      baseType: 'quarter',
      dots: 0,
      pitch: { step: 'C', octave: 5, alter: 0 },
    });
    score = history.do(cmd);
    cursor = advanceCursor(score, cursor, 960);

    // Move Home, then Tab to Voice 2
    cursor = moveCursorToMeasureBoundary(score, cursor, 'start');
    cursor = cycleVoice(score, cursor, 'next');

    // Enter C4 in Voice 2
    pastCursors.push({ ...cursor });
    cmd = enterNote(cursor, {
      baseType: 'quarter',
      dots: 0,
      pitch: { step: 'C', octave: 4, alter: 0 },
    });
    score = history.do(cmd);
    cursor = advanceCursor(score, cursor, 960);

    // Verify Voice 2 note exists
    const smBeforeUndo = score.parts[0].staves[0].measures[measureId];
    expect(smBeforeUndo.voices.find((v) => v.voiceIndex === 2)).toBeDefined();

    // Now undo Voice 2 note entry
    expect(history.canUndo()).toBe(true);
    futureCursors.push({ ...cursor });
    const restoredCursor = pastCursors.pop()!;
    cursor = restoredCursor;
    score = history.undo()!;

    // Cursor is restored to voice 2, tick 0
    expect(cursor.voiceIndex).toBe(2);
    expect(cursor.tick).toBe(0);

    // State after undo: Voice 2 note is undone
    const smAfterUndo = score.parts[0].staves[0].measures[measureId];
    const v2AfterUndo = smAfterUndo.voices.find((v) => v.voiceIndex === 2);
    expect(v2AfterUndo).toBeUndefined();

    // Redo restores Voice 2 note and cursor
    expect(history.canRedo()).toBe(true);
    pastCursors.push({ ...cursor });
    cursor = futureCursors.pop()!;
    score = history.redo()!;

    expect(cursor.voiceIndex).toBe(2);
    expect(cursor.tick).toBe(960);

    const smAfterRedo = score.parts[0].staves[0].measures[measureId];
    const v2AfterRedo = smAfterRedo.voices.find((v) => v.voiceIndex === 2);
    expect(v2AfterRedo).toBeDefined();
    expect(v2AfterRedo!.events.some((e) => e.kind === 'note')).toBe(true);
  });
});
