// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  createEmptyScore,
  createMeasure,
  createNote,
  createPart,
  createPitch,
  createRest,
} from '../../src/core/factory';
import { Score } from '../../src/core/model';
import { pitchToMidi } from '../../src/playback/pitch';
import { buildSchedule } from '../../src/playback/schedule';

describe('Milestone 4 Section A: Pure Playback Core', () => {
  describe('pitchToMidi', () => {
    it('calculates standard C4 as MIDI 60 and A4 as MIDI 69', () => {
      const c4 = createPitch('C', 4, 0);
      const a4 = createPitch('A', 4, 0);

      expect(pitchToMidi(c4)).toEqual({ midi: 60, detuneCents: 0 });
      expect(pitchToMidi(a4)).toEqual({ midi: 69, detuneCents: 0 });
    });

    it('handles quarter-tone sharp (+0.5 alter) on C4 -> 60 +50 cents', () => {
      const cQuarterSharp = createPitch('C', 4, 0.5);
      expect(pitchToMidi(cQuarterSharp)).toEqual({ midi: 60, detuneCents: 50 });
    });

    it('handles quarter-tone flat (-0.5 alter) on D4 -> 61 +50 cents', () => {
      // D4 is semitone 62, 62 - 0.5 = 61.5 -> floor(61.5) = 61, detune = +50
      const dQuarterFlat = createPitch('D', 4, -0.5);
      expect(pitchToMidi(dQuarterFlat)).toEqual({ midi: 61, detuneCents: 50 });
    });
  });

  describe('buildSchedule', () => {
    it('schedules four quarter notes in 4/4 at 120 bpm at 0, 0.5, 1.0, 1.5 total 2.0s', () => {
      let score = createEmptyScore({ measures: 1, timeSig: { num: 4, den: 4 } });
      const mId = score.measures[0].id;
      const v = score.parts[0].staves[0].measures[mId].voices[0];

      v.events = [
        createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' }),
      ];

      const res = buildSchedule(score);
      expect(res.notes).toHaveLength(4);
      expect(res.notes[0].startSeconds).toBeCloseTo(0.0, 3);
      expect(res.notes[0].durationSeconds).toBeCloseTo(0.5, 3);
      expect(res.notes[1].startSeconds).toBeCloseTo(0.5, 3);
      expect(res.notes[2].startSeconds).toBeCloseTo(1.0, 3);
      expect(res.notes[3].startSeconds).toBeCloseTo(1.5, 3);
      expect(res.totalSeconds).toBeCloseTo(2.0, 3);
    });

    it('rests advance time and produce no notes', () => {
      let score = createEmptyScore({ measures: 1, timeSig: { num: 4, den: 4 } });
      const mId = score.measures[0].id;
      const v = score.parts[0].staves[0].measures[mId].voices[0];

      v.events = [
        createRest({ baseType: 'quarter' }),
        createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
        createRest({ baseType: 'half' }),
      ];

      const res = buildSchedule(score);
      expect(res.notes).toHaveLength(1);
      expect(res.notes[0].startSeconds).toBeCloseTo(0.5, 3);
      expect(res.notes[0].durationSeconds).toBeCloseTo(0.5, 3);
      expect(res.totalSeconds).toBeCloseTo(2.0, 3);
    });

    it('chords produce several notes at the same start time', () => {
      let score = createEmptyScore({ measures: 1 });
      const mId = score.measures[0].id;
      const v = score.parts[0].staves[0].measures[mId].voices[0];

      v.events = [
        createNote({
          pitches: [createPitch('C', 4), createPitch('E', 4), createPitch('G', 4)],
          baseType: 'half',
        }),
        createRest({ baseType: 'half' }),
      ];

      const res = buildSchedule(score);
      expect(res.notes).toHaveLength(3);
      expect(res.notes[0].startSeconds).toBeCloseTo(0.0, 3);
      expect(res.notes[1].startSeconds).toBeCloseTo(0.0, 3);
      expect(res.notes[2].startSeconds).toBeCloseTo(0.0, 3);
      expect(res.notes.map((n) => n.midi)).toEqual([60, 64, 67]);
    });

    it('merges ties across barlines into ONE sounding note with combined duration', () => {
      let score = createEmptyScore({ measures: 2, timeSig: { num: 4, den: 4 } });
      const m0Id = score.measures[0].id;
      const m1Id = score.measures[1].id;

      const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' });
      n1.tiedToNext = true;
      const n2 = createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' });

      score.parts[0].staves[0].measures[m0Id].voices[0].events = [n1];
      score.parts[0].staves[0].measures[m1Id].voices[0].events = [n2];

      const res = buildSchedule(score);
      expect(res.notes).toHaveLength(1);
      expect(res.notes[0].startSeconds).toBeCloseTo(0.0, 3);
      expect(res.notes[0].durationSeconds).toBeCloseTo(4.0, 3); // 2 whole notes = 4.0s at 120 bpm
      expect(res.notes[0].eventId).toEqual([n1.id, n2.id]);
    });

    it('applies tempo changes at subsequent measures and respects beatUnit', () => {
      let score = createEmptyScore({ measures: 2 });
      score.measures[0].tempo = { bpm: 120, beatUnit: 1.0 }; // 120 bpm, quarter = 0.5s
      score.measures[1].tempo = { bpm: 60, beatUnit: 1.0 };  // 60 bpm, quarter = 1.0s

      const m0Id = score.measures[0].id;
      const m1Id = score.measures[1].id;

      score.parts[0].staves[0].measures[m0Id].voices[0].events = [
        createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' }),
      ];
      score.parts[0].staves[0].measures[m1Id].voices[0].events = [
        createNote({ pitches: [createPitch('D', 4)], baseType: 'whole' }),
      ];

      const res = buildSchedule(score);
      expect(res.notes).toHaveLength(2);
      expect(res.notes[0].startSeconds).toBeCloseTo(0.0, 3);
      expect(res.notes[0].durationSeconds).toBeCloseTo(2.0, 3); // 4 quarters at 0.5s = 2.0s
      expect(res.notes[1].startSeconds).toBeCloseTo(2.0, 3);
      expect(res.notes[1].durationSeconds).toBeCloseTo(4.0, 3); // 4 quarters at 1.0s = 4.0s
      expect(res.totalSeconds).toBeCloseTo(6.0, 3);
    });

    it('respects compound meter beatUnit 1.5 at bpm 60 (quarter = 0.667s)', () => {
      let score = createEmptyScore({ measures: 1 });
      score.measures[0].tempo = { bpm: 60, beatUnit: 1.5 }; // beatUnit = dotted quarter
      // Seconds per quarter = 60 / (60 * 1.5) = 1 / 1.5 = 0.6667s
      const m0Id = score.measures[0].id;
      score.parts[0].staves[0].measures[m0Id].voices[0].events = [
        createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
        createRest({ baseType: 'half', dots: 1 }),
      ];

      const res = buildSchedule(score);
      expect(res.notes[0].durationSeconds).toBeCloseTo(0.6667, 3);
    });

    it('applies articulations and dynamic persistence', () => {
      let score = createEmptyScore({ measures: 1 });
      const mId = score.measures[0].id;

      const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
      n1.articulations = ['staccato'];
      n1.dynamic = 'f'; // 0.85

      const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
      n2.articulations = ['accent']; // 0.85 + 0.15 = 1.0

      const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
      // dynamic persists as 'f' (0.85)

      const n4 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
      n4.dynamic = 'p'; // 0.40

      score.parts[0].staves[0].measures[mId].voices[0].events = [n1, n2, n3, n4];

      const res = buildSchedule(score);
      expect(res.notes).toHaveLength(4);
      // Staccato halves sounding duration: 0.5 * 0.5 = 0.25s
      expect(res.notes[0].durationSeconds).toBeCloseTo(0.25, 3);
      expect(res.notes[0].velocity).toBeCloseTo(0.85, 2);

      // Accent adds 0.15 velocity: 0.85 + 0.15 = 1.0
      expect(res.notes[1].velocity).toBeCloseTo(1.0, 2);

      // Persistence: n3 stays at 0.85
      expect(res.notes[2].velocity).toBeCloseTo(0.85, 2);

      // n4 changes to p = 0.40
      expect(res.notes[3].velocity).toBeCloseTo(0.40, 2);
    });

    it('merges and sorts multiple parts by start time', () => {
      const part1 = createPart({ name: 'Violin 1' });
      const part2 = createPart({ name: 'Violin 2' });
      const mDef = createMeasure();

      // Part 1: quarter note at 0, quarter note at 0.5
      const v1 = {
        id: 'v1',
        voiceIndex: 1 as const,
        events: [
          createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('D', 5)], baseType: 'quarter' }),
          createRest({ baseType: 'half' }),
        ],
      };

      // Part 2: eighth note at 0, eighth note at 0.25, quarter note at 0.5
      const v2 = {
        id: 'v2',
        voiceIndex: 1 as const,
        events: [
          createNote({ pitches: [createPitch('E', 4)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('G', 4)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
          createRest({ baseType: 'half' }),
        ],
      };

      part1.staves[0].measures[mDef.id] = { voices: [v1] };
      part2.staves[0].measures[mDef.id] = { voices: [v2] };

      const score: Score = {
        schemaVersion: 1,
        id: 'score-test-2part',
        meta: { title: 'Trio', composer: '' },
        measures: [mDef],
        parts: [part1, part2],
        groups: [],
        overrides: {},
      };

      const res = buildSchedule(score);
      expect(res.notes).toHaveLength(5);
      // Verify chronological order
      for (let i = 1; i < res.notes.length; i++) {
        expect(res.notes[i].startSeconds).toBeGreaterThanOrEqual(res.notes[i - 1].startSeconds);
      }
    });

    it('supports fromEventId with times relative to that event', () => {
      let score = createEmptyScore({ measures: 1 });
      const mId = score.measures[0].id;
      const v = score.parts[0].staves[0].measures[mId].voices[0];

      const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
      const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
      const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
      const n4 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
      v.events = [n1, n2, n3, n4];

      const res = buildSchedule(score, { fromEventId: n3.id });
      // Starts from n3 -> n3 is at 0.0s, n4 at 0.5s
      expect(res.notes).toHaveLength(2);
      expect(res.notes[0].startSeconds).toBeCloseTo(0.0, 3);
      expect(res.notes[0].eventId).toBe(n3.id);
      expect(res.notes[1].startSeconds).toBeCloseTo(0.5, 3);
      expect(res.notes[1].eventId).toBe(n4.id);
    });

    it('property test: totalSeconds equals sum of all measure durations', () => {
      const score = createEmptyScore({ measures: 8, timeSig: { num: 4, den: 4 } });
      const res = buildSchedule(score);
      // 8 measures of 4/4 at 120 bpm: each measure = 2.0s -> 16.0s
      expect(res.totalSeconds).toBeCloseTo(16.0, 3);
      expect(res.measureStarts).toHaveLength(8);
      for (let i = 0; i < 8; i++) {
        expect(res.measureStarts[i].startSeconds).toBeCloseTo(i * 2.0, 3);
      }
    });
  });
});
