// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Comprehensive validateScore Schema v7 rules test suite.
 * Tests every single rule in Section 5 of docs/design/schema-v7-migration-plan.md.
 */

import { describe, expect, it } from 'vitest';
import { createMeasure, createNote, createPart, createPitch, createRest, createScore, newId } from '../../src/core/factory';
import { validateScore } from '../../src/core/validate';

describe('Schema v7 validateScore Rules (Plan Section 5)', () => {
  function createBaseScore() {
    const score = createScore();
    const m = createMeasure({ num: 4, den: 4 });
    const part = createPart({ name: 'Violin', instrument: 'violin' });
    score.measures.push(m);
    score.parts.push(part);
    part.staves[0].measures[m.id] = {
      voices: [
        {
          id: newId(),
          voiceIndex: 1,
          events: [createRest({ baseType: 'whole', duration: 3840, wholeMeasure: true })],
        },
      ],
    };
    return { score, m, part };
  }

  it('passes on a valid Schema v7 score with no errors', () => {
    const { score } = createBaseScore();
    const problems = validateScore(score);
    expect(problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  // Rule 1: Duplicate voiceIndex
  it('emits error duplicate-voice-index when a measure has duplicate voiceIndex values', () => {
    const { score, m, part } = createBaseScore();
    part.staves[0].measures[m.id].voices.push({
      id: newId(),
      voiceIndex: 1, // Duplicate voice 1
      events: [createRest({ baseType: 'whole', duration: 3840, wholeMeasure: true })],
    });

    const problems = validateScore(score);
    const err = problems.find((p) => p.code === 'duplicate-voice-index');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  // Rule 2: At most 4 voices
  it('emits error too-many-voices when a measure has more than 4 voices', () => {
    const { score, m, part } = createBaseScore();
    part.staves[0].measures[m.id].voices = [
      { id: newId(), voiceIndex: 1, events: [createRest({ baseType: 'whole', duration: 3840 })] },
      { id: newId(), voiceIndex: 2 as any, events: [createRest({ baseType: 'whole', duration: 3840 })] },
      { id: newId(), voiceIndex: 3 as any, events: [createRest({ baseType: 'whole', duration: 3840 })] },
      { id: newId(), voiceIndex: 4 as any, events: [createRest({ baseType: 'whole', duration: 3840 })] },
      { id: newId(), voiceIndex: 4 as any, events: [createRest({ baseType: 'whole', duration: 3840 })] }, // 5th voice!
    ];

    const problems = validateScore(score);
    const err = problems.find((p) => p.code === 'too-many-voices');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  // Rule 3: Voice 1 exists
  it('emits error missing-voice-1 when voice 1 is absent', () => {
    const { score, m, part } = createBaseScore();
    part.staves[0].measures[m.id].voices = [
      {
        id: newId(),
        voiceIndex: 2 as any, // Only voice 2, voice 1 missing
        events: [createRest({ baseType: 'whole', duration: 3840 })],
      },
    ];

    const problems = validateScore(score);
    const err = problems.find((p) => p.code === 'missing-voice-1');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  // Rule 4: Tick sum equals measure length (underfull & overfull)
  it('emits error measure-underfull when voice duration is short', () => {
    const { score, m, part } = createBaseScore();
    part.staves[0].measures[m.id].voices[0].events = [
      createRest({ baseType: 'half', duration: 1920 }), // only 1920 out of 3840
    ];

    const problems = validateScore(score);
    const err = problems.find((p) => p.code === 'measure-underfull');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  it('emits error measure-overfull when voice duration exceeds measure length', () => {
    const { score, m, part } = createBaseScore();
    part.staves[0].measures[m.id].voices[0].events = [
      createRest({ baseType: 'whole', duration: 3840 }),
      createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }), // 4800 out of 3840
    ];

    const problems = validateScore(score);
    const err = problems.find((p) => p.code === 'measure-overfull');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  // Rule 5: Ties are intra-voice
  it('emits error tie-cross-voice when a tie attempts to connect across voices', () => {
    const { score, m, part } = createBaseScore();
    // Voice 1 has note at tick 0 with tiedToNext
    const tiedNote = createNote({
      pitches: [{ step: 'C', octave: 4, alter: 0, tiedToNext: true }],
      baseType: 'half',
    });
    const restVoice1 = createRest({ baseType: 'half', duration: 1920 });

    // Voice 2 has rest at tick 0, and matching note C4 at tick 1920
    const restVoice2 = createRest({ baseType: 'half', duration: 1920 });
    const matchingNoteVoice2 = createNote({
      pitches: [createPitch('C', 4)],
      baseType: 'half',
    });

    part.staves[0].measures[m.id].voices = [
      { id: newId(), voiceIndex: 1, events: [tiedNote, restVoice1] },
      { id: newId(), voiceIndex: 2 as any, events: [restVoice2, matchingNoteVoice2] },
    ];

    const problems = validateScore(score);
    const err = problems.find((p) => p.code === 'tie-cross-voice');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  // Rule 6: Slurs are intra-voice
  it('emits error slur-cross-voice when a slur connects events across different voices', () => {
    const { score, m, part } = createBaseScore();
    const evVoice1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' });
    const evVoice2 = createNote({ pitches: [createPitch('E', 4)], baseType: 'whole' });

    part.staves[0].measures[m.id].voices = [
      { id: newId(), voiceIndex: 1, events: [evVoice1] },
      { id: newId(), voiceIndex: 2 as any, events: [evVoice2] },
    ];

    part.staves[0].slurs = [
      {
        id: 'slur-cross',
        startEventId: evVoice1.id, // Voice 1
        endEventId: evVoice2.id,   // Voice 2
      },
    ];

    const problems = validateScore(score);
    const err = problems.find((p) => p.code === 'slur-cross-voice');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  // Rule 7: A StaffMeasure exists for every MeasureDef
  it('emits error missing-staff-measure when a staff lacks a measure defined in score.measures', () => {
    const { score } = createBaseScore();
    const m2 = createMeasure({ num: 4, den: 4 });
    score.measures.push(m2); // Added to score, but not to part.staves[0].measures!

    const problems = validateScore(score);
    const err = problems.find((p) => p.code === 'missing-staff-measure');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  // Rule 8: WARNING for more than 15 non-percussion parts sharing channels
  it('emits WARNING (not error) midi-channel-reuse when more than 15 non-percussion parts share channels', () => {
    const score = createScore();
    const m = createMeasure({ num: 4, den: 4 });
    score.measures.push(m);

    for (let i = 0; i < 16; i++) {
      const part = createPart({ name: `Violin ${i + 1}`, instrument: 'violin' });
      part.staves[0].measures[m.id] = {
        voices: [{ id: newId(), voiceIndex: 1, events: [createRest({ baseType: 'whole', duration: 3840 })] }],
      };
      score.parts.push(part);
    }

    const problems = validateScore(score);
    const warnings = problems.filter((p) => p.severity === 'warning');
    const errors = problems.filter((p) => p.severity === 'error');

    expect(warnings.some((w) => w.code === 'midi-channel-reuse')).toBe(true);
    expect(errors).toHaveLength(0);
  });
});
