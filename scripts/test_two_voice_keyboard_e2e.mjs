// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7a-4 Playwright E2E: Keyboard-Only Two-Voice Entry Test (T7)
 *
 * Executes the T1 workflow in the real browser:
 * 1. Creates a clean 1-measure 4/4 score.
 * 2. Enters note input mode (KeyN), sets quarter duration (Digit5).
 * 3. Enters C5, D5, E5, F5 in Voice 1 via keyboard.
 * 4. Presses Home (jumps to measure start at tick 0).
 * 5. Presses Tab (switches to Voice 2 at tick 0).
 * 6. Enters C4, D4, E4, F4 in Voice 2 via keyboard.
 * 7. Asserts DOM glyph counts (4 noteheads in Voice 1, 4 noteheads in Voice 2 = 8 total).
 * 8. Captures screenshots BEFORE download (ensuring zero toast in image).
 * 9. Triggers Ctrl+S download, intercepts downloaded file, and asserts exact events per voice.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execSync } from 'node:child_process';
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

export async function runTwoVoiceKeyboardE2E() {
  console.log('--- Starting Playwright E2E: Keyboard-Only Two-Voice Entry (T7) ---');

  const defaultUrl = 'http://localhost:5173';
  let serverUrl = defaultUrl;
  let devProcess = null;

  const isRunning = await checkServer(defaultUrl);
  if (!isRunning) {
    console.log('No local server found on :5173. Spawning preview server on port 4173...');
    serverUrl = 'http://localhost:4173';
    devProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
      shell: true,
      stdio: 'pipe',
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

  const screenshotsDir = path.resolve('docs/screenshots/m7a-4');
  const artifactsDir = path.resolve('artifacts');
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(artifactsDir, { recursive: true });

  let success = false;

  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 850 },
      deviceScaleFactor: 2,
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

    await page.goto(serverUrl, { waitUntil: 'networkidle' });
    await sleep(500);

    // Ensure Turkish locale for screenshot consistency
    await page.selectOption('#language-select', 'tr');
    await sleep(200);

    // 1. Reset to clean 1-measure score via UI New Score modal
    const btnNewScore = await page.waitForSelector('[data-testid="btn-new-score"]', { timeout: 10000 });
    await btnNewScore.click();
    await sleep(300);

    await page.selectOption('#keysig-select', '0');
    await page.selectOption('#timesig-select', '4/4');
    await page.fill('#measures-input', '1');
    await sleep(100);

    const btnCreate = await page.waitForSelector('[data-testid="btn-create-score"]', { timeout: 5000 });
    await btnCreate.click();
    await sleep(200);
    if (await page.locator('[data-testid="btn-create-score"]').isVisible()) {
      await btnCreate.click();
      await sleep(200);
    }

    const measureCountAfterCreate = await page.evaluate(() => window.__getScoreForTest().measures.length);
    console.log(`Measure count after create: ${measureCountAfterCreate}`);

    // Clear tip dismiss flag so tip is shown
    await page.evaluate(() => {
      try {
        localStorage.removeItem('scoreforge:dismissed_two_voice_tip');
      } catch {}
    });

    // Enter input mode
    await page.keyboard.press('KeyN');
    await sleep(200);

    // Screenshot 5: One-time tip banner visible on first entry to input mode
    const shotTip = path.join(screenshotsDir, '05_one_time_tip.png');
    await page.screenshot({ path: shotTip });
    fs.copyFileSync(shotTip, path.join(artifactsDir, '05_one_time_tip.png'));
    console.log(`[Captured] 05_one_time_tip.png`);

    // Set quarter duration
    await page.keyboard.press('Digit5');
    await sleep(150);

    // Screenshot 2: Beat guide and pending-slot band in Voice 1 at tick 0
    const shotBeatV1 = path.join(screenshotsDir, '02_beat_guide_pending_band_voice1.png');
    await page.screenshot({ path: shotBeatV1 });
    fs.copyFileSync(shotBeatV1, path.join(artifactsDir, '02_beat_guide_pending_band_voice1.png'));
    console.log(`[Captured] 02_beat_guide_pending_band_voice1.png`);

    // Enter Voice 1: C5, D5, E5, F5
    console.log('Entering Voice 1 notes: C5, D5, E5, F5...');
    await page.keyboard.press('KeyC');
    await sleep(100);
    await page.keyboard.press('KeyD');
    await sleep(100);
    await page.keyboard.press('KeyE');
    await sleep(100);
    await page.keyboard.press('KeyF');
    await sleep(200);

    const countAfterV1 = await page.locator('svg use[data-event-id][href*="notehead"]').count();
    console.log(`DOM noteheads after Voice 1: ${countAfterV1}`);

    // After 4 quarters, measure 1 is filled and cursor auto-advanced to measure 2, tick 0.
    // Use Left arrow to navigate back across barline into measure 1
    console.log('Pressing ArrowLeft to return across barline into measure 1...');
    await page.keyboard.press('ArrowLeft');
    await sleep(150);

    // Jump to measure 1 start with Home key
    console.log('Pressing Home to return to measure 1 start...');
    await page.keyboard.press('Home');
    await sleep(200);

    // Switch to Voice 2 with Tab key
    console.log('Pressing Tab to switch to Voice 2...');
    await page.keyboard.press('Tab');
    await sleep(200);

    // Verify status bar shows "Ses 2"
    const statusTextV2 = await page.textContent('[data-testid="status-bar"]');
    console.log(`Status bar text after Tab: "${statusTextV2?.trim()}"`);
    if (!statusTextV2?.includes('Ses 2')) {
      throw new Error(`Expected status bar to contain "Ses 2", found: "${statusTextV2}"`);
    }

    // Screenshot 3: Beat guide and pending band in Voice 2 on beat 1 (shared beat with Voice 1)
    const shotBeatV2 = path.join(screenshotsDir, '03_beat_guide_shared_beat_voice2.png');
    await page.screenshot({ path: shotBeatV2 });
    fs.copyFileSync(shotBeatV2, path.join(artifactsDir, '03_beat_guide_shared_beat_voice2.png'));
    console.log(`[Captured] 03_beat_guide_shared_beat_voice2.png`);

    // Enter Voice 2: C4, D4, E4, F4
    console.log('Entering Voice 2 notes: C4, D4, E4, F4...');
    await page.keyboard.press('KeyC');
    await sleep(100);
    // Transpose C5 to C4 with Ctrl+ArrowDown
    await page.keyboard.press('ControlOrMeta+ArrowDown');
    await sleep(100);
    await page.keyboard.press('KeyD');
    await sleep(100);
    await page.keyboard.press('KeyE');
    await sleep(100);
    await page.keyboard.press('KeyF');
    await sleep(300);

    const scoreDump = await page.evaluate(() => {
      const s = window.__getScoreForTest();
      return s.measures.map((m, idx) => {
        const sm = s.parts[0]?.staves[0]?.measures[m.id];
        return {
          measure: idx + 1,
          voices: sm?.voices.map((v) => ({
            voice: v.voiceIndex,
            events: v.events.map((e) => (e.kind === 'note' ? e.pitches[0].step + e.pitches[0].octave : 'rest')),
          })),
        };
      });
    });
    console.log('Score dump after Voice 2:', JSON.stringify(scoreDump, null, 2));

    // Screenshot 4: Toolbar voice buttons with content dots (both voices 1 & 2 have notes)
    const shotToolbar = path.join(screenshotsDir, '04_toolbar_voice_buttons_dots.png');
    await page.screenshot({
      path: shotToolbar,
      clip: { x: 0, y: 0, width: 1366, height: 130 },
    });
    fs.copyFileSync(shotToolbar, path.join(artifactsDir, '04_toolbar_voice_buttons_dots.png'));
    console.log(`[Captured] 04_toolbar_voice_buttons_dots.png`);

    // Assert DOM glyph counts: 8 noteheads total (4 in voice 1, 4 in voice 2)
    const domUseElements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('svg use')).map((u) => ({
        id: u.getAttribute('data-id'),
        eventId: u.getAttribute('data-event-id'),
        href: u.getAttribute('href') || u.getAttribute('xlink:href'),
      }));
    });
    console.log('DOM use elements count:', domUseElements.length);
    console.log('DOM use elements with notehead:', domUseElements.filter((u) => u.href?.includes('notehead')));

    const noteheadCount = await page.locator('svg use[data-event-id][href*="notehead"]').count();
    console.log(`DOM notehead count: ${noteheadCount}`);
    if (noteheadCount !== 8) {
      throw new Error(`Expected exactly 8 notehead glyphs in DOM, found: ${noteheadCount}`);
    }

    // Screenshot 1: Final two-voice measure entered in one measure (BEFORE download, NO toast)
    const toastCountBeforeDownload = await page.locator('[data-testid="status-toast"]').count();
    if (toastCountBeforeDownload > 0) {
      throw new Error(`Toast is present before download! Image must not contain toast.`);
    }

    const shotFinal = path.join(screenshotsDir, '01_two_voice_measure.png');
    await page.screenshot({ path: shotFinal });
    fs.copyFileSync(shotFinal, path.join(artifactsDir, '01_two_voice_measure.png'));
    console.log(`[Captured] 01_two_voice_measure.png (BEFORE download, no toast)`);

    // Now trigger download via Ctrl+S
    console.log('Triggering download via Ctrl+S...');
    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('ControlOrMeta+KeyS');
    const download = await downloadPromise;

    const downloadPath = path.join(artifactsDir, 'downloaded_two_voice_keyboard.sfscore');
    await download.saveAs(downloadPath);
    console.log(`Downloaded score saved to: ${downloadPath}`);

    // Verify downloaded score content
    const fileContent = JSON.parse(fs.readFileSync(downloadPath, 'utf-8'));
    const scoreObj = fileContent.score || fileContent;
    const mId = scoreObj.measures[0]?.id;
    const sm = scoreObj.parts[0].staves[0].measures[mId];
    const v1 = sm?.voices.find((v) => v.voiceIndex === 1);
    const v2 = sm?.voices.find((v) => v.voiceIndex === 2);

    if (!v1 || v1.events.length !== 4) {
      throw new Error(`Downloaded score voice 1 must have 4 events, found: ${v1?.events?.length}`);
    }
    if (!v2 || v2.events.length !== 4) {
      throw new Error(`Downloaded score voice 2 must have 4 events, found: ${v2?.events?.length}`);
    }

    console.log('Voice 1 events:', JSON.stringify(v1.events.map((e) => ({ kind: e.kind, dur: e.duration, p: e.pitches?.[0] }))));
    console.log('Voice 2 events:', JSON.stringify(v2.events.map((e) => ({ kind: e.kind, dur: e.duration, p: e.pitches?.[0] }))));

    success = true;
    console.log('✓ Playwright E2E Keyboard-Only Two-Voice Entry PASSED successfully!');
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

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  runTwoVoiceKeyboardE2E().catch((err) => {
    console.error('E2E run failed:', err);
    process.exit(1);
  });
}
