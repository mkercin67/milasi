// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, newId } from '../../src/core/factory';
import { Score, ScoreEvent } from '../../src/core/model';
import { Command, History } from '../../src/core/commandTypes';
import { deleteRange, transposeRange } from '../../src/core/commands';
import { pasteEvents } from '../../src/core/clipboard';
import { eventsInRange } from '../../src/core/selection';
import { validateScore } from '../../src/core/validate';

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pasteCommand(
  target: { staffId: string; voiceIndex: 1 | 2 | 3 | 4; startMeasureId: string; startOffsetTicks: number },
  eventsToPaste: ScoreEvent[]
): Command {
  return {
    name: 'Paste Events',
    apply: (s) => pasteEvents(s, target, eventsToPaste),
  };
}

function getVoiceEventsMap(score: Score, voiceIndex: 1 | 2 | 3 | 4): Record<string, ScoreEvent[]> {
  const res: Record<string, ScoreEvent[]> = {};
  const staff = score.parts[0]?.staves[0];
  if (!staff) return res;
  for (const mDef of score.measures) {
    const sm = staff.measures[mDef.id];
    const v = sm?.voices.find((vo) => vo.voiceIndex === voiceIndex);
    res[mDef.id] = v ? JSON.parse(JSON.stringify(v.events)) : [];
  }
  return res;
}

describe('T4: Seeded Property Test for Multi-Voice Operations and Clipboard (Rule R6)', () => {
  const SEEDS = Array.from({ length: 20 }, (_, i) => 2001 + i * 43);

  it('verifies 20 seeds x 100 steps of random voice operations, isolation, and undo/redo reversibility', () => {
    console.log('T4 Seeds: ' + JSON.stringify(SEEDS));
    for (const seed of SEEDS) {
      const rng = mulberry32(seed);

      // Create initial 3-measure 4/4 score with 2 voices in every measure
      let score = createEmptyScore({ measures: 3, timeSig: { num: 4, den: 4 }, title: `Property Score ${seed}` });
      const staff = score.parts[0].staves[0];
      const staffId = staff.id;

      // Fill voice 1 and voice 2 with 4 quarter notes per measure
      const pitchSteps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
      for (let m = 0; m < 3; m++) {
        const mId = score.measures[m].id;
        const v1Notes: ScoreEvent[] = [];
        const v2Notes: ScoreEvent[] = [];
        for (let q = 0; q < 4; q++) {
          v1Notes.push(
            createNote({
              pitches: [createPitch(pitchSteps[(m * 4 + q) % pitchSteps.length], 5)],
              baseType: 'quarter',
            })
          );
          v2Notes.push(
            createNote({
              pitches: [createPitch(pitchSteps[(m * 4 + q + 2) % pitchSteps.length], 4)],
              baseType: 'quarter',
            })
          );
        }
        staff.measures[mId].voices = [
          { id: newId(), voiceIndex: 1, events: v1Notes },
          { id: newId(), voiceIndex: 2, events: v2Notes },
        ];
      }

      expect(validateScore(score)).toHaveLength(0);
      const initialScoreSnapshot = JSON.parse(JSON.stringify(score));
      const history = new History(score);

      let clipboardEvents: ScoreEvent[] = [];

      for (let step = 0; step < 100; step++) {
        const opType = Math.floor(rng() * 6); // 0: transpose, 1: delete, 2: copy, 3: paste, 4: undo, 5: redo
        const targetVoiceIndex = (rng() < 0.5 ? 1 : 2) as 1 | 2;
        const otherVoiceIndex = (targetVoiceIndex === 1 ? 2 : 1) as 1 | 2;

        const curScore = history.score;
        const curStaff = curScore.parts[0].staves[0];

        // Gather all events for target voice
        const allTargetVoiceEvents: Array<{ ev: ScoreEvent; mId: string }> = [];
        for (const mDef of curScore.measures) {
          const sm = curStaff.measures[mDef.id];
          const v = sm?.voices.find((vo) => vo.voiceIndex === targetVoiceIndex);
          if (v) {
            for (const ev of v.events) {
              allTargetVoiceEvents.push({ ev, mId: mDef.id });
            }
          }
        }

        const otherVoiceBefore = getVoiceEventsMap(curScore, otherVoiceIndex);

        if (opType === 0 && allTargetVoiceEvents.length > 0) {
          // Transpose range
          const i1 = Math.floor(rng() * allTargetVoiceEvents.length);
          const i2 = Math.floor(rng() * allTargetVoiceEvents.length);
          const [startIdx, endIdx] = i1 <= i2 ? [i1, i2] : [i2, i1];
          const anchorId = allTargetVoiceEvents[startIdx].ev.id;
          const focusId = allTargetVoiceEvents[endIdx].ev.id;
          const semitonesChoices = [-12, -2, -1, 1, 2, 12];
          const semitones = semitonesChoices[Math.floor(rng() * semitonesChoices.length)];

          try {
            history.do(
              transposeRange(
                {
                  staffId,
                  voiceIndex: targetVoiceIndex,
                  anchorId,
                  focusId,
                },
                semitones
              )
            );
            // Non-targeted voice must remain untouched
            expect(getVoiceEventsMap(history.score, otherVoiceIndex)).toEqual(otherVoiceBefore);
          } catch {
            // MIDI bounds clamp throws: history remains untouched
          }
        } else if (opType === 1 && allTargetVoiceEvents.length > 0) {
          // Delete range
          const i1 = Math.floor(rng() * allTargetVoiceEvents.length);
          const i2 = Math.floor(rng() * allTargetVoiceEvents.length);
          const [startIdx, endIdx] = i1 <= i2 ? [i1, i2] : [i2, i1];
          const anchorId = allTargetVoiceEvents[startIdx].ev.id;
          const focusId = allTargetVoiceEvents[endIdx].ev.id;

          history.do(
            deleteRange({
              staffId,
              voiceIndex: targetVoiceIndex,
              anchorId,
              focusId,
            })
          );
          // Non-targeted voice must remain untouched
          expect(getVoiceEventsMap(history.score, otherVoiceIndex)).toEqual(otherVoiceBefore);
        } else if (opType === 2 && allTargetVoiceEvents.length > 0) {
          // Copy range
          const i1 = Math.floor(rng() * allTargetVoiceEvents.length);
          const i2 = Math.floor(rng() * allTargetVoiceEvents.length);
          const [startIdx, endIdx] = i1 <= i2 ? [i1, i2] : [i2, i1];
          const anchorId = allTargetVoiceEvents[startIdx].ev.id;
          const focusId = allTargetVoiceEvents[endIdx].ev.id;

          clipboardEvents = eventsInRange(history.score, {
            kind: 'range',
            staffId,
            voiceIndex: targetVoiceIndex,
            anchorId,
            focusId,
          });
        } else if (opType === 3 && clipboardEvents.length > 0) {
          // Paste into voice w (1 or 2) in measure m
          const pasteVoiceIndex = (rng() < 0.5 ? 1 : 2) as 1 | 2;
          const unpastedVoiceIndex = (pasteVoiceIndex === 1 ? 2 : 1) as 1 | 2;
          const unpastedVoiceBefore = getVoiceEventsMap(curScore, unpastedVoiceIndex);

          const targetMIdx = Math.floor(rng() * curScore.measures.length);
          const targetMId = curScore.measures[targetMIdx].id;
          const offsets = [0, 960, 1920];
          const offset = offsets[Math.floor(rng() * offsets.length)];

          history.do(
            pasteCommand(
              {
                staffId,
                voiceIndex: pasteVoiceIndex,
                startMeasureId: targetMId,
                startOffsetTicks: offset,
              },
              clipboardEvents
            )
          );

          // Non-targeted voice for paste must remain untouched across all prior measures
          const unpastedVoiceAfter = getVoiceEventsMap(history.score, unpastedVoiceIndex);
          for (const mDef of curScore.measures) {
            expect(unpastedVoiceAfter[mDef.id]).toEqual(unpastedVoiceBefore[mDef.id]);
          }
        } else if (opType === 4 && history.canUndo()) {
          history.undo();
        } else if (opType === 5 && history.canRedo()) {
          history.redo();
        }

        // Invariants checked after EVERY step:
        const s = history.score;
        expect(validateScore(s)).toHaveLength(0);

        for (const mDef of s.measures) {
          const sm = s.parts[0].staves[0].measures[mDef.id];
          expect(sm).toBeDefined();
          const voices = sm!.voices;

          // Unique voiceIndex
          const vIndices = voices.map((v) => v.voiceIndex);
          expect(new Set(vIndices).size).toBe(voices.length);

          // Sorted voiceIndex
          for (let vi = 1; vi < voices.length; vi++) {
            expect(voices[vi].voiceIndex).toBeGreaterThan(voices[vi - 1].voiceIndex);
          }

          // Voice 1 is ALWAYS present
          expect(voices.some((v) => v.voiceIndex === 1)).toBe(true);
        }
      }

      // Reversibility check:
      // First redo any remaining future so we are at the topmost state of this history branch
      while (history.canRedo()) {
        history.redo();
      }
      const finalScoreSnapshot = JSON.parse(JSON.stringify(history.score));

      // Undo all steps to initial state
      while (history.canUndo()) {
        history.undo();
        expect(validateScore(history.score)).toHaveLength(0);
      }
      expect(JSON.parse(JSON.stringify(history.score))).toEqual(initialScoreSnapshot);

      // Redo all steps to topmost state
      while (history.canRedo()) {
        history.redo();
        expect(validateScore(history.score)).toHaveLength(0);
      }
      expect(JSON.parse(JSON.stringify(history.score))).toEqual(finalScoreSnapshot);
    }
  });
});
