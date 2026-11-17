import { describe, expect, it } from 'vitest';
import { createBenchmark64Score } from '../../src/ui/Demo';
import { pasteEvents } from '../../src/core/clipboard';
import { layoutScore } from '../../src/layout/layoutScore';

describe('M6a: 8-measure paste profiling breakdown', () => {
  it('profiles 20 runs of 8-measure paste (32 notes) and measures command and layout splits', () => {
    const score = createBenchmark64Score();
    const staff = score.parts[0].staves[0];
    const measureIds = score.measures.map((m) => m.id);

    const eventsToCopy = [];
    for (let i = 0; i < 8; i++) {
      const m = staff.measures[measureIds[i]];
      for (const v of m.voices) {
        for (const ev of v.events) {
          if (ev.kind === 'note') eventsToCopy.push(ev);
        }
      }
    }
    const clipboard = eventsToCopy.slice(0, 32);

    expect(clipboard).toHaveLength(32);

    const commandTimes: number[] = [];
    const layoutTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const placed: string[] = [];
      const target = {
        staffId: staff.id,
        voiceId: staff.measures[measureIds[0]].voices[0].id,
        startMeasureId: measureIds[0],
        startOffsetTicks: 0,
      };
      const newScore = pasteEvents(score, target, clipboard, placed);
      const t1 = performance.now();

      layoutScore(newScore, { width: 70 });
      const t2 = performance.now();

      commandTimes.push(t1 - t0);
      layoutTimes.push(t2 - t1);
    }

    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const p50 = (arr: number[]) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length * 0.5)];
    const p95 = (arr: number[]) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length * 0.95)];

    console.log('--- 8-Measure Paste Microbenchmark (20 runs) ---');
    console.log(`Command (pasteEvents) - Mean: ${mean(commandTimes).toFixed(2)} ms, p50: ${p50(commandTimes).toFixed(2)} ms, p95: ${p95(commandTimes).toFixed(2)} ms`);
    console.log(`Layout (layoutScore)   - Mean: ${mean(layoutTimes).toFixed(2)} ms, p50: ${p50(layoutTimes).toFixed(2)} ms, p95: ${p95(layoutTimes).toFixed(2)} ms`);

    expect(p95(commandTimes)).toBeLessThan(50);
    expect(p95(layoutTimes)).toBeLessThan(100);
    expect(p95(commandTimes) + p95(layoutTimes)).toBeLessThan(150);
  });
});
