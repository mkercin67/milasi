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

// Launch dedicated Chrome instance with CDP
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9604',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1440,960',
  '--user-data-dir=C:\\Users\\Murat\\AppData\\Local\\Temp\\chrome_m6c_e2e_v2',
]);

await new Promise((r) => setTimeout(r, 1500));

http.get('http://127.0.0.1:9604/json/list', (res) => {
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

    async function clipScreenshot(selector, filename, padding = 15) {
      const clip = await evaluate(`(() => {
        const el = document.querySelector('${selector}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: Math.max(0, rect.x - ${padding}),
          y: Math.max(0, rect.y - ${padding}),
          width: Math.min(1440, rect.width + ${padding * 2}),
          height: Math.min(960, rect.height + ${padding * 2}),
          scale: 1
        };
      })()`);
      assert(clip, `Element ${selector} must exist to screenshot`);
      const shot = await send('Page.captureScreenshot', { format: 'png', clip });
      const buf = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(path.join(REPO_SHOTS_DIR, filename), buf);
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
      const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
      console.log(`Saved screenshot: ${filename} (${buf.length} bytes, sha256: ${hash})`);
      return hash;
    }

    try {
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Page.navigate', { url: 'http://localhost:5173' });
      await new Promise((r) => setTimeout(r, 2000));

      console.log('--- Verifying Milestone 6c Features in Live App ---');

      // Set zoom to 200% via UI selector
      await evaluate(`(() => {
        for (const sel of document.querySelectorAll('select')) {
          if (Array.from(sel.options).some(o => o.value === '2')) {
            sel.value = '2';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      })()`);
      await new Promise((r) => setTimeout(r, 400));

      const screenshotHashes = new Set();

      // 1. HEADER (Title, Subtitle, Composer, Arranger) via Score Info Dialog
      console.log('1. Setting and verifying Header via dialog...');
      const dialogCheck = await evaluate(`(() => {
        const btn = document.querySelector('[data-testid="btn-score-info"]');
        if (btn) btn.click();
        return { btnFound: Boolean(btn) };
      })()`);
      console.log('Open button check:', dialogCheck);
      await new Promise((r) => setTimeout(r, 500));

      const inputCheck = await evaluate(`(() => {
        const tInput = document.querySelector('[data-testid="input-score-title"]');
        const stInput = document.querySelector('[data-testid="input-score-subtitle"]');
        const cInput = document.querySelector('[data-testid="input-score-composer"]');
        const aInput = document.querySelector('[data-testid="input-score-arranger"]');
        const saveBtn = document.querySelector('[data-testid="btn-save-score-info"]');

        const found = {
          tInput: Boolean(tInput),
          saveBtn: Boolean(saveBtn),
          currentScoreMeta: window.__getScoreForTest()?.meta
        };

        const setVal = (el, val) => {
          const proto = Object.getPrototypeOf(el);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        if (tInput) setVal(tInput, 'Yıldızların Altında');
        if (stInput) setVal(stInput, 'Nihavend Şarkı');
        if (cInput) setVal(cInput, 'Kaptanzade Ali Rıza Bey');
        if (aInput) setVal(aInput, 'Ömer Bedrettin Uşaklı');

        if (saveBtn) saveBtn.click();
        return found;
      })()`);
      console.log('Inputs found check:', inputCheck);
      await new Promise((r) => setTimeout(r, 500));

      const headerTexts = await evaluate(`(() => {
        return {
          title: document.querySelector('[data-id="header-title"]')?.textContent,
          subtitle: document.querySelector('[data-id="header-subtitle"]')?.textContent,
          composer: document.querySelector('[data-id="header-composer"]')?.textContent,
          arranger: document.querySelector('[data-id="header-arranger"]')?.textContent,
        };
      })()`);
      console.log('Header text nodes:', headerTexts);
      assert(headerTexts.title === 'Yıldızların Altında', 'Header title must be rendered');
      assert(headerTexts.subtitle === 'Nihavend Şarkı', 'Header subtitle must be rendered');
      assert(headerTexts.composer === 'Kaptanzade Ali Rıza Bey', 'Header composer must be rendered');
      assert(headerTexts.arranger === 'Ömer Bedrettin Uşaklı', 'Header arranger must be rendered');

      const h1 = await clipScreenshot('[data-id="header-title"]', '01_header_200.png', 40);
      screenshotHashes.add(h1);

      // 2. TEMPO DISPLAY (SMuFL Note Glyph + Allegro vivace + = 120) via Tempo Dialog
      console.log('2. Setting and verifying Tempo Marking via dialog...');
      await evaluate(`(() => {
        const btn = document.querySelector('[data-testid="btn-tempo"]');
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));

      await evaluate(`(() => {
        const bpmInput = document.querySelector('input[type="number"]');
        const textInput = document.getElementById('tempo-prefix-input');

        const setVal = (el, val) => {
          if (!el) return;
          const proto = Object.getPrototypeOf(el);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        if (bpmInput) setVal(bpmInput, '120');
        if (textInput) setVal(textInput, 'Allegro vivace');

        const applyBtn = document.querySelector('[data-testid="btn-apply-tempo"]');
        if (applyBtn) applyBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));

      const tempoElements = await evaluate(`(() => {
        return {
          text: document.querySelector('[data-id^="tempo-text-"]')?.textContent,
          glyph: document.querySelector('[data-id^="tempo-glyph-"]')?.getAttribute('href'),
          bpm: document.querySelector('[data-id^="tempo-bpm-"]')?.textContent,
        };
      })()`);
      console.log('Tempo elements:', tempoElements);
      assert(tempoElements.text === 'Allegro vivace', 'Tempo text prefix must render');
      assert(tempoElements.glyph?.includes('metNoteQuarterUp'), 'Tempo beat note glyph must render');
      assert(tempoElements.bpm?.includes('120'), 'Tempo BPM text must render');

      const h2 = await clipScreenshot('[data-id^="tempo-text-"]', '02_tempo_marking_200.png', 30);
      screenshotHashes.add(h2);

      // 3. KEY SIGNATURE CHANGE MID-SCORE WITH CANCELLATION NATURALS
      console.log('3. Setting and verifying Key Signature Change & Cancellation Naturals...');
      await evaluate(`(() => {
        const curScore = window.__getScoreForTest();
        const score = JSON.parse(JSON.stringify(curScore));
        score.measures[0].keySig = -3; // 3 flats (Bb, Eb, Ab)
        for (let i = 1; i < score.measures.length; i++) {
          score.measures[i].keySig = -1; // 1 flat (Bb) -> cancels Eb and Ab with naturals
        }
        window.__resetScoreForTest(score);
      })()`);
      await new Promise((r) => setTimeout(r, 500));

      const keyChangeCount = await evaluate(`(() => {
        const items = Array.from(document.querySelectorAll('[data-id^="keychange-"]'));
        return {
          count: items.length,
          naturals: items.filter(el => el.getAttribute('href')?.includes('accidentalNatural')).length,
          flats: items.filter(el => el.getAttribute('href')?.includes('accidentalFlat')).length,
        };
      })()`);
      console.log('Key change accidentals:', keyChangeCount);
      assert(keyChangeCount.count === 3, 'Key change from 3 flats to 1 flat must produce 3 accidentals');
      assert(keyChangeCount.naturals === 2, 'Must have 2 cancellation naturals');
      assert(keyChangeCount.flats === 1, 'Must have 1 flat for new key');

      const h3 = await clipScreenshot('[data-id^="keychange-"]', '03_keysig_cancellation_200.png', 25);
      screenshotHashes.add(h3);

      // 4. PICKUP MEASURE (ANACRUSIS) & SYSTEM MEASURE NUMBERING
      console.log('4. Setting and verifying Pickup Measure & System Measure Numbers...');
      await evaluate(`(() => {
        const curScore = window.__getScoreForTest();
        const score = JSON.parse(JSON.stringify(curScore));
        score.measures[0].actualTicks = 960; // 1 quarter note in 4/4
        const m0Id = score.measures[0].id;
        score.parts[0].staves[0].measures[m0Id].voices[0].events = [{
          id: 'pickup-quarter-note',
          kind: 'note',
          baseType: 'quarter',
          dots: 0,
          duration: 960,
          pitches: [{ step: 'A', octave: 4, alter: 0 }]
        }];
        window.__resetScoreForTest(score);
      })()`);
      await new Promise((r) => setTimeout(r, 500));

      const pickupInfo = await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const m0 = score.measures[0];
        const mNumbers = Array.from(document.querySelectorAll('[data-id$="measure-number"]')).map(el => el.textContent);
        return {
          actualTicks: m0.actualTicks,
          measureNumbers: mNumbers,
        };
      })()`);
      console.log('Pickup info & system measure numbers:', pickupInfo);
      assert(pickupInfo.actualTicks === 960, 'Measure 0 must have actualTicks 960');
      assert(pickupInfo.measureNumbers.length > 0, 'Systems after system 0 must show measure numbers');

      const h4 = await clipScreenshot('[data-id="pickup-quarter-note"]', '04_pickup_measure_200.png', 40);
      screenshotHashes.add(h4);

      // 5. DOUBLE AND FINAL BARLINES
      console.log('5. Setting and verifying Double & Final Barlines...');
      await evaluate(`(() => {
        const curScore = window.__getScoreForTest();
        const score = JSON.parse(JSON.stringify(curScore));
        score.measures[1].endBarline = 'double';
        score.measures[score.measures.length - 1].endBarline = 'final';
        window.__resetScoreForTest(score);
      })()`);
      await new Promise((r) => setTimeout(r, 500));

      const barlineElements = await evaluate(`(() => {
        const score = window.__getScoreForTest();
        const m1Id = score.measures[1].id;
        const lastId = score.measures[score.measures.length - 1].id;
        const doubleLines = Array.from(document.querySelectorAll('[data-id^="barline-' + m1Id + '"]'));
        const finalLines = Array.from(document.querySelectorAll('[data-id^="barline-' + lastId + '"]'));
        return {
          doubleCount: doubleLines.length,
          finalCount: finalLines.length,
          finalThick: finalLines.some(l => parseFloat(l.getAttribute('stroke-width') || '0') >= 5),
        };
      })()`);
      console.log('Barline inspection:', barlineElements);
      assert(barlineElements.doubleCount === 2, 'Double barline must consist of 2 lines');
      assert(barlineElements.finalCount === 2, 'Final barline must consist of 2 lines (thin + thick)');
      assert(barlineElements.finalThick, 'Final barline must include thick barline');

      const h5 = await clipScreenshot('[data-id$="-thick"]', '05_double_and_final_barlines_200.png', 30);
      screenshotHashes.add(h5);

      assert(screenshotHashes.size === 5, 'All 5 screenshots must be unique (different hashes)');
      console.log('Unique hashes confirmed: 5 / 5');

      console.log('ALL MILESTONE 6c E2E CHECKS PASSED SUCCESSFULLY!');
      process.exit(0);
    } catch (e) {
      console.error('E2E FAILURE:', e);
      process.exit(1);
    } finally {
      chrome.kill();
    }
  });
});
