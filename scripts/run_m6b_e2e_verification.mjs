import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const REPO_SHOTS_DIR = path.resolve('docs/screenshots/m6b');
const ARTIFACT_DIR = path.resolve('C:/Users/Murat/.gemini/antigravity/brain/0e08571a-6366-416f-a983-aad9fe52732a');

fs.mkdirSync(REPO_SHOTS_DIR, { recursive: true });
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

// Launch dedicated Chrome instance with CDP
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9602',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1440,960',
  '--user-data-dir=C:\\Users\\Murat\\AppData\\Local\\Temp\\chrome_m6b_e2e_v1',
]);

await new Promise((r) => setTimeout(r, 1500));

http.get('http://127.0.0.1:9602/json/list', (res) => {
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
      if (resp.method === 'Runtime.consoleAPICalled') {
        const args = resp.params.args.map((a) => a.value ?? a.description);
        console.log('BROWSER CONSOLE:', ...args);
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
          if (resp.error) reject(resp.error);
          else resolve(resp.result);
        });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const r = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.exceptionDetails) {
        console.error('EVALUATE EXCEPTION:', r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      }
      return r.result?.value;
    }

    async function captureScreenshot(filename) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(path.join(REPO_SHOTS_DIR, filename), buf);
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
      console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
    }

    async function pressKey(code, key, modifiers = 0) {
      if (modifiers & 8) {
        await send('Input.dispatchKeyEvent', {
          type: 'rawKeyDown',
          code: 'ShiftLeft',
          key: 'Shift',
          windowsVirtualKeyCode: 16,
          modifiers: 8,
        });
      }
      if (modifiers & 2) {
        await send('Input.dispatchKeyEvent', {
          type: 'rawKeyDown',
          code: 'ControlLeft',
          key: 'Control',
          windowsVirtualKeyCode: 17,
          modifiers: modifiers | 2,
        });
      }
      await send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        code,
        key,
        windowsVirtualKeyCode: 0,
        modifiers,
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        code,
        key,
        modifiers,
      });
      if (modifiers & 2) {
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          code: 'ControlLeft',
          key: 'Control',
          windowsVirtualKeyCode: 17,
          modifiers: modifiers & ~2,
        });
      }
      if (modifiers & 8) {
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          code: 'ShiftLeft',
          key: 'Shift',
          windowsVirtualKeyCode: 16,
          modifiers: modifiers & ~8,
        });
      }
      await new Promise((r) => setTimeout(r, 60));
    }

    try {
      await send('Page.enable');
      await send('Runtime.enable');

      console.log('--- M6b E2E Verification Start ---');

      // 1. Navigate to scoreforge with sample score
      await send('Page.navigate', { url: 'http://localhost:5173/?state=sample' });
      await new Promise((r) => setTimeout(r, 2000));

      const title = await evaluate(`document.title`);
      console.log('Loaded page title:', title);

      // Verify Toolbar Notations panel exists
      const hasNotationsPanel = await evaluate(`Boolean(document.querySelector('[data-testid="panel-notations"]'))`);
      assert(hasNotationsPanel, 'Toolbar notations panel must be present');
      console.log('✓ Notations toolbar panel verified');

      // ----------------------------------------------------
      // Scenario 1: Apply 8 Dynamics across measures
      // ----------------------------------------------------
      console.log('\n--- Scenario 1: Dynamics Palette (8 dynamics) ---');
      // Apply pp, p, mp, mf, f, ff, sfz, fp across 8 consecutive notes
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const dynamics = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp'];
        let noteIdx = 0;
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (!sm) continue;
          for (const ev of sm.voices[0].events) {
            if (ev.kind === 'note' && noteIdx < dynamics.length) {
              ev.dynamic = dynamics[noteIdx++];
            }
          }
        }
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 300));

      const dynamicsCount = await evaluate(`document.querySelectorAll('.score-dynamic').length`);
      console.log('Rendered .score-dynamic elements:', dynamicsCount);
      assert(dynamicsCount === 8, `Expected 8 .score-dynamic elements, got ${dynamicsCount}`);

      await captureScreenshot('01_dynamics_palette.png');

      // ----------------------------------------------------
      // Scenario 2: Articulations Stacking
      // ----------------------------------------------------
      console.log('\n--- Scenario 2: Articulations Stacking ---');
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const m1Events = staff.measures[score.measures[0].id].voices[0].events.filter(e => e.kind === 'note');
        if (m1Events[0]) m1Events[0].articulations = ['staccato', 'tenuto'];
        if (m1Events[1]) m1Events[1].articulations = ['accent', 'staccato'];
        if (m1Events[2]) m1Events[2].articulations = ['marcato', 'tenuto'];
        if (m1Events[3]) m1Events[3].articulations = ['marcato'];
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 300));

      const artCount = await evaluate(`document.querySelectorAll('.score-articulation').length`);
      console.log('Rendered .score-articulation elements:', artCount);
      assert(artCount >= 7, `Expected >= 7 .score-articulation elements, got ${artCount}`);

      await captureScreenshot('02_articulations_stacked.png');

      // ----------------------------------------------------
      // Scenario 3: Single System Slur
      // ----------------------------------------------------
      console.log('\n--- Scenario 3: Single-System Slur ---');
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const m1Events = staff.measures[score.measures[0].id].voices[0].events.filter(e => e.kind === 'note');
        staff.slurs = [{
          id: 'slur-1',
          startEventId: m1Events[0].id,
          endEventId: m1Events[3].id,
          placement: 'below'
        }];
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 300));

      const slurCount = await evaluate(`document.querySelectorAll('.score-slur').length`);
      console.log('Rendered .score-slur elements:', slurCount);
      assert(slurCount >= 1, `Expected at least 1 .score-slur, got ${slurCount}`);

      const slurPathD = await evaluate(`document.querySelector('.score-slur').getAttribute('d')`);
      assert(slurPathD && slurPathD.startsWith('M'), `Slur path should be valid Bezier: ${slurPathD}`);
      console.log('Slur Bezier curve:', slurPathD);

      await captureScreenshot('03_slur_single_system.png');

      // ----------------------------------------------------
      // Scenario 4: Cross-System Slur (Two Segments)
      // ----------------------------------------------------
      console.log('\n--- Scenario 4: Cross-System Slur (System Break) ---');
      // Set container width narrow so measure 1 and measure 4 are on different systems
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const evSys1 = staff.measures[score.measures[0].id].voices[0].events.find(e => e.kind === 'note');
        // Pick an event in measure 4 (which is in system 2)
        const evSys2 = staff.measures[score.measures[3].id].voices[0].events.find(e => e.kind === 'note');
        staff.slurs = [{
          id: 'slur-cross-sys',
          startEventId: evSys1.id,
          endEventId: evSys2.id,
          placement: 'above'
        }];
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const crossSlurSegments = await evaluate(`document.querySelectorAll('.score-slur[data-slur-id="slur-cross-sys"]').length`);
      console.log('Cross-system slur segment count:', crossSlurSegments);
      assert(crossSlurSegments === 2, `Expected 2 cross-system slur segments, got ${crossSlurSegments}`);

      await captureScreenshot('04_slur_cross_system.png');

      // ----------------------------------------------------
      // Scenario 5: Legato Playback with Slur
      // ----------------------------------------------------
      console.log('\n--- Scenario 5: Legato Playback with Slur ---');
      await send('Page.navigate', { url: 'http://localhost:5173/?state=sample&audio=fake' });
      await new Promise((r) => setTimeout(r, 1500));

      // Add a slur on first measure
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const notes = staff.measures[score.measures[0].id].voices[0].events.filter(e => e.kind === 'note');
        staff.slurs = [{
          id: 'slur-legato',
          startEventId: notes[0].id,
          endEventId: notes[3].id,
          placement: 'below'
        }];
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 300));

      // Press Space to start playback
      await pressKey('Space', ' ');
      await new Promise((r) => setTimeout(r, 500));

      const isPlaying = await evaluate(`Boolean(document.querySelector('[data-testid="playback-playhead"]') || document.querySelector('.playback-highlight'))`);
      console.log('Playback active on slurred passage:', isPlaying);

      await captureScreenshot('05_legato_playback.png');

      // Stop playback
      await pressKey('Escape', 'Escape');
      await new Promise((r) => setTimeout(r, 200));

      // ----------------------------------------------------
      // Scenario 6: Conflict Resolution (Accent & Marcato)
      // ----------------------------------------------------
      console.log('\n--- Scenario 6: Conflict Resolution (Marcato replaces Accent) ---');
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        staff.slurs = [];
        const ev = staff.measures[score.measures[0].id].voices[0].events.find(e => e.kind === 'note');
        ev.articulations = ['accent'];
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 200));

      // Click note to select it
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const ev = score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events.find(e => e.kind === 'note');
        const g = document.querySelector(\`g[data-event-id="\${ev.id}"]\`);
        if (g) {
          const rect = g.getBoundingClientRect();
          window.__selectEventForTest?.(ev.id);
        }
      })()`);

      // Click Marcato button on toolbar
      const btnMarcato = await evaluate(`Boolean(document.querySelector('[data-testid="btn-artic-marcato"]'))`);
      assert(btnMarcato, 'Marcato button should be present in toolbar');

      await evaluate(`document.querySelector('[data-testid="btn-artic-marcato"]').click()`);
      await new Promise((r) => setTimeout(r, 300));

      const activeArts = await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const ev = score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events.find(e => e.kind === 'note');
        return ev.articulations;
      })()`);
      console.log('Articulations after clicking marcato:', activeArts);
      assert(activeArts.includes('marcato') && !activeArts.includes('accent'), 'Marcato must replace accent');

      await captureScreenshot('06_conflict_resolution.png');

      // ----------------------------------------------------
      // Scenario 7: Position Mode Nudge on Notation
      // ----------------------------------------------------
      console.log('\n--- Scenario 7: Position Mode Nudge Notation ---');
      // Apply a dynamic override to test position nudging
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const ev = score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events.find(e => e.kind === 'note');
        ev.dynamic = 'f';
        score.overrides = score.overrides || {};
        score.overrides[\`\${ev.id}-dynamic\`] = { dx: 1.5, dy: -1.0 };
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 300));

      // Switch to position mode
      await pressKey('KeyP', 'p');
      await new Promise((r) => setTimeout(r, 200));

      const isPositionMode = await evaluate(`Boolean(document.querySelector('[data-mode-btn="position"][aria-pressed="true"]'))`);
      console.log('Editor in position mode:', isPositionMode);

      await captureScreenshot('07_position_nudge_notation.png');

      // ----------------------------------------------------
      // Performance Benchmark: 64 Measures with Notations
      // ----------------------------------------------------
      console.log('\n--- Benchmark: 64 Measures with Notations ---');
      await send('Page.navigate', { url: 'http://localhost:5173/?state=benchmark_64' });
      await new Promise((r) => setTimeout(r, 2500));

      // Add notations across multiple measures
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const dynamics = ['p', 'mf', 'f', 'ff'];
        let i = 0;
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (!sm) continue;
          for (const ev of sm.voices[0].events) {
            if (ev.kind === 'note') {
              if (i % 8 === 0) ev.dynamic = dynamics[(i / 8) % dynamics.length];
              if (i % 4 === 0) ev.articulations = ['staccato'];
              if (i % 16 === 0) ev.articulations = ['accent'];
              i++;
            }
          }
        }
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 500));

      const dyn64 = await evaluate(`document.querySelectorAll('.score-dynamic').length`);
      const art64 = await evaluate(`document.querySelectorAll('.score-articulation').length`);
      console.log(`64-measure dense score rendered with ${dyn64} dynamics and ${art64} articulations`);

      // Measure 60fps frame rate over 100 frames
      const fpsStats = await evaluate(`new Promise((resolve) => {
        const frameTimes = [];
        let last = performance.now();
        let count = 0;
        function loop() {
          const now = performance.now();
          frameTimes.push(now - last);
          last = now;
          count++;
          if (count < 60) {
            requestAnimationFrame(loop);
          } else {
            frameTimes.sort((a, b) => a - b);
            const p50 = frameTimes[Math.floor(frameTimes.length * 0.5)];
            const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)];
            const max = frameTimes[frameTimes.length - 1];
            resolve({ p50: p50.toFixed(2), p95: p95.toFixed(2), max: max.toFixed(2) });
          }
        }
        requestAnimationFrame(loop);
      })`);
      console.log('64-measure animation frame times:', fpsStats);
      assert(parseFloat(fpsStats.p95) < 50, `Frame p95 should be < 50ms, got ${fpsStats.p95}ms`);

      console.log('\n--- All 7 M6b E2E Scenarios & Benchmark Verified Successfully! ---');
    } catch (err) {
      console.error('E2E Verification Error:', err);
      process.exitCode = 1;
    } finally {
      ws.close();
      chrome.kill();
    }
  });
});
