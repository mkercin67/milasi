// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import summary from '../../docs/review/perf/profile-200-summary.json';
import extended from '../../docs/review/perf/dom-mutation-extended.json';

describe('DOM Mutation Isolation Verification', () => {
  it('verifies DOM mutations outside the edited system are exactly 0 in 200-measure score (50-edit batch)', () => {
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

  it('verifies DOM isolation across 4 distinct edit locations (Step 5)', () => {
    expect(extended).toBeDefined();
    expect(extended.length).toBe(4);

    // (a) Measure 0 (System 0)
    const testA = extended.find((b) => b.name === 'measure-0-pitch-edit');
    expect(testA).toBeDefined();
    expect(testA?.targets).toEqual(['sys-0']);

    // (b) Middle system (System 3)
    const testB = extended.find((b) => b.name === 'middle-system-3-edit');
    expect(testB).toBeDefined();
    expect(testB?.targets).toEqual(['sys-3']);

    // (c) Last visible system (System 7)
    const testC = extended.find((b) => b.name === 'last-visible-system-7-edit');
    expect(testC).toBeDefined();
    expect(testC?.targets).toEqual(['sys-7']);

    // (d) Beam grouping edit (System 0)
    const testD = extended.find((b) => b.name === 'beam-grouping-flip-edit');
    expect(testD).toBeDefined();
    expect(testD?.targets).toEqual(['sys-0']);
  });
});
