// SPDX-License-Identifier: GPL-3.0-or-later
import { spawn, execSync } from 'child_process';

console.log('Starting parallel CPU busy-loop processes to generate high CPU contention...');
const busyWorkers = [
  spawn('node', ['-e', 'const end = Date.now() + 120000; while(Date.now() < end) {}']),
  spawn('node', ['-e', 'const end = Date.now() + 120000; while(Date.now() < end) {}']),
];

try {
  for (let run = 1; run <= 3; run++) {
    console.log(`\n======================================================`);
    console.log(`=== Running Full Suite (Run ${run}/3) Under CPU Load ===`);
    console.log(`======================================================\n`);
    const t0 = Date.now();
    execSync('npx vitest run', { stdio: 'inherit' });
    const dur = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`\n=== Run ${run}/3 PASSED in ${dur}s ===`);
  }
  console.log('\nAll 3 test runs PASSED under CPU contention! Rule R6 fully verified.');
} finally {
  for (const w of busyWorkers) {
    try {
      w.kill();
    } catch {}
  }
}
