// SPDX-License-Identifier: GPL-3.0-or-later
import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import { chromium } from 'playwright';

// Traceability anchor (R6: bench remains an executable script, not an assertion-free unit test)
// test('captures 200 and 400 measure multi-bench results', async () => {});
// test('captures grand-staff 100 and 200 measure multi-bench results', async () => {});

function killProcessTree(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${proc.pid} /f /t`, { stdio: 'ignore' });
    } else {
      try {
        execSync(`pkill -P ${proc.pid}`, { stdio: 'ignore' });
      } catch {}
      try {
        process.kill(-proc.pid, 'SIGKILL');
      } catch {
        try {
          proc.kill('SIGKILL');
        } catch {}
      }
    }
  } catch {}
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findChromePath() {
  const chromePaths = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  for (const p of chromePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function waitForServer(url, timeoutMs = 15000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) resolve();
        else retry();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - t0 > timeoutMs) reject(new Error(`Server timeout at ${url}`));
      else setTimeout(check, 250);
    };
    check();
  });
}

function calculateStats(arr) {
  if (!arr || arr.length === 0) return { mean: 0, median: 0, p95: 0, min: 0, max: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const mean = arr.reduce((acc, v) => acc + v, 0) / arr.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { mean, median, p95, min, max };
}

async function runScenario(page, stateName, editCount = 50) {
  const url = `http://localhost:4199/?state=${stateName}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.score-event-group', { timeout: 15000 });

  await page.evaluate(() => {
    const firstNote = document.querySelector('.score-event-group');
    const eventId = firstNote?.getAttribute('data-event-id');
    if (eventId && window.__selectEventForTest) {
      window.__selectEventForTest(eventId);
    }
  });
  await sleep(200);

  await page.evaluate(() => {
    window.__perfDoubleRaf = [];
    window.__perfSingleRaf = [];
    window.__perfEventTiming = [];

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'keydown') {
            window.__perfEventTiming.push(entry.duration);
          }
        }
      });
      observer.observe({ type: 'event', durationThreshold: 0, buffered: true });
    } catch {
      // Event Timing API fallback
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        const t0 = performance.now();
        requestAnimationFrame(() => {
          const dtSingle = performance.now() - t0;
          window.__perfSingleRaf.push(dtSingle);
          requestAnimationFrame(() => {
            const dtDouble = performance.now() - t0;
            window.__perfDoubleRaf.push(dtDouble);
          });
        });
      }
    });
  });

  for (let i = 0; i < editCount; i++) {
    const key = i % 2 === 0 ? 'ArrowUp' : 'ArrowDown';
    await page.keyboard.press(key);
    await sleep(90);
  }
  await sleep(250);

  const doubleRaf = await page.evaluate(() => window.__perfDoubleRaf);
  const singleRaf = await page.evaluate(() => window.__perfSingleRaf);
  const eventTiming = await page.evaluate(() => window.__perfEventTiming);
  const appPerf = await page.evaluate((cnt) => window.__perf?.slice(-cnt) ?? [], editCount);

  return {
    doubleRaf: calculateStats(doubleRaf),
    singleRaf: calculateStats(singleRaf),
    eventTiming: eventTiming.length > 0 ? calculateStats(eventTiming) : null,
    appPerf: appPerf.length > 0 ? calculateStats(appPerf) : null,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const disableVsync = args.includes('--no-vsync');
  const isPoly = args.includes('--poly');
  const isGrand = args.includes('--grand');
  const runsCount = 5;
  const editsPerRun = 50;

  console.log(`=== Multi-Bench: ${runsCount} runs x ${editsPerRun} edits (vsync: ${disableVsync ? 'OFF' : 'ON'}, mode: ${isPoly ? 'POLYPHONIC' : 'MONOPHONIC'}) ===`);

  const port = 4199;
  const baseUrl = `http://localhost:${port}`;
  const isWin = process.platform === 'win32';
  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    shell: isWin,
    detached: !isWin,
    stdio: 'pipe',
  });

  try {
    await waitForServer(baseUrl);
    const execPath = findChromePath();

    const chromeArgs = ['--no-sandbox', '--disable-gpu'];
    if (disableVsync) {
      chromeArgs.push('--disable-frame-rate-limit', '--disable-gpu-vsync');
    }

    const browser = await chromium.launch({
      headless: true,
      executablePath: execPath,
      args: chromeArgs,
    });

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    if (isGrand) {
      // M7b-2 gate: grand staff (2 staves) against the single-staff reference at the same length.
      const scenarios = [
        ['single-100', 'benchmark_100_full'],
        ['grand-100', 'benchmark_100_grand'],
        ['grand-200', 'benchmark_200_grand'],
      ];
      const grandSummary = { timestamp: new Date().toISOString(), vsyncDisabled: disableVsync, scenarios: {} };
      for (const [label, stateName] of scenarios) {
        console.log(`\n--- ${label} (${runsCount} runs x ${editsPerRun} edits) ---`);
        const runs = [];
        for (let r = 0; r < runsCount; r++) {
          process.stdout.write(`  Run ${r + 1}/${runsCount}... `);
          const res = await runScenario(page, stateName, editsPerRun);
          runs.push({
            median: Number(res.doubleRaf.median.toFixed(2)),
            p95: Number(res.doubleRaf.p95.toFixed(2)),
            max: Number(res.doubleRaf.max.toFixed(2)),
            appPerfP95: res.appPerf ? Number(res.appPerf.p95.toFixed(2)) : null,
          });
          console.log(`Median: ${runs[r].median} ms, p95: ${runs[r].p95} ms, Max: ${runs[r].max} ms`);
        }
        const p95s = runs.map((x) => x.p95);
        grandSummary.scenarios[label] = {
          runs,
          p95Avg: Number((p95s.reduce((a, b) => a + b, 0) / p95s.length).toFixed(2)),
          p95Max: Math.max(...p95s),
        };
      }
      await browser.close();
      console.log('\n=== GRAND SUMMARY (double-rAF p95, ms) ===');
      for (const [label, v] of Object.entries(grandSummary.scenarios)) {
        console.log(`${label}: p95 avg ${v.p95Avg}, worst run ${v.p95Max}`);
      }
      const gOut = `docs/review/perf/multi-bench-grand-${disableVsync ? 'no-vsync' : 'vsync'}.json`;
      fs.writeFileSync(gOut, JSON.stringify(grandSummary, null, 2));
      console.log(`Saved summary to ${gOut}`);
      return;
    }

    const results64 = [];
    if (!isPoly) {
      // Scenario 64 measures
      console.log(`\n--- Running 64-measure (${runsCount} runs x ${editsPerRun} edits) ---`);
      for (let r = 0; r < runsCount; r++) {
        process.stdout.write(`  Run ${r + 1}/${runsCount}... `);
        const res = await runScenario(page, 'benchmark_64_full', editsPerRun);
        results64.push(res);
        console.log(`Double rAF Med: ${res.doubleRaf.median.toFixed(2)} ms, p95: ${res.doubleRaf.p95.toFixed(2)} ms, Max: ${res.doubleRaf.max.toFixed(2)} ms`);
      }
    }

    // Scenario 200 measures
    const state200 = isPoly ? 'benchmark_200_poly' : 'benchmark_200_full';
    console.log(`\n--- Running 200-measure ${isPoly ? 'Polyphonic' : 'Full'} (${runsCount} runs x ${editsPerRun} edits) ---`);
    const results200 = [];
    for (let r = 0; r < runsCount; r++) {
      process.stdout.write(`  Run ${r + 1}/${runsCount}... `);
      const res = await runScenario(page, state200, editsPerRun);
      results200.push(res);
      console.log(`Double rAF Med: ${res.doubleRaf.median.toFixed(2)} ms, p95: ${res.doubleRaf.p95.toFixed(2)} ms, Max: ${res.doubleRaf.max.toFixed(2)} ms`);
    }

    // Scenario 400 measures
    const state400 = isPoly ? 'benchmark_400_poly' : 'benchmark_400_full';
    console.log(`\n--- Running 400-measure ${isPoly ? 'Polyphonic' : 'Full'} (${runsCount} runs x ${editsPerRun} edits) ---`);
    const results400 = [];
    for (let r = 0; r < runsCount; r++) {
      process.stdout.write(`  Run ${r + 1}/${runsCount}... `);
      const res = await runScenario(page, state400, editsPerRun);
      results400.push(res);
      console.log(`Double rAF Med: ${res.doubleRaf.median.toFixed(2)} ms, p95: ${res.doubleRaf.p95.toFixed(2)} ms, Max: ${res.doubleRaf.max.toFixed(2)} ms`);
    }

    await browser.close();

    function summarizeRuns(runs) {
      const medians = runs.map((r) => r.doubleRaf.median);
      const p95s = runs.map((r) => r.doubleRaf.p95);
      const maxes = runs.map((r) => r.doubleRaf.max);

      const medianSpread = Math.max(...medians) - Math.min(...medians);
      const p95Spread = Math.max(...p95s) - Math.min(...p95s);

      return {
        runs: runs.map((r, i) => ({
          run: i + 1,
          median: Number(r.doubleRaf.median.toFixed(2)),
          p95: Number(r.doubleRaf.p95.toFixed(2)),
          max: Number(r.doubleRaf.max.toFixed(2)),
          eventTimingMed: r.eventTiming ? Number(r.eventTiming.median.toFixed(2)) : null,
          eventTimingP95: r.eventTiming ? Number(r.eventTiming.p95.toFixed(2)) : null,
        })),
        summary: {
          medianAvg: Number((medians.reduce((a, b) => a + b, 0) / medians.length).toFixed(2)),
          medianSpread: Number(medianSpread.toFixed(2)),
          p95Avg: Number((p95s.reduce((a, b) => a + b, 0) / p95s.length).toFixed(2)),
          p95Min: Number(Math.min(...p95s).toFixed(2)),
          p95Max: Number(Math.max(...p95s).toFixed(2)),
          p95Spread: Number(p95Spread.toFixed(2)),
          maxOverall: Number(Math.max(...maxes).toFixed(2)),
        },
      };
    }

    const summary = {
      timestamp: new Date().toISOString(),
      vsyncDisabled: disableVsync,
      scenario64: summarizeRuns(results64),
      scenario200: summarizeRuns(results200),
      scenario400: summarizeRuns(results400),
    };

    console.log('\n=== SUMMARY ===');
    console.log('64-measure:');
    console.log(`  Medians: ${summary.scenario64.runs.map((r) => r.median).join(', ')} (Spread: ${summary.scenario64.summary.medianSpread} ms)`);
    console.log(`  p95s:    ${summary.scenario64.runs.map((r) => r.p95).join(', ')} (Spread: ${summary.scenario64.summary.p95Spread} ms, Avg: ${summary.scenario64.summary.p95Avg} ms)`);
    console.log('200-measure:');
    console.log(`  Medians: ${summary.scenario200.runs.map((r) => r.median).join(', ')} (Spread: ${summary.scenario200.summary.medianSpread} ms)`);
    console.log(`  p95s:    ${summary.scenario200.runs.map((r) => r.p95).join(', ')} (Spread: ${summary.scenario200.summary.p95Spread} ms, Avg: ${summary.scenario200.summary.p95Avg} ms)`);
    console.log('400-measure:');
    console.log(`  Medians: ${summary.scenario400.runs.map((r) => r.median).join(', ')} (Spread: ${summary.scenario400.summary.medianSpread} ms)`);
    console.log(`  p95s:    ${summary.scenario400.runs.map((r) => r.p95).join(', ')} (Spread: ${summary.scenario400.summary.p95Spread} ms, Avg: ${summary.scenario400.summary.p95Avg} ms)`);

    const outPath = `docs/review/perf/multi-bench-${isPoly ? 'poly-' : ''}${disableVsync ? 'no-vsync' : 'vsync'}.json`;
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
    console.log(`Saved summary to ${outPath}`);
  } finally {
    killProcessTree(preview);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
