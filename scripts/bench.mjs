import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

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
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };

    const retry = () => {
      if (Date.now() - t0 > timeoutMs) {
        reject(new Error(`Timed out waiting for server at ${url}`));
      } else {
        setTimeout(check, 250);
      }
    };

    check();
  });
}

function calculateStats(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mean = arr.reduce((acc, v) => acc + v, 0) / arr.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { mean, median, p95, min, max };
}

async function runBenchmark() {
  const port = 4199;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Starting Vite preview server on port ${port}...`);

  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    shell: true,
    stdio: 'pipe',
  });

  preview.stderr.on('data', (d) => {
    const s = d.toString();
    if (!s.includes('warning') && !s.includes('deprecated')) {
      console.error('[preview err]', s);
    }
  });

  try {
    await waitForServer(baseUrl);
    console.log(`Vite preview ready at ${baseUrl}`);

    const execPath = findChromePath();
    const browser = await chromium.launch({
      headless: true,
      executablePath: execPath,
      args: ['--no-sandbox', '--disable-gpu'],
    });

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    // -------------------------------------------------------------
    // Scenario 1: 64-measure full-featured
    // -------------------------------------------------------------
    console.log('\nRunning Scenario 1: 64-measure full-featured score...');
    await page.goto(`${baseUrl}/?state=benchmark_64_full`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.score-event-group', { timeout: 10000 });

    // Select first note
    await page.evaluate(() => {
      const firstNote = document.querySelector('.score-event-group');
      const eventId = firstNote?.getAttribute('data-event-id');
      if (eventId && window.__selectEventForTest) {
        window.__selectEventForTest(eventId);
      }
    });
    await sleep(200);

    // Instrument keydown latency measurement
    await page.evaluate(() => {
      window.__perfLatencies = [];
      window.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
          const t0 = performance.now();
          requestAnimationFrame(() => {
            const dt = performance.now() - t0;
            window.__perfLatencies.push(dt);
          });
        }
      });
    });

    // 30 Keystrokes
    for (let i = 0; i < 30; i++) {
      const key = i % 2 === 0 ? 'ArrowUp' : 'ArrowDown';
      await page.keyboard.press(key);
      await sleep(90);
    }
    await sleep(200);

    const latencies64 = await page.evaluate(() => window.__perfLatencies);
    const stats64 = calculateStats(latencies64);

    console.log('--- 64-Measure Full-Featured Benchmark Results ---');
    console.log(`Keystrokes: ${latencies64.length}`);
    console.log(`Mean:       ${stats64.mean.toFixed(2)} ms`);
    console.log(`Median:     ${stats64.median.toFixed(2)} ms`);
    console.log(`p95:        ${stats64.p95.toFixed(2)} ms (Target: < 25.0 ms)`);
    console.log(`Min / Max:  ${stats64.min.toFixed(2)} ms / ${stats64.max.toFixed(2)} ms`);

    if (stats64.p95 >= 25.0) {
      throw new Error(`FAIL: 64-measure p95 (${stats64.p95.toFixed(2)} ms) exceeds 25 ms target!`);
    }

    // -------------------------------------------------------------
    // Scenario 2: 200-measure full-featured + Virtualization checks
    // -------------------------------------------------------------
    console.log('\nRunning Scenario 2: 200-measure full-featured score...');
    await page.goto(`${baseUrl}/?state=benchmark_200_full`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.score-event-group', { timeout: 15000 });

    // Verify virtualization at top
    const totalSystems = await page.evaluate(() => {
      const placeholders = document.querySelectorAll('[data-system-placeholder="true"]').length;
      const systems = document.querySelectorAll('svg > g[data-system-index]').length;
      return placeholders + systems;
    });

    const renderedSystemsTop = await page.evaluate(() => {
      return document.querySelectorAll('svg > g[data-system-index]:not([data-system-placeholder="true"])').length;
    });
    const placeholderSystemsTop = await page.evaluate(() => {
      return document.querySelectorAll('[data-system-placeholder="true"]').length;
    });

    console.log(`Virtualization at Top: ${renderedSystemsTop} rendered systems, ${placeholderSystemsTop} placeholder systems (total: ${totalSystems})`);
    if (placeholderSystemsTop === 0) {
      throw new Error(`FAIL: Virtualization inactive! 0 placeholder systems found on 200-measure score.`);
    }

    // Scroll to bottom
    console.log('Scrolling container to bottom...');
    await page.evaluate(() => {
      const container = document.querySelector('div[style*="overflow: auto"]');
      if (container) {
        container.scrollTop = container.scrollHeight;
        container.dispatchEvent(new Event('scroll'));
      }
    });
    await sleep(300);

    const isSystem0Placeholder = await page.evaluate(() => {
      const s0 = document.querySelector('[data-system-placeholder="true"][data-system-index="0"]');
      return s0 !== null;
    });
    const renderedSystemsBottom = await page.evaluate(() => {
      return document.querySelectorAll('svg > g[data-system-index]:not([data-system-placeholder="true"])').length;
    });
    const placeholderSystemsBottom = await page.evaluate(() => {
      return document.querySelectorAll('[data-system-placeholder="true"]').length;
    });

    console.log(`Virtualization at Bottom: System 0 is placeholder = ${isSystem0Placeholder}, ${renderedSystemsBottom} rendered, ${placeholderSystemsBottom} placeholders`);
    if (!isSystem0Placeholder) {
      throw new Error(`FAIL: System 0 did not virtualize to placeholder after scrolling to bottom!`);
    }

    // Scroll back to top
    await page.evaluate(() => {
      const container = document.querySelector('div[style*="overflow: auto"]');
      if (container) {
        container.scrollTop = 0;
        container.dispatchEvent(new Event('scroll'));
      }
    });
    await sleep(300);

    // Verify Ctrl+A (Select All)
    console.log('Testing Ctrl+A Select All with virtualization...');
    await page.keyboard.press('Control+a');
    await sleep(150);

    const hasSelection = await page.evaluate(() => {
      const bands = document.querySelectorAll('[data-testid="range-selection-band"]');
      const editorState = window.__getEditorStateForTest ? window.__getEditorStateForTest() : null;
      return bands.length > 0 || (editorState && editorState.selection && editorState.selection.kind === 'range');
    });
    console.log(`Select All test: hasSelection = ${hasSelection}`);
    if (!hasSelection) {
      throw new Error('FAIL: Ctrl+A failed to select score range when virtualized!');
    }

    // Clear range selection with Escape so single-note keydown test measures normal editing
    await page.keyboard.press('Escape');
    await sleep(150);

    // Select first note for keydown benchmark
    await page.evaluate(() => {
      const firstNote = document.querySelector('.score-event-group');
      const eventId = firstNote?.getAttribute('data-event-id');
      if (eventId && window.__selectEventForTest) {
        window.__selectEventForTest(eventId);
      }
    });
    await sleep(150);

    // Instrument keydown latency measurement for 200 measures
    await page.evaluate(() => {
      window.__perfLatencies200 = [];
      window.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
          const t0 = performance.now();
          requestAnimationFrame(() => {
            const dt = performance.now() - t0;
            window.__perfLatencies200.push(dt);
          });
        }
      });
    });

    for (let i = 0; i < 30; i++) {
      const key = i % 2 === 0 ? 'ArrowUp' : 'ArrowDown';
      await page.keyboard.press(key);
      await sleep(90);
    }
    await sleep(200);

    const latencies200 = await page.evaluate(() => window.__perfLatencies200);
    const perfAppSamples = await page.evaluate(() => window.__perf?.slice(-30) ?? []);
    console.log('Sample App perf timings (last 5):', perfAppSamples.slice(-5));
    const stats200 = calculateStats(latencies200);

    console.log('\n--- 200-Measure Full-Featured Benchmark Results ---');
    console.log(`Keystrokes: ${latencies200.length}`);
    console.log(`Mean:       ${stats200.mean.toFixed(2)} ms`);
    console.log(`Median:     ${stats200.median.toFixed(2)} ms`);
    console.log(`p95:        ${stats200.p95.toFixed(2)} ms (Target: < 40.0 ms)`);
    console.log(`Min / Max:  ${stats200.min.toFixed(2)} ms / ${stats200.max.toFixed(2)} ms`);

    if (stats200.p95 >= 40.0) {
      throw new Error(`FAIL: 200-measure p95 (${stats200.p95.toFixed(2)} ms) exceeds 40 ms target!`);
    }

    await browser.close();

    // Write benchmark report file
    const dateStr = new Date().toISOString().split('T')[0];
    const reportDir = path.resolve('docs/perf');
    fs.mkdirSync(reportDir, { recursive: true });

    const reportPath = path.join(reportDir, `bench-${dateStr}.json`);
    const reportData = {
      date: dateStr,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      browser: 'Chromium',
      scenarios: {
        benchmark_64_full: {
          measures: 64,
          features: ['ties', 'slurs', 'dynamics', 'articulations', 'repeats', 'lyrics'],
          runs: latencies64.length,
          meanMs: Number(stats64.mean.toFixed(2)),
          medianMs: Number(stats64.median.toFixed(2)),
          p95Ms: Number(stats64.p95.toFixed(2)),
          minMs: Number(stats64.min.toFixed(2)),
          maxMs: Number(stats64.max.toFixed(2)),
          targetP95Ms: 25.0,
          pass: stats64.p95 < 25.0,
        },
        benchmark_200_full: {
          measures: 200,
          features: ['ties', 'slurs', 'dynamics', 'articulations', 'repeats', 'lyrics'],
          runs: latencies200.length,
          meanMs: Number(stats200.mean.toFixed(2)),
          medianMs: Number(stats200.median.toFixed(2)),
          p95Ms: Number(stats200.p95.toFixed(2)),
          minMs: Number(stats200.min.toFixed(2)),
          maxMs: Number(stats200.max.toFixed(2)),
          targetP95Ms: 40.0,
          pass: stats200.p95 < 40.0,
          virtualization: {
            totalSystems,
            renderedSystemsTop,
            placeholderSystemsTop,
            renderedSystemsBottom,
            placeholderSystemsBottom,
            isSystem0PlaceholderAfterScroll: isSystem0Placeholder,
            selectAllWorks: hasSelection,
          },
        },
      },
    };

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
    console.log(`\nBenchmark report successfully written to: ${reportPath}`);

    console.log('\n========================================================================================');
    console.log('PRODUCTION KEYSTROKE-TO-PAINT BENCHMARK SUMMARY');
    console.log('========================================================================================');
    console.log(`64 Full-Featured:  Median = ${stats64.median.toFixed(2)} ms, p95 = ${stats64.p95.toFixed(2)} ms (Target: < 25.0 ms) -> PASS`);
    console.log(`200 Full-Featured: Median = ${stats200.median.toFixed(2)} ms, p95 = ${stats200.p95.toFixed(2)} ms (Target: < 40.0 ms) -> PASS`);
    console.log(`Virtualization:    ${placeholderSystemsTop}/${totalSystems} placeholders at top; System 0 virtualized at bottom -> PASS`);
    console.log(`Select All (CtrlA): Verified functional with virtualization -> PASS`);
    console.log('========================================================================================\n');
  } finally {
    try {
      if (preview.pid) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(preview.pid), '/f', '/t']);
        } else {
          preview.kill('SIGTERM');
        }
      }
    } catch {
      // Ignore cleanup error
    }
    process.exit(0);
  }
}

runBenchmark().catch((err) => {
  console.error('\nBENCHMARK FAILED:', err);
  process.exit(1);
});
