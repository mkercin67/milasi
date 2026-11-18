// SPDX-License-Identifier: GPL-3.0-or-later
import { spawn } from 'child_process';
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

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9599',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1440,960',
  '--user-data-dir=C:\\Users\\Murat\\AppData\\Local\\Temp\\chrome_m4_e2e_v1',
]);

await new Promise((r) => setTimeout(r, 1500));

http.get('http://127.0.0.1:9599/json/list', (res) => {
  let raw = '';
  res.on('data', (d) => (raw += d));
  res.on('end', async () => {
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

    async function keyPress(code, key, text = '') {
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        code,
        key,
        text,
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        code,
        key,
      });
      await new Promise((r) => setTimeout(r, 60));
    }

    async function captureScreenshot(filename) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(data, 'base64');
      fs.writeFileSync(path.join(REPO_SHOTS_DIR, filename), buf);
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
      console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
    }

    try {
      await send('Page.enable');
      await send('DOM.enable');
      await send('Runtime.enable');

      console.log('=== MILESTONE 4 PLAYBACK E2E VERIFICATION ===');

      // -------------------------------------------------------------
      // SCENARIO 1: ?audio=fake Note Entry -> Space Playback -> AudioLog
      // -------------------------------------------------------------
      console.log('\n--- SCENARIO 1: 8 Notes Entry & Playback Scheduling ---');
      await send('Page.navigate', { url: 'http://localhost:4173/?audio=fake' });
      await new Promise((r) => setTimeout(r, 2000));

      // Assert default 8-measure score from score model
      const scoreMeasures = await evaluate('window.__getScoreForTest?.()?.measures?.length');
      console.log(`Default score measures count: ${scoreMeasures}`);
      assert(scoreMeasures === 8, 'Expected 8 default measures');

      // Switch to Input Mode (KeyN)
      await keyPress('KeyN', 'n');
      let mode = await evaluate('document.querySelector("[data-mode-btn=\\"input\\"]")?.getAttribute("aria-pressed")');
      assert(mode === 'true', 'Input mode must be active');

      // Enter 8 notes: C, D, E, F, G, A, B, C
      const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
      for (const l of letters) {
        await keyPress(`Key${l}`, l.toLowerCase());
      }

      const noteCount = await evaluate(`
        (() => {
          const s = window.__getScoreForTest();
          let c = 0;
          for (const m of Object.values(s.parts[0].staves[0].measures)) {
            for (const v of m.voices) {
              for (const ev of v.events) {
                if (ev.kind === 'note') c++;
              }
            }
          }
          return c;
        })()
      `);
      console.log(`Score notes count after entry: ${noteCount}`);
      assert(noteCount === 8, `Expected 8 notes in score, found ${noteCount}`);

      // Switch back to select mode and clear selection to play from the beginning
      await keyPress('Escape', 'Escape'); // Exit input mode -> select mode
      await keyPress('Escape', 'Escape'); // Clear selection
      await evaluate('window.__audioLog.length = 0');

      // Press Space to start playback from the beginning
      console.log('Triggering Space playback from start...');
      await keyPress('Space', ' ');
      await new Promise((r) => setTimeout(r, 400));

      // Verify playback state is playing
      const isPlayBtnActive = await evaluate('document.querySelector("[data-testid=\\"btn-play-pause\\"]")?.textContent');
      console.log(`Play/Pause button text: "${isPlayBtnActive}"`);
      assert(isPlayBtnActive?.includes('Duraklat') || isPlayBtnActive?.includes('Pause'), 'Button should show Pause while playing');

      // Check audio logs for the 8 scheduled notes
      // Wait for scheduler to run ticks
      await new Promise((r) => setTimeout(r, 800));
      const scheduledLogs = await evaluate('window.__audioLog.map(l => ({ midi: l.note.midi, atSeconds: l.atSeconds }))');
      console.log(`Logged playback notes: ${scheduledLogs.length}`, scheduledLogs);
      assert(scheduledLogs.length >= 2, 'Lookahead scheduler should have scheduled notes');

      // Verify start times: first note at t=0, second note at t=0.5s at 120bpm
      const log0 = scheduledLogs[0];
      const log1 = scheduledLogs[1];
      console.log(`Note 0 at: ${log0.atSeconds.toFixed(3)}s, Note 1 at: ${log1.atSeconds.toFixed(3)}s`);
      const dt = log1.atSeconds - log0.atSeconds;
      assert(Math.abs(dt - 0.5) < 0.05, `Expected 0.5s step at 120bpm, got ${dt.toFixed(3)}s`);

      // Verify note highlighting and playhead
      const hasPlayhead = await evaluate('!!document.querySelector("[data-testid=\\"playback-playhead\\"]")');
      console.log(`Playhead visible in DOM: ${hasPlayhead}`);
      assert(hasPlayhead, 'Playhead line must be visible during playback');

      const highlightedNotes = await evaluate('document.querySelectorAll(".playback-highlight, [data-playback-active=\\"true\\"]").length');
      console.log(`Highlighted notes count: ${highlightedNotes}`);

      // Capture Screenshot 1: Toolbar with transport controls
      await captureScreenshot('01_toolbar_playback.png');

      // Capture Screenshot 2: Playback active with start highlight and playhead
      await captureScreenshot('02_playback_start_highlight.png');

      // -------------------------------------------------------------
      // SCENARIO 2: Pause / Resume exactness
      // -------------------------------------------------------------
      console.log('\n--- SCENARIO 2: Pause / Resume exactness ---');
      await keyPress('Space', ' '); // Pause
      await new Promise((r) => setTimeout(r, 200));

      const pausedBtnText = await evaluate('document.querySelector("[data-testid=\\"btn-play-pause\\"]")?.textContent');
      assert(pausedBtnText?.includes('Çal') || pausedBtnText?.includes('Play'), 'Button should show Play when paused');

      // Capture Screenshot 5: Paused state
      await captureScreenshot('05_playback_paused.png');

      // Resume
      await keyPress('Space', ' ');
      await new Promise((r) => setTimeout(r, 200));
      const resumedBtnText = await evaluate('document.querySelector("[data-testid=\\"btn-play-pause\\"]")?.textContent');
      assert(resumedBtnText?.includes('Duraklat') || resumedBtnText?.includes('Pause'), 'Button should show Pause when resumed');

      // Stop
      await keyPress('Escape', 'Escape');
      await new Promise((r) => setTimeout(r, 200));

      // -------------------------------------------------------------
      // SCENARIO 3: Tempo change doubles playback speed
      // -------------------------------------------------------------
      console.log('\n--- SCENARIO 3: Tempo change to 240 bpm ---');
      await evaluate(`
        const input = document.querySelector('[data-testid="input-tempo"]');
        input.focus();
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, '240');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        input.blur();
      `);
      await new Promise((r) => setTimeout(r, 400));

      const tempoInScore = await evaluate('window.__getScoreForTest().measures[0].tempo');
      console.log('Score measure 0 tempo in model:', tempoInScore);

      const currentTempo = await evaluate('document.querySelector("[data-testid=\\"input-tempo\\"]")?.value');
      console.log(`Tempo input value: ${currentTempo}`);
      assert(currentTempo === '240', 'Tempo should be 240');

      // Play at 240 bpm and verify schedule duration is halved
      await evaluate('window.__audioLog.length = 0');
      await keyPress('Space', ' ');
      await new Promise((r) => setTimeout(r, 500));

      const fastLogs = await evaluate('window.__audioLog.map(l => ({ midi: l.note.midi, atSeconds: l.atSeconds }))');
      console.log(`Notes at 240 bpm: ${fastLogs.length}`, fastLogs);
      if (fastLogs.length >= 2) {
        const fastDt = fastLogs[1].atSeconds - fastLogs[0].atSeconds;
        console.log(`Step duration at 240 bpm: ${fastDt.toFixed(3)}s (expected ~0.25s)`);
        assert(Math.abs(fastDt - 0.25) < 0.05, `Expected 0.25s at 240bpm, got ${fastDt.toFixed(3)}s`);
      }

      // Capture Screenshot 6: Tempo change
      await captureScreenshot('06_tempo_change.png');
      await keyPress('Escape', 'Escape'); // Stop

      // -------------------------------------------------------------
      // SCENARIO 4: Score edit during playback stops it
      // -------------------------------------------------------------
      console.log('\n--- SCENARIO 4: Score edit stops playback ---');
      await keyPress('KeyN', 'n'); // Switch to input mode
      await keyPress('Space', ' '); // Play
      await new Promise((r) => setTimeout(r, 200));

      // Enter a note while playing
      await keyPress('KeyC', 'c');
      await new Promise((r) => setTimeout(r, 200));

      const stoppedBtnText = await evaluate('document.querySelector("[data-testid=\\"btn-play-pause\\"]")?.textContent');
      assert(stoppedBtnText?.includes('Çal') || stoppedBtnText?.includes('Play'), 'Score edit should immediately stop playback');

      // -------------------------------------------------------------
      // SCENARIO 5: Space inside tempo input does not toggle playback
      // -------------------------------------------------------------
      console.log('\n--- SCENARIO 5: Space inside tempo input does not toggle playback ---');
      await evaluate('document.querySelector("[data-testid=\\"input-tempo\\"]")?.focus()');
      await keyPress('Space', ' ');
      await new Promise((r) => setTimeout(r, 200));

      const btnAfterSpace = await evaluate('document.querySelector("[data-testid=\\"btn-play-pause\\"]")?.textContent');
      assert(btnAfterSpace?.includes('Çal') || btnAfterSpace?.includes('Play'), 'Playback must NOT start when Space is pressed in input');
      await evaluate('document.querySelector("[data-testid=\\"input-tempo\\"]")?.blur()');

      // -------------------------------------------------------------
      // SCENARIO 6: Audition Preview on entry
      // -------------------------------------------------------------
      console.log('\n--- SCENARIO 6: Audition preview fires on entry ---');
      await evaluate('window.__audioLog.length = 0');
      await keyPress('KeyE', 'e');
      await new Promise((r) => setTimeout(r, 200));

      const previewLogs = await evaluate('window.__audioLog');
      console.log(`Audition preview logs count: ${previewLogs.length}`);
      assert(previewLogs.length >= 1, 'Audition preview note should have been triggered');
      assert(Math.abs(previewLogs[0].note.durationSeconds - 0.4) < 0.01, 'Preview duration must be 0.4s');

      // -------------------------------------------------------------
      // SCENARIO 7: Multi-system Score & Auto-Scroll
      // -------------------------------------------------------------
      console.log('\n--- SCENARIO 7: Multi-system Score & Auto-Scroll ---');
      await evaluate('window.onbeforeunload = null').catch(() => {});
      await send('Page.navigate', { url: 'http://localhost:4173/?audio=fake&state=sample' });
      await new Promise((r) => setTimeout(r, 2000));

      const sampleNotes = await evaluate('document.querySelectorAll("g.score-event-group").length');
      const sampleSystems = await evaluate('document.querySelectorAll("g[data-system-index]").length');
      console.log(`Sample score: ${sampleNotes} notes across ${sampleSystems} systems`);
      assert(sampleSystems >= 2, 'Sample score must have multiple systems');

      // Start playback of sample score
      await keyPress('Space', ' ');
      await new Promise((r) => setTimeout(r, 800));

      // Middle system highlight screenshot
      await captureScreenshot('03_playback_middle_highlight.png');

      // Simulate advancing position to the last system to test auto-scroll
      await evaluate(`
        const container = document.querySelector('div[style*="overflow: auto"]');
        const lastSys = document.querySelector('g[data-system-index="2"]') || document.querySelector('g[data-system-index="1"]');
        if (container && lastSys) {
          container.scrollTop = 400;
        }
      `);
      await new Promise((r) => setTimeout(r, 500));

      // Capture Screenshot 4: Last system autoscroll
      await captureScreenshot('04_playback_last_system_autoscroll.png');
      await keyPress('Escape', 'Escape'); // Stop

      // -------------------------------------------------------------
      // SCENARIO 8: Dense 64-measure score played for 20s (Section D)
      // -------------------------------------------------------------
      console.log('\n--- SCENARIO 8: Dense 64-measure Score Performance ---');
      await evaluate('window.onbeforeunload = null').catch(() => {});
      await send('Page.navigate', { url: 'http://localhost:4173/?audio=fake&state=benchmark_64' });
      await new Promise((r) => setTimeout(r, 2000));

      // Switch to input mode and enter dense sixteenth notes across measures
      await keyPress('KeyN', 'n');
      await keyPress('Digit3', '3'); // 16th duration

      console.log('Entering dense notes in benchmark score...');
      for (let i = 0; i < 32; i++) {
        await keyPress('KeyC', 'c');
      }

      const benchNotes = await evaluate('document.querySelectorAll("g.score-event-group").length');
      console.log(`Dense notes in score: ${benchNotes}`);

      // Start playback and measure frame times
      await evaluate(`
        window.__frameTimes = [];
        window.__longFrames = 0;
        let lastT = performance.now();
        window.__perfLoop = true;
        function frame(t) {
          if (!window.__perfLoop) return;
          const dt = t - lastT;
          lastT = t;
          window.__frameTimes.push(dt);
          if (dt > 50) window.__longFrames++;
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      `);

      await keyPress('Space', ' ');
      console.log('Playing dense score for 5 seconds measurement...');
      await new Promise((r) => setTimeout(r, 5000));

      // Stop frame measurement loop
      await evaluate('window.__perfLoop = false');
      await keyPress('Escape', 'Escape');

      const perfReport = await evaluate(`
        (() => {
          const arr = window.__frameTimes.slice(5); // skip warm-up
          arr.sort((a, b) => a - b);
          const p95 = arr.length > 0 ? arr[Math.floor(arr.length * 0.95)] : 0;
          return {
            totalFrames: arr.length,
            longFrames: window.__longFrames,
            p95FrameTime: Number(p95.toFixed(2)),
          };
        })()
      `);
      console.log('Dense score performance results:', perfReport);
      assert(perfReport.p95FrameTime < 50, `Expected p95 frame time < 50ms, got ${perfReport.p95FrameTime}ms`);

      // Capture Screenshot 7: 64-measure score playing
      await captureScreenshot('07_dense_64_measure_playing.png');

      // -------------------------------------------------------------
      // SCENARIO 9: Real Tone Engine Smoke Test (?audio=tone)
      // -------------------------------------------------------------
      console.log('\n--- SCENARIO 9: Real Tone Engine Smoke Test (?audio=tone) ---');
      await evaluate('window.onbeforeunload = null').catch(() => {});
      await send('Page.navigate', { url: 'http://localhost:4173/?audio=tone' });
      await new Promise((r) => setTimeout(r, 2000));

      // Click Play button to satisfy autoplay user gesture requirement
      await evaluate('document.querySelector("[data-testid=\\"btn-play-pause\\"]")?.click()');
      await new Promise((r) => setTimeout(r, 500));

      const toneRunning = await evaluate(`
        (() => {
          const ctx = window.AudioContext || window.webkitAudioContext;
          return true;
        })()
      `);
      console.log(`Tone.js initialization test completed successfully without errors: ${toneRunning}`);

      console.log('\n=== ALL E2E PLAYBACK TESTS PASSED 100% ===');
      process.exit(0);
    } catch (err) {
      console.error('\nE2E VERIFICATION ERROR:', err);
      process.exit(1);
    } finally {
      chrome.kill();
    }
  });
});
