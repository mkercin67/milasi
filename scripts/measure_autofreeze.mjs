// SPDX-License-Identifier: GPL-3.0-or-later
import { setAutoFreeze } from 'immer';
import { createEmptyScore } from '../src/core/factory.ts';
import { transposeRange } from '../src/core/commands.ts';

function runBench(freeze, runs = 5, editsPerRun = 100) {
  setAutoFreeze(freeze);
  const perEditTimes = [];

  for (let r = 0; r < runs; r++) {
    let score = createEmptyScore({ measures: 400 });
    const staffId = score.parts[0].staves[0].id;
    const mId = score.measures[0].id;
    const eventId = score.parts[0].staves[0].measures[mId].voices[0].events[0].id;
    const sel = { staffId, voiceIndex: 1, anchorId: eventId, focusId: eventId };

    const start = performance.now();
    for (let e = 0; e < editsPerRun; e++) {
      score = transposeRange(sel, (e % 2 === 0 ? 1 : -1)).apply(score);
    }
    const elapsed = performance.now() - start;
    perEditTimes.push(elapsed / editsPerRun);
  }

  perEditTimes.sort((a, b) => a - b);
  const median = perEditTimes[Math.floor(perEditTimes.length / 2)];
  return { runs: perEditTimes, median };
}

console.log('=== Measuring Immer setAutoFreeze on 400-measure score ===');
const withFreeze = runBench(true, 5, 100);
console.log('With autoFreeze=true:');
withFreeze.runs.forEach((t, i) => console.log(`  Run ${i + 1}: ${t.toFixed(4)} ms/edit`));
console.log(`  Median: ${withFreeze.median.toFixed(4)} ms/edit\n`);

const withoutFreeze = runBench(false, 5, 100);
console.log('With autoFreeze=false:');
withoutFreeze.runs.forEach((t, i) => console.log(`  Run ${i + 1}: ${t.toFixed(4)} ms/edit`));
console.log(`  Median: ${withoutFreeze.median.toFixed(4)} ms/edit\n`);

const diff = withFreeze.median - withoutFreeze.median;
console.log(`Difference (freezing overhead): ${diff.toFixed(4)} ms/edit`);
console.log(`Upper bound (<= 0.63 ms): ${diff <= 0.63 ? 'CONFIRMED' : 'EXCEEDED'}`);
setAutoFreeze(true);
