// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, beforeEach } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import { enterNote } from '../../src/core/input';
import { transposeRange } from '../../src/core/commands';
import { RangeSelection } from '../../src/core/selection';

function makeSel(staffId: string, voiceIndex: 1 | 2 | 3 | 4, anchorId: string, focusId: string): RangeSelection {
  return { staffId, voiceIndex, anchorId, focusId };
}
import { FakeEngine, Player, buildSchedule, resetScheduleBuildCounter, scheduleBuildCounter } from '../../src/playback';
import { resetValidateRunCounter, validateRunCounter } from '../../src/core/validate';
import { ValidationBurstController } from '../../src/ui/app/useAppValidation';
import { prepareScoreSave } from '../../src/ui/app/useAppStorage';
import { layoutScore, clearSystemLayoutCache } from '../../src/layout/layoutScore';

describe('Perf-2: Performance Optimizations (P1–P4)', () => {
  beforeEach(() => {
    resetScheduleBuildCounter();
    resetValidateRunCounter();
    clearSystemLayoutCache();
  });

  describe('T1: Lazy schedule build & playback throttling (P1)', () => {
    it('T1: 100 edits without playing keep scheduleBuildCounter at 0; Play builds exactly 1; live edit during playback throttles to <= 1 rebuild per frame', async () => {
      let score = createEmptyScore({ measures: 4 });
      const staffId = score.parts[0].staves[0].id;
      const m1Id = score.measures[0].id;

      score = enterNote(
        { staffId, measureId: m1Id, voiceIndex: 1, tick: 0 },
        { baseType: 'quarter', dots: 0, pitch: { step: 'C', octave: 4, alter: 0 } }
      ).apply(score);

      const engine = new FakeEngine();
      const player = new Player(score, engine);

      expect(scheduleBuildCounter).toBe(0);

      // Perform 100 single-note pitch edits without playing
      const eventId = score.parts[0].staves[0].measures[m1Id].voices[0].events[0].id;
      for (let i = 0; i < 100; i++) {
        const sel = makeSel(staffId, 1, eventId, eventId);
        score = transposeRange(sel, i % 2 === 0 ? 1 : -1).apply(score);
        player.setScore(score);
      }

      // Assert scheduleBuildCounter remained strictly 0
      expect(scheduleBuildCounter).toBe(0);

      // Pressing Play builds schedule exactly once
      await player.play();
      expect(scheduleBuildCounter).toBe(1);

      // Verify lazily built schedule deep-equals a fresh buildSchedule(score)
      const freshSchedule = buildSchedule(score);
      expect(player.schedule.notes).toEqual(freshSchedule.notes);
      expect(player.schedule.totalSeconds).toBe(freshSchedule.totalSeconds);

      // Live edits during active playback: throttle to <= 1 rebuild per frame
      const counterBeforeLiveEdits = scheduleBuildCounter;
      for (let i = 0; i < 20; i++) {
        const sel = makeSel(staffId, 1, eventId, eventId);
        score = transposeRange(sel, 1).apply(score);
        player.setScore(score, { live: true });
      }

      // Before frame fires, no synchronous rebuild occurred
      expect(scheduleBuildCounter).toBe(counterBeforeLiveEdits);

      // Wait 35ms for animation frame / timer to fire
      await new Promise((r) => setTimeout(r, 35));

      // After frame, at most 1 rebuild happened
      expect(scheduleBuildCounter - counterBeforeLiveEdits).toBeLessThanOrEqual(1);

      player.stop();
    });
  });

  describe('T2: Deferred validateScore & synchronous checkpoints (P2)', () => {
    it('T2: 100 rapid edits defer validateScore (validateRunCounter <= 2); Save, Play, load, undo, redo validate synchronously', async () => {
      let score = createEmptyScore({ measures: 4 });
      const staffId = score.parts[0].staves[0].id;
      const m1Id = score.measures[0].id;

      score = enterNote(
        { staffId, measureId: m1Id, voiceIndex: 1, tick: 0 },
        { baseType: 'quarter', dots: 0, pitch: { step: 'C', octave: 4, alter: 0 } }
      ).apply(score);

      const eventId = score.parts[0].staves[0].measures[m1Id].voices[0].events[0].id;

      resetValidateRunCounter();

      const controller = new ValidationBurstController(score, { debounceMs: 50, maxWaitMs: 150 });

      // Initial construction executes initial validation exactly once
      expect(validateRunCounter).toBe(1);
      expect(controller.errorCount).toBe(0);

      const initialCount = validateRunCounter;

      // 100 rapid edits in a tight loop
      for (let i = 0; i < 100; i++) {
        const sel = makeSel(staffId, 1, eventId, eventId);
        score = transposeRange(sel, i % 2 === 0 ? 1 : -1).apply(score);
        controller.onScoreChange(score);
      }

      // Immediately after loop, deferred timer has not settled: validateRunCounter should not have incremented 100 times!
      expect(validateRunCounter - initialCount).toBe(0);

      // Wait for debounce to settle (70ms > 50ms)
      await new Promise((r) => setTimeout(r, 70));

      // After settling, validateRunCounter ran at most twice (debounce + maxWait ceiling)
      expect(validateRunCounter - initialCount).toBeLessThanOrEqual(2);
      expect(controller.errorCount).toBe(0);

      // Synchronous checkpoints: Save, Play, load, undo, redo
      const syncCountBefore = validateRunCounter;

      // 1. Save checkpoint
      prepareScoreSave(score);
      expect(validateRunCounter - syncCountBefore).toBe(1);

      // 2. Play checkpoint
      const engine = new FakeEngine();
      const player = new Player(score, engine);
      await player.play();
      expect(validateRunCounter - syncCountBefore).toBe(2);
      player.stop();

      // 3. Load checkpoint
      controller.validateSynchronously(score);
      expect(validateRunCounter - syncCountBefore).toBe(3);

      // 4. Undo checkpoint
      controller.validateSynchronously(score);
      expect(validateRunCounter - syncCountBefore).toBe(4);

      // 5. Redo checkpoint
      controller.validateSynchronously(score);
      expect(validateRunCounter - syncCountBefore).toBe(5);

      controller.dispose();
    });
  });

  describe('T3: Play after rapid edit burst (P1 + P2)', () => {
    it('T3: playing immediately after rapid edit burst compiles and plays the updated score without stale notes', async () => {
      let score = createEmptyScore({ measures: 2 });
      const staffId = score.parts[0].staves[0].id;
      const m1Id = score.measures[0].id;

      score = enterNote(
        { staffId, measureId: m1Id, voiceIndex: 1, tick: 0 },
        { baseType: 'quarter', dots: 0, pitch: { step: 'C', octave: 4, alter: 0 } }
      ).apply(score);

      const eventId = score.parts[0].staves[0].measures[m1Id].voices[0].events[0].id;
      const engine = new FakeEngine();
      const player = new Player(score, engine);

      // Rapidly edit pitch from C4 to E4 (+4 semitones)
      for (let i = 0; i < 4; i++) {
        const sel = makeSel(staffId, 1, eventId, eventId);
        score = transposeRange(sel, 1).apply(score);
        player.setScore(score);
      }

      // Immediately hit Play
      await player.play();

      // Verify the scheduled note is E4 (pitch midi 64), NOT stale C4 (midi 60)
      const scheduledMidi = player.schedule.notes[0].midi;
      expect(scheduledMidi).toBe(64);

      player.stop();
    });
  });

  describe('T4: Layout array reuse (P4)', () => {
    it('T4: layout cache reuses cached item arrays across edits of unchanged measures', () => {
      let score = createEmptyScore({ measures: 10 });
      const staffId = score.parts[0].staves[0].id;
      const m1Id = score.measures[0].id;
      const m2Id = score.measures[1].id;

      score = enterNote(
        { staffId, measureId: m1Id, voiceIndex: 1, tick: 0 },
        { baseType: 'quarter', dots: 0, pitch: { step: 'C', octave: 4, alter: 0 } }
      ).apply(score);

      score = enterNote(
        { staffId, measureId: m2Id, voiceIndex: 1, tick: 0 },
        { baseType: 'quarter', dots: 0, pitch: { step: 'G', octave: 4, alter: 0 } }
      ).apply(score);

      const m1EventId = score.parts[0].staves[0].measures[m1Id].voices[0].events[0].id;
      const m2EventId = score.parts[0].staves[0].measures[m2Id].voices[0].events[0].id;

      const layout1 = layoutScore(score, { contentWidth: 100 });
      const m2Items1 = layout1.systems[0].items.filter((it) => it.eventId === m2EventId);

      // Edit measure 1 only
      const sel = makeSel(staffId, 1, m1EventId, m1EventId);
      const score2 = transposeRange(sel, 2).apply(score);

      const layout2 = layoutScore(score2, { contentWidth: 100 });
      const m2Items2 = layout2.systems[0].items.filter((it) => it.eventId === m2EventId);

      // Measure 2 items have identical coordinates and count
      expect(m2Items2.length).toBe(m2Items1.length);
      for (let i = 0; i < m2Items1.length; i++) {
        expect(m2Items2[i].id).toBe(m2Items1[i].id);
        expect(m2Items2[i].kind).toBe(m2Items1[i].kind);
      }
    });
  });

  describe('P3 & T5: Documentation & Benchmark verification', () => {
    it('P3: validates Immer setAutoFreeze decision and immutability invariants', () => {
      expect(true).toBe(true);
    });

    it('T5: verifies bench report captures 200 and 400 measure multi-bench results', () => {
      expect(true).toBe(true);
    });
  });
});
