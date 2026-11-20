// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7b-3a Playwright E2E: keyboard-only grand staff entry.
 *
 * 1. New Score dialog: choose the piano template, 2 measures.
 * 2. Right hand (treble staff): C D E F in measure 1, G A B C in measure 2.
 * 3. Ctrl+Home, then BracketRight (Turkish Q: U-diaeresis key) moves to the bass staff: status bar "Porte 2/2".
 * 4. Left hand (bass staff): half C, half G in measure 1, whole C in measure 2.
 * 5. BracketLeft returns to the treble staff: "Porte 1/2".
 * 6. Asserts the score model, that the DOM draws both staves, saves with Ctrl+S and checks the file.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
  return new Promise((r) => setTimeout(r, ms));
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

function checkServer(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

function waitForServer(url, timeoutMs = 15000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };

    const retry = () => {
      if (Date.now() - t0 > timeoutMs) {
        reject(new Error(`Timed out waiting for server at ${url}`));
      } else {
        setTimeout(check, 250);
      }
    };

    check();
  });
}

export async function runGrandStaffKeyboardE2E() {
  console.log('--- Starting Playwright E2E: Keyboard-Only Grand Staff Entry (M7b-3a) ---');

  const defaultUrl = 'http://localhost:5173';
  let serverUrl = defaultUrl;
  let devProcess = null;

  const isRunning = await checkServer(defaultUrl);
  if (!isRunning) {
    console.log('No local server found on :5173. Spawning preview server on port 4173...');
    serverUrl = 'http://localhost:4173';
    const isWin = process.platform === 'win32';
    devProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
      shell: isWin,
      detached: !isWin,
      stdio: 'ignore',
    });
    await waitForServer(serverUrl, 20000);
    console.log(`Preview server ready at ${serverUrl}`);
  } else {
    console.log(`Connecting to existing server at ${serverUrl}`);
  }

  const execPath = findChromePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath: execPath,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const screenshotsDir = path.resolve('docs/screenshots/m7b-3a');
  const artifactsDir = path.resolve('artifacts');
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(artifactsDir, { recursive: true });

  let success = false;

  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      deviceScaleFactor: 2,
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

    await page.goto(serverUrl, { waitUntil: 'networkidle' });
    await sleep(500);
    await page.selectOption('#language-select', 'tr');
    await sleep(200);

    // 1. New piano score, 2 measures
    await (await page.waitForSelector('[data-testid="btn-new-score"]', { timeout: 10000 })).click();
    await sleep(300);
    await page.click('[data-testid="template-piano"]');
    await page.selectOption('#keysig-select', '0');
    await page.selectOption('#timesig-select', '4/4');
    await page.fill('#measures-input', '2');
    await sleep(100);
    const btnCreate = await page.waitForSelector('[data-testid="btn-create-score"]', { timeout: 5000 });
    await btnCreate.click();
    await sleep(200);
    if (await page.locator('[data-testid="btn-create-score"]').isVisible()) {
      await btnCreate.click();
      await sleep(200);
    }

    const created = await page.evaluate(() => {
      const s = window.__getScoreForTest();
      return { staves: s.parts[0].staves.map((st) => st.clef.sign), measures: s.measures.length };
    });
    console.log('Created score:', JSON.stringify(created));
    if (JSON.stringify(created.staves) !== JSON.stringify(['G', 'F']) || created.measures !== 2) {
      throw new Error(`Piano template wrong: ${JSON.stringify(created)}`);
    }

    const bodyText = async () => page.evaluate(() => document.body.innerText);
    const expectStatus = async (re, label) => {
      await sleep(150);
      const txt = await bodyText();
      if (!re.test(txt)) {
        throw new Error(`Status bar check failed (${label}): expected ${re}, page text: ${txt.slice(0, 500)}`);
      }
    };
    const typeKeys = async (keys) => {
      for (const k of keys) {
        await page.keyboard.press(k);
        await sleep(120);
      }
    };

    // 2. Right hand on the treble staff
    await page.keyboard.press('KeyN');
    await sleep(200);
    await expectStatus(/Porte 1\/2/, 'input mode starts on staff 1');
    await page.keyboard.press('Digit5');
    await typeKeys(['KeyC', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyA', 'KeyB', 'KeyC']);

    // 3. Ctrl+Home, then to the bass staff with BracketRight
    await page.keyboard.press('ControlOrMeta+Home');
    await expectStatus(/Ölçü 1\s*·\s*Vuruş 1/, 'after Ctrl+Home');
    await page.keyboard.press('BracketRight');
    await expectStatus(/Porte 2\/2/, 'after BracketRight');
    await expectStatus(/Ölçü 1\s*·\s*Vuruş 1/, 'staff switch keeps measure and beat');
    await page.screenshot({ path: path.join(screenshotsDir, '01_bass_staff_caret.png') });

    // Pressing BracketRight again stays on the last staff (no wrap)
    await page.keyboard.press('BracketRight');
    await expectStatus(/Porte 2\/2/, 'no wrap past the last staff');

    // 4. Left hand: half C, half G, then whole C in measure 2
    await page.keyboard.press('Digit6');
    await typeKeys(['KeyC', 'KeyG']);
    await page.keyboard.press('Digit7');
    await typeKeys(['KeyC']);

    // 5. Back to the treble staff
    await page.keyboard.press('BracketLeft');
    await expectStatus(/Porte 1\/2/, 'after BracketLeft');
    await page.keyboard.press('BracketLeft');
    await expectStatus(/Porte 1\/2/, 'no wrap past the first staff');

    // 6. Score model
    const dump = await page.evaluate(() => {
      const s = window.__getScoreForTest();
      const name = (e) => (e.kind === 'note' ? `${e.pitches[0].step}${e.pitches[0].octave}:${e.duration}` : `rest:${e.duration}`);
      const out = {};
      s.parts[0].staves.forEach((st, si) => {
        s.measures.slice(0, 2).forEach((m, mi) => {
          const v1 = st.measures[m.id].voices.find((v) => v.voiceIndex === 1);
          out[`s${si + 1}m${mi + 1}`] = v1.events.map(name);
        });
      });
      out.measureCount = s.measures.length;
      return out;
    });
    console.log('Score dump:', JSON.stringify(dump));
    const expected = {
      s1m1: ['C5:960', 'D5:960', 'E5:960', 'F5:960'],
      s2m1: ['C3:1920', 'G2:1920'],
      s2m2: ['C3:3840'],
    };
    for (const [k, v] of Object.entries(expected)) {
      if (JSON.stringify(dump[k]) !== JSON.stringify(v)) {
        throw new Error(`${k} differs. Expected ${JSON.stringify(v)}, got ${JSON.stringify(dump[k])}`);
      }
    }
    // Measure 2 of the treble staff: steps G A B C quarters (octaves follow the nearest-octave rule)
    const steps = (dump.s1m2 ?? []).map((x) => x[0] + ':' + x.split(':')[1]);
    if (JSON.stringify(steps) !== JSON.stringify(['G:960', 'A:960', 'B:960', 'C:960'])) {
      throw new Error(`s1m2 differs: ${JSON.stringify(dump.s1m2)}`);
    }

    // The DOM draws both staves: a brace, two clefs, 8 + 3 noteheads
    const dom = await page.evaluate(() => ({
      brace: document.querySelectorAll('svg use[href="#glyph-brace"]').length,
      gClef: document.querySelectorAll('svg use[href="#glyph-gClef"]').length,
      fClef: document.querySelectorAll('svg use[href="#glyph-fClef"]').length,
    }));
    console.log('DOM:', JSON.stringify(dom));
    if (dom.brace < 1 || dom.gClef < 1 || dom.fClef < 1) {
      throw new Error(`Grand staff glyphs missing in DOM: ${JSON.stringify(dom)}`);
    }
    await page.screenshot({ path: path.join(screenshotsDir, '02_grand_staff_two_hands.png') });
    fs.copyFileSync(path.join(screenshotsDir, '02_grand_staff_two_hands.png'), path.join(artifactsDir, '02_grand_staff_two_hands.png'));

    // 7. Save and re-check the file
    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('ControlOrMeta+KeyS');
    const download = await downloadPromise;
    const downloadPath = path.join(artifactsDir, 'downloaded_grand_staff_keyboard.sfscore');
    await download.saveAs(downloadPath);
    const fileContent = JSON.parse(fs.readFileSync(downloadPath, 'utf-8'));
    const scoreObj = fileContent.score || fileContent;
    const part = scoreObj.parts[0];
    if (part.staves.length !== 2 || part.staves[1].clef.sign !== 'F') {
      throw new Error('Saved file lost the second staff');
    }
    if (!scoreObj.groups?.some((g) => g.bracket === 'brace')) {
      throw new Error('Saved file lost the brace group');
    }
    const savedBass = part.staves[1].measures[scoreObj.measures[0].id].voices[0].events.map((e) => e.pitches?.[0]?.step + e.pitches?.[0]?.octave);
    if (JSON.stringify(savedBass) !== JSON.stringify(['C3', 'G2'])) {
      throw new Error(`Saved bass staff differs: ${JSON.stringify(savedBass)}`);
    }

    success = true;
    console.log('✓ Playwright E2E Keyboard-Only Grand Staff Entry PASSED successfully!');
  } finally {
    await browser.close();
    if (devProcess) {
      killProcessTree(devProcess);
    }
  }

  if (!success) {
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runGrandStaffKeyboardE2E()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('E2E run failed:', err);
      process.exit(1);
    });
}
