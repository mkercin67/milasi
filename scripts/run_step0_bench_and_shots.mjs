import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';

const REPO_SHOTS_DIR = path.resolve('docs/screenshots/m4');
const ARTIFACT_DIR = path.resolve(
  'C:/Users/Murat/.gemini/antigravity/brain/0e08571a-6366-416f-a983-aad9fe52732a'
);

fs.mkdirSync(REPO_SHOTS_DIR, { recursive: true });
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9611',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1440,960',
  '--user-data-dir=C:\\Users\\Murat\\AppData\\Local\\Temp\\chrome_step0_bench_' + Date.now(),
]);

await new Promise((r) => setTimeout(r, 1500));

http.get('http://127.0.0.1:9611/json/list', (res) => {
  let raw = '';
  res.on('data', (d) => (raw += d));
  res.on('end', async () => {
    try {
      const list = JSON.parse(raw);
      const pageTarget = list.find((t) => t.type === 'page') ?? list[0];
      const ws = new globalThis.WebSocket(pageTarget.webSocketDebuggerUrl);
      await new Promise((resolve) => {
        ws.onopen = resolve;
      });

      let msgId = 1;
      const callbacks = new Map();
      ws.onmessage = (evt) => {
        const resp = JSON.parse(evt.data);
        if (resp.method === 'Page.javascriptDialogOpening') {
          send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
          return;
        }
        if (resp.id && callbacks.has(resp.id)) {
          const cb = callbacks.get(resp.id);
          callbacks.delete(resp.id);
          cb(resp);
        }
      };

      function send(method, params = {}) {
        return new Promise((resolve, reject) => {
          const id = msgId++;
          callbacks.set(id, (resp) => {
            if (resp.error) {
              reject(new Error(`${method} failed: ${JSON.stringify(resp.error)}`));
            } else {
              resolve(resp.result);
            }
          });
          ws.send(JSON.stringify({ id, method, params }));
        });
      }

      async function evaluate(expr) {
        const res = await send('Runtime.evaluate', {
          expression: expr,
          returnByValue: true,
          awaitPromise: true,
        });
        if (res.exceptionDetails) {
          throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
        }
        return res.result.value;
      }

      async function keyPress(code, key) {
        await send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          code,
          key,
          windowsVirtualKeyCode: 0,
        });
        await new Promise((r) => setTimeout(r, 40));
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          code,
          key,
        });
        await new Promise((r) => setTimeout(r, 60));
      }

      async function captureScreenshot(filename) {
        const res = await send('Page.captureScreenshot', { format: 'png' });
        const buf = Buffer.from(res.data, 'base64');
        const repoPath = path.join(REPO_SHOTS_DIR, filename);
        const artPath = path.join(ARTIFACT_DIR, filename);
        fs.writeFileSync(repoPath, buf);
        fs.writeFileSync(artPath, buf);
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        console.log(`Saved screenshot: ${filename} (${buf.length} bytes, SHA-256: ${hash.slice(0, 16)}...)`);
        return { buf, hash, repoPath, artPath };
      }

      await send('Page.enable');
      await send('Runtime.enable');

      // -------------------------------------------------------------
      // PART 1: FIX SCREENSHOT 01 VS 02 (Step 0d)
      // -------------------------------------------------------------
      console.log('\n=== STEP 0d: Fixing Screenshots 01 vs 02 ===');
      await send('Page.navigate', { url: 'http://localhost:4173/?audio=fake' });
      await new Promise((r) => setTimeout(r, 2000));

      // Enter a few notes so score is populated
      await keyPress('KeyN', 'n');
      for (const l of ['C', 'D', 'E', 'F', 'G']) {
        await keyPress(`Key${l}`, l.toLowerCase());
      }
      await keyPress('Escape', 'Escape');
      await keyPress('Escape', 'Escape');

      // CAPTURE 01 WHILE IDLE (Playback not started!)
      console.log('Capturing 01_toolbar_playback.png (IDLE state)...');
      const shot01 = await captureScreenshot('01_toolbar_playback.png');

      // Now start playback with Space
      console.log('Starting playback with Space...');
      await keyPress('Space', ' ');
      await new Promise((r) => setTimeout(r, 500));

      // CAPTURE 02 DURING PLAYBACK (Playhead + highlight active!)
      console.log('Capturing 02_playback_start_highlight.png (PLAYING state)...');
      const shot02 = await captureScreenshot('02_playback_start_highlight.png');

      console.log('\n--- Screenshot Hash Verification ---');
      console.log(`01_toolbar_playback.png:         SHA-256: ${shot01.hash}`);
      console.log(`02_playback_start_highlight.png: SHA-256: ${shot02.hash}`);
      assert(shot01.hash !== shot02.hash, 'Screenshots 01 and 02 must have DIFFERENT hashes!');
      console.log('CONFIRMED: Screenshots 01 and 02 are distinctly different!');

      // Stop playback
      await keyPress('Escape', 'Escape');
      await new Promise((r) => setTimeout(r, 300));

      // -------------------------------------------------------------
      // PART 2: 64-MEASURE BENCHMARK (Step 0c)
      // -------------------------------------------------------------
      console.log('\n=== STEP 0c: 64-Measure Benchmark (Sixteenths & Chords, 20s Playback) ===');
      await evaluate('window.onbeforeunload = null').catch(() => {});
      await send('Page.navigate', { url: 'http://localhost:4173/?audio=fake&state=benchmark_64' });
      await new Promise((r) => setTimeout(r, 2500));

      const measureCount = await evaluate('window.__getScoreForTest().measures.length');
      const totalEvents = await evaluate(`
        (() => {
          const s = window.__getScoreForTest();
          let count = 0;
          for (const m of Object.values(s.parts[0].staves[0].measures)) {
            for (const v of m.voices) {
              count += v.events.length;
            }
          }
          return count;
        })()
      `);
      console.log(`Benchmark Score: ${measureCount} measures, ${totalEvents} events (sixteenths + chords)`);
      assert(measureCount === 64, `Expected 64 measures, got ${measureCount}`);
      assert(totalEvents > 800, `Expected > 800 dense events, got ${totalEvents}`);

      // Start frame time measurement loop
      await evaluate(`
        window.__frameTimes = [];
        window.__longFrames = 0;
        let lastTime = performance.now();
        window.__benchLoop = true;
        function onFrame(now) {
          if (!window.__benchLoop) return;
          const dt = now - lastTime;
          lastTime = now;
          window.__frameTimes.push(dt);
          if (dt > 50) window.__longFrames++;
          requestAnimationFrame(onFrame);
        }
        requestAnimationFrame(onFrame);
      `);

      // Reset performance keystroke array
      await evaluate('window.__perf = []');

      // Start Playback with Space
      console.log('Starting playback of 64-measure dense score...');
      await keyPress('Space', ' ');
      await new Promise((r) => setTimeout(r, 500));

      const isPlaying = await evaluate('document.querySelector("[data-testid=\\"btn-play-pause\\"]")?.textContent');
      console.log(`Playback status: "${isPlaying}"`);

      console.log('Playing for 20 seconds while dispatching >= 30 keystrokes...');
      const startTime = Date.now();
      let keyCount = 0;

      // Dispatch 35 arrow navigation keystrokes WHILE playing
      for (let i = 0; i < 35; i++) {
        // Alternate ArrowRight and ArrowLeft navigation
        const key = i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft';
        await send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          code: key,
          key,
          windowsVirtualKeyCode: key === 'ArrowRight' ? 39 : 37,
        });
        await new Promise((r) => setTimeout(r, 30));
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          code: key,
          key,
        });
        keyCount++;
        // Space keystrokes across the 20 seconds
        await new Promise((r) => setTimeout(r, 450));
      }

      // Wait until full 20 seconds of playback have elapsed
      const elapsed = Date.now() - startTime;
      if (elapsed < 20000) {
        console.log(`Waiting remaining ${(20000 - elapsed) / 1000}s to reach full 20s...`);
        await new Promise((r) => setTimeout(r, 20000 - elapsed));
      }

      // Capture Screenshot 07 of dense score playing
      console.log('Capturing 07_dense_64_measure_playing.png...');
      await captureScreenshot('07_dense_64_measure_playing.png');

      // Stop frame loop and stop playback
      await evaluate('window.__benchLoop = false');
      await keyPress('Escape', 'Escape');
      await new Promise((r) => setTimeout(r, 200));

      // Collect performance metrics
      const perfResults = await evaluate(`
        (() => {
          const frames = window.__frameTimes.slice(10); // omit initial warm-up frames
          frames.sort((a, b) => a - b);
          const p50Frame = frames.length > 0 ? frames[Math.floor(frames.length * 0.50)] : 0;
          const p95Frame = frames.length > 0 ? frames[Math.floor(frames.length * 0.95)] : 0;
          const maxFrame = frames.length > 0 ? frames[frames.length - 1] : 0;

          const keySamples = window.__perf || [];
          const sortedKeys = [...keySamples].sort((a, b) => a - b);
          const p50Key = sortedKeys.length > 0 ? sortedKeys[Math.floor(sortedKeys.length * 0.50)] : 0;
          const p95Key = sortedKeys.length > 0 ? sortedKeys[Math.floor(sortedKeys.length * 0.95)] : 0;

          return {
            totalFrames: frames.length,
            longFrames: window.__longFrames,
            p50FrameTimeMs: Number(p50Frame.toFixed(2)),
            p95FrameTimeMs: Number(p95Frame.toFixed(2)),
            maxFrameTimeMs: Number(maxFrame.toFixed(2)),
            keystrokeCount: sortedKeys.length,
            keystrokeP50Ms: Number(p50Key.toFixed(2)),
            keystrokeP95Ms: Number(p95Key.toFixed(2)),
          };
        })()
      `);

      console.log('\n--- 64-MEASURE BENCHMARK PERFORMANCE RESULTS ---');
      console.log(`Total animation frames measured: ${perfResults.totalFrames}`);
      console.log(`Long frames (> 50 ms):           ${perfResults.longFrames}`);
      console.log(`Frame time p50:                  ${perfResults.p50FrameTimeMs} ms`);
      console.log(`Frame time p95:                  ${perfResults.p95FrameTimeMs} ms`);
      console.log(`Max frame time:                  ${perfResults.maxFrameTimeMs} ms`);
      console.log(`Keystroke-to-paint count:        ${perfResults.keystrokeCount} (dispatched ${keyCount})`);
      console.log(`Keystroke-to-paint p50:          ${perfResults.keystrokeP50Ms} ms`);
      console.log(`Keystroke-to-paint p95:          ${perfResults.keystrokeP95Ms} ms`);

      assert(perfResults.p95FrameTimeMs < 50, `p95 frame time must be < 50ms, got ${perfResults.p95FrameTimeMs}ms`);
      assert(perfResults.keystrokeCount >= 30, `Expected n >= 30 keystroke samples, got ${perfResults.keystrokeCount}`);
      console.log(`Assertion passed: Keystroke count ${perfResults.keystrokeCount} >= 30`);

      console.log('\n=== ALL STEP 0 BENCHMARK & SCREENSHOT CHECKS PASSED ===');
      process.exit(0);
    } catch (err) {
      console.error('\nSTEP 0 RUNNER ERROR:', err);
      process.exit(1);
    } finally {
      chrome.kill();
    }
  });
});
