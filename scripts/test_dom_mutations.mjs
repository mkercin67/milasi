// SPDX-License-Identifier: GPL-3.0-or-later
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

async function runDomMutationTests() {
  const port = 4199;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Starting Vite preview server on port ${port}...`);

  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    shell: true,
    stdio: 'pipe',
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

    console.log('Navigating to benchmark_200_full...');
    await page.goto(`${baseUrl}/?state=benchmark_200_full`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.score-event-group', { timeout: 15000 });

    // Set up MutationObserver to track per-action mutations by system target
    await page.evaluate(() => {
      window.__mutationBatches = [];
      const svg = document.querySelector('svg.notranslate');
      if (!svg) return;

      let currentBatch = { name: '', mutations: [], targets: new Set() };

      const observer = new MutationObserver((records) => {
        for (const record of records) {
          let sysId = null;
          if (record.target) {
            const el = record.target;
            const sysG = el.closest ? el.closest('[data-system-index]') : null;
            if (sysG) {
              sysId = `sys-${sysG.getAttribute('data-system-index')}`;
              currentBatch.targets.add(sysId);
            }
          }
          currentBatch.mutations.push({
            type: record.type,
            attributeName: record.attributeName,
            system: sysId,
          });
        }
      });

      observer.observe(svg, { childList: true, subtree: true, attributes: true, characterData: true });

      window.__startBatch = (name) => {
        currentBatch = { name, mutations: [], targets: new Set() };
      };

      window.__endBatch = () => {
        window.__mutationBatches.push({
          name: currentBatch.name,
          count: currentBatch.mutations.length,
          targets: Array.from(currentBatch.targets),
          mutations: currentBatch.mutations,
        });
      };
    });

    // Test (a): Edit in measure 0 (System 0)
    console.log('Testing (a): Edit in Measure 0 (System 0)...');
    await page.evaluate(() => {
      const note = document.querySelector('svg > g[data-system-index="0"] .score-event-group');
      const id = note?.getAttribute('data-event-id');
      if (id && window.__selectEventForTest) window.__selectEventForTest(id);
    });
    await sleep(200);

    await page.evaluate(() => window.__startBatch('measure-0-pitch-edit'));
    await page.keyboard.press('ArrowUp');
    await sleep(200);
    await page.evaluate(() => window.__endBatch());

    // Test (b): Edit in middle system (e.g. System 3)
    console.log('Testing (b): Edit in middle system (System 3)...');
    await page.evaluate(() => {
      const note = document.querySelector('svg > g[data-system-index="3"] .score-event-group');
      const id = note?.getAttribute('data-event-id');
      if (id && window.__selectEventForTest) window.__selectEventForTest(id);
    });
    await sleep(200);

    await page.evaluate(() => window.__startBatch('middle-system-3-edit'));
    await page.keyboard.press('ArrowUp');
    await sleep(200);
    await page.evaluate(() => window.__endBatch());

    // Test (c): Edit in last visible system (System 7)
    console.log('Testing (c): Edit in last visible system (System 7)...');
    await page.evaluate(() => {
      const note = document.querySelector('svg > g[data-system-index="7"] .score-event-group');
      const id = note?.getAttribute('data-event-id');
      if (id && window.__selectEventForTest) window.__selectEventForTest(id);
    });
    await sleep(200);

    await page.evaluate(() => window.__startBatch('last-visible-system-7-edit'));
    await page.keyboard.press('ArrowUp');
    await sleep(200);
    await page.evaluate(() => window.__endBatch());

    // Test (d): Edit that changes beam grouping (transposing note across stem direction threshold)
    console.log('Testing (d): Edit that changes beam grouping in System 0...');
    await page.evaluate(() => {
      const note = document.querySelector('svg > g[data-system-index="0"] .score-event-group');
      const id = note?.getAttribute('data-event-id');
      if (id && window.__selectEventForTest) window.__selectEventForTest(id);
    });
    await sleep(200);

    await page.evaluate(() => window.__startBatch('beam-grouping-flip-edit'));
    // Press Control+ArrowUp (octave up) to flip stem direction from up to down, recalculating beam
    await page.keyboard.down('Control');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.up('Control');
    await sleep(200);
    await page.evaluate(() => window.__endBatch());

    const batches = await page.evaluate(() => window.__mutationBatches);
    await browser.close();

    console.log('\n=== DOM MUTATION EXTENDED TEST RESULTS ===');
    for (const b of batches) {
      console.log(`Test [${b.name}]: ${b.count} mutations, affected systems: ${JSON.stringify(b.targets)}`);
    }

    const outDir = path.resolve('docs/review/perf');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'dom-mutation-extended.json');
    fs.writeFileSync(outPath, JSON.stringify(batches, null, 2));
    console.log(`Saved extended mutation results to ${outPath}`);
  } finally {
    preview.kill('SIGTERM');
  }
}

runDomMutationTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
