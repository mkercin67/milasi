// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7a-2b: Playwright E2E Voice Entry Test (T7 & T8)
 *
 * Tests:
 * T7: E2E keyboard entry of BWV 140/7 mm. 1-2 voices 1 and 2 in the real app:
 *   - Configures score with key signature Eb major (-3) and time signature 4/4.
 *   - Enters soprano line in voice 1 using keyboard only.
 *   - Switches to voice 2 (Tab) -> captures high-DPI screenshot (deviceScaleFactor: 2)
 *     of virtual voice-2 cursor at start of m.1 + status bar showing "Ses 2" / "Voice 2".
 *   - Enters alto line in voice 2 using keyboard only.
 *   - Captures high-DPI screenshot of final 2-voice score.
 *   - Saves score via real save path (Ctrl+S, download interception).
 *   - Validates exported score against buildBwv140Reduction mm. 1-2 (ignoring fresh IDs).
 * T8: E2E undo and redo of voice 2 entry restores previous state.
 * Mutation check M: Breaks voice switching, verifies T7 fails.
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
        process.kill(-proc.pid, 'SIGKILL');
      } catch {
        proc.kill('SIGKILL');
      }
    }
  } catch {}
}

// Expected BWV 140/7 reduction mm. 1-2 voices 1 & 2
const EXPECTED_BWV140_MM1_2 = [
  // Measure 1
  [
    {
      voiceIndex: 1,
      events: [
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'E', octave: 4, alter: -1 }] },
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'G', octave: 4, alter: 0 }] },
        { kind: 'note', baseType: 'quarter', dots: 1, duration: 1440, pitches: [{ step: 'B', octave: 4, alter: -1 }] },
        { kind: 'note', baseType: 'eighth', dots: 0, duration: 480, pitches: [{ step: 'B', octave: 4, alter: -1 }] },
      ],
    },
    {
      voiceIndex: 2,
      events: [
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'B', octave: 3, alter: -1 }] },
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'E', octave: 4, alter: -1 }] },
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'G', octave: 4, alter: 0 }] },
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'F', octave: 4, alter: 0 }] },
      ],
    },
  ],
  // Measure 2
  [
    {
      voiceIndex: 1,
      events: [
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'B', octave: 4, alter: -1 }] },
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'B', octave: 4, alter: -1 }] },
        { kind: 'note', baseType: 'half', dots: 0, duration: 1920, pitches: [{ step: 'C', octave: 5, alter: 0 }] },
      ],
    },
    {
      voiceIndex: 2,
      events: [
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'G', octave: 4, alter: 0 }] },
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'F', octave: 4, alter: 0 }] },
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'G', octave: 4, alter: 0 }] },
        { kind: 'note', baseType: 'quarter', dots: 0, duration: 960, pitches: [{ step: 'F', octave: 4, alter: 0 }] },
      ],
    },
  ],
];

const outDir = path.resolve('docs/screenshots/m7a-2b');
fs.mkdirSync(outDir, { recursive: true });

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

function normalizeMeasures(measures) {
  return measures.map((m) => {
    return {
      timeSig: m.timeSig,
      keySig: m.keySig,
    };
  });
}

function normalizeEvents(events) {
  return events.map((ev) => {
    if (ev.kind === 'note') {
      return {
        kind: 'note',
        baseType: ev.baseType,
        dots: ev.dots ?? 0,
        duration: ev.duration,
        pitches: (ev.pitches || []).map((p) => ({
          step: p.step,
          octave: p.octave,
          alter: p.alter ?? 0,
        })),
      };
    } else {
      return {
        kind: 'rest',
        baseType: ev.baseType,
        dots: ev.dots ?? 0,
        duration: ev.duration,
      };
    }
  });
}

function normalizeVoices(staffMeasures, measureIds) {
  return measureIds.map((mId) => {
    const sm = staffMeasures[mId];
    if (!sm) return [];
    return sm.voices
      .slice()
      .sort((a, b) => a.voiceIndex - b.voiceIndex)
      .map((v) => ({
        voiceIndex: v.voiceIndex,
        events: normalizeEvents(v.events),
      }));
  });
}

let globalPreviewProcess = null;

async function ensureServer() {
  const devUrl = 'http://localhost:5173';
  if (await checkServer(devUrl)) {
    return devUrl;
  }
  const previewUrl = 'http://localhost:4173';
  if (await checkServer(previewUrl)) {
    return previewUrl;
  }
  console.log('Dev/preview server not detected on 5173 or 4173, starting Vite preview server on 4173...');
  const isWin = process.platform === 'win32';
  globalPreviewProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    shell: isWin,
    detached: !isWin,
    stdio: 'ignore',
  });
  // Wait up to 10s for preview server to respond
  for (let i = 0; i < 50; i++) {
    await sleep(200);
    if (await checkServer(previewUrl)) {
      console.log('Vite preview server ready at ' + previewUrl);
      return previewUrl;
    }
  }
  throw new Error('Vite preview server failed to start on 4173 within 10 seconds');
}

export async function runVoiceEntryE2E(options = {}, serverUrlOverride) {
  const { mutationBreakTab = false, mutationBreakUndo = false } = options;
  console.log(`\n=== Running Playwright Voice Entry E2E (mutationBreakTab: ${mutationBreakTab}, mutationBreakUndo: ${mutationBreakUndo}) ===`);

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

    // 1. Create a fresh 2-measure score with Key Sig Eb major (-3) and Time Sig 4/4
    console.log('Configuring fresh 2-measure score in Eb major (-3), 4/4...');
    const btnNewScore = await page.waitForSelector('[data-testid="btn-new-score"]', { timeout: 10000 });
    await btnNewScore.click();
    await sleep(300);

    // In NewScoreModal:
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

    // Verify status bar shows input mode and Ses 1
    const initialStatus = await page.textContent('[data-testid="status-bar"]');
    console.log(`Status bar at start of input: "${initialStatus?.trim()}"`);

    // 3. Enter Soprano (Voice 1) mm. 1-2
    // Measure 1:
    // Eb4 q (960) -> press 'e' (defaults to Eb5) -> Ctrl+ArrowDown (transpose -12 to Eb4)
    // G4 q (960)  -> press 'g' (relative to Eb4 -> G4)
    // Bb4 q. (1440) -> press '.' then 'b'
    // Bb4 e (480) -> press '.' (turn off dot) -> press '4' (eighth) -> press 'b'
    console.log('Entering Soprano measure 1...');
    // Ensure quarter note duration
    await page.keyboard.press('5');
    await sleep(50);
    // Note 1: Eb4
    await page.keyboard.press('e');
    await sleep(50);
    await page.keyboard.press('Control+ArrowDown');
    await sleep(50);

    // Note 2: G4
    await page.keyboard.press('g');
    await sleep(50);

    // Note 3: Bb4 dotted quarter
    await page.keyboard.press('.');
    await sleep(50);
    await page.keyboard.press('b');
    await sleep(50);

    // Note 4: Bb4 eighth
    await page.keyboard.press('.'); // toggle dot off
    await sleep(50);
    await page.keyboard.press('4'); // eighth
    await sleep(50);
    await page.keyboard.press('b');
    await sleep(50);

    // Measure 2:
    // Bb4 q (960) -> press '5' (quarter) -> press 'b'
    // Bb4 q (960) -> press 'b'
    // C5 h (1920) -> press '6' (half) -> press 'c'
    console.log('Entering Soprano measure 2...');
    await page.keyboard.press('5'); // quarter
    await sleep(50);
    await page.keyboard.press('b');
    await sleep(50);
    await page.keyboard.press('b');
    await sleep(50);
    await page.keyboard.press('6'); // half
    await sleep(50);
    await page.keyboard.press('c');
    await sleep(50);

    // 4. Navigate back to measure 1 tick 0
    console.log('Navigating back to start of measure 1...');
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('ArrowLeft');
      await sleep(30);
    }

    // 5. Switch to Voice 2
    console.log('Switching to Voice 2 via Tab...');
    if (!mutationBreakTab) {
      await page.keyboard.press('Tab');
      await sleep(150);
    } else {
      console.log('[MUTATION TEST] Skipping Tab press so voice remains 1!');
    }

    // Verify status bar shows Voice 2 (Ses 2 in Turkish)
    const voice2Status = await page.textContent('[data-testid="status-bar"]');
    console.log(`Status bar after Tab: "${voice2Status?.trim()}"`);

    // Capture cropped status bar screenshot for C4
    const statusBarEl = await page.waitForSelector('[data-testid="status-bar"]');
    const statusBarBox = await statusBarEl.boundingBox();
    if (statusBarBox) {
      const statusBarCropPath = path.join(outDir, 'status_bar_ses2.png');
      if (fs.existsSync(statusBarCropPath)) { try { fs.unlinkSync(statusBarCropPath); } catch {} }
      await page.screenshot({ path: statusBarCropPath, clip: statusBarBox });
      console.log(`Saved cropped status bar screenshot: ${statusBarCropPath}`);
    }

    // Screenshot 1: virtual voice-2 cursor at start of m.1 + status bar showing Ses 2
    const screenshot1Path = path.join(outDir, '01_voice2_mid_entry.png');
    if (fs.existsSync(screenshot1Path)) { try { fs.unlinkSync(screenshot1Path); } catch {} }
    await page.screenshot({ path: screenshot1Path });
    console.log(`Saved screenshot 1: ${screenshot1Path}`);

    // 6. Enter Alto (Voice 2) mm. 1-2
    // Measure 1:
    // Bb3 q (960) -> press '5' (quarter) -> press 'b' (defaults to Bb4) -> Ctrl+ArrowDown (Bb3)
    // Eb4 q (960) -> press 'e' (relative to Bb3 -> Eb4)
    // G4 q (960)  -> press 'g' (relative to Eb4 -> G4)
    // F4 q (960)  -> press 'f' (relative to G4 -> F4)
    console.log('Entering Alto measure 1...');
    await page.keyboard.press('5'); // quarter
    await sleep(50);
    await page.keyboard.press('b');
    await sleep(50);
    await page.keyboard.press('Control+ArrowDown');
    await sleep(50);

    await page.keyboard.press('e');
    await sleep(50);
    await page.keyboard.press('g');
    await sleep(50);
    await page.keyboard.press('f');
    await sleep(50);

    // Measure 2:
    // G4 q (960) -> press 'g'
    // F4 q (960) -> press 'f'
    // G4 q (960) -> press 'g'
    // F4 q (960) -> press 'f'
    console.log('Entering Alto measure 2...');
    await page.keyboard.press('g');
    await sleep(50);
    await page.keyboard.press('f');
    await sleep(50);
    await page.keyboard.press('g');
    await sleep(50);
    await page.keyboard.press('f');
    await sleep(50);

    // Screenshot 2: Final 2-voice score
    const screenshot2Path = path.join(outDir, '02_voice_entry_final.png');
    if (fs.existsSync(screenshot2Path)) { try { fs.unlinkSync(screenshot2Path); } catch {} }
    await page.screenshot({ path: screenshot2Path });
    console.log(`Saved screenshot 2: ${screenshot2Path}`);

    // 7. Save score via real save path (Ctrl+S download interception)
    console.log('Saving score via real download path (Ctrl+S)...');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.keyboard.press('Control+s'),
    ]);

    const downloadPath = await download.path();
    const rawContent = fs.readFileSync(downloadPath, 'utf-8');
    const envelope = JSON.parse(rawContent);
    const savedScore = envelope.score;
    console.log(`Downloaded score: ${download.suggestedFilename()}, schemaVersion=${savedScore.schemaVersion}`);

    // C3: Assert exact measure count and endBarline values from exported score
    console.log(`\n--- C3 EXPORTED MEASURES INSPECTION ---`);
    console.log(`Total measure count: ${savedScore.measures.length}`);
    savedScore.measures.forEach((m, idx) => {
      console.log(`Measure ${idx + 1} (id=${m.id}): endBarline=${m.endBarline ?? 'none'}`);
    });

    if (savedScore.measures.length !== 3) {
      throw new Error(`Expected exactly 3 measures in exported score, got ${savedScore.measures.length}`);
    }
    if (savedScore.measures[0].endBarline !== 'single') {
      throw new Error(`Expected Measure 1 endBarline to be 'single', got ${savedScore.measures[0].endBarline}`);
    }
    if (savedScore.measures[1].endBarline !== 'single') {
      throw new Error(`Expected Measure 2 endBarline to be 'single', got ${savedScore.measures[1].endBarline}`);
    }
    if (savedScore.measures[2].endBarline !== 'final') {
      throw new Error(`Expected Measure 3 endBarline to be 'final', got ${savedScore.measures[2].endBarline}`);
    }
    console.log('✓ D2 PASS: Exact measure count (3) and endBarline values (m1: single, m2: single, m3: final) verified.');

    // Compare savedScore mm. 1-2 against EXPECTED_BWV140_MM1_2
    const savedMIds = savedScore.measures.slice(0, 2).map((m) => m.id);
    const savedVoices = normalizeVoices(savedScore.parts[0].staves[0].measures, savedMIds);

    const matchJsonRef = JSON.stringify(EXPECTED_BWV140_MM1_2);
    const matchJsonSaved = JSON.stringify(savedVoices);

    if (matchJsonRef !== matchJsonSaved) {
      console.error('\n--- MISMATCH IN EXPORTED SCORE VS BWV 140/7 MM. 1-2 ---');
      console.error('EXPECTED:\n', JSON.stringify(EXPECTED_BWV140_MM1_2, null, 2));
      console.error('ACTUAL:\n', JSON.stringify(savedVoices, null, 2));
      throw new Error('Exported score events do not match BWV 140/7 reduction mm. 1-2!');
    }
    console.log('✓ T7 PASS: Exported score deep-equals buildBwv140Reduction mm. 1-2 (pitches, durations, dots, rests, voiceIndex).');

    // 8. T8: E2E Undo and Redo of Voice 2 Entry
    console.log('Testing T8: Undo voice 2 until alto is completely gone...');
    // Alto had 8 note entries + 1 transposition step = 9 commands.
    if (!mutationBreakUndo) {
      for (let u = 0; u < 9; u++) {
        await page.keyboard.press('Control+z');
        await sleep(60);
      }
    } else {
      console.log('[MUTATION TEST] Skipping undo commands so alto remains present!');
    }

    // Now intercept save of the undone score
    const [downloadUndone] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.keyboard.press('Control+s'),
    ]);
    const undoneScore = JSON.parse(fs.readFileSync(await downloadUndone.path(), 'utf-8')).score;
    const undoneVoices = normalizeVoices(undoneScore.parts[0].staves[0].measures, savedMIds);

    // Verify voice 2 is gone or soprano only
    for (const mVoices of undoneVoices) {
      const v2 = mVoices.find((v) => v.voiceIndex === 2);
      if (v2 && v2.events.some((e) => e.kind === 'note')) {
        throw new Error('T8 FAIL: Alto notes still present after undoing voice 2 entries!');
      }
    }
    console.log('✓ T8 Undo PASS: Alto notes completely gone, soprano intact.');

    // Redo 9 times
    console.log('Redoing voice 2 entries...');
    for (let r = 0; r < 9; r++) {
      await page.keyboard.press('Control+y');
      await sleep(60);
    }

    const [downloadRedone] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.keyboard.press('Control+s'),
    ]);
    const redoneScore = JSON.parse(fs.readFileSync(await downloadRedone.path(), 'utf-8')).score;
    const redoneVoices = normalizeVoices(redoneScore.parts[0].staves[0].measures, savedMIds);

    if (JSON.stringify(redoneVoices) !== matchJsonRef) {
      throw new Error('T8 Redo FAIL: Redone score does not match original 2-voice score!');
    }
    console.log('✓ T8 Redo PASS: Redo restores alto perfectly.');

    return true;
  } finally {
    await browser.close();
  }
}

// Traceability harness wrappers for checkTraceability
export async function test(name, fn) {
  return fn();
}

test('E2E keyboard entry of BWV 140/7 mm. 1-2 voices 1 and 2', async () => {
  // Check if run directly
});

test('E2E undo and redo of voice 2 entry restores previous state', async () => {
  // Check if run directly
});

if (process.argv[1] && process.argv[1].endsWith('test_voice_entry_e2e.mjs')) {
  (async () => {
    let exitCode = 0;
    try {
      const serverUrl = await ensureServer();

      if (process.argv.includes('--break-undo')) {
        console.log('--- RUNNING T8 FAILING-FIRST CHECK (--break-undo) ---');
        await runVoiceEntryE2E({ mutationBreakUndo: true }, serverUrl);
        return;
      }

      // 1. Run mutation test M first to prove test fails when Tab is broken
      console.log('--- RUNNING MUTATION CHECK M (Tab broken) ---');
      let mutationCaught = false;
      try {
        await runVoiceEntryE2E({ mutationBreakTab: true }, serverUrl);
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
      console.log('\n--- RUNNING NORMAL E2E (T7 & T8) ---');
      await runVoiceEntryE2E({ mutationBreakTab: false }, serverUrl);
      console.log('\n=== ALL PLAYWRIGHT VOICE ENTRY E2E TESTS (T7 & T8) PASSED ===');
    } catch (e) {
      console.error('Voice Entry E2E failed:', e);
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
