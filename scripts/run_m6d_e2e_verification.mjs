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
        const subtitle = document.querySelector('[data-id="header-subtitle"]')?.textContent;
        const composer = document.querySelector('[data-id="header-composer"]')?.textContent;
        const repeatStarts = document.querySelectorAll('[data-id^="repeat-start-"]');
        const repeatEnds = document.querySelectorAll('[data-id^="repeat-end-"]');
        const voltas = document.querySelectorAll('[data-id^="volta-text-"]');
        const lyrics = document.querySelectorAll('[data-id^="lyric-text-"]');

        return {
          title,
          subtitle,
          composer,
          repeatStartCount: repeatStarts.length,
          repeatEndCount: repeatEnds.length,
          voltaCount: voltas.length,
          lyricCount: lyrics.length,
        };
      })()`);
      console.log('Reference score DOM inspection:', scoreDOM);
      assert(scoreDOM.title?.includes('Süt İçtim Dilim Yandı'), 'Title must be Süt İçtim Dilim Yandı');
      assert(scoreDOM.repeatStartCount >= 1, 'Must have at least 1 repeat start');
      assert(scoreDOM.repeatEndCount >= 1, 'Must have at least 1 repeat end');
      assert(scoreDOM.voltaCount >= 2, 'Must have volta 1 and volta 2');
      assert(scoreDOM.lyricCount >= 15, 'Must have lyrics on notes');

      await setZoom('1');
      screenshots.push(await captureFullScreenshot('01_sut_ictim_full_score.png'));

      console.log('\n--- 2. Repeats & Voltas Detail at 200% zoom ---');
      await setZoom('2');
      screenshots.push(await captureFullScreenshot('02_repeats_and_voltas_detail.png'));

      console.log('\n--- 3. Lyrics Mode ("Söz Girişi") KeyU & Floating Input ---');
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
      screenshots.push(await captureFullScreenshot('03_lyrics_mode_editing.png'));

      console.log('\n--- 4. "Hecele (Solfej)" Command Result ---');
      // Click "Hecele (Solfej)" toolbar button
      await evaluate(`(() => {
        const btn = document.querySelector('[data-testid="btn-auto-solfege"]');
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));

      const solfegeDOM = await evaluate(`(() => {
        const lyrics = Array.from(document.querySelectorAll('[data-id^="lyric-text-"]')).map(el => el.textContent);
        const hasSolfege = lyrics.some(t => ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'].includes(t || ''));
        return {
          totalLyrics: lyrics.length,
          hasSolfege,
          sampleSyllables: lyrics.slice(0, 6)
        };
      })()`);
      console.log('Auto-solfege DOM inspection:', solfegeDOM);
      assert(solfegeDOM.hasSolfege, 'Notes must be annotated with Turkish solfege syllables');
      screenshots.push(await captureFullScreenshot('04_auto_solfege_result.png'));

      console.log('\n--- 5. Keystroke-to-Paint Performance Benchmark (n >= 30, 64 measures) ---');
      const perfResults = await evaluate(`(async () => {
        // Build 64-measure score with repeats and lyrics
        const score = {
          id: 'perf-m6d-64',
          schemaVersion: 5,
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
            repeat: i === 4 ? 'start' : i === 8 ? 'end' : undefined,
          });
          score.parts[0].staves[0].measures[mId] = {
            voices: [{
              id: 'v1',
              events: [
                { id: 'ev-' + i + '-1', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'C', octave: 4, alter: 0 }], lyrics: 'Do' },
                { id: 'ev-' + i + '-2', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'D', octave: 4, alter: 0 }], lyrics: 'Re' },
                { id: 'ev-' + i + '-3', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'E', octave: 4, alter: 0 }], lyrics: 'Mi' },
                { id: 'ev-' + i + '-4', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'F', octave: 4, alter: 0 }], lyrics: 'Fa' },
              ]
            }]
          };
        }
        window.__resetScoreForTest(score);
        await new Promise(r => setTimeout(r, 500));

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
