// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7b-6 Playwright E2E: mouse entry in measures that hold only rests.
 *
 * Piano template, 4/4.
 * 1. Sixteenth selected: a click in the middle of an EMPTY measure enters the note on the first beat (sixteenth
 *    slots are too narrow to aim at): no rest in front of the note. Undo removes it.
 * 2. Quarter selected: slots are wide enough, the click in the middle of the empty measure enters the note on a
 *    grid slot; the rests in front of it stay and the measure is full.
 * 3. A click in the bass staff under that note enters the bass note on the same tick.
 */

// Traceability anchor (B14: the E2E below is the executable test, this line only names it)
// test('a click on a later rest of a prepared measure enters the note there and keeps the rest before it', async () => {});
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

export async function runEmptyMeasureGridE2E() {
  console.log('--- Starting Playwright E2E: Mouse Entry Grid in an Empty Measure (M7b-6) ---');
  const defaultUrl = 'http://localhost:5173';
  let serverUrl = defaultUrl;
  let devProcess = null;
  if (!(await checkServer(defaultUrl))) {
    serverUrl = 'http://localhost:4173';
    const isWin = process.platform === 'win32';
    devProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
      shell: isWin,
      detached: !isWin,
      stdio: 'ignore',
    });
    await waitForServer(serverUrl, 20000);
  }
  const browser = await chromium.launch({ headless: true, executablePath: findChromePath(), args: ['--no-sandbox', '--disable-gpu'] });
  const screenshotsDir = path.resolve('docs/screenshots/m7b-6');
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
  let success = false;
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
    await page.goto(serverUrl, { waitUntil: 'networkidle' });
    await sleep(500);
    await page.selectOption('#language-select', 'tr');
    await (await page.waitForSelector('[data-testid="btn-new-score"]', { timeout: 10000 })).click();
    await sleep(300);
    await page.click('[data-testid="template-piano"]');
    await page.fill('#measures-input', '2');
    const btnCreate = await page.waitForSelector('[data-testid="btn-create-score"]', { timeout: 5000 });
    await btnCreate.click();
    await sleep(300);
    if (await page.locator('[data-testid="btn-create-score"]').isVisible()) {
      await btnCreate.click();
      await sleep(300);
    }
    const dump = () =>
      page.evaluate(() => {
        const s = window.__getScoreForTest();
        const m1 = s.measures[0].id;
        return s.parts[0].staves.map((st) =>
          st.measures[m1].voices[0].events.map((e) =>
            e.kind === 'note' ? `${e.pitches[0].step}${e.pitches[0].octave}:${e.duration}` : `rest:${e.duration}`
          )
        );
      });
    const waitDump = async (pred, label, timeoutMs = 4000) => {
      const t0 = Date.now();
      let last = await dump();
      while (!pred(last)) {
        if (Date.now() - t0 > timeoutMs) {
          await page.screenshot({ path: path.resolve('artifacts', `grid_e2e_fail_${label}.png`) });
          throw new Error(`${label}: condition not met within ${timeoutMs} ms, score: ${JSON.stringify(last)}`);
        }
        await sleep(100);
        last = await dump();
      }
      return last;
    };
    const box = async (selector) => {
      const b = await page.locator(selector).first().boundingBox();
      if (!b) throw new Error(`No bounding box for ${selector}`);
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, right: b.x + b.width, left: b.x, w: b.width };
    };
    const sum = (events, upTo) => events.slice(0, upTo).reduce((t, e) => t + Number(e.split(':')[1]), 0);

    await page.keyboard.press('KeyN');
    await page.waitForFunction(() => /Porte 1\/2/.test(document.body.innerText), null, { timeout: 5000 });
    await page.keyboard.press('Digit3'); // sixteenth
    await sleep(200);

    const gClef = await box('svg use[href="#glyph-gClef"]');
    const fClef = await box('svg use[href="#glyph-fClef"]');
    const restsLoc = page.locator('svg use[href^="#glyph-rest"]');
    const wholeRest = await restsLoc.nth(0).boundingBox(); // whole rest of measure 1, centred in the measure
    const middleX = wholeRest.x + wholeRest.width / 2;

    // 1. A click in the middle of the empty measure: first beat, nothing in front of the note
    await page.mouse.move(middleX, gClef.y);
    await sleep(200);
    await page.screenshot({ path: path.join(screenshotsDir, '01_ghost_in_empty_measure.png') });
    await page.mouse.click(middleX, gClef.y);
    let d = await waitDump((x) => x[0].some((e) => !e.startsWith('rest')), 'first_click');
    console.log('After click in the empty measure:', JSON.stringify(d));
    if (d[0][0].startsWith('rest') || d[0][0].split(':')[1] !== '240') {
      throw new Error(`The note is not on the first beat: ${JSON.stringify(d[0])}`);
    }
    await page.keyboard.press('ControlOrMeta+KeyZ');
    d = await waitDump((x) => x[0].every((e) => e.startsWith('rest')) && x[0].length === 1, 'undo_first_click');

    // 2. Quarter notes: the grid is usable, the note lands on a slot and the rests in front of it stay
    await page.keyboard.press('Digit5');
    await sleep(150);
    await page.mouse.move(middleX, gClef.y);
    await sleep(200);
    await page.screenshot({ path: path.join(screenshotsDir, '02_ghost_on_quarter_slot.png') });
    await page.mouse.click(middleX, gClef.y);
    d = await waitDump((x) => x[0].some((e) => !e.startsWith('rest')), 'quarter_click');
    console.log('After quarter click:', JSON.stringify(d));
    const idx = d[0].findIndex((e) => !e.startsWith('rest'));
    const quarterTick = sum(d[0], idx);
    if (![960, 1920, 2880].includes(quarterTick) || d[0][idx].split(':')[1] !== '960') {
      throw new Error(`The quarter note is not on a grid slot behind rests: ${JSON.stringify(d[0])}`);
    }
    if (!d[0].slice(0, idx).every((e) => e.startsWith('rest')) || sum(d[0], d[0].length) !== 3840) {
      throw new Error(`Rests in front of the note are missing or the measure is not full: ${JSON.stringify(d[0])}`);
    }

    // 3. The bass staff follows the columns of the treble staff
    const trebleHead = await box('svg use[href="#glyph-noteheadBlack"]');
    await page.mouse.move(trebleHead.x, fClef.y);
    await sleep(200);
    await page.mouse.click(trebleHead.x, fClef.y);
    d = await waitDump((x) => x[1].some((e) => !e.startsWith('rest')), 'bass_click');
    console.log('After bass click:', JSON.stringify(d));
    const bIdx = d[1].findIndex((e) => !e.startsWith('rest'));
    if (sum(d[1], bIdx) !== quarterTick) throw new Error(`Bass note not on tick ${quarterTick}: ${JSON.stringify(d[1])}`);
    await page.screenshot({ path: path.join(screenshotsDir, '03_two_notes_behind_rests.png') });

    success = true;
    console.log('✓ Playwright E2E Mouse Entry in Rest Measures PASSED successfully!');
  } finally {
    await browser.close();
    if (devProcess) killProcessTree(devProcess);
  }
  if (!success) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runEmptyMeasureGridE2E()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('E2E run failed:', err);
      process.exit(1);
    });
}
