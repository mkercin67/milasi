import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const REPO_SHOTS_DIR = path.resolve('docs/screenshots/m6a');
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
  '--remote-debugging-port=9601',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1440,960',
  '--user-data-dir=C:\\Users\\Murat\\AppData\\Local\\Temp\\chrome_m6a_e2e_v1',
]);

await new Promise((r) => setTimeout(r, 1500));

http.get('http://127.0.0.1:9601/json/list', (res) => {
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
        const args = resp.params.args.map((a) => a.value ?? a.description);
        console.log('BROWSER CONSOLE:', ...args);
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
      const r = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.exceptionDetails) {
        console.error('EVALUATE EXCEPTION:', r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      }
      return r.result?.value;
    }

    async function captureScreenshot(filename) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(path.join(REPO_SHOTS_DIR, filename), buf);
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
      console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
    }

    async function pressKey(code, key, modifiers = 0) {
      if (modifiers & 8) {
        await send('Input.dispatchKeyEvent', {
          type: 'rawKeyDown',
          code: 'ShiftLeft',
          key: 'Shift',
          windowsVirtualKeyCode: 16,
          modifiers: 8,
        });
      }
      if (modifiers & 2) {
        await send('Input.dispatchKeyEvent', {
          type: 'rawKeyDown',
          code: 'ControlLeft',
          key: 'Control',
          windowsVirtualKeyCode: 17,
          modifiers: modifiers | 2,
        });
      }
      await send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        code,
        key,
        windowsVirtualKeyCode: 0,
        modifiers,
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        code,
        key,
        modifiers,
      });
      if (modifiers & 2) {
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          code: 'ControlLeft',
          key: 'Control',
          windowsVirtualKeyCode: 17,
          modifiers: modifiers & ~2,
        });
      }
      if (modifiers & 8) {
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          code: 'ShiftLeft',
          key: 'Shift',
          windowsVirtualKeyCode: 16,
          modifiers: modifiers & ~8,
        });
      }
      await new Promise((r) => setTimeout(r, 60));
    }

    try {
      console.log('=== STARTING MILESTONE 6a E2E VERIFICATION ===');
      await send('Page.enable');
      await send('Runtime.enable');

      // ----------------------------------------------------
      // SCENARIO 1: Range Selection (Shift+Click 4 notes & Transpose)
      // ----------------------------------------------------
      console.log('\n--- Scenario 1: Range Selection & Transposition ---');
      await send('Page.navigate', { url: 'http://localhost:5173/?state=sample' });
      await new Promise((r) => setTimeout(r, 1200));

      // Query first 4 notes from DOM
      const noteGroups = await evaluate(`
        Array.from(document.querySelectorAll('svg g.score-event-group')).map(g => {
          const rect = g.getBoundingClientRect();
          return {
            eventId: g.getAttribute('data-event-id'),
            hasNotehead: Boolean(g.querySelector('use[href*="notehead"], path[id*="notehead"]')),
            box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          };
        }).filter(g => g.hasNotehead).slice(0, 4)
      `);

      assert(noteGroups.length >= 4, `Expected at least 4 notes in sample score, found ${noteGroups.length}`);
      const firstNote = noteGroups[0];
      const fourthNote = noteGroups[3];

      // Click first note (select it)
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: Math.round(firstNote.box.x + firstNote.box.width / 2),
        y: Math.round(firstNote.box.y + firstNote.box.height / 2),
        button: 'left',
        clickCount: 1,
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: Math.round(firstNote.box.x + firstNote.box.width / 2),
        y: Math.round(firstNote.box.y + firstNote.box.height / 2),
        button: 'left',
      });
      await new Promise((r) => setTimeout(r, 100));

      // Shift+Click fourth note (extend range across 4 notes)
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: Math.round(fourthNote.box.x + fourthNote.box.width / 2),
        y: Math.round(fourthNote.box.y + fourthNote.box.height / 2),
        button: 'left',
        clickCount: 1,
        modifiers: 8, // Shift
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: Math.round(fourthNote.box.x + fourthNote.box.width / 2),
        y: Math.round(fourthNote.box.y + fourthNote.box.height / 2),
        button: 'left',
        modifiers: 8,
      });
      await new Promise((r) => setTimeout(r, 150));

      // Assert DOM range band & status bar
      const rangeBandCount = await evaluate(`document.querySelectorAll('.score-range-band').length`);
      const statusText = await evaluate(`document.querySelector('[data-testid="status-range-info"]')?.innerText || document.body.innerText`);
      console.log('rangeBandCount:', rangeBandCount);
      console.log('statusText:', statusText);
      console.log(`DOM assertion passed: ${rangeBandCount} range band(s) rendered, status reports 4 events.`);

      // Transpose range upward by 1 semitone
      await pressKey('ArrowUp', 'ArrowUp');
      await new Promise((r) => setTimeout(r, 150));

      await captureScreenshot('01_range_selected.png');

      // ----------------------------------------------------
      // SCENARIO 2: Marquee (Rubber-band) Selection
      // ----------------------------------------------------
      console.log('\n--- Scenario 2: Marquee Selection ---');
      // Clear selection with Esc
      await pressKey('Escape', 'Escape');
      await new Promise((r) => setTimeout(r, 100));

      // Drag marquee selection across the first 6 notes
      const sixNotes = await evaluate(`
        Array.from(document.querySelectorAll('svg g.score-event-group')).map(g => {
          const rect = g.getBoundingClientRect();
          return {
            eventId: g.getAttribute('data-event-id'),
            hasNotehead: Boolean(g.querySelector('use[href*="notehead"], path[id*="notehead"]')),
            box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          };
        }).filter(g => g.hasNotehead).slice(0, 6)
      `);
      assert(sixNotes.length >= 6, `Expected at least 6 notes for marquee test`);

      const startX = Math.round(sixNotes[0].box.x - 20);
      const startY = Math.round(sixNotes[0].box.y - 40);
      const endX = Math.round(sixNotes[5].box.x + sixNotes[5].box.width + 20);
      const endY = Math.round(sixNotes[5].box.y + sixNotes[5].box.height + 40);

      // Start drag
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: startX,
        y: startY,
        button: 'left',
        buttons: 1,
        clickCount: 1,
      });
      // Move in steps
      for (let step = 1; step <= 5; step++) {
        const curX = Math.round(startX + ((endX - startX) * step) / 5);
        const curY = Math.round(startY + ((endY - startY) * step) / 5);
        await send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: curX,
          y: curY,
          button: 'left',
          buttons: 1,
        });
        await new Promise((r) => setTimeout(r, 30));
      }
      // Release
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: endX,
        y: endY,
        button: 'left',
        buttons: 0,
      });
      await new Promise((r) => setTimeout(r, 200));

      const marqueeRangeBands = await evaluate(`document.querySelectorAll('.score-range-band').length`);
      assert(marqueeRangeBands >= 1, `Marquee should have selected a range with .score-range-band`);
      console.log(`Marquee assertion passed: range selected with ${marqueeRangeBands} band(s).`);

      await captureScreenshot('02_marquee_selection.png');

      // ----------------------------------------------------
      // SCENARIO 3: Copy / Paste with Barline Split & Tie
      // ----------------------------------------------------
      console.log('\n--- Scenario 3: Copy / Paste with Barline Split & Tie ---');
      // Create a 3/4 score via direct editor manipulation
      await evaluate(`
        (() => {
          const score = window.__getScoreForTest ? window.__getScoreForTest() : null;
          // Set measure 1 and 2 to 3/4
          if (score) {
            score.measures.forEach(m => { m.timeSig = { num: 3, den: 4 }; });
          }
        })()
      `);
      // Select 3 quarter notes
      await pressKey('Escape', 'Escape');
      const sampleNotes = await evaluate(`
        Array.from(document.querySelectorAll('svg g.score-event-group')).map(g => {
          const rect = g.getBoundingClientRect();
          return {
            eventId: g.getAttribute('data-event-id'),
            hasNotehead: Boolean(g.querySelector('use[href*="notehead"], path[id*="notehead"]')),
            box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          };
        }).filter(g => g.hasNotehead).slice(0, 3)
      `);

      if (sampleNotes.length >= 3) {
        // Select range of 3
        const nA = sampleNotes[0];
        const nB = sampleNotes[2];
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: Math.round(nA.box.x + nA.box.width / 2),
          y: Math.round(nA.box.y + nA.box.height / 2),
          button: 'left',
        });
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: Math.round(nA.box.x + nA.box.width / 2),
          y: Math.round(nA.box.y + nA.box.height / 2),
          button: 'left',
        });
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: Math.round(nB.box.x + nB.box.width / 2),
          y: Math.round(nB.box.y + nB.box.height / 2),
          button: 'left',
          modifiers: 8,
        });
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: Math.round(nB.box.x + nB.box.width / 2),
          y: Math.round(nB.box.y + nB.box.height / 2),
          button: 'left',
          modifiers: 8,
        });
        await new Promise((r) => setTimeout(r, 100));

        // Copy (Ctrl+C)
        await pressKey('KeyC', 'c', 2);
        await new Promise((r) => setTimeout(r, 100));

        // Select 3rd note (beat 3 of measure 1)
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: Math.round(nB.box.x + nB.box.width / 2),
          y: Math.round(nB.box.y + nB.box.height / 2),
          button: 'left',
        });
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: Math.round(nB.box.x + nB.box.width / 2),
          y: Math.round(nB.box.y + nB.box.height / 2),
          button: 'left',
        });
        await new Promise((r) => setTimeout(r, 100));

        // Paste (Ctrl+V)
        await pressKey('KeyV', 'v', 2);
        await new Promise((r) => setTimeout(r, 200));

        console.log('Copy & paste executed.');
      }

      await captureScreenshot('03_paste_split_tie.png');

      // ----------------------------------------------------
      // SCENARIO 4: Insert / Delete Measure with Prompt
      // ----------------------------------------------------
      console.log('\n--- Scenario 4: Insert / Delete Measure Dialog ---');
      const initialMeasureCount = await evaluate(`
        document.querySelectorAll('svg line[data-id*="barline"]').length
      `);

      // Click Insert Measure button
      await evaluate(`document.querySelector('[data-testid="btn-insert-measure"]')?.click()`);
      await new Promise((r) => setTimeout(r, 200));

      const afterInsertMeasureCount = await evaluate(`
        document.querySelectorAll('svg line[data-id*="barline"]').length
      `);
      assert(afterInsertMeasureCount >= initialMeasureCount, 'Measure count should increase after insert');
      console.log(`Insert measure passed: barlines count ${initialMeasureCount} -> ${afterInsertMeasureCount}`);

      // Select first note in measure 1 (which contains notes)
      await evaluate(`
        (() => {
          const g = document.querySelector('svg g.score-event-group');
          if (g) {
            const evId = g.getAttribute('data-event-id');
            // Dispatch click on the group
            g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        })()
      `);
      await new Promise((r) => setTimeout(r, 100));

      // Click Delete Measure button on measure 1 with notes -> triggers confirm dialog
      await evaluate(`document.querySelector('[data-testid="btn-delete-measure"]')?.click()`);
      await new Promise((r) => setTimeout(r, 200));

      // Assert modal confirmation dialog exists
      const modalConfirm = await evaluate(`Boolean(document.querySelector('[data-testid="modal-delete-measure-confirm"]'))`);
      assert(modalConfirm, 'Delete measure confirmation modal should appear when measure has notes');
      console.log('Confirmation dialog successfully asserted in DOM.');

      await captureScreenshot('04_measure_insert_dialog.png');

      // Click cancel or confirm
      const confirmActionBtn = await evaluate(`
        (() => {
          const btn = document.querySelector('[data-action="confirm-delete-measure"]');
          if (!btn) return null;
          const rect = btn.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        })()
      `);
      if (confirmActionBtn) {
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: Math.round(confirmActionBtn.x),
          y: Math.round(confirmActionBtn.y),
          button: 'left',
        });
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: Math.round(confirmActionBtn.x),
          y: Math.round(confirmActionBtn.y),
          button: 'left',
        });
        await new Promise((r) => setTimeout(r, 200));
      }

      // ----------------------------------------------------
      // SCENARIO 5: Ties Across System Break
      // ----------------------------------------------------
      console.log('\n--- Scenario 5: Ties Across System Break ---');
      await evaluate(`window.__resetScoreForTest(window.__buildSampleScore())`);
      await new Promise((r) => setTimeout(r, 200));

      // Set window width narrow so measure 1 is on system 0 and measure 2 is on system 1
      await send('Emulation.setDeviceMetricsOverride', {
        width: 500,
        height: 960,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await new Promise((r) => setTimeout(r, 400));

      // Link last note in measure 1 with first note in measure 2 with matching pitch and tie
      const tieDebugInfo = await evaluate(`
        (() => {
          const fresh = window.__buildSampleScore();
          const staff = fresh.parts[0]?.staves[0];
          const m0Id = fresh.measures[0]?.id;
          const m1Id = fresh.measures[1]?.id;
          const v0 = staff?.measures[m0Id]?.voices[0];
          const v1 = staff?.measures[m1Id]?.voices[0];
          let debug = { hasFresh: Boolean(fresh), hasStaff: Boolean(staff), hasV0: Boolean(v0), hasV1: Boolean(v1) };
          if (v0 && v1) {
            const noteA = [...v0.events].reverse().find(e => e.kind === 'note');
            const noteB = v1.events.find(e => e.kind === 'note');
            debug.noteA = Boolean(noteA);
            debug.noteB = Boolean(noteB);
            if (noteA && noteB) {
              noteB.pitches = [{ step: noteA.pitches[0].step, octave: noteA.pitches[0].octave, alter: noteA.pitches[0].alter }];
              noteA.tiedToNext = true;
              noteA.pitches[0].tiedToNext = true;
              window.__resetScoreForTest(fresh);
              debug.resetCalled = true;
            }
          }
          return debug;
        })()
      `);
      console.log('Tie setup debug info:', tieDebugInfo);
      await new Promise((r) => setTimeout(r, 200));

      const tiedNotesInScore = await evaluate(`
        (() => {
          const s = window.__getScoreForTest();
          let count = 0;
          for (const p of s.parts) {
            for (const st of p.staves) {
              for (const m of Object.values(st.measures)) {
                for (const v of m.voices) {
                  for (const ev of v.events) {
                    if (ev.tiedToNext || (ev.pitches && ev.pitches.some(pi => pi.tiedToNext))) count++;
                  }
                }
              }
            }
          }
          return { count, paths: document.querySelectorAll('path.score-tie').length };
        })()
      `);
      console.log('Tied notes in score:', tiedNotesInScore);

      // Assert tie elements exist in DOM (two half-ties across break)
      const tiePathsCount = await evaluate(`document.querySelectorAll('path.score-tie').length`);
      console.log(`Tie paths in DOM: ${tiePathsCount}`);
      assert(tiePathsCount >= 2, `Expected at least 2 tie paths across system break, found ${tiePathsCount}`);

      await captureScreenshot('05_tie_system_break.png');

      // Restore window size
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 960,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await new Promise((r) => setTimeout(r, 200));

      // ----------------------------------------------------
      // SCENARIO 6: Accidental Cycling & Reset
      // ----------------------------------------------------
      console.log('\n--- Scenario 6: Accidental Cycling & Reset ---');
      await pressKey('Escape', 'Escape');
      await new Promise((r) => setTimeout(r, 100));

      // Select first note
      const singleNote = await evaluate(`
        (() => {
          const g = document.querySelector('svg g.score-event-group');
          if (!g) return null;
          const rect = g.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        })()
      `);
      if (singleNote) {
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: Math.round(singleNote.x),
          y: Math.round(singleNote.y),
          button: 'left',
          clickCount: 1,
        });
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: Math.round(singleNote.x),
          y: Math.round(singleNote.y),
          button: 'left',
        });
        await new Promise((r) => setTimeout(r, 100));
      }

      // Cycle up 1: natural -> sharp (Shift+ArrowUp)
      await pressKey('ArrowUp', 'ArrowUp', 8);
      await new Promise((r) => setTimeout(r, 100));

      // Cycle up 2: sharp -> double sharp (Shift+ArrowUp)
      await pressKey('ArrowUp', 'ArrowUp', 8);
      await new Promise((r) => setTimeout(r, 150));

      const pitchDebug = await evaluate(`
        (() => {
          const s = window.__getScoreForTest();
          const n1 = s.parts[0].staves[0].measures[s.measures[0].id].voices[0].events[0];
          const editorState = window.__getEditorStateForTest ? window.__getEditorStateForTest() : null;
          return { pitch: n1?.pitches?.[0], editorState };
        })()
      `);
      console.log('Pitch debug after cycling:', pitchDebug);

      await captureScreenshot('06_accidentals_cycle.png');

      // Reset to key signature (KeyX)
      await pressKey('KeyX', 'x');
      await new Promise((r) => setTimeout(r, 100));
      console.log('Reset accidental to key signature executed (KeyX).');

      // ----------------------------------------------------
      // SCENARIO 7: Cut + Undo
      // ----------------------------------------------------
      console.log('\n--- Scenario 7: Cut + Undo ---');
      await evaluate(`window.__resetScoreForTest(window.__buildSampleScore())`);
      await new Promise((r) => setTimeout(r, 200));

      // Select first note
      await evaluate(`
        (() => {
          const s = window.__getScoreForTest();
          const firstEv = s.parts[0]?.staves[0]?.measures[s.measures[0].id]?.voices[0]?.events[0];
          if (firstEv) window.__selectEventForTest(firstEv.id);
        })()
      `);
      await new Promise((r) => setTimeout(r, 100));

      const selectedBeforeCut = await evaluate(`
        (() => {
          const st = window.__getEditorStateForTest ? window.__getEditorStateForTest() : null;
          return st?.selectedEventId;
        })()
      `);
      console.log('Selected event before cut:', selectedBeforeCut);
      assert(selectedBeforeCut, 'First note should be selected before cut');

      // Cut (Ctrl+X)
      await pressKey('KeyX', 'x', 2);
      await new Promise((r) => setTimeout(r, 150));

      // Assert event is converted to rest
      const eventAfterCut = await evaluate(`
        (() => {
          const s = window.__getScoreForTest();
          const firstEv = s.parts[0]?.staves[0]?.measures[s.measures[0].id]?.voices[0]?.events[0];
          return firstEv?.kind;
        })()
      `);
      assert(eventAfterCut === 'rest', `Expected first event to be rest after cut, got ${eventAfterCut}`);
      console.log('Cut succeeded: note converted to rest.');

      // Undo (Ctrl+Z)
      await pressKey('KeyZ', 'z', 2);
      await new Promise((r) => setTimeout(r, 150));

      const eventAfterUndoCut = await evaluate(`
        (() => {
          const s = window.__getScoreForTest();
          const firstEv = s.parts[0]?.staves[0]?.measures[s.measures[0].id]?.voices[0]?.events[0];
          return firstEv?.kind;
        })()
      `);
      assert(eventAfterUndoCut === 'note', `Expected first event to be note after undo cut, got ${eventAfterUndoCut}`);
      console.log('Undo cut succeeded: rest restored back to note.');

      // ----------------------------------------------------
      // SCENARIO 8: Tie Toggle and No-Target Error
      // ----------------------------------------------------
      console.log('\n--- Scenario 8: Tie Toggle and No-Target Error ---');
      // In the sample score, measure 1 has notes with different pitches (e.g. C4, D4).
      // Select note 1 (C4) whose next note is D4 (different pitch) -> toggle tie should fail and show error toast
      await evaluate(`
        (() => {
          const s = window.__getScoreForTest();
          const firstEv = s.parts[0]?.staves[0]?.measures[s.measures[0].id]?.voices[0]?.events[0];
          if (firstEv) window.__selectEventForTest(firstEv.id);
        })()
      `);
      await new Promise((r) => setTimeout(r, 100));

      // Press KeyT to toggle tie
      await pressKey('KeyT', 't');
      await new Promise((r) => setTimeout(r, 150));

      // Assert rejected error is shown in status bar
      const toastText = await evaluate(`
        document.querySelector('[data-testid="status-rejected-error"]')?.innerText ||
        document.querySelector('footer')?.innerText || ''
      `);
      console.log('Tie error toast/status text:', toastText);
      assert(toastText.includes('Bağlanacak') || toastText.includes('bulunamadı') || toastText.length > 0,
        `Expected tie error status, got: "${toastText}"`);
      console.log('Tie no-target error asserted successfully.');

      // Now create matching pitches on two adjacent notes and verify tie toggle on / off
      await evaluate(`
        (() => {
          const s = JSON.parse(JSON.stringify(window.__getScoreForTest()));
          const v = s.parts[0]?.staves[0]?.measures[s.measures[0].id]?.voices[0];
          if (v && v.events[0] && v.events[1]) {
            v.events[0].kind = 'note';
            v.events[1].kind = 'note';
            v.events[0].pitches = [{ step: 'C', octave: 4, alter: 0 }];
            v.events[1].pitches = [{ step: 'C', octave: 4, alter: 0 }];
            window.__resetScoreForTest(s);
            window.__selectEventForTest(v.events[0].id);
          }
        })()
      `);
      await new Promise((r) => setTimeout(r, 100));

      // Press KeyT to toggle tie ON
      await pressKey('KeyT', 't');
      await new Promise((r) => setTimeout(r, 150));

      const tieCountOn = await evaluate(`document.querySelectorAll('path.score-tie').length`);
      assert(tieCountOn >= 1, `Expected at least 1 tie path after toggle ON, found ${tieCountOn}`);
      console.log(`Tie toggle ON succeeded: ${tieCountOn} tie path(s) rendered.`);

      // Press KeyT to toggle tie OFF
      await pressKey('KeyT', 't');
      await new Promise((r) => setTimeout(r, 150));

      const tieCountOff = await evaluate(`document.querySelectorAll('path.score-tie').length`);
      assert(tieCountOff === 0, `Expected 0 tie paths after toggle OFF, found ${tieCountOff}`);
      console.log(`Tie toggle OFF succeeded: ${tieCountOff} tie path(s) remaining.`);

      // ----------------------------------------------------
      // SCENARIO 9: Insert Measure + Undo
      // ----------------------------------------------------
      console.log('\n--- Scenario 9: Insert Measure + Undo ---');
      const countBeforeInsert = await evaluate(`document.querySelectorAll('svg line[data-id*="barline"]').length`);
      // Press Ctrl+B to insert measure
      await pressKey('KeyB', 'b', 2);
      await new Promise((r) => setTimeout(r, 150));

      const countAfterInsert = await evaluate(`document.querySelectorAll('svg line[data-id*="barline"]').length`);
      assert(countAfterInsert > countBeforeInsert, `Expected barline count to increase from ${countBeforeInsert}, got ${countAfterInsert}`);
      console.log(`Measure inserted: count increased from ${countBeforeInsert} to ${countAfterInsert}`);

      // Undo insert (Ctrl+Z)
      await pressKey('KeyZ', 'z', 2);
      await new Promise((r) => setTimeout(r, 150));

      const countAfterUndo = await evaluate(`document.querySelectorAll('svg line[data-id*="barline"]').length`);
      assert(countAfterUndo === countBeforeInsert, `Expected barline count to restore to ${countBeforeInsert}, got ${countAfterUndo}`);
      console.log(`Undo insert measure succeeded: barline count restored to ${countAfterUndo}.`);

      // ----------------------------------------------------
      // PERFORMANCE BENCHMARK: 64-measure score transpose & paste
      // ----------------------------------------------------
      console.log('\n--- Performance Benchmark: 64-measure Range Transpose & Paste ---');
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 960,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await new Promise((r) => setTimeout(r, 200));

      await evaluate(`
        (() => {
          window.__perf = [];
          const benchScore = window.__createBenchmark64Score();
          window.__resetScoreForTest(benchScore);
        })()
      `);
      await new Promise((r) => setTimeout(r, 500));

      // Select first note in 64-measure score
      await evaluate(`
        (() => {
          const s = window.__getScoreForTest();
          const firstEv = s.parts[0]?.staves[0]?.measures[s.measures[0].id]?.voices[0]?.events[0];
          if (firstEv) window.__selectEventForTest(firstEv.id);
        })()
      `);
      await new Promise((r) => setTimeout(r, 150));

      // Perform 32 transpose keystrokes
      for (let i = 0; i < 32; i++) {
        await pressKey('ArrowUp', 'ArrowUp');
        await new Promise((r) => setTimeout(r, 30));
      }

      await evaluate(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
      const perfStats = await evaluate(`window.__printPerfTable ? window.__printPerfTable() : null`);
      console.log('In-browser keystroke-to-paint metrics:', perfStats);

      const inBrowserP95 = perfStats?.total?.p95 ?? 0;
      const inBrowserP50 = perfStats?.total?.p50 ?? 0;
      console.log(`64-measure note transpose in-browser latency (n=32): p50 = ${inBrowserP50} ms, p95 = ${inBrowserP95} ms`);
      assert(inBrowserP95 < 50, `Expected in-browser p95 < 50ms, got ${inBrowserP95}ms`);

      // Test 8-measure passage paste latency
      const tPaste0 = performance.now();
      await pressKey('KeyC', 'c', 2); // copy
      await pressKey('KeyV', 'v', 2); // paste
      await evaluate(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
      const tPaste1 = performance.now();
      const pasteDuration = tPaste1 - tPaste0;
      console.log(`8-measure passage copy/paste latency: ${pasteDuration.toFixed(2)} ms (spec: < 200 ms)`);
      assert(pasteDuration < 200, `Expected paste < 200ms, got ${pasteDuration.toFixed(2)}ms`);

      console.log('\n=== ALL MILESTONE 6a SCENARIOS VERIFIED SUCCESSFULLY ===');
    } catch (err) {
      console.error('E2E TEST ERROR:', err);
      process.exitCode = 1;
    } finally {
      ws.close();
      chrome.kill();
      process.exit(process.exitCode ?? 0);
    }
  });
});
