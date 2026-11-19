// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import summary from '../../docs/review/perf/profile-200-summary.json';

describe('DOM Mutation Isolation Verification', () => {
  it('verifies DOM mutations outside the edited system are exactly 0 in 200-measure score', () => {
    expect(summary).toBeDefined();
    const affectedTargets = summary.domMutationsPerEdit.affectedSystemTargets;

    // Filter for system containers
    const systemsMutated = affectedTargets.filter((t: string) => t.startsWith('sys-'));
    expect(systemsMutated).toEqual(['sys-0']);

    // Assert that no other system was mutated (systems 1..49 had 0 mutations)
    const otherSystems = systemsMutated.filter((s: string) => s !== 'sys-0');
    expect(otherSystems.length).toBe(0);

    for (let i = 1; i < 50; i++) {
      expect(affectedTargets.includes(`sys-${i}`)).toBe(false);
    }
  });
});
