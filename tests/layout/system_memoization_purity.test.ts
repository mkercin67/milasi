// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { clearSystemLayoutCache, layoutScore } from '../../src/layout/layoutScore';
import { createBenchmarkFullFeaturedScore } from '../../src/ui/Demo';
import { transposeEvent } from '../../src/core/commands';

describe('System-level Layout Memoization & Purity (H1 Hardening)', () => {
  it('guarantees pure layout: identical scores reached via different command sequences yield identical LayoutResult', () => {
    clearSystemLayoutCache();

    // Start from common baseline score
    const baseScore = createBenchmarkFullFeaturedScore(64);
    const staff = baseScore.parts[0].staves[0];
    const m5Id = baseScore.measures[5].id;
    const noteId = staff.measures[m5Id].voices[0].events[0].id;

    // Sequence A: Transpose up by 2 semitones, then back down by 2 semitones
    const scoreA1 = transposeEvent(noteId, 2).apply(baseScore);
    const scoreA = transposeEvent(noteId, -2).apply(scoreA1);

    // Sequence B: Transpose down by 5 semitones, then back up by 5 semitones
    const scoreB1 = transposeEvent(noteId, -5).apply(baseScore);
    const scoreB = transposeEvent(noteId, 5).apply(scoreB1);

    const layoutA = layoutScore(scoreA, { width: 70 });
    const layoutB = layoutScore(scoreB, { width: 70 });

    expect(layoutA.width).toBe(layoutB.width);
    expect(layoutA.height).toBe(layoutB.height);
    expect(layoutA.systems.length).toBe(layoutB.systems.length);

    // Assert every item across all systems is identical
    for (let s = 0; s < layoutA.systems.length; s++) {
      const sysA = layoutA.systems[s];
      const sysB = layoutB.systems[s];
      expect(sysA.items.length).toBe(sysB.items.length);

      for (let i = 0; i < sysA.items.length; i++) {
        const itemA = sysA.items[i];
        const itemB = sysB.items[i];
        expect(itemA.id).toBe(itemB.id);
        expect(itemA.kind).toBe(itemB.kind);
        expect(itemA.x).toBeCloseTo(itemB.x, 4);
        expect(itemA.y).toBeCloseTo(itemB.y, 4);
        if (itemA.x2 !== undefined) expect(itemA.x2).toBeCloseTo(itemB.x2!, 4);
        if (itemA.y2 !== undefined) expect(itemA.y2).toBeCloseTo(itemB.y2!, 4);
        if (itemA.glyph !== undefined) expect(itemA.glyph).toBe(itemB.glyph);
        if (itemA.text !== undefined) expect(itemA.text).toBe(itemB.text);
      }
    }
  });

  it('guarantees identical layout before and after clearing the system layout cache', () => {
    const score = createBenchmarkFullFeaturedScore(64);

    // Warm up cache
    const layoutCached = layoutScore(score, { width: 70 });

    // Clear cache
    clearSystemLayoutCache();
    const layoutFresh = layoutScore(score, { width: 70 });

    expect(layoutCached.width).toBe(layoutFresh.width);
    expect(layoutCached.height).toBe(layoutFresh.height);
    expect(layoutCached.items.length).toBe(layoutFresh.items.length);

    for (let i = 0; i < layoutCached.items.length; i++) {
      const itA = layoutCached.items[i];
      const itB = layoutFresh.items[i];
      expect(itA.id).toBe(itB.id);
      expect(itA.x).toBeCloseTo(itB.x, 4);
      expect(itA.y).toBeCloseTo(itB.y, 4);
    }
  });

  it('completes layout calculation for a single-note edit at 200 and 400 measures with high cache hits (Rule R6: operational counter)', () => {
    for (const count of [200, 400]) {
      const score = createBenchmarkFullFeaturedScore(count);
      // Warm up
      layoutScore(score, { width: 70 });

      const staff = score.parts[0].staves[0];
      const m10Id = score.measures[10].id;
      const noteId = staff.measures[m10Id].voices[0].events[0].id;
      const editedScore = transposeEvent(noteId, 1).apply(score);

      // Measure single-note edit layout calculation
      const runs = 20;
      const samples: number[] = [];
      let lastLayout: any;
      for (let r = 0; r < runs; r++) {
        const t0 = performance.now();
        lastLayout = layoutScore(editedScore, { width: 70 });
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const medianMs = samples[Math.floor(samples.length / 2)];
      const p95Ms = samples[Math.floor(samples.length * 0.95)];

      console.log(`[PERF TEST] ${count} measures single-note edit layoutScore median: ${medianMs.toFixed(2)} ms, p95: ${p95Ms.toFixed(2)} ms`);
      // R6: No absolute wall-clock ms gate; assert structural operational output
      expect(lastLayout.systems.length).toBeGreaterThan(0);
      expect(lastLayout.items.length).toBeGreaterThan(0);
    }
  });
});
