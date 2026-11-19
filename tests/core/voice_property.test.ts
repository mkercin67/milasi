// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { Score } from '../../src/core/model';
import { createEmptyScore } from '../../src/core/factory';
import { History } from '../../src/core/commands';
import {
  advanceCursor,
  cycleVoice,
  enterNote,
  enterRest,
  InputNoteSpec,
  moveCursor,
  planEnter,
  ScoreCursor,
} from '../../src/core/input';
import { durationTicks, measureTicks } from '../../src/core/time';
import { validateScore } from '../../src/core/validate';

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DURATIONS: Array<{ baseType: InputNoteSpec['baseType']; dots: number }> = [
  { baseType: 'whole', dots: 0 },
  { baseType: 'half', dots: 0 },
  { baseType: 'quarter', dots: 0 },
  { baseType: 'eighth', dots: 0 },
  { baseType: 'quarter', dots: 1 },
];

const PITCH_STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

describe('T4: Seeded Property Test across Multi-Voice Operations (Rule R6: No Wall-Clock Gates)', () => {
  const SEEDS = Array.from({ length: 20 }, (_, i) => 1001 + i * 37);

  it('verifies 20 seeds x 200 steps of random voice navigation, entry, and undo/redo', () => {
    console.log('T4 seeded property test seeds:', SEEDS);

    for (const seed of SEEDS) {
      const rng = mulberry32(seed);

      // Create a fresh 4-measure 4/4 score
      let score: Score = createEmptyScore({
        clef: { sign: 'G', line: 2 },
        keySig: 0,
        timeSig: { num: 4, den: 4 },
        measures: 4,
        title: `Seed Score ${seed}`,
      });
      const initialScore = score;

      const staffId = score.parts[0].staves[0].id;
      let cursor: ScoreCursor = {
        staffId,
        measureId: score.measures[0].id,
        voiceIndex: 1,
        tick: 0,
      };

      const history = new History(score);
      const cursorHistory: { past: ScoreCursor[]; future: ScoreCursor[] } = {
        past: [],
        future: [],
      };

      for (let step = 0; step < 200; step++) {
        const actionType = Math.floor(rng() * 6);

        switch (actionType) {
          case 0: {
            // Tab -> next voice
            cursor = cycleVoice(score, cursor, 'next');
            break;
          }
          case 1: {
            // Shift+Tab -> prev voice
            cursor = cycleVoice(score, cursor, 'prev');
            break;
          }
          case 2: {
            // Enter Note
            // Filter durations that can fit in remaining measure ticks
            const mDef = score.measures.find((m) => m.id === cursor.measureId);
            const mLength = mDef?.actualTicks ?? (mDef ? measureTicks(mDef.timeSig) : 3840);
            const remaining = mLength - cursor.tick;
            if (remaining <= 0) {
              cursor = moveCursor(score, cursor, 'next');
              break;
            }

            const fittingDurations = DURATIONS.filter(
              (d) => durationTicks(d.baseType, d.dots ?? 0) <= remaining
            );
            if (fittingDurations.length === 0) {
              cursor = moveCursor(score, cursor, 'next');
              break;
            }

            const durSpec = fittingDurations[Math.floor(rng() * fittingDurations.length)];
            const stepName = PITCH_STEPS[Math.floor(rng() * PITCH_STEPS.length)];
            const spec: InputNoteSpec = {
              kind: 'note',
              baseType: durSpec.baseType,
              dots: durSpec.dots,
              pitch: { step: stepName, octave: 4, alter: 0 },
            };

            const plan = planEnter(score, cursor, spec);
            if (plan.ok) {
              cursorHistory.past.push({ ...cursor });
              cursorHistory.future = [];
              score = history.do(enterNote(cursor, spec));
              cursor = advanceCursor(score, cursor, durationTicks(spec.baseType, spec.dots ?? 0));
            }
            break;
          }
          case 3: {
            // Enter Rest
            const mDef = score.measures.find((m) => m.id === cursor.measureId);
            const mLength = mDef?.actualTicks ?? (mDef ? measureTicks(mDef.timeSig) : 3840);
            const remaining = mLength - cursor.tick;
            if (remaining <= 0) {
              cursor = moveCursor(score, cursor, 'next');
              break;
            }

            const fittingDurations = DURATIONS.filter(
              (d) => d.dots === 0 && durationTicks(d.baseType, 0) <= remaining
            );
            if (fittingDurations.length === 0) {
              cursor = moveCursor(score, cursor, 'next');
              break;
            }

            const durSpec = fittingDurations[Math.floor(rng() * fittingDurations.length)];
            const spec: InputNoteSpec = {
              kind: 'rest',
              baseType: durSpec.baseType,
              dots: 0,
            };

            const plan = planEnter(score, cursor, spec);
            if (plan.ok) {
              cursorHistory.past.push({ ...cursor });
              cursorHistory.future = [];
              score = history.do(enterRest(cursor, spec));
              cursor = advanceCursor(score, cursor, durationTicks(spec.baseType, 0));
            }
            break;
          }
          case 4: {
            // Undo
            if (history.canUndo()) {
              cursorHistory.future.push({ ...cursor });
              cursor = cursorHistory.past.pop()!;
              score = history.undo()!;
            }
            break;
          }
          case 5: {
            // Redo
            if (history.canRedo()) {
              cursorHistory.past.push({ ...cursor });
              cursor = cursorHistory.future.pop()!;
              score = history.redo()!;
            }
            break;
          }
        }

        // --- INVARIANT ASSERTIONS AFTER EVERY STEP ---
        // 1. validateScore zero errors
        const problems = validateScore(score);
        const errors = problems.filter((p) => p.severity === 'error');
        expect(errors).toHaveLength(0);

        // 2. Structural invariants on voices
        for (const part of score.parts) {
          for (const staff of part.staves) {
            for (const mDef of score.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;

              // Voice 1 must exist
              expect(sm.voices.some((v) => v.voiceIndex === 1)).toBe(true);

              // voiceIndex unique, in 1..4, and sorted
              const indices = sm.voices.map((v) => v.voiceIndex);
              for (const vi of indices) {
                expect(vi >= 1 && vi <= 4).toBe(true);
              }
              const sorted = [...indices].sort((a, b) => a - b);
              expect(indices).toEqual(sorted);
              const unique = new Set(indices);
              expect(unique.size).toBe(indices.length);
            }
          }
        }

        // 3. Cursor voiceIndex in 1..4
        expect(cursor.voiceIndex >= 1 && cursor.voiceIndex <= 4).toBe(true);
      }

      // --- END OF 200 STEPS: UNDO-ALL AND REDO-ALL ---
      const finalScore = score;

      // Undo all steps
      let undoCount = 0;
      while (history.canUndo()) {
        score = history.undo()!;
        undoCount++;
      }
      expect(score).toBe(initialScore);

      // Redo the exact number of undone steps
      for (let i = 0; i < undoCount; i++) {
        score = history.redo()!;
      }
      expect(score).toBe(finalScore);
    }
  });
});
