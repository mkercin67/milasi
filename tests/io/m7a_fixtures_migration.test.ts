// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Test suite for real .sfscore files migration (Item 7 & Rule R1).
 * Loads genuine saved .sfscore fixtures for v1..v6 and asserts valid v7 output.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { deserializeScore } from '../../src/io/json';
import { validateScore } from '../../src/core/validate';

describe('Real Saved .sfscore Fixtures Migration (Item 7 & Rule R1)', () => {
  const fixturesDir = path.resolve('tests/fixtures/scores');

  const versions = [1, 2, 3, 4, 5, 6];

  versions.forEach((version) => {
    it(`loads real saved v${version}_real.sfscore and migrates to a valid v7 score`, () => {
      const filePath = path.join(fixturesDir, `v${version}_real.sfscore`);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      const score = deserializeScore(content);

      // Verify v7 invariants
      expect(score.schemaVersion).toBe(7);
      expect(score.groups).toEqual([]);
      expect(score.parts[0].midiChannel).toBe(0); // Flute: non-percussion channel 0
      expect(score.parts[0].shortName).toBe('Fl.'); // Flute shortName from catalogue

      // Verify voices have voiceIndex
      for (const p of score.parts) {
        for (const st of p.staves) {
          for (const sm of Object.values(st.measures)) {
            for (const v of sm.voices) {
              expect(v.voiceIndex).toBeGreaterThanOrEqual(1);
              expect(v.voiceIndex).toBeLessThanOrEqual(4);
            }
          }
        }
      }

      // Assert no validation errors
      const problems = validateScore(score);
      const errors = problems.filter((pr) => pr.severity === 'error');
      expect(errors).toEqual([]);
    });
  });
});
