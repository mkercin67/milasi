// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Tests for deterministic ID generation and collision policy (Item 9).
 */

import { describe, expect, it } from 'vitest';
import { generateDeterministicId } from '../../src/core/deterministicId';
import { migrateV6ToV7 } from '../../src/io/migrations';

describe('Deterministic ID Generation and Collision Policy (Item 9)', () => {
  // Test (a): Same input gives same output (pure function, byte-identical)
  it('produces byte-identical deterministic IDs for identical inputs across repeated invocations', () => {
    const id1 = generateDeterministicId('staff-123', 'measure-456', 1, 0, 'voice');
    const id2 = generateDeterministicId('staff-123', 'measure-456', 1, 0, 'voice');
    const id3 = generateDeterministicId('staff-123', 'measure-456', 1, 0, 'voice');

    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
    // Verifies RFC4122 v4 UUID format
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('produces distinct IDs when any parameter differs', () => {
    const idBase = generateDeterministicId('staff-A', 'measure-M1', 1, 0, 'voice');
    const idDiffStaff = generateDeterministicId('staff-B', 'measure-M1', 1, 0, 'voice');
    const idDiffMeasure = generateDeterministicId('staff-A', 'measure-M2', 1, 0, 'voice');
    const idDiffVoice = generateDeterministicId('staff-A', 'measure-M1', 2, 0, 'voice');
    const idDiffCounter = generateDeterministicId('staff-A', 'measure-M1', 1, 1, 'voice');
    const idDiffDomain = generateDeterministicId('staff-A', 'measure-M1', 1, 0, 'rest');

    const set = new Set([idBase, idDiffStaff, idDiffMeasure, idDiffVoice, idDiffCounter, idDiffDomain]);
    expect(set.size).toBe(6);
  });

  // Test (b): A fixture that forces a collision aborts the migration with input untouched
  it('aborts migration with collision error and leaves input completely untouched when an ID collides', () => {
    const staffId = 'staff-col-test';
    const measureId = 'm1-col-test';
    const collidingId = generateDeterministicId(staffId, measureId, 1, 0, 'voice');

    const v6Data: any = {
      schemaVersion: 6,
      id: 'score-collision',
      meta: { title: 'Collision Score', composer: 'Test' },
      measures: [{ id: measureId, timeSig: { num: 4, den: 4 } }],
      parts: [
        {
          id: 'part-1',
          name: 'Violin',
          instrument: 'violin',
          staves: [
            {
              id: staffId,
              clef: { sign: 'G', line: 2 },
              measures: {
                [measureId]: { voices: [] }, // Missing voice 1 -> will generate deterministic ID
              },
            },
          ],
        },
      ],
      overrides: {
        [collidingId]: { dx: 2.5 }, // Pre-existing collision!
      },
    };

    const cloneBefore = JSON.parse(JSON.stringify(v6Data));
    expect(() => migrateV6ToV7(v6Data)).toThrow(/Kimlik çakışması tespit edildi/);
    expect(v6Data).toEqual(cloneBefore); // Input untouched
  });
});
