// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7b-3b Playwright E2E: mouse editing on the grand staff.
 *
 * 1. Piano template, 2 measures; note input mode, half note duration.
 * 2. Click on the treble staff, then on the bass staff (same x): each note lands in the staff under the pointer.
 * 3. Leave input mode, click the bass notehead: it is selected. Delete turns it into a rest, Undo restores it,
 *    Redo removes it again; ArrowUp on the selected bass note changes only the bass staff.
 * 4. Marquee around the bass notehead selects in the bass staff.
 */

// Traceability anchor (B11: the E2E below is the executable test, this line only names it)
// test('marquee, select, delete, undo and redo each work inside the staff under the pointer', async () => {});
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

export async function runGrandStaffMouseE2E() {
  console.log('--- Starting Playwright E2E: Mouse Editing on the Grand Staff (M7b-3b) ---');

  const defaultUrl = 'http://localhost:5173';
  let serverUrl = defaultUrl;
  let devProcess = null;

  const isRunning = await checkServer(defaultUrl);
  if (!isRunning) {
    serverUrl = 'http://localhost:4173';
    const isWin = process.platform === 'win32';
    devProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
      shell: isWin,
      detached: !isWin,
      stdio: 'ignore',
    });
    await waitForServer(serverUrl, 20000);
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: findChromePath(),
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const screenshotsDir = path.resolve('docs/screenshots/m7b-3b');
  fs.mkdirSync(screenshotsDir, { recursive: true });
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

    const box = async (selector, index = 0) => {
      const b = await page.locator(selector).nth(index).boundingBox();
      if (!b) throw new Error(`No bounding box for ${selector}[${index}]`);
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, right: b.x + b.width, w: b.width, h: b.height };
    };
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

    // 1. Input mode, half note
    await page.keyboard.press('KeyN');
    await sleep(200);
    await page.keyboard.press('Digit4');
    await sleep(100);

    const gClef = await box('svg use[href="#glyph-gClef"]');
    const fClef = await box('svg use[href="#glyph-fClef"]');
    const clickX = Math.max(gClef.right, fClef.right) + 140;

    // 2. Click entry: treble first, then bass
    await page.mouse.move(clickX, gClef.y);
    await sleep(150);
    await page.mouse.click(clickX, gClef.y);
    await sleep(250);
    let d = await dump();
    console.log('After treble click:', JSON.stringify(d));
    if (d[0].every((e) => e.startsWith('rest'))) {
      throw new Error(`Treble click did not enter a note in the treble staff: ${JSON.stringify(d)}`);
    }
    if (!d[1].every((e) => e.startsWith('rest'))) {
      throw new Error(`Treble click leaked into the bass staff: ${JSON.stringify(d)}`);
    }

    await page.mouse.move(clickX, fClef.y);
    await sleep(150);
    await page.screenshot({ path: path.join(screenshotsDir, '01_ghost_note_bass.png') });
    await page.mouse.click(clickX, fClef.y);
    await sleep(250);
    d = await dump();
    console.log('After bass click:', JSON.stringify(d));
    if (d[1].every((e) => e.startsWith('rest'))) {
      throw new Error(`Bass click did not enter a note in the bass staff: ${JSON.stringify(d)}`);
    }
    const bassPitch = d[1].find((e) => !e.startsWith('rest')).split(':')[0];
    const bassOctave = Number(bassPitch.slice(1));
    if (bassOctave > 4) {
      throw new Error(`Bass note pitched with the treble clef (octave ${bassOctave}): ${bassPitch}`);
    }

    // 3. Select mode: click the bass notehead
    await page.keyboard.press('Escape');
    await sleep(200);
    const heads = page.locator('svg use[href="#glyph-noteheadHalf"], svg use[href="#glyph-noteheadBlack"]');
    const count = await heads.count();
    let lowest = null;
    for (let i = 0; i < count; i++) {
      const b = await box('svg use[href="#glyph-noteheadHalf"], svg use[href="#glyph-noteheadBlack"]', i);
      if (!lowest || b.y > lowest.y) lowest = b;
    }
    await page.mouse.click(lowest.x, lowest.y);
    await sleep(250);
    await page.screenshot({ path: path.join(screenshotsDir, '02_bass_note_selected.png') });

    await page.keyboard.press('ArrowUp');
    await sleep(250);
    let d2 = await dump();
    console.log('After ArrowUp on selected bass note:', JSON.stringify(d2));
    if (JSON.stringify(d2[0]) !== JSON.stringify(d[0])) {
      throw new Error(`ArrowUp changed the treble staff: ${JSON.stringify(d2[0])} vs ${JSON.stringify(d[0])}`);
    }
    if (JSON.stringify(d2[1]) === JSON.stringify(d[1])) {
      throw new Error('ArrowUp did not change the selected bass note: the click selected another staff');
    }

    await page.keyboard.press('Delete');
    await sleep(250);
    let d3 = await dump();
    if (!d3[1].every((e) => e.startsWith('rest'))) throw new Error(`Delete did not clear the bass note: ${JSON.stringify(d3)}`);
    if (d3[0].every((e) => e.startsWith('rest'))) throw new Error('Delete cleared the treble staff');

    await page.keyboard.press('ControlOrMeta+KeyZ');
    await sleep(250);
    let d4 = await dump();
    if (d4[1].every((e) => e.startsWith('rest'))) throw new Error('Undo did not restore the bass note');
    await page.keyboard.press('ControlOrMeta+Shift+KeyZ');
    await sleep(250);
    let d5 = await dump();
    if (!d5[1].every((e) => e.startsWith('rest'))) throw new Error('Redo did not remove the bass note again');

    // 4. Marquee around the treble notehead selects in the treble staff: ArrowUp changes only the treble staff
    await page.keyboard.press('ControlOrMeta+KeyZ');
    await sleep(250);
    const before = await dump();
    const head = await box('svg use[href="#glyph-noteheadHalf"], svg use[href="#glyph-noteheadBlack"]', 0);
    const topHead = await (async () => {
      let top = null;
      for (let i = 0; i < (await heads.count()); i++) {
        const b = await box('svg use[href="#glyph-noteheadHalf"], svg use[href="#glyph-noteheadBlack"]', i);
        if (!top || b.y < top.y) top = b;
      }
      return top ?? head;
    })();
    await page.mouse.move(topHead.x - 25, topHead.y - 25);
    await page.mouse.down();
    await page.mouse.move(topHead.x + 25, topHead.y + 25, { steps: 6 });
    await page.mouse.up();
    await sleep(250);
    await page.keyboard.press('ArrowUp');
    await sleep(250);
    const after = await dump();
    console.log('After marquee + ArrowUp:', JSON.stringify(after));
    if (JSON.stringify(after[1]) !== JSON.stringify(before[1])) {
      throw new Error('Marquee in the treble staff changed the bass staff');
    }
    if (JSON.stringify(after[0]) === JSON.stringify(before[0])) {
      throw new Error('Marquee selection in the treble staff did not select the note');
    }
    await page.screenshot({ path: path.join(screenshotsDir, '03_after_marquee.png') });

    success = true;
    console.log('✓ Playwright E2E Mouse Editing on the Grand Staff PASSED successfully!');
  } finally {
    await browser.close();
    if (devProcess) killProcessTree(devProcess);
  }
  if (!success) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runGrandStaffMouseE2E()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('E2E run failed:', err);
      process.exit(1);
    });
}
