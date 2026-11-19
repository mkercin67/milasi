// SPDX-License-Identifier: GPL-3.0-or-later
import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

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

async function runTraceAndProfile() {
  const port = 4199;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Starting Vite preview server on port ${port}...`);

  const isWin = process.platform === 'win32';
  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    shell: isWin,
    detached: !isWin,
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

    console.log('\nLoading 200-measure full-featured score for profiling...');
    await page.goto(`${baseUrl}/?state=benchmark_200_full`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.score-event-group', { timeout: 15000 });

    // Select first note
    await page.evaluate(() => {
      const firstNote = document.querySelector('.score-event-group');
      const eventId = firstNote?.getAttribute('data-event-id');
      if (eventId && window.__selectEventForTest) {
        window.__selectEventForTest(eventId);
      }
    });
    await sleep(200);

    // Set up MutationObserver to count DOM mutations per edit
    await page.evaluate(() => {
      window.__domMutationStats = [];
      const svg = document.querySelector('svg.notranslate');
      if (!svg) return;

      let currentMutations = { added: 0, removed: 0, attributes: 0, characterData: 0, targets: new Set() };

      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === 'childList') {
            currentMutations.added += record.addedNodes.length;
            currentMutations.removed += record.removedNodes.length;
          } else if (record.type === 'attributes') {
            currentMutations.attributes += 1;
          } else if (record.type === 'characterData') {
            currentMutations.characterData += 1;
          }
          if (record.target) {
            const el = record.target;
            const sysG = el.closest ? el.closest('[data-system-index]') : null;
            if (sysG) {
              currentMutations.targets.add(`sys-${sysG.getAttribute('data-system-index')}`);
            } else {
              currentMutations.targets.add(el.nodeName || 'unknown');
            }
          }
        }
      });

      observer.observe(svg, { childList: true, subtree: true, attributes: true, characterData: true });

      window.__startMutationBatch = () => {
        currentMutations = { added: 0, removed: 0, attributes: 0, characterData: 0, targets: new Set() };
      };

      window.__endMutationBatch = () => {
        window.__domMutationStats.push({
          added: currentMutations.added,
          removed: currentMutations.removed,
          attributes: currentMutations.attributes,
          characterData: currentMutations.characterData,
          total: currentMutations.added + currentMutations.removed + currentMutations.attributes + currentMutations.characterData,
          targets: Array.from(currentMutations.targets),
        });
      };
    });

    // CDP Client for Chrome Timeline Tracing
    const client = await page.context().newCDPSession(page);
    const traceEvents = [];
    client.on('Tracing.dataCollected', (data) => {
      if (data && data.value) {
        traceEvents.push(...data.value);
      }
    });

    console.log('Starting CDP Tracing with devtools.timeline categories...');
    await client.send('Tracing.start', {
      categories: [
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
        'blink.user_timing',
        'v8.execute',
      ].join(','),
      options: 'sampling-frequency=10000',
    });

    // Perform 50 single-note pitch edits
    console.log('Performing 50 single-note pitch edits (ArrowUp / ArrowDown)...');
    const editRenderCounts = [];
    for (let i = 0; i < 50; i++) {
      await page.evaluate(() => {
        window.__startMutationBatch();
        window.__componentRenders = {};
      });
      const key = i % 2 === 0 ? 'ArrowUp' : 'ArrowDown';
      await page.keyboard.press(key);
      await sleep(100);
      const renders = await page.evaluate(() => {
        window.__endMutationBatch();
        return { ...(window.__componentRenders || {}) };
      });
      editRenderCounts.push(renders);
    }

    console.log('Stopping CDP Tracing and collecting events...');
    const tracingCompletePromise = new Promise((resolve) => client.once('Tracing.tracingComplete', resolve));
    await client.send('Tracing.end');
    await tracingCompletePromise;

    // Collect DOM mutation counts
    const mutationStats = await page.evaluate(() => window.__domMutationStats);
    await browser.close();

    // Save trace
    const outDir = path.resolve('docs/review/perf');
    fs.mkdirSync(outDir, { recursive: true });
    const tracePath = path.join(outDir, 'trace-200.json');

    // Filter relevant timeline events for reporting
    const timelineEvents = traceEvents.filter((e) =>
      e.cat && (e.cat.includes('devtools.timeline') || e.cat.includes('blink.user_timing') || e.cat.includes('v8'))
    );

    console.log(`Total collected trace events: ${traceEvents.length} (Timeline events: ${timelineEvents.length})`);

    // Analyze trace events
    // Event names:
    // Scripting: FunctionCall, EvaluateScript, v8.execute, HitTest
    // Style: UpdateLayoutTree, RecalculateStyles
    // Layout: Layout
    // Paint: Paint, PrePaint, PaintSetup
    // Raster/Composite: CompositeLayers, RasterTask, Rasterize
    let totalScriptingUs = 0;
    let totalStyleUs = 0;
    let totalLayoutUs = 0;
    let totalPaintUs = 0;
    let totalRasterUs = 0;

    for (const e of traceEvents) {
      const dur = e.dur || 0;
      if (!dur) continue;

      const name = e.name;
      if (name === 'FunctionCall' || name === 'EvaluateScript' || name === 'v8.execute' || name === 'HitTest' || name === 'EventDispatch') {
        totalScriptingUs += dur;
      } else if (name === 'UpdateLayoutTree' || name === 'RecalculateStyles') {
        totalStyleUs += dur;
      } else if (name === 'Layout') {
        totalLayoutUs += dur;
      } else if (name === 'Paint' || name === 'PrePaint' || name === 'PaintSetup') {
        totalPaintUs += dur;
      } else if (name === 'CompositeLayers' || name === 'RasterTask' || name === 'Rasterize' || name === 'Commit') {
        totalRasterUs += dur;
      }
    }

    // Per-edit averages (over 50 edits)
    const perEditScriptingMs = (totalScriptingUs / 1000) / 50;
    const perEditStyleMs = (totalStyleUs / 1000) / 50;
    const perEditLayoutMs = (totalLayoutUs / 1000) / 50;
    const perEditPaintMs = (totalPaintUs / 1000) / 50;
    const perEditRasterMs = (totalRasterUs / 1000) / 50;
    const perEditTotalMs = perEditScriptingMs + perEditStyleMs + perEditLayoutMs + perEditPaintMs + perEditRasterMs;

    // DOM mutation summary
    const avgAdded = mutationStats.reduce((acc, m) => acc + m.added, 0) / mutationStats.length;
    const avgRemoved = mutationStats.reduce((acc, m) => acc + m.removed, 0) / mutationStats.length;
    const avgAttrs = mutationStats.reduce((acc, m) => acc + m.attributes, 0) / mutationStats.length;
    const avgTotalMutations = mutationStats.reduce((acc, m) => acc + m.total, 0) / mutationStats.length;
    const uniqueTargets = Array.from(new Set(mutationStats.flatMap((m) => m.targets)));

    const avgRenders = {};
    for (const r of editRenderCounts) {
      for (const [comp, cnt] of Object.entries(r)) {
        avgRenders[comp] = (avgRenders[comp] || 0) + cnt;
      }
    }
    for (const comp of Object.keys(avgRenders)) {
      avgRenders[comp] = Number((avgRenders[comp] / editRenderCounts.length).toFixed(1));
    }

    const summary = {
      timestamp: new Date().toISOString(),
      scoreMeasures: 200,
      editCount: 50,
      cdpTrace: {
        totalEvents: traceEvents.length,
        perEditSplitMs: {
          scriptingJs: Number(perEditScriptingMs.toFixed(2)),
          styleRecalc: Number(perEditStyleMs.toFixed(2)),
          layout: Number(perEditLayoutMs.toFixed(2)),
          paint: Number(perEditPaintMs.toFixed(2)),
          rasterComposite: Number(perEditRasterMs.toFixed(2)),
          totalTraceMs: Number(perEditTotalMs.toFixed(2)),
        },
      },
      componentRendersPerEdit: {
        avgRendersPerEdit: avgRenders,
        sampleEdit0: editRenderCounts[0],
        sampleEdit1: editRenderCounts[1],
      },
      domMutationsPerEdit: {
        avgAdded: Number(avgAdded.toFixed(1)),
        avgRemoved: Number(avgRemoved.toFixed(1)),
        avgAttributes: Number(avgAttrs.toFixed(1)),
        avgTotalMutations: Number(avgTotalMutations.toFixed(1)),
        affectedSystemTargets: uniqueTargets,
        sampleEdit0: mutationStats[0],
        sampleEdit1: mutationStats[1],
      },
    };

    // Save summary and sampled trace
    fs.writeFileSync(path.join(outDir, 'profile-200-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
    // Save compressed/compact trace json
    fs.writeFileSync(tracePath, JSON.stringify({ traceEvents }, null, 0), 'utf8');
    console.log(`Trace saved to: ${tracePath} (${(fs.statSync(tracePath).size / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`Summary saved to: ${path.join(outDir, 'profile-200-summary.json')}`);

    console.log('\n======================================================');
    console.log('REAL CHROME TRACE PER-EDIT BREAKDOWN (200 Measures, n=50)');
    console.log('======================================================');
    console.log(`Scripting (JS):         ${perEditScriptingMs.toFixed(2)} ms`);
    console.log(`Style Recalculation:    ${perEditStyleMs.toFixed(2)} ms`);
    console.log(`Layout:                 ${perEditLayoutMs.toFixed(2)} ms`);
    console.log(`Paint:                  ${perEditPaintMs.toFixed(2)} ms`);
    console.log(`Raster / Composite:     ${perEditRasterMs.toFixed(2)} ms`);
    console.log(`Total Trace Time:       ${perEditTotalMs.toFixed(2)} ms`);
    console.log('------------------------------------------------------');
    console.log('React Component Renders per Edit:', JSON.stringify(avgRenders));
    console.log('------------------------------------------------------');
    console.log(`DOM Mutations per Edit: Added: ${avgAdded.toFixed(1)}, Removed: ${avgRemoved.toFixed(1)}, Attrs: ${avgAttrs.toFixed(1)}, Total: ${avgTotalMutations.toFixed(1)}`);
    console.log(`Affected System Targets in DOM: ${uniqueTargets.join(', ')}`);
    console.log('======================================================\n');
  } finally {
    killProcessTree(preview);
  }
}

runTraceAndProfile().catch((err) => {
  console.error('Trace error:', err);
  process.exit(1);
});
