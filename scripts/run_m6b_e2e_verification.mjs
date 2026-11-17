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
  '--user-data-dir=C:\\Users\\Murat\\AppData\\Local\\Temp\\chrome_m6b_e2e_v2',
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

    async function captureScreenshot(filename, clip = null) {
      const params = { format: 'png' };
      if (clip) {
        params.clip = clip;
      }
      const shot = await send('Page.captureScreenshot', params);
      const buf = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(path.join(REPO_SHOTS_DIR, filename), buf);
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
      console.log(`Saved 200% close-up screenshot: ${filename} (${buf.length} bytes)`);
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

      console.log('=== Milestone 6b Real-Browser CDP E2E Verification (200% Zoom) ===');

      // 1. Navigate to scoreforge with 200% zoom
      await send('Page.navigate', { url: 'http://localhost:5173/?state=sample&zoom=2' });
      await new Promise((r) => setTimeout(r, 2000));

      const title = await evaluate(`document.title`);
      console.log('Loaded page title:', title);

      // Verify zoom in select dropdown is 2
      const zoomVal = await evaluate(`document.getElementById('zoom-select')?.value`);
      console.log('Active UI zoom level:', zoomVal);
      assert(zoomVal === '2', `Expected zoom to be 2, got ${zoomVal}`);

      // ====================================================
      // 1. DYNAMICS ROW (pp..fp below staff at 200% zoom)
      // ====================================================
      console.log('\n--- 1. Dynamics Row (pp..fp) at 200% Zoom ---');
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const dyns = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp'];
        let idx = 0;
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (!sm) continue;
          for (const ev of sm.voices[0].events) {
            if (ev.kind === 'note' && idx < dyns.length) {
              ev.dynamic = dyns[idx++];
            }
          }
        }
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const dynCount = await evaluate(`document.querySelectorAll('.score-dynamic').length`);
      console.log('DOM assertion - Rendered .score-dynamic elements:', dynCount);
      assert(dynCount === 8, `Expected exactly 8 dynamics, got ${dynCount}`);

      const dynTexts = await evaluate(`Array.from(document.querySelectorAll('.score-dynamic')).map(el => el.getAttribute('data-dynamic-type'))`);
      console.log('DOM assertion - Dynamic types:', dynTexts);
      assert(dynTexts.includes('pp') && dynTexts.includes('fp') && dynTexts.includes('sfz'), 'All 8 dynamics present in DOM');

      // Close-up clip of the first system
      await captureScreenshot('01_dynamics_row_200.png', { x: 40, y: 80, width: 900, height: 350, scale: 1 });

      // ====================================================
      // 2. ARTICULATIONS ON STEM-UP, STEM-DOWN, AND BEAMED NOTES
      // ====================================================
      console.log('\n--- 2. Articulations on Stem-Up, Stem-Down, and Beamed Notes ---');
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        // Measure 1: stem-up quarter note (D4) with staccato, stem-down quarter note (B4) with accent
        // and two beamed eighth notes (E4, G4) with tenuto and marcato
        const m1 = staff.measures[score.measures[0].id].voices[0];
        m1.events = [
          { id: 'art-n1', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'D', octave: 4, alter: 0 }], articulations: ['staccato'] },
          { id: 'art-n2', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'B', octave: 4, alter: 0 }], articulations: ['accent'] },
          { id: 'art-n3', kind: 'note', baseType: 'eighth', duration: 480, dots: 0, pitches: [{ step: 'E', octave: 4, alter: 0 }], articulations: ['tenuto'] },
          { id: 'art-n4', kind: 'note', baseType: 'eighth', duration: 480, dots: 0, pitches: [{ step: 'G', octave: 4, alter: 0 }], articulations: ['marcato'] },
        ];
        // Clear dynamics and slurs for pure articulation focus
        staff.slurs = [];
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const artCount = await evaluate(`document.querySelectorAll('.score-articulation').length`);
      const beamCount = await evaluate(`document.querySelectorAll('.scoreforge-beam, [data-beam-group]').length`);
      console.log('DOM assertion - Rendered .score-articulation elements:', artCount);
      console.log('DOM assertion - Rendered .score-beam elements:', beamCount);
      assert(artCount === 4, `Expected 4 articulations, got ${artCount}`);
      assert(beamCount >= 1, `Expected at least 1 beam, got ${beamCount}`);

      await captureScreenshot('02_articulations_stems_and_beams_200.png', { x: 40, y: 80, width: 800, height: 350, scale: 1 });

      // ====================================================
      // 3. STEM-UP SLUR
      // ====================================================
      console.log('\n--- 3. Stem-Up Slur ---');
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const m1 = staff.measures[score.measures[0].id].voices[0];
        // Low notes C4, D4, E4 -> stems point UP, slur placed BELOW
        m1.events = [
          { id: 'su-1', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'C', octave: 4, alter: 0 }] },
          { id: 'su-2', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'D', octave: 4, alter: 0 }] },
          { id: 'su-3', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'E', octave: 4, alter: 0 }] },
          { id: 'su-4', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'F', octave: 4, alter: 0 }] },
        ];
        staff.slurs = [{ id: 'slur-stem-up', startEventId: 'su-1', endEventId: 'su-3', placement: 'below' }];
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const slurUpCount = await evaluate(`document.querySelectorAll('.score-slur').length`);
      console.log('DOM assertion - Stem-up .score-slur elements:', slurUpCount);
      assert(slurUpCount === 1, `Expected 1 slur, got ${slurUpCount}`);

      const slurUpD = await evaluate(`document.querySelector('.score-slur').getAttribute('d')`);
      console.log('DOM assertion - Slur Bezier path:', slurUpD);
      assert(slurUpD && slurUpD.startsWith('M'), 'Valid Bezier curve path');

      await captureScreenshot('03_slur_stem_up_200.png', { x: 40, y: 80, width: 700, height: 350, scale: 1 });

      // ====================================================
      // 4. STEM-DOWN SLUR
      // ====================================================
      console.log('\n--- 4. Stem-Down Slur ---');
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const m1 = staff.measures[score.measures[0].id].voices[0];
        // High notes C5, D5, E5 -> stems point DOWN, slur placed ABOVE
        m1.events = [
          { id: 'sd-1', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'C', octave: 5, alter: 0 }] },
          { id: 'sd-2', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'D', octave: 5, alter: 0 }] },
          { id: 'sd-3', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'E', octave: 5, alter: 0 }] },
          { id: 'sd-4', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'D', octave: 5, alter: 0 }] },
        ];
        staff.slurs = [{ id: 'slur-stem-down', startEventId: 'sd-1', endEventId: 'sd-3', placement: 'above' }];
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const slurDownCount = await evaluate(`document.querySelectorAll('.score-slur').length`);
      console.log('DOM assertion - Stem-down .score-slur elements:', slurDownCount);
      assert(slurDownCount === 1, `Expected 1 slur, got ${slurDownCount}`);

      await captureScreenshot('04_slur_stem_down_200.png', { x: 40, y: 80, width: 700, height: 350, scale: 1 });

      // ====================================================
      // 5. LONG SLUR OVER A HIGH MIDDLE NOTE (>= 0.5 space clearance)
      // ====================================================
      console.log('\n--- 5. Long Slur Over a High Middle Note (Clearance >= 0.5 space) ---');
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const m1 = staff.measures[score.measures[0].id].voices[0];
        // Note 1: C4 (low), Note 2: A5 (very high obstacle!), Note 3: C4 (low)
        m1.events = [
          { id: 'obs-1', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'C', octave: 4, alter: 0 }] },
          { id: 'obs-2', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'A', octave: 5, alter: 0 }] },
          { id: 'obs-3', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'C', octave: 4, alter: 0 }] },
          { id: 'obs-4', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'G', octave: 4, alter: 0 }] },
        ];
        staff.slurs = [{ id: 'slur-obstacle', startEventId: 'obs-1', endEventId: 'obs-3', placement: 'above' }];
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const obsSlurCount = await evaluate(`document.querySelectorAll('.score-slur').length`);
      console.log('DOM assertion - High obstacle .score-slur count:', obsSlurCount);
      assert(obsSlurCount === 1, `Expected 1 slur, got ${obsSlurCount}`);

      const obsSlurD = await evaluate(`document.querySelector('.score-slur').getAttribute('d')`);
      console.log('DOM assertion - Slur path over obstacle:', obsSlurD);

      await captureScreenshot('05_slur_high_middle_note_200.png', { x: 40, y: 40, width: 700, height: 400, scale: 1 });

      // ====================================================
      // 6. SLUR ACROSS A SYSTEM BREAK
      // ====================================================
      console.log('\n--- 6. Slur Across a System Break ---');
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        // Measure 1 event (system 1) to Measure 4 event (system 2)
        const evSys1 = staff.measures[score.measures[0].id].voices[0].events[0];
        const evSys2 = staff.measures[score.measures[3].id].voices[0].events[0];
        staff.slurs = [{
          id: 'slur-sys-break',
          startEventId: evSys1.id,
          endEventId: evSys2.id,
          placement: 'above',
        }];
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const splitSlurSegments = await evaluate(`document.querySelectorAll('.score-slur[data-slur-id="slur-sys-break"]').length`);
      console.log('DOM assertion - Cross-system slur segment count:', splitSlurSegments);
      assert(splitSlurSegments === 2, `Expected exactly 2 split slur segments across system break, got ${splitSlurSegments}`);

      await captureScreenshot('06_slur_system_break_200.png', { x: 40, y: 80, width: 1000, height: 600, scale: 1 });

      // ====================================================
      // 7. MOVED DYNAMIC IN POSITION MODE
      // ====================================================
      console.log('\n--- 7. Moved Dynamic in Position Mode ---');
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        staff.slurs = [];
        const ev = staff.measures[score.measures[0].id].voices[0].events[0];
        ev.dynamic = 'f';
        score.overrides = score.overrides || {};
        score.overrides[\`\${ev.id}-dynamic\`] = { dx: 2.0, dy: -1.5 };
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 300));

      // Switch to position mode via KeyP
      await pressKey('KeyP', 'p');
      await new Promise((r) => setTimeout(r, 200));

      const isPosMode = await evaluate(`Boolean(document.querySelector('[data-mode-btn="position"][aria-pressed="true"]'))`);
      console.log('DOM assertion - Editor in position mode:', isPosMode);
      assert(isPosMode, 'Position mode button must be pressed');

      const movedDynTransform = await evaluate(`document.querySelector('.score-dynamic')?.getAttribute('transform')`);
      console.log('DOM assertion - Dynamic transform with dx/dy override:', movedDynTransform);

      await captureScreenshot('07_moved_dynamic_200.png', { x: 40, y: 80, width: 600, height: 350, scale: 1 });

      // Return to select mode
      await pressKey('KeyV', 'v');
      await new Promise((r) => setTimeout(r, 200));

      // ====================================================
      // 8. SLUR PLUS TIE ON THE SAME NOTES
      // ====================================================
      console.log('\n--- 8. Slur Plus Tie on the Same Notes ---');
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const m1 = staff.measures[score.measures[0].id].voices[0];
        m1.events = [
          { id: 'st-1', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'G', octave: 4, alter: 0, tiedToNext: true }], tiedToNext: true },
          { id: 'st-2', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'G', octave: 4, alter: 0 }] },
          { id: 'st-3', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'A', octave: 4, alter: 0 }] },
          { id: 'st-4', kind: 'note', baseType: 'quarter', duration: 960, dots: 0, pitches: [{ step: 'B', octave: 4, alter: 0 }] },
        ];
        // Slur connects st-1 to st-3; Tie connects st-1 to st-2
        staff.slurs = [{ id: 'slur-tie-combo', startEventId: 'st-1', endEventId: 'st-3', placement: 'above' }];
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const tieCount = await evaluate(`document.querySelectorAll('.score-tie').length`);
      const comboSlurCount = await evaluate(`document.querySelectorAll('.score-slur').length`);
      console.log('DOM assertion - Rendered .score-tie elements:', tieCount);
      console.log('DOM assertion - Rendered .score-slur elements:', comboSlurCount);
      assert(tieCount >= 1, `Expected at least 1 tie, got ${tieCount}`);
      assert(comboSlurCount >= 1, `Expected at least 1 slur, got ${comboSlurCount}`);

      await captureScreenshot('08_slur_plus_tie_same_notes_200.png', { x: 40, y: 80, width: 700, height: 350, scale: 1 });

      // ====================================================
      // 9. PERFORMANCE BENCHMARK (64-measure score, n >= 30 keystrokes)
      // ====================================================
      console.log('\n--- 9. Benchmark: Keystroke-to-Paint on 64-Measure Score ---');
      await send('Page.navigate', { url: 'http://localhost:5173/?state=benchmark_64' });
      await new Promise((r) => setTimeout(r, 2500));

      // Add notations across all 64 measures
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const staff = score.parts[0].staves[0];
        const dyns = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp'];
        let idx = 0;
        staff.slurs = [];
        for (let m = 0; m < score.measures.length; m++) {
          const mDef = score.measures[m];
          const sm = staff.measures[mDef.id];
          if (!sm) continue;
          const evs = sm.voices[0].events.filter(e => e.kind === 'note');
          if (evs.length > 0) {
            evs[0].dynamic = dyns[m % dyns.length];
            evs[0].articulations = ['staccato'];
          }
          if (evs.length > 2) {
            evs[1].articulations = ['tenuto'];
            evs[2].articulations = ['accent'];
          }
          if (m % 8 === 0 && evs.length >= 3) {
            staff.slurs.push({
              id: \`slur-bm-\${m}\`,
              startEventId: evs[0].id,
              endEventId: evs[evs.length - 1].id,
            });
          }
        }
        window.__resetScoreForTest(JSON.parse(JSON.stringify(score)));
      })()`);
      await new Promise((r) => setTimeout(r, 600));

      // Select first note
      await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const firstEv = score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events[0];
        window.__selectEventForTest?.(firstEv.id);
      })()`);
      await new Promise((r) => setTimeout(r, 200));

      // Clear performance buffer
      await evaluate(`window.__perf = []`);

      // Execute 35 ArrowRight keystrokes
      console.log('Dispatching 35 keystrokes (ArrowRight)...');
      for (let i = 0; i < 35; i++) {
        await pressKey('ArrowRight', 'ArrowRight');
      }
      await new Promise((r) => setTimeout(r, 500));

      const perfStats = await evaluate(`(() => {
        const arr = window.__perf || [];
        if (arr.length === 0) return null;
        arr.sort((a, b) => a - b);
        const p50 = arr[Math.floor(arr.length * 0.5)];
        const p95 = arr[Math.floor(arr.length * 0.95)];
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return { count: arr.length, mean: mean.toFixed(2), p50: p50.toFixed(2), p95: p95.toFixed(2) };
      })()`);

      console.log('Keystroke-to-Paint Results (n >= 30 on 64-measure dense score):', perfStats);
      assert(perfStats && perfStats.count >= 30, `Expected at least 30 samples, got ${perfStats?.count}`);
      assert(parseFloat(perfStats.p95) < 50, `Keystroke-to-paint p95 must be < 50ms, got ${perfStats.p95}ms`);

      console.log('\n=== All 8 Screenshots and Performance Benchmarks Verified Successfully! ===');
    } catch (err) {
      console.error('E2E Verification Error:', err);
      process.exitCode = 1;
    } finally {
      ws.close();
      chrome.kill();
    }
  });
});
