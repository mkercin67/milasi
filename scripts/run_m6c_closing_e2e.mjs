// SPDX-License-Identifier: GPL-3.0-or-later
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';

const REPO_SHOTS_DIR = path.resolve('docs/screenshots/m6c');
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
  '--remote-debugging-port=9605',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1280,960',
  '--user-data-dir=C:\\Users\\Murat\\AppData\\Local\\Temp\\chrome_m6c_closing',
]);

await new Promise((r) => setTimeout(r, 1500));

http.get('http://127.0.0.1:9605/json/list', (res) => {
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
      await send('Page.navigate', { url: 'http://localhost:5173' });
      await new Promise((r) => setTimeout(r, 2000));

      const screenshots = [];

      // 1. HEADER AT 100% AND 200% WITH ALL 4 FIELDS FILLED AND LONG TITLE
      console.log('\n--- 1. Header with all 4 fields filled & long title ---');
      await evaluate(`(() => {
        const curScore = window.__getScoreForTest();
        const score = JSON.parse(JSON.stringify(curScore));
        score.meta = {
          title: 'Süt İçtim Dilim Yandı — Anadolu Ezgileri ve Türküleri Derlemesi',
          subtitle: 'Kilis / Güneydoğu Anadolu Yöresi',
          composer: 'Anonim (Kaynak Kişi: Abdurrahman Kızılay)',
          arranger: 'KYS Nota Kurulu',
        };
        window.__resetScoreForTest(score);
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      // Assert DOM counts before shot
      const hCount100 = await evaluate(`(() => {
        const titleNodes = document.querySelectorAll('[data-id^="header-title"]');
        const subNodes = document.querySelectorAll('[data-id="header-subtitle"]');
        const compNodes = document.querySelectorAll('[data-id="header-composer"]');
        const arrNodes = document.querySelectorAll('[data-id="header-arranger"]');
        return {
          titleCount: titleNodes.length,
          subtitleCount: subNodes.length,
          composerCount: compNodes.length,
          arrangerCount: arrNodes.length,
          totalHeaderNodes: titleNodes.length + subNodes.length + compNodes.length + arrNodes.length
        };
      })()`);
      console.log('DOM header node counts (100%):', hCount100);
      assert(hCount100.totalHeaderNodes >= 4, 'Must have at least 4 header elements');

      await setZoom('1');
      screenshots.push(await captureFullScreenshot('01_header_100.png'));

      await setZoom('2');
      screenshots.push(await captureFullScreenshot('01_header_200.png'));

      // 2. TEMPO MARKING AT MEASURE STARTING A SYSTEM
      console.log('\n--- 2. Tempo marking at measure starting a system ---');
      await evaluate(`(() => {
        const curScore = window.__getScoreForTest();
        const score = JSON.parse(JSON.stringify(curScore));
        // System 0 tempo marking
        score.measures[0].tempo = { bpm: 120, beatUnit: 1, text: 'Allegro moderato' };
        window.__resetScoreForTest(score);
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const tempoDOM = await evaluate(`(() => {
        const glyphs = document.querySelectorAll('[data-id^="tempo-glyph-"]');
        const texts = document.querySelectorAll('[data-id^="tempo-text-"]');
        const bpms = document.querySelectorAll('[data-id^="tempo-bpm-"]');
        return { glyphs: glyphs.length, texts: texts.length, bpms: bpms.length };
      })()`);
      console.log('DOM tempo counts:', tempoDOM);
      assert(tempoDOM.glyphs >= 1 && tempoDOM.bpms >= 1, 'Tempo glyph and BPM must exist');
      screenshots.push(await captureFullScreenshot('02_tempo_marking_200.png'));

      // 3. KEY CHANGE WITH NATURALS AT START OF A SYSTEM
      console.log('\n--- 3. Key change with naturals at START OF A SYSTEM ---');
      await evaluate(`(() => {
        const curScore = window.__getScoreForTest();
        const score = JSON.parse(JSON.stringify(curScore));
        // System 0 has 3 flats (measures 0..2)
        score.measures[0].keySig = -3;
        score.measures[1].keySig = -3;
        // System 1 starts at measure 2 or 3; let measure 3 change to 1 flat (-1) with cancellation naturals
        score.measures[2].keySig = -3;
        score.measures[3].keySig = -1;
        score.measures[4].keySig = -1;
        window.__resetScoreForTest(score);
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const keyAccDOM = await evaluate(`(() => {
        const accs = document.querySelectorAll('[data-id^="keychange-"]');
        const naturals = Array.from(accs).filter(a => a.getAttribute('href')?.includes('accidentalNatural'));
        const flats = Array.from(accs).filter(a => a.getAttribute('href')?.includes('accidentalFlat'));
        return { total: accs.length, naturals: naturals.length, flats: flats.length };
      })()`);
      console.log('DOM keychange cancellation counts:', keyAccDOM);
      assert(keyAccDOM.naturals >= 2, 'Key change cancellation must render naturals');
      screenshots.push(await captureFullScreenshot('03_keysig_cancellation_200.png'));

      // 4. PICKUP MEASURE + 6/8 BEAMING
      console.log('\n--- 4. Pickup measure + 6/8 beaming ---');
      await evaluate(`(() => {
        const curScore = window.__getScoreForTest();
        const score = JSON.parse(JSON.stringify(curScore));
        for (const m of score.measures) {
          m.timeSig = { num: 6, den: 8 };
        }
        score.measures[0].actualTicks = 1440; // 3 eighths pickup
        const m0Id = score.measures[0].id;
        score.parts[0].staves[0].measures[m0Id].voices[0].events = [
          { id: 'pk-1', kind: 'note', baseType: 'eighth', dots: 0, duration: 480, pitches: [{ step: 'A', octave: 4, alter: 0 }] },
          { id: 'pk-2', kind: 'note', baseType: 'eighth', dots: 0, duration: 480, pitches: [{ step: 'B', octave: 4, alter: 0 }] },
          { id: 'pk-3', kind: 'note', baseType: 'eighth', dots: 0, duration: 480, pitches: [{ step: 'C', octave: 5, alter: 0 }] },
        ];
        window.__resetScoreForTest(score);
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const pickupDOM = await evaluate(`(() => {
        const beams = document.querySelectorAll('path[data-id^="beam-"]');
        const pickupNotes = document.querySelectorAll('[data-id^="pk-"]');
        return { beamCount: beams.length, pickupNotes: pickupNotes.length };
      })()`);
      console.log('DOM pickup 6/8 counts:', pickupDOM);
      assert(pickupDOM.beamCount >= 1, '6/8 pickup notes must be beamed together');
      screenshots.push(await captureFullScreenshot('04_pickup_measure_200.png'));

      // 5. DOUBLE AND FINAL BARLINES
      console.log('\n--- 5. Double and Final Barlines ---');
      await evaluate(`(() => {
        const curScore = window.__getScoreForTest();
        const score = JSON.parse(JSON.stringify(curScore));
        score.measures[1].endBarline = 'double';
        score.measures[score.measures.length - 1].endBarline = 'final';
        window.__resetScoreForTest(score);
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const barlineDOM = await evaluate(`(() => {
        const lines = document.querySelectorAll('line[data-id*="barline"]');
        return { totalBarlines: lines.length };
      })()`);
      console.log('DOM barline counts:', barlineDOM);
      assert(barlineDOM.totalBarlines >= 4, 'Barlines must render in score');
      screenshots.push(await captureFullScreenshot('05_double_and_final_barlines_200.png'));

      // 6. TIME SIGNATURE CHANGE MID-SCORE
      console.log('\n--- 6. Time signature change mid-score ---');
      await evaluate(`(() => {
        const curScore = window.__getScoreForTest();
        const score = JSON.parse(JSON.stringify(curScore));
        score.measures[2].timeSig = { num: 3, den: 4 };
        score.measures[3].timeSig = { num: 3, den: 4 };
        window.__resetScoreForTest(score);
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const timeSigDOM = await evaluate(`(() => {
        const glyphs = document.querySelectorAll('[data-id^="timesig-"]');
        return { totalTimeSigGlyphs: glyphs.length };
      })()`);
      console.log('DOM mid-score timesig counts:', timeSigDOM);
      assert(timeSigDOM.totalTimeSigGlyphs >= 4, 'Time signature glyphs must render at start and mid-score');
      screenshots.push(await captureFullScreenshot('06_time_sig_change_mid_score_200.png'));

      // 7. PERFORMANCE BENCHMARK: KEYSTROKE-TO-PAINT ON 64-MEASURE SCORE
      console.log('\n--- 7. Performance benchmark: keydown-to-paint p95 (n >= 30, 64 measures) ---');
      const perfResults = await evaluate(`(async () => {
        // Build 64-measure score
        const score = {
          id: 'perf-64',
          schemaVersion: 4,
          meta: { title: 'Benchmark 64' },
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
            keySig: i % 4 === 0 ? 1 : 0
          });
          score.parts[0].staves[0].measures[mId] = {
            voices: [{
              id: 'v1',
              events: [
                { id: 'ev-' + i + '-1', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'C', octave: 4, alter: 0 }] },
                { id: 'ev-' + i + '-2', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'D', octave: 4, alter: 0 }] },
                { id: 'ev-' + i + '-3', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'E', octave: 4, alter: 0 }] },
                { id: 'ev-' + i + '-4', kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'F', octave: 4, alter: 0 }] },
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
          // Dispatch ArrowRight
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

      console.log('KeyDown-to-Paint Results on 64-Measure Score:');
      console.log(`n: ${perfResults.n}`);
      console.log(`Mean: ${perfResults.mean.toFixed(2)} ms`);
      console.log(`p50:  ${perfResults.p50.toFixed(2)} ms`);
      console.log(`p95:  ${perfResults.p95.toFixed(2)} ms`);
      console.log(`Min:  ${perfResults.min.toFixed(2)} ms`);
      console.log(`Max:  ${perfResults.max.toFixed(2)} ms`);

      console.log('\n--- VERIFICATION SUMMARY ---');
      for (const s of screenshots) {
        console.log(`  ${s.filename.padEnd(35)} : ${s.size} bytes (sha256: ${s.hash})`);
      }
      console.log('ALL SCREENSHOTS RETAKEN AT FULL 1280px WIDTH AND VERIFIED NON-EMPTY.');
      process.exit(0);
    } catch (e) {
      console.error('Error during execution:', e);
      process.exit(1);
    } finally {
      chrome.kill();
    }
  });
});
