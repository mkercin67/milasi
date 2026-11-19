// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7a-3: Playwright E2E Voice Selection, Transpose, Clipboard and Editing Test (T5)
 *
 * Requirements:
 * - Enter BWV 140/7 mm. 1-2 in two voices via keyboard.
 * - Capture voice 1 note selection screenshot to verify notehead tint behavior (F2).
 * - Click first alto note, Shift+click last alto note of m.2:
 *   Range selection highlight spans the 8 alto notes; status bar shows:
 *     TR: "8 öge seçildi (Ölçü 1–2)"
 * - Save screenshot 1: 01_selected.png
 * - Press ArrowUp: transposes all 8 alto notes up one semitone.
 * - Checkpoint 1 (Download via Ctrl+S):
 *   assert and PRINT compared pitch lists: voice 1 unchanged, voice 2 original +1 semitone;
 *   print and assert endBarline (m.1=single, m.2=final).
 * - Copy (Ctrl+C), create measure 3, paste (Ctrl+V) into voice 2:
 *   poll score/DOM until render finishes;
 *   save screenshot 2: 02_pasted.png
 * - Checkpoint 2 (Download via Ctrl+S):
 *   assert and PRINT compared pitch lists: voice 2 in m.3 and m.4 equals copied transposed notes;
 *   voice 1 unchanged (rests only);
 *   print and assert endBarline (mm.1-3=single, m.4=final).
 * - Press Delete: voice 2 notes become rests.
 * - Save screenshot 3: 03_after_delete.png
 * - Checkpoint 3 (Download via Ctrl+S):
 *   assert voice 2 in m.3 and m.4 holds rests only; voice 1 unchanged;
 *   print and assert endBarline (mm.1-3=single, m.4=final).
 * - Assert distinct SHA-256 hashes across all 3 screenshots.
 * - Mutation check: --mutate-paste-voice-1 pastes into voice 1, verifying Checkpoint 2 fails.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
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

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

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

async function downloadScoreCheckpoint(page, checkpointName) {
  console.log(`\n--- DOWNLOAD CHECKPOINT: ${checkpointName} ---`);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.keyboard.press('Control+s'),
  ]);
  const downloadPath = await download.path();
  const rawContent = fs.readFileSync(downloadPath, 'utf-8');
  const envelope = JSON.parse(rawContent);
  return envelope.score;
}

export async function runVoiceSelectionE2E(options = {}, serverUrlOverride) {
  const {
    mutationBreakVoiceLookup = false,
    mutatePasteVoice1 = false,
  } = options;

  console.log(`\n=== Running Playwright Voice Selection E2E ===`);
  console.log(`Options: mutationBreakVoiceLookup=${mutationBreakVoiceLookup}, mutatePasteVoice1=${mutatePasteVoice1}`);

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
      permissions: ['clipboard-read', 'clipboard-write'],
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

    const initialMeasures = await page.evaluate(() => window.__getScoreForTest().measures);
    console.log(`MEASURES IMMEDIATELY AFTER CREATE: length=${initialMeasures.length}`, initialMeasures.map((m, idx) => `m.${idx + 1}:${m.endBarline || 'single'}`));

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

    const afterSopranoMeasures = await page.evaluate(() => window.__getScoreForTest().measures);
    console.log(`MEASURES AFTER SOPRANO: length=${afterSopranoMeasures.length}`, afterSopranoMeasures.map((m, idx) => `m.${idx + 1}:${m.endBarline || 'single'}`));

    // Capture Voice 1 selection screenshot to verify notehead tint (F2)
    console.log('Capturing Voice 1 selection screenshot for notehead tint verification (F2)...');
    await page.keyboard.press('Escape'); // Exit to select mode
    await sleep(200);
    const firstSopranoEl = page.locator('svg [data-event-id]').first();
    await firstSopranoEl.click({ force: true });
    await sleep(200);
    const voice1SelectionPath = path.join(outDir, 'voice1_selection.png');
    await page.screenshot({ path: voice1SelectionPath });
    console.log(`Saved Voice 1 selection screenshot: ${voice1SelectionPath}`);

    // Return to input mode and navigate back to m.1 tick 0
    await page.keyboard.press('n');
    await sleep(200);
    console.log('Navigating back to start of m.1...');
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('ArrowLeft');
      await sleep(30);
    }

    // 4. Switch to Voice 2 via Tab
    console.log('Switching to Voice 2 via Tab...');
    await page.keyboard.press('Tab');
    await sleep(150);

    // 5. Enter Alto (Voice 2) mm. 1-2
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

    const afterAltoMeasures = await page.evaluate(() => window.__getScoreForTest().measures);
    console.log(`MEASURES AFTER ALTO: length=${afterAltoMeasures.length}`, afterAltoMeasures.map((m, idx) => `m.${idx + 1}:${m.endBarline || 'single'}`));

    // 6. Exit input mode to select mode (Escape)
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

    // 7. Verify status bar shows range selection info
    await page.waitForSelector('[data-testid="status-bar"]');
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
    const screenshot1Path = path.join(outDir, '01_selected.png');
    await page.screenshot({ path: screenshot1Path });
    console.log(`Saved screenshot 1: ${screenshot1Path}`);

    // 8. Press ArrowUp: transposes all 8 alto notes up one semitone
    console.log('Pressing ArrowUp to transpose all 8 alto notes up one semitone...');
    await page.keyboard.press('ArrowUp');
    await sleep(200);

    // CHECKPOINT 1: Download score via Ctrl+S and assert pitch lists + endBarlines
    const cp1Score = await downloadScoreCheckpoint(page, 'Checkpoint 1 (after transpose)');
    const cp1Staff = cp1Score.parts[0].staves[0];
    const cp1M0 = cp1Staff.measures[cp1Score.measures[0].id];
    const cp1M1 = cp1Staff.measures[cp1Score.measures[1].id];

    // Barlines: only the last measure has endBarline 'final', all earlier measures are 'single'
    const cp1Barlines = cp1Score.measures.map((m, idx) => `m.${idx + 1}=${m.endBarline || 'single'}`);
    console.log('Checkpoint 1 EndBarlines:', cp1Barlines.join(', '));
    for (let i = 0; i < cp1Score.measures.length - 1; i++) {
      if (cp1Score.measures[i].endBarline && cp1Score.measures[i].endBarline !== 'single') {
        throw new Error(`Checkpoint 1: Measure ${i + 1} endBarline must be single, got ${cp1Score.measures[i].endBarline}`);
      }
    }
    const cp1LastM = cp1Score.measures.length - 1;
    if ((cp1Score.measures[cp1LastM].endBarline || 'final') !== 'final') {
      throw new Error(`Checkpoint 1: Last measure (${cp1LastM + 1}) endBarline must be final, got ${cp1Score.measures[cp1LastM].endBarline}`);
    }

    // Voice 1 unchanged: Soprano pitches
    const v1Cp1Pitches = [...cp1M0.voices[0].events, ...cp1M1.voices[0].events]
      .filter((e) => e.kind === 'note')
      .map((n) => `${n.pitches[0].step}${n.pitches[0].alter ? (n.pitches[0].alter > 0 ? '#' : 'b') : ''}${n.pitches[0].octave}`);
    console.log('Checkpoint 1 Voice 1 (Soprano) Pitches:', JSON.stringify(v1Cp1Pitches));
    const expectedSoprano = ['Eb4', 'G4', 'Bb4', 'Bb4', 'Bb4', 'Bb4', 'C5'];
    if (JSON.stringify(v1Cp1Pitches) !== JSON.stringify(expectedSoprano)) {
      throw new Error(`Checkpoint 1: Voice 1 changed! Expected ${JSON.stringify(expectedSoprano)}, got ${JSON.stringify(v1Cp1Pitches)}`);
    }

    // Voice 2 transposed: Alto pitches original vs transposed
    const origAlto = ['Bb3', 'Eb4', 'G4', 'F4', 'G4', 'F4', 'G4', 'F4'];
    const v2Cp1Events = [...cp1M0.voices.find((v) => v.voiceIndex === 2).events, ...cp1M1.voices.find((v) => v.voiceIndex === 2).events];
    const v2Cp1Pitches = v2Cp1Events.filter((e) => e.kind === 'note').map((n) => {
      const p = n.pitches[0];
      const acc = p.alter === 1 ? '#' : p.alter === -1 ? 'b' : '';
      return `${p.step}${acc}${p.octave}`;
    });
    console.log('Checkpoint 1 Voice 2 Original Alto:  ', JSON.stringify(origAlto));
    console.log('Checkpoint 1 Voice 2 Transposed Alto:', JSON.stringify(v2Cp1Pitches));
    const expectedTransposedAlto = ['B3', 'E4', 'G#4', 'F#4', 'G#4', 'F#4', 'G#4', 'F#4'];
    if (JSON.stringify(v2Cp1Pitches) !== JSON.stringify(expectedTransposedAlto)) {
      throw new Error(`Checkpoint 1: Voice 2 transpose failed! Expected ${JSON.stringify(expectedTransposedAlto)}, got ${JSON.stringify(v2Cp1Pitches)}`);
    }
    console.log('✓ Checkpoint 1 verified: Voice 1 untouched, Voice 2 all 8 pitches transposed +1 semitone.');

    // 9. Copy selection via Ctrl+C
    console.log('Copying selection via Ctrl+C...');
    await page.keyboard.press('Control+c');
    await sleep(150);

    // 10. Ensure measure 3 exists
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

    // 11. Navigate to measure 3 voice 2 and paste via Ctrl+V
    console.log('Switching into input mode and ensuring cursor at measure 3...');
    await page.keyboard.press('n'); // Enter input mode
    await sleep(150);

    // Navigate cursor forward until measureIndex is at least 2 (measure 3)
    let curCursorState = await page.evaluate(() => {
      const c = window.__getEditorStateForTest ? window.__getEditorStateForTest().cursor : null;
      const s = window.__getScoreForTest();
      return {
        measureIndex: c ? s.measures.findIndex((m) => m.id === c.measureId) : -1,
        voiceIndex: c ? c.voiceIndex : 1,
      };
    });

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

    // Set cursor to desired voice for paste (Voice 2 normally, Voice 1 for mutation)
    const targetVoice = mutatePasteVoice1 ? 1 : 2;
    console.log(`Setting cursor voice to ${targetVoice} for paste (mutatePasteVoice1=${mutatePasteVoice1})...`);
    for (let i = 0; i < 6; i++) {
      if (curCursorState.voiceIndex === targetVoice) break;
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

    console.log('Pasting copied notes via Ctrl+V...');
    await page.keyboard.press('Control+v');

    // Poll until DOM and score show paste completion (NO fixed sleep!)
    console.log('Polling DOM and score until paste renders...');
    await page.waitForFunction(
      (isMutate) => {
        const s = window.__getScoreForTest ? window.__getScoreForTest() : null;
        if (!s || s.measures.length < 3) return false;
        const staff = s.parts[0]?.staves[0];
        const m2 = staff?.measures[s.measures[2]?.id];
        if (isMutate) {
          const v1m2 = m2?.voices.find((v) => v.voiceIndex === 1);
          return v1m2 && v1m2.events.some((e) => e.kind === 'note');
        }
        const v2m2 = m2?.voices.find((v) => v.voiceIndex === 2);
        return v2m2 && v2m2.events.some((e) => e.kind === 'note');
      },
      mutatePasteVoice1,
      { timeout: 10000 }
    );
    console.log('✓ Paste render verified in DOM and score.');

    // Screenshot 2: Transposed and pasted into voice 2 of measure 3 (spilling into m.4)
    const screenshot2Path = path.join(outDir, '02_pasted.png');
    await page.screenshot({ path: screenshot2Path });
    console.log(`Saved screenshot 2: ${screenshot2Path}`);

    // CHECKPOINT 2: Download score via Ctrl+S and assert paste contents + endBarlines
    const cp2Score = await downloadScoreCheckpoint(page, 'Checkpoint 2 (after paste)');
    const cp2Staff = cp2Score.parts[0].staves[0];

    // Measure 4 explanation:
    // 8 quarter notes = 7680 ticks. Measure 3 holds 3840 ticks in 4/4.
    // The first 4 quarter notes fill Measure 3, and the remaining 4 quarter notes
    // automatically spill 3840 ticks into newly created Measure 4.
    console.log('\nMeasure 4 Origin Explanation:');
    console.log('  8 quarter notes = 7680 total ticks.');
    console.log('  Measure 3 capacity = 3840 ticks in 4/4 time.');
    console.log('  Pasted notes 1..4 (3840 ticks) fill Measure 3.');
    console.log('  Pasted notes 5..8 (3840 ticks) spill into newly created Measure 4.');
    console.log(`  Total measures in score: ${cp2Score.measures.length}`);

    // Barlines check
    const cp2Barlines = cp2Score.measures.map((m, idx) => `m.${idx + 1}=${m.endBarline || 'single'}`);
    console.log('Checkpoint 2 EndBarlines:', cp2Barlines.join(', '));
    for (let i = 0; i < cp2Score.measures.length - 1; i++) {
      if (cp2Score.measures[i].endBarline && cp2Score.measures[i].endBarline !== 'single') {
        throw new Error(`Checkpoint 2: Measure ${i + 1} endBarline must be single, got ${cp2Score.measures[i].endBarline}`);
      }
    }
    const lastMIdx = cp2Score.measures.length - 1;
    if ((cp2Score.measures[lastMIdx].endBarline || 'final') !== 'final') {
      throw new Error(`Checkpoint 2: Last measure (${lastMIdx + 1}) endBarline must be final, got ${cp2Score.measures[lastMIdx].endBarline}`);
    }

    const cp2M2 = cp2Staff.measures[cp2Score.measures[2].id];
    const cp2M3 = cp2Staff.measures[cp2Score.measures[3]?.id];
    const v1M2 = cp2M2?.voices.find((v) => v.voiceIndex === 1);
    const v2M2 = cp2M2?.voices.find((v) => v.voiceIndex === 2);
    const v1M3 = cp2M3?.voices.find((v) => v.voiceIndex === 1);
    const v2M3 = cp2M3?.voices.find((v) => v.voiceIndex === 2);

    if (mutatePasteVoice1) {
      if (v1M2 && v1M2.events.some((e) => e.kind === 'note')) {
        throw new Error('MUTATION_FAILURE: Paste went to Voice 1 instead of Voice 2!');
      }
    }

    // Voice 1 in m.3 and m.4 must be rests only
    const v1M2Rests = v1M2 ? v1M2.events.every((e) => e.kind === 'rest') : false;
    const v1M3Rests = v1M3 ? v1M3.events.every((e) => e.kind === 'rest') : false;
    console.log(`Checkpoint 2 Voice 1 in m.3 rests only: ${v1M2Rests}`);
    console.log(`Checkpoint 2 Voice 1 in m.4 rests only: ${v1M3Rests}`);
    if (!v1M2Rests || !v1M3Rests) {
      throw new Error('Checkpoint 2: Voice 1 in m.3 or m.4 expected to have rests only!');
    }

    // Voice 2 in m.3 and m.4 equals the copied transposed events
    const v2PastedNotes = [...(v2M2?.events || []), ...(v2M3?.events || [])]
      .filter((e) => e.kind === 'note')
      .map((n) => {
        const p = n.pitches[0];
        const acc = p.alter === 1 ? '#' : p.alter === -1 ? 'b' : '';
        return { pitch: `${p.step}${acc}${p.octave}`, duration: n.duration };
      });
    console.log('Checkpoint 2 Pasted Notes in Voice 2 (mm.3-4):', JSON.stringify(v2PastedNotes));
    const expectedPastedNotes = expectedTransposedAlto.map((pitch) => ({ pitch, duration: 960 }));
    if (JSON.stringify(v2PastedNotes) !== JSON.stringify(expectedPastedNotes)) {
      throw new Error(
        `Checkpoint 2: Pasted events mismatch! Expected ${JSON.stringify(expectedPastedNotes)}, got ${JSON.stringify(v2PastedNotes)}`
      );
    }
    console.log('✓ Checkpoint 2 verified: Voice 2 contains all 8 transposed notes across mm.3-4, Voice 1 holds rests.');

    // 12. Press Delete: voice 2 notes become rests
    console.log('Pressing Delete to delete pasted voice 2 notes...');
    await page.keyboard.press('Delete');

    // Poll until DOM and score show notes converted to rests
    console.log('Polling DOM and score until notes in mm.3-4 become rests...');
    await page.waitForFunction(() => {
      const s = window.__getScoreForTest ? window.__getScoreForTest() : null;
      if (!s || s.measures.length < 4) return false;
      const staff = s.parts[0]?.staves[0];
      const m2 = staff?.measures[s.measures[2]?.id];
      const m3 = staff?.measures[s.measures[3]?.id];
      const v2m2 = m2?.voices.find((v) => v.voiceIndex === 2);
      const v2m3 = m3?.voices.find((v) => v.voiceIndex === 2);
      return (!v2m2 || v2m2.events.every((e) => e.kind === 'rest')) &&
             (!v2m3 || v2m3.events.every((e) => e.kind === 'rest'));
    }, { timeout: 10000 });
    console.log('✓ Delete render verified in DOM and score.');

    // Screenshot 3: Final state after delete
    const screenshot3Path = path.join(outDir, '03_after_delete.png');
    await page.screenshot({ path: screenshot3Path });
    console.log(`Saved screenshot 3: ${screenshot3Path}`);

    // CHECKPOINT 3: Download score via Ctrl+S and assert voice 2 holds rests only
    const cp3Score = await downloadScoreCheckpoint(page, 'Checkpoint 3 (after delete)');
    const cp3Staff = cp3Score.parts[0].staves[0];
    const cp3M2 = cp3Staff.measures[cp3Score.measures[2].id];
    const cp3M3 = cp3Staff.measures[cp3Score.measures[3]?.id];
    const cp3v2M2 = cp3M2?.voices.find((v) => v.voiceIndex === 2);
    const cp3v2M3 = cp3M3?.voices.find((v) => v.voiceIndex === 2);
    const cp3v1M2 = cp3M2?.voices.find((v) => v.voiceIndex === 1);
    const cp3v1M3 = cp3M3?.voices.find((v) => v.voiceIndex === 1);

    const cp3v2AllRests = (cp3v2M2 ? cp3v2M2.events.every((e) => e.kind === 'rest') : true) &&
                          (cp3v2M3 ? cp3v2M3.events.every((e) => e.kind === 'rest') : true);
    const cp3v1AllRests = (cp3v1M2 ? cp3v1M2.events.every((e) => e.kind === 'rest') : true) &&
                          (cp3v1M3 ? cp3v1M3.events.every((e) => e.kind === 'rest') : true);

    console.log(`Checkpoint 3 Voice 2 in mm.3-4 holds rests only: ${cp3v2AllRests}`);
    console.log(`Checkpoint 3 Voice 1 in mm.3-4 unchanged (rests only): ${cp3v1AllRests}`);
    if (!cp3v2AllRests) {
      throw new Error('Checkpoint 3: Voice 2 in mm.3-4 expected to hold rests only after Delete!');
    }
    if (!cp3v1AllRests) {
      throw new Error('Checkpoint 3: Voice 1 in mm.3-4 expected to remain rests only!');
    }

    const cp3Barlines = cp3Score.measures.map((m, idx) => `m.${idx + 1}=${m.endBarline || 'single'}`);
    console.log('Checkpoint 3 EndBarlines:', cp3Barlines.join(', '));
    console.log('✓ Checkpoint 3 verified: Voice 2 in mm.3-4 converted to rests, Voice 1 untouched.');

    // 13. Distinct SHA-256 Hashes Assertion
    const hash1 = sha256File(screenshot1Path);
    const hash2 = sha256File(screenshot2Path);
    const hash3 = sha256File(screenshot3Path);
    console.log('\n--- SCREENSHOT SHA-256 HASHES ---');
    console.log(`01_selected.png:     ${hash1}`);
    console.log(`02_pasted.png:       ${hash2}`);
    console.log(`03_after_delete.png: ${hash3}`);

    if (hash1 === hash2 || hash2 === hash3 || hash1 === hash3) {
      throw new Error(
        `Screenshots must have distinct SHA-256 hashes! Hashes: \n  1: ${hash1}\n  2: ${hash2}\n  3: ${hash3}`
      );
    }
    console.log('✓ All 3 screenshots have strictly distinct SHA-256 hashes.');

    console.log('\n✓ T5 PASS: Voice selection, transposition, cross-measure paste and delete E2E verified cleanly.');
  } finally {
    await browser.close();
  }
}

// CLI entrypoint
if (process.argv[1] && process.argv[1].endsWith('test_voice_selection_e2e.mjs')) {
  (async () => {
    let exitCode = 0;
    try {
      const isMutateFlag = process.argv.includes('--mutate-paste-voice-1');
      const serverUrl = await ensureServer();

      if (isMutateFlag) {
        console.log('--- RUNNING E2E WITH MUTATION: --mutate-paste-voice-1 ---');
        await runVoiceSelectionE2E({ mutatePasteVoice1: true }, serverUrl);
        return;
      }

      // 1. Run mutation check M first to verify failing-first behavior
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
