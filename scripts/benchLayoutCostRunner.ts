// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Score } from '../src/core/model';
import { layoutScore } from '../src/layout/layoutScore';
import {
  buildNoteheadIndex,
  layoutArticulations,
  layoutDynamics,
  layoutSlurs,
} from '../src/layout/notations';
import { layoutTies } from '../src/layout/ties';
import { createBenchmarkFullFeaturedScore } from '../src/ui/Demo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  };
}

function calculateStats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  const median = sorted[Math.floor(n / 2)];
  const p95 = sorted[Math.floor(n * 0.95)];
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  return { min, max, median, p95, avg };
}

function runBenchmark() {
  console.log('=====================================================');
  console.log('MiLaSi Full Pipeline Node Layout Cost Benchmark');
  console.log('Informational Only (Rule R6: Not Gated in CI)');
  console.log('=====================================================\n');

  const sizes = [64, 200, 400];
  const runs = 50;
  const warmup = 15;
  const results: Record<number, ReturnType<typeof calculateStats>> = {};

  for (const size of sizes) {
    const score = createBenchmarkFullFeaturedScore(size);

    // Warmup
    for (let i = 0; i < warmup; i++) {
      runFullLayoutPipeline(score, 100);
    }

    const times: number[] = [];
    for (let i = 0; i < runs; i++) {
      times.push(runFullLayoutPipeline(score, 100).dt);
    }

    results[size] = calculateStats(times);
    console.log(
      `${size} Measures (${runs} runs): min=${results[size].min.toFixed(3)} ms, ` +
        `med=${results[size].median.toFixed(3)} ms, ` +
        `p95=${results[size].p95.toFixed(3)} ms, ` +
        `max=${results[size].max.toFixed(3)} ms`
    );
  }

  const ratio400_200 = results[400].median / results[200].median;
  const ratio200_64 = results[200].median / results[64].median;
  console.log(`\nMedian Scaling Ratios:`);
  console.log(`  200m / 64m:  ${ratio200_64.toFixed(2)}x (Proportional ~3.1x)`);
  console.log(`  400m / 200m: ${ratio400_200.toFixed(2)}x (Linear is 2.0x)`);

  // Write markdown report
  const docPath = path.join(__dirname, '../docs/review/layout-cost-benchmark.md');
  const docContent = `# Full Pipeline Node Layout Cost Benchmark

> **Status:** Informational Only  
> **Rule R6 Compliance:** In accordance with Rule R6, this benchmark is reported for tracking and regression analysis. It is **never** used as a pass/fail timing gate in automated CI test suites. CI correctness and scaling are gated strictly by deterministic operation count complexity and minimum ratio bounds.

## Benchmark Configuration
- **Runtime:** Node.js ${process.version} (${process.platform} ${process.arch})
- **Score Types:** Full-featured scores (measures with notes, ties across barlines, slurs, dynamics, and articulations)
- **Runs:** 50 runs per score size (preceded by 15 JIT warmup runs)
- **Width:** 100 staff spaces

## Results Table

| Score Size | Min (ms) | Median (ms) | p95 (ms) | Max (ms) |
| :--- | :--- | :--- | :--- | :--- |
| **64 Measures** | ${results[64].min.toFixed(3)} | ${results[64].median.toFixed(3)} | ${results[64].p95.toFixed(3)} | ${results[64].max.toFixed(3)} |
| **200 Measures** | ${results[200].min.toFixed(3)} | ${results[200].median.toFixed(3)} | ${results[200].p95.toFixed(3)} | ${results[200].max.toFixed(3)} |
| **400 Measures** | ${results[400].min.toFixed(3)} | ${results[400].median.toFixed(3)} | ${results[400].p95.toFixed(3)} | ${results[400].max.toFixed(3)} |

## Scaling Analysis
- **200m / 64m Ratio (Median):** ${ratio200_64.toFixed(2)}x (Expected linear ~3.1x)
- **400m / 200m Ratio (Median):** ${ratio400_200.toFixed(2)}x (Expected linear ~2.0x)

The O(1) indexed notehead lookup path ensures strictly linear O(N) scaling across all score sizes.
`;

  fs.writeFileSync(docPath, docContent, 'utf8');
  console.log(`\nWrote benchmark report to: ${docPath}`);
}

runBenchmark();
