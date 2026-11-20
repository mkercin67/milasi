// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * scripts/repro_two_voice_entry.mjs
 *
 * Diagnostic script for Step 0.3 and Step 0.4:
 * S-a: new score, N, quarter in voice 1 at beat 1, Tab, quarter in voice 2.
 * S-b: new score, N, Tab (before any note), four quarters.
 * S-c: Wachet auf fixture, select voice-2 note, N, pitch key.
 * S-d: Wachet auf fixture, select voice-1 note, N, Tab, pitch key.
 * Mouse Click: click on note/rest in input mode.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkServer(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => resolve(res.statusCode === 200)).on('error', () => resolve(false));
  });
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

async function getAppState(page) {
  return await page.evaluate(() => {
    const s = window.__getScoreForTest ? window.__getScoreForTest() : null;
    const ed = window.__getEditorStateForTest ? window.__getEditorStateForTest() : null;
    const statusEl = document.querySelector('[data-testid="status-bar"]');
    const statusVoiceEl = document.querySelector('[data-testid="status-voice-indicator"]');
    const statusRangeEl = document.querySelector('[data-testid="status-range-info"]');

    if (!s) return null;
    const staff = s.parts[0]?.staves[0];
    const m0 = staff?.measures[s.measures[0]?.id];
    const v1 = m0?.voices.find((v) => v.voiceIndex === 1);
    const v2 = m0?.voices.find((v) => v.voiceIndex === 2);

    const summarizeEvents = (events) => {
      if (!events) return [];
      let t = 0;
      const res = [];
      for (const ev of events) {
        if (ev.kind === 'note') {
          const p = ev.pitches?.[0];
          const acc = p?.alter === 1 ? '#' : p?.alter === -1 ? 'b' : '';
          res.push({ tick: t, kind: 'note', pitch: `${p?.step}${acc}${p?.octave}`, dur: ev.duration });
        } else {
          res.push({ tick: t, kind: 'rest', dur: ev.duration });
        }
        t += ev.duration;
      }
      return res;
    };

    return {
      mode: ed?.mode,
      selectedEventId: ed?.selectedEventId,
      cursor: ed?.cursor ? {
        measureIndex: s.measures.findIndex((m) => m.id === ed.cursor.measureId),
        voiceIndex: ed.cursor.voiceIndex,
        tick: ed.cursor.tick,
      } : null,
      statusBarText: statusEl?.innerText?.replace(/\s+/g, ' ').trim() || '',
      voiceIndicatorText: statusVoiceEl?.innerText?.trim() || '',
      rangeInfoText: statusRangeEl?.innerText?.trim() || '',
      m0_v1_events: summarizeEvents(v1?.events),
      m0_v2_events: summarizeEvents(v2?.events),
    };
  });
}

async function createFreshScore(page, serverUrl) {
  await page.goto(serverUrl, { waitUntil: 'networkidle' });
  await sleep(200);
}

async function ensureSelectMode(page) {
  const mode = await page.evaluate(() => (window.__getEditorStateForTest ? window.__getEditorStateForTest().mode : 'select'));
  if (mode !== 'select') {
    await page.keyboard.press('Escape');
    await sleep(100);
  }
}

async function main() {
  const serverUrl = 'http://localhost:5173';
  if (!(await checkServer(serverUrl))) {
    console.error(`Dev server not running at ${serverUrl}`);
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: findChromePath(),
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      locale: 'tr-TR',
    });
    const page = await context.newPage();
    await page.goto(serverUrl, { waitUntil: 'networkidle' });
    await sleep(400);

    console.log('===============================================================');
    console.log('REPRODUCTION STEP 0.3: TWO-VOICE ENTRY SCENARIOS');
    console.log('===============================================================\n');

    // -------------------------------------------------------------
    // SCENARIO S-a:
    // New score, N, quarter in voice 1 at beat 1, Tab, quarter in voice 2.
    // -------------------------------------------------------------
    console.log('--- SCENARIO S-a: New score, N, quarter in voice 1 at beat 1, Tab, quarter in voice 2 ---');
    await createFreshScore(page, serverUrl);
    await ensureSelectMode(page);
    let logSteps = [];

    logSteps.push({ action: 'Initial (after create)', state: await getAppState(page) });

    await page.keyboard.press('n');
    await sleep(100);
    logSteps.push({ action: 'Press "n" (enter input mode)', state: await getAppState(page) });

    await page.keyboard.press('5'); // quarter duration
    await sleep(50);
    logSteps.push({ action: 'Press "5" (set quarter duration)', state: await getAppState(page) });

    await page.keyboard.press('c'); // enter C in voice 1
    await sleep(100);
    logSteps.push({ action: 'Press "c" (enter C in voice 1)', state: await getAppState(page) });

    await page.keyboard.press('Tab'); // switch to voice 2
    await sleep(100);
    logSteps.push({ action: 'Press "Tab" (switch to voice 2)', state: await getAppState(page) });

    await page.keyboard.press('e'); // try enter E in voice 2
    await sleep(100);
    logSteps.push({ action: 'Press "e" (enter E in voice 2)', state: await getAppState(page) });

    for (const step of logSteps) {
      console.log(`[Action: ${step.action}]`);
      console.log(`  Mode: ${step.state.mode}, Cursor: ${JSON.stringify(step.state.cursor)}`);
      console.log(`  Status Bar: "${step.state.statusBarText}"`);
      console.log(`  M.1 Voice 1 Events: ${JSON.stringify(step.state.m0_v1_events)}`);
      console.log(`  M.1 Voice 2 Events: ${JSON.stringify(step.state.m0_v2_events)}\n`);
    }

    // -------------------------------------------------------------
    // SCENARIO S-b:
    // New score, N, Tab (before any note), four quarters.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO S-b: New score, N, Tab (before any note), four quarters ---');
    await createFreshScore(page, serverUrl);
    await ensureSelectMode(page);
    logSteps = [];

    await page.keyboard.press('n');
    await sleep(100);
    logSteps.push({ action: 'Press "n" (enter input mode)', state: await getAppState(page) });

    await page.keyboard.press('Tab');
    await sleep(100);
    logSteps.push({ action: 'Press "Tab" (before any note)', state: await getAppState(page) });

    await page.keyboard.press('5'); // quarter
    await sleep(50);

    for (const noteKey of ['c', 'd', 'e', 'f']) {
      await page.keyboard.press(noteKey);
      await sleep(100);
      logSteps.push({ action: `Press "${noteKey}" (quarter note in voice 2)`, state: await getAppState(page) });
    }

    for (const step of logSteps) {
      console.log(`[Action: ${step.action}]`);
      console.log(`  Mode: ${step.state.mode}, Cursor: ${JSON.stringify(step.state.cursor)}`);
      console.log(`  Status Bar: "${step.state.statusBarText}"`);
      console.log(`  M.1 Voice 1 Events: ${JSON.stringify(step.state.m0_v1_events)}`);
      console.log(`  M.1 Voice 2 Events: ${JSON.stringify(step.state.m0_v2_events)}\n`);
    }

    // -------------------------------------------------------------
    // SCENARIO S-c:
    // The Wachet auf fixture, select a voice-2 note, N, press a pitch key.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO S-c: Wachet auf fixture, select a voice-2 note, N, press a pitch key ---');
    await ensureSelectMode(page);
    // Reset to Wachet auf fixture
    await page.evaluate(() => {
      window.__resetScoreForTest(window.__buildBwv140Reduction());
      window.__selectEventForTest(null);
    });
    await sleep(300);
    await ensureSelectMode(page);
    logSteps = [];

    // Find first voice 2 note event id in measure 1
    const v2NoteId = await page.evaluate(() => {
      const s = window.__getScoreForTest();
      const staff = s.parts[0]?.staves[0];
      const m0 = staff?.measures[s.measures[0]?.id];
      const v2 = m0?.voices.find((v) => v.voiceIndex === 2);
      return v2?.events.find((e) => e.kind === 'note')?.id;
    });
    console.log(`Found voice 2 note ID in Wachet auf m.1: ${v2NoteId}`);

    // Click/select the voice 2 note
    await page.evaluate((id) => window.__selectEventForTest(id), v2NoteId);
    await sleep(100);
    logSteps.push({ action: 'Select voice-2 note', state: await getAppState(page) });

    await page.keyboard.press('n');
    await sleep(100);
    logSteps.push({ action: 'Press "n" (enter input mode from voice-2 note)', state: await getAppState(page) });

    await page.keyboard.press('c'); // press pitch key C
    await sleep(100);
    logSteps.push({ action: 'Press "c" (pitch key)', state: await getAppState(page) });

    for (const step of logSteps) {
      console.log(`[Action: ${step.action}]`);
      console.log(`  Mode: ${step.state.mode}, Cursor: ${JSON.stringify(step.state.cursor)}`);
      console.log(`  Status Bar: "${step.state.statusBarText}"`);
      console.log(`  M.1 Voice 1 Events: ${JSON.stringify(step.state.m0_v1_events)}`);
      console.log(`  M.1 Voice 2 Events: ${JSON.stringify(step.state.m0_v2_events)}\n`);
    }

    // -------------------------------------------------------------
    // SCENARIO S-d:
    // The same fixture, select a voice-1 note, N, Tab, press a pitch key.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO S-d: Wachet auf fixture, select a voice-1 note, N, Tab, press a pitch key ---');
    await ensureSelectMode(page);
    await page.evaluate(() => {
      window.__resetScoreForTest(window.__buildBwv140Reduction());
      window.__selectEventForTest(null);
    });
    await sleep(300);
    await ensureSelectMode(page);
    logSteps = [];

    const v1NoteId = await page.evaluate(() => {
      const s = window.__getScoreForTest();
      const staff = s.parts[0]?.staves[0];
      const m0 = staff?.measures[s.measures[0]?.id];
      const v1 = m0?.voices.find((v) => v.voiceIndex === 1);
      return v1?.events.find((e) => e.kind === 'note')?.id;
    });
    console.log(`Found voice 1 note ID in Wachet auf m.1: ${v1NoteId}`);

    await page.evaluate((id) => window.__selectEventForTest(id), v1NoteId);
    await sleep(100);
    logSteps.push({ action: 'Select voice-1 note', state: await getAppState(page) });

    await page.keyboard.press('n');
    await sleep(100);
    logSteps.push({ action: 'Press "n" (enter input mode from voice-1 note)', state: await getAppState(page) });

    await page.keyboard.press('Tab');
    await sleep(100);
    logSteps.push({ action: 'Press "Tab" (switch to voice 2)', state: await getAppState(page) });

    await page.keyboard.press('c'); // press pitch key C
    await sleep(100);
    logSteps.push({ action: 'Press "c" (pitch key)', state: await getAppState(page) });

    for (const step of logSteps) {
      console.log(`[Action: ${step.action}]`);
      console.log(`  Mode: ${step.state.mode}, Cursor: ${JSON.stringify(step.state.cursor)}`);
      console.log(`  Status Bar: "${step.state.statusBarText}"`);
      console.log(`  M.1 Voice 1 Events: ${JSON.stringify(step.state.m0_v1_events)}`);
      console.log(`  M.1 Voice 2 Events: ${JSON.stringify(step.state.m0_v2_events)}\n`);
    }

    // -------------------------------------------------------------
    // SCENARIO 0.4: MOUSE CLICK IN INPUT MODE
    // -------------------------------------------------------------
    console.log('===============================================================');
    console.log('REPRODUCTION STEP 0.4: MOUSE CLICK IN INPUT MODE');
    console.log('===============================================================\n');

    await ensureSelectMode(page);
    await page.evaluate(() => {
      window.__resetScoreForTest(window.__buildBwv140Reduction());
      window.__selectEventForTest(null);
    });
    await sleep(300);
    await ensureSelectMode(page);

    // Enter input mode
    await page.keyboard.press('n');
    await sleep(100);
    const beforeClickState = await getAppState(page);
    console.log('[Before Mouse Click in Input Mode]');
    console.log(`  Mode: ${beforeClickState.mode}, Cursor: ${JSON.stringify(beforeClickState.cursor)}`);
    console.log(`  SelectedEventId: ${beforeClickState.selectedEventId}`);

    // Click on the second note in Voice 1 or Voice 2
    const targetElement = page.locator('svg [data-event-id]').nth(2);
    const targetEventId = await targetElement.getAttribute('data-event-id');
    console.log(`Clicking on SVG element with data-event-id="${targetEventId}"...`);
    await targetElement.click({ force: true });
    await sleep(200);

    // Test clicking a Voice 2 note specifically
    const v2TargetId = await page.evaluate(() => {
      const s = window.__getScoreForTest();
      const staff = s.parts[0]?.staves[0];
      const m0 = staff?.measures[s.measures[0]?.id];
      const v2 = m0?.voices.find((v) => v.voiceIndex === 2);
      return v2?.events.find((e) => e.kind === 'note')?.id;
    });
    console.log(`\nClicking specifically on Voice 2 note (${v2TargetId}) in input mode...`);
    const v2El = page.locator(`svg [data-event-id="${v2TargetId}"]`).first();
    await v2El.click({ force: true });
    await sleep(200);

    const afterV2ClickState = await getAppState(page);
    console.log('[After Clicking Voice 2 Note in Input Mode]');
    console.log(`  Mode: ${afterV2ClickState.mode}, Cursor: ${JSON.stringify(afterV2ClickState.cursor)}`);
    console.log(`  SelectedEventId: ${afterV2ClickState.selectedEventId}`);
    console.log(`  Did voiceIndex change to 2? cursor.voiceIndex = ${afterV2ClickState.cursor?.voiceIndex}`);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
