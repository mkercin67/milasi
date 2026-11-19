// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Tests for severity policy on score load (Item 10):
 * - deserializeScore accepts scores with warnings (e.g. >15 non-percussion parts)
 * - deserializeScore rejects scores with errors (e.g. overfull measure)
 */

import { describe, expect, it } from 'vitest';
import { createMeasure, createNote, createPart, createPitch, createRest, createScore, newId } from '../../src/core/factory';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { validateScore } from '../../src/core/validate';

describe('Severity Policy in deserializeScore (Item 10)', () => {
  it('accepts a score with only warnings (more than 15 non-percussion parts) without throwing', () => {
    const score = createScore();
    const m = createMeasure({ num: 4, den: 4 });
    score.measures.push(m);

    // 16 non-percussion parts sharing MIDI channels beyond 15
    for (let i = 0; i < 16; i++) {
      const part = createPart({ name: `Violin ${i + 1}`, instrument: 'violin' });
      part.staves[0].measures[m.id] = {
        voices: [{ id: newId(), voiceIndex: 1, events: [createRest({ baseType: 'whole', duration: 3840 })] }],
      };
      score.parts.push(part);
    }

    const problems = validateScore(score);
    expect(problems.some((p) => p.code === 'midi-channel-reuse' && p.severity === 'warning')).toBe(true);
    expect(problems.filter((p) => p.severity === 'error')).toHaveLength(0);

    const json = serializeScore(score);
    // Must NOT throw: warnings are tolerated on load
    const loaded = deserializeScore(json);
    expect(loaded.parts).toHaveLength(16);
  });

  it('rejects a score with validation errors (overfull voice duration) with descriptive error', () => {
    const score = createScore();
    const m = createMeasure({ num: 4, den: 4 });
    const part = createPart({ name: 'Flute', instrument: 'flute' });
    score.measures.push(m);
    score.parts.push(part);

    part.staves[0].measures[m.id] = {
      voices: [
        {
          id: newId(),
          voiceIndex: 1,
          events: [
            createRest({ baseType: 'whole', duration: 3840 }),
            createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }), // Overfull!
          ],
        },
      ],
    };

    const json = serializeScore(score);
    expect(() => deserializeScore(json)).toThrow(/Validation failed on score load/);
  });
});
