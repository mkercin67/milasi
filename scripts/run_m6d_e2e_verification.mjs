import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';

const REPO_SHOTS_DIR = path.resolve('docs/screenshots/m6d');
const ARTIFACT_DIR = path.resolve('C:/Users/Murat/.gemini/antigravity/brain/0e08571a-6366-416f-a983-aad9fe52732a');

fs.mkdirSync(REPO_SHOTS_DIR, { recursive: true });
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

// Launch dedicated Chrome instance with CDP at 1280x960
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9606',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1280,960',
  '--user-data-dir=C:\\Users\\Murat\\AppData\\Local\\Temp\\chrome_m6d_e2e',
]);

await new Promise((r) => setTimeout(r, 1500));

http.get('http://127.0.0.1:9606/json/list', (res) => {
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
        console.log('BROWSER CONSOLE:', ...resp.params.args.map(a => a.value ?? a.description));
      }
      if (resp.method === 'Runtime.exceptionThrown') {
        console.log('BROWSER EXCEPTION:', resp.params.exceptionDetails);
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
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res?.result?.value;
    }

    async function captureFullScreenshot(filename) {
      const shot = await send('Page.captureScreenshot', {
        format: 'png',
      });
      const buf = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(path.join(REPO_SHOTS_DIR, filename), buf);
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
      const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
      console.log(`[SCREENSHOT] ${filename} | ${buf.length} bytes | sha256: ${hash}`);
      assert(buf.length > 10000, `Screenshot ${filename} must be > 10KB to ensure non-empty`);
      return { filename, size: buf.length, hash };
    }

    async function setZoom(zoomVal) {
      await evaluate(`(() => {
        for (const sel of document.querySelectorAll('select')) {
          if (Array.from(sel.options).some(o => o.value === '${zoomVal}')) {
            sel.value = '${zoomVal}';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      })()`);
      await new Promise((r) => setTimeout(r, 400));
    }

    try {
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Page.navigate', { url: 'http://localhost:5173?state=sut_ictim' });
      await new Promise((r) => setTimeout(r, 2000));

      const screenshots = [];

      console.log('\n--- 1. Reference Score "Süt İçtim Dilim Yandı" (Full Score) ---');
      const scoreDOM = await evaluate(`(() => {
        const title = document.querySelector('[data-id^="header-title"]')?.textContent;
        const composer = document.querySelector('[data-id="header-composer"]')?.textContent;
        const repeatBarlines = document.querySelectorAll('[data-id*="repeat"]');
        const lyrics = document.querySelectorAll('[data-id^="lyric-text-"]');

        return {
          title,
          composer,
          repeatCount: repeatBarlines.length,
          lyricCount: lyrics.length,
        };
      })()`);
      console.log('Reference score DOM inspection:', scoreDOM);
      assert(scoreDOM.title?.includes('Süt İçtim Dilim Yandı'), 'Title must be Süt İçtim Dilim Yandı');
      assert(scoreDOM.composer?.includes('Müzik Notlarım'), 'Composer must be Müzik Notlarım');
      assert(scoreDOM.repeatCount >= 2, 'Must have repeat barlines rendered');
      assert(scoreDOM.lyricCount >= 20, 'Must have solfege lyrics on notes');

      await setZoom('1');
      screenshots.push(await captureFullScreenshot('01_sut_ictim_full_score_100.png'));

      console.log('\n--- 2. Repeats Detail at 200% zoom (Combined :|: barline between m4-m5 and end repeat m8) ---');
      await setZoom('2');
      screenshots.push(await captureFullScreenshot('02_sut_ictim_repeats_detail_200.png'));

      console.log('\n--- 3. Two Voltas Score (1st and 2nd endings) ---');
      await evaluate(`(() => {
        const score = {
          id: 'score-voltas-demo',
          schemaVersion: 6,
          meta: { title: 'Volta Örneği', composer: 'ScoreForge' },
          measures: [
            { id: 'vm-0', timeSig: { num: 4, den: 4 }, keySig: 0, repeatStart: true },
            { id: 'vm-1', timeSig: { num: 4, den: 4 }, keySig: 0, volta: { number: 1 }, repeatEnd: true },
            { id: 'vm-2', timeSig: { num: 4, den: 4 }, keySig: 0, volta: { number: 2 } },
            { id: 'vm-3', timeSig: { num: 4, den: 4 }, keySig: 0, endBarline: 'final' }
          ],
          parts: [{
            id: 'vp-1',
            name: 'Piyano',
            staves: [{
              id: 'vs-1',
              clef: { sign: 'G', line: 2 },
              measures: {
                'vm-0': { voices: [{ id: 'vv-0', events: [{ id: 've-0', kind: 'note', baseType: 'whole', dots: 0, duration: 3840, pitches: [{ step: 'C', octave: 4, alter: 0 }] }] }] },
                'vm-1': { voices: [{ id: 'vv-1', events: [{ id: 've-1', kind: 'note', baseType: 'whole', dots: 0, duration: 3840, pitches: [{ step: 'D', octave: 4, alter: 0 }] }] }] },
                'vm-2': { voices: [{ id: 'vv-2', events: [{ id: 've-2', kind: 'note', baseType: 'whole', dots: 0, duration: 3840, pitches: [{ step: 'E', octave: 4, alter: 0 }] }] }] },
                'vm-3': { voices: [{ id: 'vv-3', events: [{ id: 've-3', kind: 'note', baseType: 'whole', dots: 0, duration: 3840, pitches: [{ step: 'F', octave: 4, alter: 0 }] }] }] }
              }
            }]
          }],
          overrides: {}
        };
        window.__resetScoreForTest(score);
      })()`);
      await new Promise((r) => setTimeout(r, 600));

      const voltasDOM = await evaluate(`(() => {
        const voltas = document.querySelectorAll('[data-id^="volta-text-"]');
        return { count: voltas.length };
      })()`);
      console.log('Voltas DOM inspection:', voltasDOM);
      assert(voltasDOM.count >= 2, 'Must render volta 1 and volta 2 text labels');
      screenshots.push(await captureFullScreenshot('03_two_voltas_example_200.png'));

      console.log('\n--- 4. Lyrics Mode ("Söz Girişi") KeyU & Floating Input ---');
      // Press KeyU to switch to Lyrics Mode
      await evaluate(`(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', code: 'KeyU', bubbles: true }));
      })()`);
      await new Promise((r) => setTimeout(r, 500));

      const lyricsModeDOM = await evaluate(`(() => {
        const overlay = document.querySelector('[data-testid="lyrics-editor-overlay"]');
        const input = document.querySelector('[data-testid="input-lyrics-editor"]');
        return {
          overlayVisible: Boolean(overlay),
          inputFound: Boolean(input),
          inputValue: input ? input.value : null,
          mode: window.__getEditorStateForTest ? window.__getEditorStateForTest().mode : null
        };
      })()`);
      console.log('Lyrics mode DOM inspection:', lyricsModeDOM);
      assert(lyricsModeDOM.overlayVisible, 'Lyrics editor overlay must be visible in lyrics mode');
      assert(lyricsModeDOM.inputFound, 'Lyrics input element must be mounted');
      screenshots.push(await captureFullScreenshot('04_lyrics_mode_editing_1280.png'));

      console.log('\n--- 5. Reset to Reference Score and Capture Auto-Solfege Syllables ---');
      await send('Page.navigate', { url: 'http://localhost:5173?state=sut_ictim' });
      await new Promise((r) => setTimeout(r, 1500));
      await setZoom('1.5');
      screenshots.push(await captureFullScreenshot('05_auto_solfege_result_1280.png'));

      console.log('\n--- 5. Keystroke-to-Paint Performance Benchmark (n >= 30, 64 measures) ---');
      const perfResults = await evaluate(`(async () => {
        // Build 64-measure score with repeats and lyrics
        const score = {
          id: 'perf-m6d-64',
          schemaVersion: 6,
          meta: { title: 'Benchmark M6d' },
          measures: [],
          parts: [{
            id: 'p1',
            name: 'Violin',
            staves: [{
              id: 's1',
              clef: { sign: 'G', line: 2 },
              measures: {}
            }]
          }],
          overrides: {}
        };
        for (let i = 0; i < 64; i++) {
          const mId = 'm-' + i;
          score.measures.push({
            id: mId,
            timeSig: { num: 4, den: 4 },
            keySig: i % 4 === 0 ? 1 : 0,
            repeatStart: i === 4 ? true : undefined,
            repeatEnd: i === 8 ? true : undefined,
          });
          score.parts[0].staves[0].measures[mId] = {
            voices: [{
              id: 'v1',
              events: [
                { id: 'ev-' + i + '-1', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'C', octave: 4, alter: 0 }], lyrics: [{ verse: 1, text: 'Do' }] },
                { id: 'ev-' + i + '-2', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'D', octave: 4, alter: 0 }], lyrics: [{ verse: 1, text: 'Re' }] },
                { id: 'ev-' + i + '-3', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'E', octave: 4, alter: 0 }], lyrics: [{ verse: 1, text: 'Mi' }] },
                { id: 'ev-' + i + '-4', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'F', octave: 4, alter: 0 }], lyrics: [{ verse: 1, text: 'Fa' }] },
              ]
            }]
          };
        }
        window.__resetScoreForTest(score);
        await new Promise(r => setTimeout(r, 500));

        // Warmup 5 keystrokes to let JIT optimize
        for (let i = 0; i < 5; i++) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }));
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        }

        // Measure keystroke-to-paint latency across 40 keystrokes
        const latencies = [];
        for (let i = 0; i < 40; i++) {
          const t0 = performance.now();
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }));
          await new Promise(r => requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              latencies.push(performance.now() - t0);
              r();
            });
          }));
        }

        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.50)];
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;

        return { n: latencies.length, mean, p50, p95, min: latencies[0], max: latencies[latencies.length - 1] };
      })()`);

      console.log('KeyDown-to-Paint Results on 64-Measure Dense Score (M6d):');
      console.log(`n: ${perfResults.n}`);
      console.log(`Mean: ${perfResults.mean.toFixed(2)} ms`);
      console.log(`p50:  ${perfResults.p50.toFixed(2)} ms`);
      console.log(`p95:  ${perfResults.p95.toFixed(2)} ms`);
      console.log(`Min:  ${perfResults.min.toFixed(2)} ms`);
      console.log(`Max:  ${perfResults.max.toFixed(2)} ms`);
      assert(perfResults.p95 < 50, `p95 latency (${perfResults.p95.toFixed(2)} ms) must be < 50 ms`);

      console.log('\n--- MILESTONE 6d VERIFICATION SUMMARY ---');
      for (const s of screenshots) {
        console.log(`  ${s.filename.padEnd(35)} : ${s.size} bytes (sha256: ${s.hash})`);
      }
      console.log('ALL MILESTONE 6d E2E AND PERFORMANCE CHECKS PASSED SUCCESSFULLY!');
      process.exit(0);
    } catch (e) {
      console.error('E2E FAILURE:', e);
      process.exit(1);
    } finally {
      chrome.kill();
    }
  });
});
