import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = `C:\\Users\\Murat\\AppData\\Local\\Temp\\chrome_profile_paste_${Date.now()}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

async function run() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9602',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${userDataDir}`,
  ]);

  await sleep(1500);

  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9602/json/list', (res) => {
      let raw = '';
      res.on('data', (d) => (raw += d));
      res.on('end', async () => {
        try {
          const list = JSON.parse(raw);
          const target = list[0];
          const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);

          let msgId = 1;
          const pending = new Map();
          const send = (method, params = {}) => {
            const id = msgId++;
            return new Promise((resFn, rejFn) => {
              pending.set(id, { resFn, rejFn });
              ws.send(JSON.stringify({ id, method, params }));
            });
          };

          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.id && pending.has(data.id)) {
              const { resFn, rejFn } = pending.get(data.id);
              pending.delete(data.id);
              if (data.error) rejFn(data.error);
              else resFn(data.result);
            }
          };

          ws.onopen = async () => {
            await send('Page.enable');
            await send('Runtime.enable');
            await send('Page.navigate', { url: 'http://localhost:5173/?state=sample' });
            await sleep(2000);

            // Set up a 16-measure score where measures 1-8 have 32 quarter notes
            const setupResult = await send('Runtime.evaluate', {
              expression: `
                (() => {
                  const score = window.__buildSampleScore ? window.__buildSampleScore() : window.__getScoreForTest();
                  // Ensure at least 16 measures
                  return { measureCount: score.measures.length };
                })()
              `,
              returnByValue: true,
            });
            console.log('Initial score loaded:', setupResult.result?.value);

            // Execute 20 profiling runs of copying 8 measures (32 notes) and pasting into measure 1
            const profileScript = `
              (async () => {
                const results = [];
                // Find first 32 notes (8 measures of 4 quarter notes)
                for (let run = 0; run < 20; run++) {
                  // Ensure fresh score before each run
                  if (window.__resetScoreForTest && window.__buildSampleScore) {
                    window.__resetScoreForTest(window.__buildSampleScore());
                  }
                  await new Promise(r => setTimeout(r, 60));

                  const noteGroups = Array.from(document.querySelectorAll('svg g.score-event-group')).map(g => {
                    const rect = g.getBoundingClientRect();
                    return {
                      eventId: g.getAttribute('data-event-id'),
                      hasNotehead: Boolean(g.querySelector('use[href*="notehead"], path[id*="notehead"]')),
                      box: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
                    };
                  }).filter(g => g.hasNotehead);

                  // Select first note
                  const nFirst = noteGroups[0];
                  // Select 32nd note (or up to noteGroups.length - 1)
                  const nLast = noteGroups[Math.min(31, noteGroups.length - 1)];

                  // Click nFirst
                  nFirst && document.querySelector('svg g.score-event-group[data-event-id="' + nFirst.eventId + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                  await new Promise(r => setTimeout(r, 20));

                  // Shift-click nLast to form 8-measure range
                  nLast && document.querySelector('svg g.score-event-group[data-event-id="' + nLast.eventId + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
                  await new Promise(r => setTimeout(r, 20));

                  // Copy
                  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', key: 'c', ctrlKey: true, bubbles: true }));
                  await new Promise(r => setTimeout(r, 20));

                  // Measure paste
                  const t0 = performance.now();
                  window.__profilePasteSplit = {};
                  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', key: 'v', ctrlKey: true, bubbles: true }));

                  // Wait for React commit and browser frame paint
                  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                  const tTotal = performance.now() - t0;

                  results.push({
                    run,
                    totalMs: tTotal,
                  });
                }
                return results;
              })()
            `;

            const evalResult = await send('Runtime.evaluate', {
              expression: profileScript,
              returnByValue: true,
              awaitPromise: true,
            });

            console.log('\n--- 8-Measure Paste Profile Results (20 runs in Headless Chrome) ---');
            const data = evalResult.result?.value ?? [];
            const totals = data.map((d) => d.totalMs);

            console.log('Run times (ms):', totals.map((t) => t.toFixed(2)).join(', '));
            const p50 = percentile(totals, 50);
            const p95 = percentile(totals, 95);
            const mean = totals.reduce((a, b) => a + b, 0) / totals.length;

            console.log(`\nStatistics (n=20):`);
            console.log(`Mean: ${mean.toFixed(2)} ms`);
            console.log(`p50:  ${p50.toFixed(2)} ms`);
            console.log(`p95:  ${p95.toFixed(2)} ms`);

            ws.close();
            chrome.kill();
            resolve({ p50, p95, mean, data });
          };
        } catch (err) {
          chrome.kill();
          reject(err);
        }
      });
    });
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
