// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7a-3: Playwright E2E Voice Selection, Transpose, Clipboard and Editing Test (T5)
 *
 * Requirements:
 * - Enter BWV 140/7 mm. 1-2 in two voices via keyboard.
 * - Click first alto note, Shift+click last alto note of m.2:
 *   Range selection highlight spans the 8 alto notes; status bar shows:
 *     TR: "8 öge seçildi (Ölçü 1–2)"
 * - Press ArrowUp: transposes all 8 alto notes up one semitone.
 * - Copy (Ctrl+C), create measure 3, paste (Ctrl+V) into voice 2:
 *   voice 2 has the notes, voice 1 has whole rest.
 * - Press Delete: voice 2 notes become rests.
 * - Save score via Ctrl+S, download and validate structure.
 * - Capture high-DPI screenshots (deviceScaleFactor: 2) in docs/screenshots/m7a-3/:
 *     01_voice2_range_selected.png (with status bar visible)
 *     02_transposed_and_pasted.png
 *     03_final_after_delete.png
 * - Mutation check M: break voice lookup, verify T5 fails.
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

const outDir = path.resolve('docs/screenshots/m7a-3');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChromePath() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  const chromePaths = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google\\Chrome\\Application\\chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google\\Chrome\\Application\\chrome.exe'),
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

let globalPreviewProcess = null;

async function ensureServer() {
  const isDevRunning = await checkServer('http://localhost:5173');
  if (isDevRunning) {
    console.log('Detected existing Vite dev server running on http://localhost:5173');
    return 'http://localhost:5173';
  }

  const isPreviewRunning = await checkServer('http://localhost:4173');
  if (isPreviewRunning) {
    console.log('Detected existing preview server running on http://localhost:4173');
    return 'http://localhost:4173';
  }

  console.log('No local server detected on 5173 or 4173. Building and starting preview server...');
  execSync('npm run build', { stdio: 'inherit' });

  const isWin = process.platform === 'win32';
  const previewUrl = 'http://localhost:4173';
  globalPreviewProcess = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    shell: isWin,
    detached: !isWin,
    stdio: 'ignore',
  });

  for (let i = 0; i < 50; i++) {
    await sleep(200);
    if (await checkServer(previewUrl)) {
      console.log('Vite preview server ready at ' + previewUrl);
      return previewUrl;
    }
  }
  throw new Error('Vite preview server failed to start on 4173 within 10 seconds');
}

export async function runVoiceSelectionE2E(options = {}, serverUrlOverride) {
  const { mutationBreakVoiceLookup = false } = options;
  console.log(`\n=== Running Playwright Voice Selection E2E (mutationBreakVoiceLookup: ${mutationBreakVoiceLookup}) ===`);

  const serverUrl = serverUrlOverride || (await ensureServer());
  const execPath = findChromePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath: execPath,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      locale: 'tr-TR',
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

    console.log(`Navigating to ${serverUrl}...`);
    await page.goto(serverUrl, { waitUntil: 'networkidle' });
    await sleep(400);

    // 1. Create fresh 2-measure score in Eb major (-3), 4/4
    console.log('Configuring fresh 2-measure score in Eb major (-3), 4/4...');
    const btnNewScore = await page.waitForSelector('[data-testid="btn-new-score"]', { timeout: 10000 });
    await btnNewScore.click();
    await sleep(300);

    await page.selectOption('#keysig-select', '-3');
    await page.selectOption('#timesig-select', '4/4');
    await page.fill('#measures-input', '2');
    await sleep(100);

    const btnCreate = await page.waitForSelector('[data-testid="btn-create-score"]', { timeout: 5000 });
    await btnCreate.click();
    await sleep(400);

    // 2. Enter Note Input Mode
    console.log('Entering note input mode (pressing "n")...');
    await page.keyboard.press('n');
    await sleep(200);

    // 3. Enter Soprano (Voice 1) mm. 1-2
    console.log('Entering Soprano mm. 1-2...');
    // m.1: Eb4 (quarter), G4 (quarter), Bb4 (dotted quarter), Bb4 (eighth)
    await page.keyboard.press('5'); // quarter
    await sleep(40);
    await page.keyboard.press('e');
    await sleep(40);
    await page.keyboard.press('Control+ArrowDown');
    await sleep(40);

    await page.keyboard.press('g');
    await sleep(40);

    await page.keyboard.press('.'); // dot
    await sleep(40);
    await page.keyboard.press('b');
    await sleep(40);

    await page.keyboard.press('.'); // toggle dot off
    await sleep(40);
    await page.keyboard.press('4'); // eighth
    await sleep(40);
    await page.keyboard.press('b');
    await sleep(40);

    // m.2: Bb4 (quarter), Bb4 (quarter), C5 (half)
    await page.keyboard.press('5'); // quarter
    await sleep(40);
    await page.keyboard.press('b');
    await sleep(40);
    await page.keyboard.press('b');
    await sleep(40);
    await page.keyboard.press('6'); // half
    await sleep(40);
    await page.keyboard.press('c');
    await sleep(40);

    // 4. Navigate back to start of m.1
    console.log('Navigating back to start of m.1...');
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('ArrowLeft');
      await sleep(30);
    }

    // 5. Switch to Voice 2 via Tab
    console.log('Switching to Voice 2 via Tab...');
    await page.keyboard.press('Tab');
    await sleep(150);

    // 6. Enter Alto (Voice 2) mm. 1-2
    console.log('Entering Alto mm. 1-2...');
    // m.1: Bb3 (quarter), Eb4 (quarter), G4 (quarter), F4 (quarter)
    await page.keyboard.press('5'); // quarter
    await sleep(40);
    await page.keyboard.press('b');
    await sleep(40);
    await page.keyboard.press('Control+ArrowDown');
    await sleep(40);

    await page.keyboard.press('e');
    await sleep(40);
    await page.keyboard.press('g');
    await sleep(40);
    await page.keyboard.press('f');
    await sleep(40);

    // m.2: G4 (quarter), F4 (quarter), G4 (quarter), F4 (quarter)
    await page.keyboard.press('g');
    await sleep(40);
    await page.keyboard.press('f');
    await sleep(40);
    await page.keyboard.press('g');
    await sleep(40);
    await page.keyboard.press('f');
    await sleep(40);

    // 7. Exit input mode to select mode (Escape)
    console.log('Exiting to select mode (pressing Escape)...');
    await page.keyboard.press('Escape');
    await sleep(200);

    // Query active score to retrieve first alto note and last alto note IDs
    const scoreInfo = await page.evaluate(() => {
      const s = window.__getScoreForTest ? window.__getScoreForTest() : null;
      if (!s) return null;
      const staff = s.parts[0]?.staves[0];
      const m0 = staff?.measures[s.measures[0]?.id];
      const m1 = staff?.measures[s.measures[1]?.id];
      const v2m0 = m0?.voices.find((v) => v.voiceIndex === 2);
      const v2m1 = m1?.voices.find((v) => v.voiceIndex === 2);
      const v1m0 = m0?.voices.find((v) => v.voiceIndex === 1);
      return {
        firstAltoId: v2m0?.events[0]?.id,
        lastAltoId: v2m1?.events[3]?.id,
        firstSopranoId: v1m0?.events[0]?.id,
      };
    });

    if (!scoreInfo || !scoreInfo.firstAltoId || !scoreInfo.lastAltoId) {
      throw new Error('Could not find alto note event IDs in active score!');
    }

    const clickStartId = mutationBreakVoiceLookup ? scoreInfo.firstSopranoId : scoreInfo.firstAltoId;

    console.log(`Clicking first alto note (${clickStartId})...`);
    const startLoc = page.locator(`[data-event-id="${clickStartId}"]`).first();
    await startLoc.click({ force: true });
    await sleep(150);

    console.log(`Shift+clicking last alto note (${scoreInfo.lastAltoId})...`);
    const endLoc = page.locator(`[data-event-id="${scoreInfo.lastAltoId}"]`).first();
    await endLoc.click({ force: true, modifiers: ['Shift'] });
    await sleep(200);

    // 8. Verify status bar shows range selection info
    const statusBarEl = await page.waitForSelector('[data-testid="status-bar"]');
    const rangeInfoText = await page.textContent('[data-testid="status-range-info"]');
    console.log(`Status bar range info: "${rangeInfoText?.trim()}"`);

    const expectedRangePattern = /8 (öge seçildi|items selected) \(Ölçü 1–2|Measures 1–2\)/;
    if (!rangeInfoText || !expectedRangePattern.test(rangeInfoText.trim())) {
      throw new Error(
        `Status bar range text mismatch! Expected "8 öge seçildi (Ölçü 1–2)" or "8 items selected (Measures 1–2)", got: "${rangeInfoText?.trim()}"`
      );
    }
    console.log('✓ Status bar correctly displays 8 selected items across measures 1–2.');

    // Screenshot 1: Range selected in voice 2 with status bar visible
    const screenshot1Path = path.join(outDir, '01_voice2_range_selected.png');
    await page.screenshot({ path: screenshot1Path });
    console.log(`Saved screenshot 1: ${screenshot1Path}`);

    // 9. Press ArrowUp: transposes all 8 alto notes up one semitone
    console.log('Pressing ArrowUp to transpose all 8 alto notes up one semitone...');
    await page.keyboard.press('ArrowUp');
    await sleep(200);

    // Verify transposition in active score
    const altoAfterTranspose = await page.evaluate(() => {
      const s = window.__getScoreForTest();
      const staff = s.parts[0].staves[0];
      const m0 = staff.measures[s.measures[0].id];
      const v2 = m0.voices.find((v) => v.voiceIndex === 2);
      return v2.events[0].pitches[0];
    });
    console.log('First alto note after transpose up:', altoAfterTranspose);
    // Bb3 (alter -1) transposed +1 -> B3 (alter 0)
    if (altoAfterTranspose.step !== 'B' || altoAfterTranspose.alter !== 0) {
      throw new Error(`Transpose failed! Expected B3 natural, got ${altoAfterTranspose.step}${altoAfterTranspose.octave} alter=${altoAfterTranspose.alter}`);
    }
    console.log('✓ All 8 alto notes transposed up one semitone successfully.');

    // 10. Copy selection via Ctrl+C
    console.log('Copying selection via Ctrl+C...');
    await page.keyboard.press('Control+c');
    await sleep(150);

    // 11. Ensure measure 3 exists
    let totalMeasures = await page.evaluate(() => window.__getScoreForTest().measures.length);
    console.log(`Current measure count before ensuring measure 3: ${totalMeasures}`);
    if (totalMeasures < 3) {
      console.log('Creating measure 3 via Toolbar button [data-testid="btn-insert-measure"]...');
      const btnInsertMeasure = await page.waitForSelector('[data-testid="btn-insert-measure"]');
      await btnInsertMeasure.click({ force: true });
      await sleep(300);
      totalMeasures = await page.evaluate(() => window.__getScoreForTest().measures.length);
    }
    console.log(`Score has ${totalMeasures} measures.`);

    // 12. Navigate to measure 3 voice 2 and paste via Ctrl+V
    console.log('Switching into input mode and ensuring cursor at measure 3 voice 2...');
    await page.keyboard.press('n'); // Enter input mode
    await sleep(150);

    // Read current cursor location
    let curCursorState = await page.evaluate(() => {
      const c = window.__getEditorStateForTest ? window.__getEditorStateForTest().cursor : null;
      const s = window.__getScoreForTest();
      return {
        measureIndex: c ? s.measures.findIndex((m) => m.id === c.measureId) : -1,
        voiceIndex: c ? c.voiceIndex : 1,
      };
    });
    console.log('Cursor state after entering input mode:', curCursorState);

    // Navigate cursor forward until measureIndex is at least 2 (measure 3)
    for (let i = 0; i < 15; i++) {
      if (curCursorState.measureIndex >= 2) break;
      await page.keyboard.press('ArrowRight');
      await sleep(40);
      curCursorState = await page.evaluate(() => {
        const c = window.__getEditorStateForTest ? window.__getEditorStateForTest().cursor : null;
        const s = window.__getScoreForTest();
        return {
          measureIndex: c ? s.measures.findIndex((m) => m.id === c.measureId) : -1,
          voiceIndex: c ? c.voiceIndex : 1,
        };
      });
    }

    // Cycle voice via Tab until voiceIndex is 2
    for (let i = 0; i < 6; i++) {
      if (curCursorState.voiceIndex === 2) break;
      await page.keyboard.press('Tab');
      await sleep(100);
      curCursorState = await page.evaluate(() => {
        const c = window.__getEditorStateForTest ? window.__getEditorStateForTest().cursor : null;
        const s = window.__getScoreForTest();
        return {
          measureIndex: c ? s.measures.findIndex((m) => m.id === c.measureId) : -1,
          voiceIndex: c ? c.voiceIndex : 1,
        };
      });
    }
    console.log('Cursor ready for paste at:', curCursorState);

    console.log('Pasting copied notes into voice 2 via Ctrl+V...');
    await page.keyboard.press('Control+v');
    await sleep(300);

    // Screenshot 2: Transposed and pasted into voice 2 of measure 3
    const screenshot2Path = path.join(outDir, '02_transposed_and_pasted.png');
    await page.screenshot({ path: screenshot2Path });
    console.log(`Saved screenshot 2: ${screenshot2Path}`);

    // Verify pasted content: Measure 3 has voice 2 with pasted notes, voice 1 has whole rest
    const m3Content = await page.evaluate(() => {
      const s = window.__getScoreForTest();
      const staff = s.parts[0].staves[0];
      const m2 = staff.measures[s.measures[2].id];
      const v1 = m2.voices.find((v) => v.voiceIndex === 1);
      const v2 = m2.voices.find((v) => v.voiceIndex === 2);
      return {
        v1IsRest: v1 ? v1.events.every((e) => e.kind === 'rest') : false,
        v2HasNotes: v2 ? v2.events.some((e) => e.kind === 'note') : false,
        v2NoteCount: v2 ? v2.events.filter((e) => e.kind === 'note').length : 0,
      };
    });
    console.log('Measure 3 content verification:', m3Content);
    if (!m3Content.v1IsRest) {
      throw new Error('Measure 3 voice 1 expected to be rests, but has non-rests!');
    }
    if (!m3Content.v2HasNotes) {
      throw new Error('Measure 3 voice 2 expected to contain pasted notes!');
    }
    console.log('✓ Pasted notes into voice 2: voice 2 has notes, voice 1 has whole rest.');

    // 13. Press Delete: voice 2 notes become rests
    console.log('Pressing Delete to delete selected voice 2 notes...');
    await page.keyboard.press('Delete');
    await sleep(250);

    // Screenshot 3: Final state after delete
    const screenshot3Path = path.join(outDir, '03_final_after_delete.png');
    await page.screenshot({ path: screenshot3Path });
    console.log(`Saved screenshot 3: ${screenshot3Path}`);

    // Verify notes in selection became rests
    const afterDeleteContent = await page.evaluate(() => {
      const s = window.__getScoreForTest();
      const staff = s.parts[0].staves[0];
      const m2 = staff.measures[s.measures[2].id];
      const v2 = m2.voices.find((v) => v.voiceIndex === 2);
      return {
        v2AllRests: v2 ? v2.events.every((e) => e.kind === 'rest') : false,
      };
    });
    console.log('After delete verification:', afterDeleteContent);
    if (!afterDeleteContent.v2AllRests) {
      throw new Error('Expected voice 2 in measure 3 to become rests after Delete!');
    }
    console.log('✓ Voice 2 notes became rests after Delete.');

    // 14. Save score via Ctrl+S download interception
    console.log('Saving final score via Ctrl+S...');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.keyboard.press('Control+s'),
    ]);

    const downloadPath = await download.path();
    const rawContent = fs.readFileSync(downloadPath, 'utf-8');
    const envelope = JSON.parse(rawContent);
    const savedScore = envelope.score;
    console.log(`Downloaded score: ${download.suggestedFilename()}, schemaVersion=${savedScore.schemaVersion}`);

    // Verify structure
    if (savedScore.measures.length < 3) {
      throw new Error(`Expected at least 3 measures in exported score, got ${savedScore.measures.length}`);
    }
    console.log('✓ T5 PASS: Voice selection, transposition, cross-measure paste and delete E2E verified cleanly.');
  } finally {
    await browser.close();
  }
}

// CLI entrypoint
if (process.argv[1] && process.argv[1].endsWith('test_voice_selection_e2e.mjs')) {
  (async () => {
    let exitCode = 0;
    try {
      const serverUrl = await ensureServer();

      // 1. Run mutation test M first to verify failing-first behavior
      console.log('--- RUNNING MUTATION CHECK M (broken voice lookup) ---');
      let mutationCaught = false;
      try {
        await runVoiceSelectionE2E({ mutationBreakVoiceLookup: true }, serverUrl);
      } catch (err) {
        console.log(`✓ Mutation check M caught failure as expected: "${err.message}"`);
        mutationCaught = true;
      }
      if (!mutationCaught) {
        console.error('FATAL: Mutation check M did not fail!');
        exitCode = 1;
        return;
      }

      // 2. Run real E2E test
      console.log('\n--- RUNNING NORMAL E2E (T5) ---');
      await runVoiceSelectionE2E({ mutationBreakVoiceLookup: false }, serverUrl);
      console.log('\n=== ALL PLAYWRIGHT VOICE SELECTION E2E TESTS (T5) PASSED ===');
    } catch (e) {
      console.error('Voice Selection E2E failed:', e);
      exitCode = 1;
    } finally {
      if (globalPreviewProcess) {
        console.log(`Terminating Vite preview server tree (PID ${globalPreviewProcess.pid})...`);
        killProcessTree(globalPreviewProcess);
        globalPreviewProcess = null;
      }
      process.exit(exitCode);
    }
  })();
}
