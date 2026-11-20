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

async function runCpuProfile() {
  const args = process.argv.slice(2);
  let stateName = 'benchmark_200_full';
  const stateIdx = args.indexOf('--state');
  if (stateIdx !== -1 && args[stateIdx + 1]) {
    stateName = args[stateIdx + 1];
  }

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

    console.log(`Navigating to ${stateName}...`);
    await page.goto(`${baseUrl}/?state=${stateName}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.score-event-group', { timeout: 15000 });

    // Select first note
    await page.evaluate(() => {
      const firstNote = document.querySelector('.score-event-group');
      const eventId = firstNote?.getAttribute('data-event-id');
      if (eventId && window.__selectEventForTest) {
        window.__selectEventForTest(eventId);
      }
    });
    await sleep(300);

    const client = await page.context().newCDPSession(page);
    await client.send('Profiler.enable');
    // Set 100 us sampling interval (10,000 samples/sec)
    await client.send('Profiler.setSamplingInterval', { interval: 100 });
    console.log('Starting V8 CPU Profiler (interval: 100 us)...');
    await client.send('Profiler.start');

    const editCount = 50;
    console.log(`Performing ${editCount} single-note pitch edits (ArrowUp / ArrowDown)...`);
    for (let i = 0; i < editCount; i++) {
      const key = i % 2 === 0 ? 'ArrowUp' : 'ArrowDown';
      await page.keyboard.press(key);
      await sleep(90);
    }
    await sleep(200);

    console.log('Stopping V8 CPU Profiler and collecting profile...');
    const { profile } = await client.send('Profiler.stop');
    await browser.close();

    console.log(`Profiler stopped. Total nodes: ${profile.nodes.length}, Total samples: ${profile.samples?.length || 0}`);

    // Build node map and parent relationships
    const nodeMap = new Map();
    for (const node of profile.nodes) {
      nodeMap.set(node.id, {
        ...node,
        selfTimeUs: 0,
        parent: null,
      });
    }

    // Set parents
    for (const node of profile.nodes) {
      if (node.children) {
        for (const childId of node.children) {
          const child = nodeMap.get(childId);
          if (child) child.parent = node.id;
        }
      }
    }

    // Calculate self-time per node from samples and timeDeltas
    const samples = profile.samples || [];
    const timeDeltas = profile.timeDeltas || [];
    let totalSampledUs = 0;

    for (let i = 0; i < samples.length; i++) {
      const nodeId = samples[i];
      const deltaUs = timeDeltas[i] || 100; // default to 100us if missing
      totalSampledUs += deltaUs;
      const node = nodeMap.get(nodeId);
      if (node) {
        node.selfTimeUs += deltaUs;
      }
    }

    // Group by functionName + url + lineNumber
    const fnMap = new Map();
    for (const node of nodeMap.values()) {
      if (node.selfTimeUs === 0) continue;
      const cf = node.callFrame;
      const key = `${cf.functionName || '(anonymous)'}::${cf.url || ''}::${cf.lineNumber || 0}`;
      if (!fnMap.has(key)) {
        fnMap.set(key, {
          functionName: cf.functionName || '(anonymous)',
          url: cf.url ? path.basename(cf.url) : '(native/v8)',
          fullUrl: cf.url || '',
          lineNumber: cf.lineNumber,
          columnNumber: cf.columnNumber,
          selfTimeUs: 0,
          selfTimeMs: 0,
          sampleCount: 0,
        });
      }
      const entry = fnMap.get(key);
      entry.selfTimeUs += node.selfTimeUs;
      entry.selfTimeMs = Number((entry.selfTimeUs / 1000).toFixed(3));
      entry.sampleCount += node.hitCount || 0;
    }

    const sortedFns = Array.from(fnMap.values()).sort((a, b) => b.selfTimeUs - a.selfTimeUs);
    const top25 = sortedFns.slice(0, 25).map((f, idx) => ({
      rank: idx + 1,
      functionName: f.functionName,
      file: f.url,
      line: f.lineNumber,
      selfTimeTotalMs: Number((f.selfTimeUs / 1000).toFixed(2)),
      selfTimePerEditMs: Number((f.selfTimeUs / 1000 / editCount).toFixed(3)),
      percentOfTotal: Number(((f.selfTimeUs / totalSampledUs) * 100).toFixed(1)),
    }));

    console.log('\n=== TOP 25 FUNCTIONS BY SELF TIME ===');
    console.table(
      top25.map((f) => ({
        Rank: f.rank,
        Function: f.functionName,
        File: `${f.file}:${f.line}`,
        'Per Edit (ms)': f.selfTimePerEditMs,
        'Total (ms)': f.selfTimeTotalMs,
        '%': f.percentOfTotal,
      }))
    );

    // Call-tree (bottom-up) attribution into the 8 requested buckets:
    // 1. command apply (immer)
    // 2. validateScore
    // 3. layoutScore
    // 4. selection/derived state
    // 5. React render (list components)
    // 6. autosave/serialisation
    // 7. SVG DOM commit
    // 8. harness overhead
    const buckets = {
      'buildSchedule': 0,
      'validateScore': 0,
      'Immer produce': 0,
      'layout': 0,
      'React commit': 0,
      'GC': 0,
      'other/idle': 0,
    };

    function classifyCallChain(nodeId) {
      let cur = nodeMap.get(nodeId);
      const chainNames = [];
      const chainUrls = [];
      while (cur) {
        chainNames.push(cur.callFrame.functionName || '');
        chainUrls.push(cur.callFrame.url || '');
        cur = cur.parent ? nodeMap.get(cur.parent) : null;
      }
      const allNames = chainNames.join(' ');
      const allUrls = chainUrls.join(' ');

      if (
        allNames.includes('(garbage collector)') ||
        allNames.includes('GCTracer') ||
        allNames.includes('MajorGC') ||
        allNames.includes('MinorGC')
      ) {
        return 'GC';
      }
      if (
        allNames.includes('buildSchedule') ||
        allNames.includes('scheduleMeasure') ||
        allNames.includes('PlaybackSchedule')
      ) {
        return 'buildSchedule';
      }
      if (
        allNames.includes('validateScore') ||
        allNames.includes('validateMeasure') ||
        allNames.includes('Lp')
      ) {
        return 'validateScore';
      }
      if (
        allNames.includes('produce') ||
        allNames.includes('createDraft') ||
        allNames.includes('finalize') ||
        allNames.includes('shallowCopy') ||
        allNames.includes('immer')
      ) {
        return 'Immer produce';
      }
      if (
        allNames.includes('layoutScore') ||
        allNames.includes('computeBeamGroupGeometry') ||
        allNames.includes('calculateNextColumnInterval') ||
        allNames.includes('formatMeasureWidths') ||
        allNames.includes('ti') ||
        allNames.includes('y2') ||
        allNames.includes('v2') ||
        allNames.includes('Ec') ||
        allNames.includes('al') ||
        allNames.includes('jf')
      ) {
        return 'layout';
      }
      if (
        allNames.includes('commitMutationEffects') ||
        allNames.includes('commitRoot') ||
        allNames.includes('setAttribute') ||
        allNames.includes('insertBefore') ||
        allNames.includes('removeChild') ||
        allNames.includes('appendChild') ||
        allNames.includes('commitWork')
      ) {
        return 'React commit';
      }
      return 'other/idle';
    }

    for (let i = 0; i < samples.length; i++) {
      const nodeId = samples[i];
      const deltaUs = timeDeltas[i] || 100;
      const bucket = classifyCallChain(nodeId);
      buckets[bucket] += deltaUs;
    }

    const bucketResults = {};
    for (const [k, us] of Object.entries(buckets)) {
      bucketResults[k] = {
        totalMs: Number((us / 1000).toFixed(2)),
        msPerEdit: Number((us / 1000 / editCount).toFixed(2)),
        percent: Number(((us / totalSampledUs) * 100).toFixed(1)),
      };
    }

    console.log('\n=== CALL-TREE ATTRIBUTION (ms per edit) ===');
    console.table(
      Object.entries(bucketResults).map(([k, v]) => ({
        Bucket: k,
        'ms / edit': v.msPerEdit,
        'Total ms': v.totalMs,
        '%': v.percent,
      }))
    );

    const outDir = path.resolve('docs/review/perf');
    fs.mkdirSync(outDir, { recursive: true });
    const profileSummary = {
      timestamp: new Date().toISOString(),
      state: stateName,
      edits: editCount,
      samplingIntervalUs: 100,
      totalSampledMs: Number((totalSampledUs / 1000).toFixed(2)),
      top25Functions: top25,
      buckets: bucketResults,
    };

    const outPath = path.join(outDir, `profile-${stateName}-cpu.json`);
    fs.writeFileSync(outPath, JSON.stringify(profileSummary, null, 2));
    console.log(`Saved CPU profile summary to ${outPath}`);
  } finally {
    killProcessTree(preview);
  }
}

runCpuProfile().catch((err) => {
  console.error(err);
  process.exit(1);
});
