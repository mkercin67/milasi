// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { Score } from '../../src/core/model';
import { layoutScore } from '../../src/layout/layoutScore';
import {
  buildNoteheadIndex,
  layoutArticulations,
  layoutDynamics,
  layoutSlurs,
  notationOpCounter,
} from '../../src/layout/notations';
import { layoutTies } from '../../src/layout/ties';
import { createBenchmarkFullFeaturedScore } from '../../src/ui/Demo';

/**
 * Runs the full layout pipeline on a score using the indexed O(1) lookup path.
 */
function runFullLayoutPipeline(score: Score, availableSpaces: number) {
  const t0 = performance.now();
  const layout = layoutScore(score, { width: availableSpaces });
  const t1 = performance.now();
  const noteheadIndex = buildNoteheadIndex(layout);
  const t2 = performance.now();
  const ties = layoutTies(score, layout, noteheadIndex);
  const t3 = performance.now();
  const slurs = layoutSlurs(score, layout, noteheadIndex);
  const t4 = performance.now();
  const dynamics = layoutDynamics(score, layout, noteheadIndex);
  const t5 = performance.now();
  const articulations = layoutArticulations(score, layout, noteheadIndex);
  const t6 = performance.now();

  return {
    dt: t6 - t0,
    breakdown: {
      layout: t1 - t0,
      index: t2 - t1,
      ties: t3 - t2,
      slurs: t4 - t3,
      dynamics: t5 - t4,
      articulations: t6 - t5,
    },
    layout,
    ties,
    slurs,
    dynamics,
    articulations,
  };
}

/**
 * Runs the legacy unindexed lookup path (O(N^2)) where each query linearly scans all systems and items.
 */
function runLegacyUnindexedPipeline(score: Score, availableSpaces: number) {
  const t0 = performance.now();
  const layout = layoutScore(score, { width: availableSpaces });

  const legacyGetNoteheadInfo = (eventId: string) => {
    for (let sIdx = 0; sIdx < layout.systems.length; sIdx++) {
      const sys = layout.systems[sIdx];
      const match = sys.items.filter((it: any) => it.eventId === eventId && it.kind === 'glyph' && it.glyph?.startsWith('notehead'));
      if (match.length > 0) return match[0];
    }
    return null;
  };

  // Execute queries mimicking ties, slurs, dynamics, articulations
  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (const mId in staff.measures) {
        const sm = staff.measures[mId];
        for (const v of sm.voices) {
          for (const ev of v.events) {
            if (ev.kind === 'note' && (ev as any).tiedToNext) {
              legacyGetNoteheadInfo(ev.id);
            }
          }
        }
      }
      for (const slur of staff.slurs ?? []) {
        legacyGetNoteheadInfo(slur.startEventId);
        legacyGetNoteheadInfo(slur.endEventId);
      }
    }
  }
  for (const evId in score.overrides) {
    legacyGetNoteheadInfo(evId);
  }

  const dt = performance.now() - t0;
  return { dt };
}

/**
 * Instruments and counts the exact number of item visits and map lookups performed by real notation passes.
 * Reads directly from production notationOpCounter.
 */
export function countNotationLookupOperations(
  score: Score,
  availableSpaces: number,
  mode: 'indexed' | 'unindexed' = 'indexed'
): number {
  notationOpCounter.reset();
  notationOpCounter.enabled = true;

  const layout = layoutScore(score, { width: availableSpaces });

  if (mode === 'indexed') {
    const noteheadIndex = buildNoteheadIndex(layout);
    layoutTies(score, layout, noteheadIndex);
    layoutSlurs(score, layout, noteheadIndex);
    layoutDynamics(score, layout, noteheadIndex);
    layoutArticulations(score, layout, noteheadIndex);
  } else {
    // Unindexed mode: layoutTies uses findNoteheadPos linear scan for each tied note
    layoutTies(score, layout, undefined);
    layoutSlurs(score, layout, undefined);
    layoutDynamics(score, layout, undefined);
    layoutArticulations(score, layout, undefined);
  }

  const ops = notationOpCounter.total;
  notationOpCounter.enabled = false;
  return ops;
}

describe('Full Pipeline Layout Cost & Scaling Complexity (Rule R6 Compliant)', () => {
  it('instruments notation lookup path and proves linear operation count scaling', () => {
    const score100 = createBenchmarkFullFeaturedScore(100);
    const score200 = createBenchmarkFullFeaturedScore(200);
    const score400 = createBenchmarkFullFeaturedScore(400);

    const count100 = countNotationLookupOperations(score100, 100, 'indexed');
    const count200 = countNotationLookupOperations(score200, 100, 'indexed');
    const count400 = countNotationLookupOperations(score400, 100, 'indexed');

    const ratio200_100 = count200 / count100;
    const ratio400_200 = count400 / count200;

    console.log(`Indexed Operation Counts: 100m=${count100}, 200m=${count200}, 400m=${count400}`);
    console.log(`Indexed Scaling: 200/100 = ${ratio200_100.toFixed(2)}x, 400/200 = ${ratio400_200.toFixed(2)}x`);

    // Gate per R6: count grows linearly, bounded by <= 2.2x (ideal linear is 2.0x)
    expect(ratio200_100).toBeLessThanOrEqual(2.2);
    expect(ratio400_200).toBeLessThanOrEqual(2.2);

    // Verify that legacy unindexed lookup path FAILS this complexity gate
    const legacy100 = countNotationLookupOperations(score100, 100, 'unindexed');
    const legacy200 = countNotationLookupOperations(score200, 100, 'unindexed');
    const legacy400 = countNotationLookupOperations(score400, 100, 'unindexed');

    const legacyRatio200_100 = legacy200 / legacy100;
    const legacyRatio400_200 = legacy400 / legacy200;

    console.log(`Legacy Unindexed Operations: 100m=${legacy100}, 200m=${legacy200}, 400m=${legacy400}`);
    console.log(`Legacy Scaling: 200/100 = ${legacyRatio200_100.toFixed(2)}x, 400/200 = ${legacyRatio400_200.toFixed(2)}x`);

    // Unindexed lookup exhibits quadratic scaling (~4.0x) and fails linear gate <= 2.2x
    expect(legacyRatio200_100).toBeGreaterThan(2.2);
    expect(legacyRatio400_200).toBeGreaterThan(2.2);
  });

  it('reports scaling ratio between 400 and 200 measures using best-of-N runs (R6: informational timing)', () => {
    const score200 = createBenchmarkFullFeaturedScore(200);
    const score400 = createBenchmarkFullFeaturedScore(400);

    // Warmup JIT
    for (let i = 0; i < 15; i++) {
      runFullLayoutPipeline(score200, 100);
      runFullLayoutPipeline(score400, 100);
    }

    const runs = 20;
    const times200: number[] = [];
    const times400: number[] = [];

    for (let i = 0; i < runs; i++) {
      times200.push(runFullLayoutPipeline(score200, 100).dt);
      times400.push(runFullLayoutPipeline(score400, 100).dt);
    }

    const min200 = Math.min(...times200);
    const min400 = Math.min(...times400);
    const ratio = min400 / min200;

    console.log(`Best-of-${runs} Ratio: min400=${min400.toFixed(3)}ms, min200=${min200.toFixed(3)}ms, ratio=${ratio.toFixed(2)}x (reported, not gated in CI per R6)`);

    // Gating uses deterministic operation counts above; timing is reported cleanly per R6
    expect(min200).toBeGreaterThan(0);
    expect(min400).toBeGreaterThan(0);
  });

  it('demonstrates that the legacy unindexed linear scan fails the scaling ratio bound', () => {
    const score200 = createBenchmarkFullFeaturedScore(200);
    const score400 = createBenchmarkFullFeaturedScore(400);

    // Warmup
    for (let i = 0; i < 5; i++) {
      runLegacyUnindexedPipeline(score200, 100);
      runLegacyUnindexedPipeline(score400, 100);
    }

    const runs = 15;
    const legacy200: number[] = [];
    const legacy400: number[] = [];

    for (let i = 0; i < runs; i++) {
      legacy200.push(runLegacyUnindexedPipeline(score200, 100).dt);
      legacy400.push(runLegacyUnindexedPipeline(score400, 100).dt);
    }

    const min200 = Math.min(...legacy200);
    const min400 = Math.min(...legacy400);
    const legacyRatio = min400 / min200;

    console.log(`Legacy Unindexed Best-of-${runs}: min400=${min400.toFixed(3)}ms, min200=${min200.toFixed(3)}ms, ratio=${legacyRatio.toFixed(2)}x (fails <= 3.0x bound)`);

    // Legacy unindexed scan has ratio > 3.0x due to quadratic O(N^2) complexity
    expect(legacyRatio).toBeGreaterThan(3.0);
  });
});
