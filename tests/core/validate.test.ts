// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  createMeasure,
  createNote,
  createPart,
  createPitch,
  createRest,
  createScore,
} from '../../src/core/factory';
import { Score } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';

describe('validateScore', () => {
  it('returns no problems for a balanced, valid score', () => {
    const score = createScore();
    const measure = createMeasure({ num: 4, den: 4 }); // 3840 ticks
    const part = createPart('Violin');
    score.measures.push(measure);
    score.parts.push(part);

    // 4 quarter notes = 4 * 960 = 3840 ticks
    const staffMeasure = {
      voices: [
        {
          id: 'v1',
          voiceIndex: 1 as const,
          events: [
            createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('E', 4, 0)], baseType: 'quarter' }),
            createRest({ baseType: 'quarter' }),
          ],
        },
      ],
    };

    part.staves[0].measures[measure.id] = staffMeasure;

    const problems = validateScore(score);
    expect(problems).toEqual([]);
  });

  it('catches a short (underfull) measure', () => {
    const score = createScore();
    const measure = createMeasure({ num: 4, den: 4 }); // Expected: 3840 ticks
    const part = createPart('Flute');
    score.measures.push(measure);
    score.parts.push(part);

    // Only 3 quarter notes = 2880 ticks (< 3840 ticks)
    part.staves[0].measures[measure.id] = {
      voices: [
        {
          id: 'v1',
          voiceIndex: 1,
          events: [
            createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('D', 5, 0)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('E', 5, 0)], baseType: 'quarter' }),
          ],
        },
      ],
    };

    const problems = validateScore(score);
    expect(problems.length).toBe(1);
    expect(problems[0].code).toBe('measure-underfull');
    expect(problems[0].severity).toBe('error');
    expect(problems[0].message).toContain('short: 2880 ticks (expected 3840)');
  });

  it('catches an overfull measure', () => {
    const score = createScore();
    const measure = createMeasure({ num: 3, den: 4 }); // Expected: 2880 ticks
    const part = createPart('Clarinet');
    score.measures.push(measure);
    score.parts.push(part);

    // 4 quarter notes = 3840 ticks (> 2880 ticks)
    part.staves[0].measures[measure.id] = {
      voices: [
        {
          id: 'v1',
          voiceIndex: 1,
          events: [
            createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('E', 4, 0)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'quarter' }),
          ],
        },
      ],
    };

    const problems = validateScore(score);
    expect(problems.length).toBe(1);
    expect(problems[0].code).toBe('measure-overfull');
    expect(problems[0].severity).toBe('error');
    expect(problems[0].message).toContain('overfull: 3840 ticks (expected 2880)');
  });

  it('flags notes with empty pitch list', () => {
    const score = createScore();
    const measure = createMeasure({ num: 1, den: 4 });
    const part = createPart('Piano');
    score.measures.push(measure);
    score.parts.push(part);

    part.staves[0].measures[measure.id] = {
      voices: [
        {
          id: 'v1',
          voiceIndex: 1,
          events: [
            createNote({ pitches: [], baseType: 'quarter' }),
          ],
        },
      ],
    };

    const problems = validateScore(score);
    expect(problems.some((p) => p.code === 'empty-note-pitches')).toBe(true);
  });

  it('flags incorrect schemaVersion', () => {
    const score = createScore();
    // Simulate invalid schemaVersion
    const invalid = { ...score, schemaVersion: 99 } as unknown as Score;
    const problems = validateScore(invalid);
    expect(problems.some((p) => p.code === 'invalid-schema-version')).toBe(true);
  });

  it('rejects group whose partIds contains an id that is not a part with group-unknown-part', () => {
    const score = createScore();
    const part = createPart('Violin');
    score.parts.push(part);
    score.groups = [
      {
        id: 'group-1',
        partIds: [part.id, 'non-existent-part-id'],
        bracket: 'bracket',
        barlineSpan: 'through',
      },
    ];
    const problems = validateScore(score);
    const groupProb = problems.find((p) => p.code === 'group-unknown-part');
    expect(groupProb).toBeDefined();
    expect(groupProb?.message).toContain('non-existent-part-id');
  });

  it('validateScore rejects measure with empty voices array', () => {
    const score = createScore();
    const measure = createMeasure({ num: 4, den: 4 });
    const part = createPart('Violin');
    score.measures.push(measure);
    score.parts.push(part);
    part.staves[0].measures[measure.id] = { voices: [] };
    const problems = validateScore(score);
    expect(problems.some((p) => p.code === 'empty-staff-measure')).toBe(true);
  });

  it('validateScore rejects duplicate voiceIndex in the same measure', () => {
    const score = createScore();
    const measure = createMeasure({ num: 4, den: 4 });
    const part = createPart('Violin');
    score.measures.push(measure);
    score.parts.push(part);
    part.staves[0].measures[measure.id] = {
      voices: [
        { id: 'v1', voiceIndex: 1, events: [createRest({ baseType: 'whole' })] },
        { id: 'v2', voiceIndex: 1, events: [createRest({ baseType: 'whole' })] },
      ],
    };
    const problems = validateScore(score);
    expect(problems.some((p) => p.code === 'duplicate-voice-index')).toBe(true);
  });

  it('validateScore rejects single voice with voiceIndex != 1', () => {
    const score = createScore();
    const measure = createMeasure({ num: 4, den: 4 });
    const part = createPart('Violin');
    score.measures.push(measure);
    score.parts.push(part);
    part.staves[0].measures[measure.id] = {
      voices: [
        { id: 'v2', voiceIndex: 2, events: [createRest({ baseType: 'whole' })] },
      ],
    };
    const problems = validateScore(score);
    expect(problems.some((p) => p.code === 'missing-voice-1')).toBe(true);
  });

  it('validateScore rejects voice whose event durations do not match measure length', () => {
    const score = createScore();
    const measure = createMeasure({ num: 4, den: 4 }); // 3840 ticks
    const part = createPart('Violin');
    score.measures.push(measure);
    score.parts.push(part);
    part.staves[0].measures[measure.id] = {
      voices: [
        { id: 'v1', voiceIndex: 1, events: [createRest({ baseType: 'half' })] }, // 1920 ticks
      ],
    };
    const problems = validateScore(score);
    expect(problems.some((p) => p.code === 'measure-underfull')).toBe(true);
  });

  it('validateScore warns when more than 15 non-percussion parts share MIDI channels', () => {
    const score = createScore();
    const measure = createMeasure({ num: 4, den: 4 });
    score.measures.push(measure);
    // Add 16 non-percussion parts
    for (let i = 0; i < 16; i++) {
      const part = createPart(`Flute ${i + 1}`);
      part.staves[0].measures[measure.id] = {
        voices: [{ id: `v-${i}`, voiceIndex: 1, events: [createRest({ baseType: 'whole' })] }],
      };
      score.parts.push(part);
    }
    const problems = validateScore(score);
    const warn = problems.find((p) => p.code === 'midi-channel-reuse');
    expect(warn).toBeDefined();
    expect(warn?.severity).toBe('warning');
  });

  it('validateScore rejects ties or slurs that cross voices', () => {
    const score = createScore();
    const measure = createMeasure({ num: 4, den: 4 });
    const part = createPart('Violin');
    score.measures.push(measure);
    score.parts.push(part);
    const n1 = createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'half' });
    const n2 = createNote({ pitches: [createPitch('E', 4, 0)], baseType: 'half' });
    part.staves[0].measures[measure.id] = {
      voices: [
        { id: 'v1', voiceIndex: 1, events: [n1, createRest({ baseType: 'half' })] },
        { id: 'v2', voiceIndex: 2, events: [createRest({ baseType: 'half' }), n2] },
      ],
    };
    part.staves[0].slurs = [
      {
        id: 'slur-1',
        startEventId: n1.id,
        endEventId: n2.id,
      },
    ];
    const problems = validateScore(score);
    expect(problems.some((p) => p.code === 'slur-cross-voice')).toBe(true);
  });

  it('validateScore rejects score when a StaffMeasure is missing for a MeasureDef', () => {
    const score = createScore();
    const measure = createMeasure({ num: 4, den: 4 });
    const part = createPart('Violin');
    score.measures.push(measure);
    score.parts.push(part);
    // Don't create staff.measures[measure.id]
    const problems = validateScore(score);
    expect(problems.some((p) => p.code === 'missing-staff-measure')).toBe(true);
  });
});
