# M7a-3 Closing Report (Review Items F1–F8)

Date: 20.11.2026
Tag: m7a-3
Milestone: M7a-3 (Selection, Clipboard, and Editing by voiceIndex)

---

## E0: Git Log (-6)

Raw output from `docs/review/evidence/e0_git_log.txt`:
```
48c6cf7 docs(review): add verbatim evidence and closing report for M7a-3
1c25291 test(e2e): add voice selection E2E verification, screenshots, and traceability (STEP 4)
6c1cd13 test(core): add voice selection, operation, clipboard, and property tests (T1-T4) (STEP 3)
1fbe0b2 refactor(selection): convert selection, clipboard, and marquee to voiceIndex only (STEP 2)
844b957 fix(core): carry-overs for insertMeasure barlines, orphan processes, marquee fallback mutation, and weak undo assertions (STEP 0)
7e81888 test(core): strengthen property test against T4 mutation, add marquee voice 2 test (D3)
```

---

## F1: Playwright E2E Overhaul & Paste Verification

### a) Screenshot Timing and Async Polling Explanation
- **Earlier behavior**: In the previous test, `02_transposed_and_pasted.png` was taken immediately after `await page.keyboard.press('Control+v')` and a fixed `sleep(300)`. Because `pasteClipboard()` in `src/ui/editor/useEditorSelection.ts` reads `navigator.clipboard.readText()` asynchronously, 300 ms was insufficient for React state dispatch and canvas DOM render to finish. Furthermore, the test immediately pressed `Delete`, which deleted the pasted range back to rests, resulting in screenshots 2 and 3 appearing visually identical.
- **Fix**: Replaced all fixed sleeps with explicit polling via `page.waitForFunction` waiting for:
  1. Score state in `window.__getScoreForTest()` to register pasted notes in measure 3 and measure 4;
  2. SVG DOM elements to render with corresponding `data-event-id` attributes before screenshot 2 is captured;
  3. Deletion to convert notes in measures 3 and 4 back into rests before screenshot 3 is captured.

### b) Three Download Checkpoints (Ctrl+S Interception)
At three critical stages, the test downloads the active score via the real `Ctrl+S` download path, validates the envelope, and compares pitch and barline lists.

#### Checkpoint 1 (After Transpose):
- **Voice 1 (Soprano)**: Unchanged and deep-equals original soprano pitches:
  `["Eb4","G4","Bb4","Bb4","Bb4","Bb4","C5"]`
- **Voice 2 (Alto)**: Transposed exactly +1 semitone up across all 8 notes:
  - Original:   `["Bb3","Eb4","G4","F4","G4","F4","G4","F4"]`
  - Transposed: `["B3","E4","G#4","F#4","G#4","F#4","G#4","F#4"]`
- **EndBarlines**:
  `m.1=single, m.2=single, m.3=final` (m.3 automatically appended by input engine when m.2 was filled).

#### Checkpoint 2 (After Paste):
- **Voice 1 in mm.3-4**: Holds rests only (`v1M2Rests: true`, `v1M3Rests: true`).
- **Voice 2 in mm.3-4**: Contains all 8 transposed quarter notes in order (pitch and duration):
  `[{"pitch":"B3","duration":960},{"pitch":"E4","duration":960},{"pitch":"G#4","duration":960},{"pitch":"F#4","duration":960},{"pitch":"G#4","duration":960},{"pitch":"F#4","duration":960},{"pitch":"G#4","duration":960},{"pitch":"F#4","duration":960}]`
- **EndBarlines**:
  `m.1=single, m.2=single, m.3=single, m.4=final`.

#### Checkpoint 3 (After Delete):
- **Voice 2 in mm.3-4**: Holds rests only (`cp3v2AllRests: true`).
- **Voice 1 in mm.3-4**: Unchanged rests only (`cp3v1AllRests: true`).
- **EndBarlines**:
  `m.1=single, m.2=single, m.3=single, m.4=final`.

### c) Measure 4 Origin Explanation
- **Mechanism**: The copied selection consists of 8 quarter notes = `7680` total ticks.
- In 4/4 meter, Measure 3 has a capacity of `3840` ticks.
- Pasting starts at tick 0 of Measure 3. The first 4 quarter notes (`3840` ticks) completely fill Measure 3.
- The remaining 4 quarter notes (`3840` ticks) automatically spill across the barline. `pasteEvents` appends Measure 4 to accommodate the spill, setting Measure 3's `endBarline` to `'single'` and Measure 4's `endBarline` to `'final'`.

### d) Renamed Screenshots and SHA-256 Hashes
The screenshots have been renamed to `01_selected.png`, `02_pasted.png`, and `03_after_delete.png`. All three have strictly distinct SHA-256 hashes:
- `01_selected.png`:     `43f0c3703789a41148d6f9426ea5ea6a1cee80861b2436b46ed2b1c13aa0fbaa`
- `02_pasted.png`:       `f486c4ebb3ec0b9fc514322de84d35cfa8105a725f580bfd50949cde36e987fa`
- `03_after_delete.png`: `13f447d8c761b7131b92f048d4b2fe6a053903c2059d1c80e88830c9e48e14d9`

### e) Mutation Flag `--mutate-paste-voice-1` Output
Raw verbatim output from `docs/review/evidence/f1_e2e_mutated.txt`:
```
Detected existing Vite dev server running on http://localhost:5173
--- RUNNING E2E WITH MUTATION: --mutate-paste-voice-1 ---

=== Running Playwright Voice Selection E2E ===
Options: mutationBreakVoiceLookup=false, mutatePasteVoice1=true
Navigating to http://localhost:5173...
Configuring fresh 2-measure score in Eb major (-3), 4/4...
MEASURES IMMEDIATELY AFTER CREATE: length=2 [ 'm.1:single', 'm.2:final' ]
Entering note input mode (pressing "n")...
Entering Soprano mm. 1-2...
MEASURES AFTER SOPRANO: length=3 [ 'm.1:single', 'm.2:single', 'm.3:final' ]
Capturing Voice 1 selection screenshot for notehead tint verification (F2)...
Saved Voice 1 selection screenshot: C:\Users\Murat\Desktop\proje_mls1\docs\screenshots\m7a-3\voice1_selection.png
Navigating back to start of m.1...
Switching to Voice 2 via Tab...
Entering Alto mm. 1-2...
MEASURES AFTER ALTO: length=3 [ 'm.1:single', 'm.2:single', 'm.3:final' ]
Exiting to select mode (pressing Escape)...
Clicking first alto note (baa4b806-2506-450b-924c-0b1eb7166b68)...
Shift+clicking last alto note (1d42bd77-9ed9-4d3b-a4bf-96a496f3e5cc)...
Status bar range info: "8 öge seçildi (Ölçü 1–2)"
✓ Status bar correctly displays 8 selected items across measures 1–2.
Saved screenshot 1: C:\Users\Murat\Desktop\proje_mls1\docs\screenshots\m7a-3\01_selected.png
Pressing ArrowUp to transpose all 8 alto notes up one semitone...

--- DOWNLOAD CHECKPOINT: Checkpoint 1 (after transpose) ---
Checkpoint 1 EndBarlines: m.1=single, m.2=single, m.3=final
Checkpoint 1 Voice 1 (Soprano) Pitches: ["Eb4","G4","Bb4","Bb4","Bb4","Bb4","C5"]
Checkpoint 1 Voice 2 Original Alto:   ["Bb3","Eb4","G4","F4","G4","F4","G4","F4"]
Checkpoint 1 Voice 2 Transposed Alto: ["B3","E4","G#4","F#4","G#4","F#4","G#4","F#4"]
✓ Checkpoint 1 verified: Voice 1 untouched, Voice 2 all 8 pitches transposed +1 semitone.
Copying selection via Ctrl+C...
Current measure count before ensuring measure 3: 3
Score has 3 measures.
Switching into input mode and ensuring cursor at measure 3...
Setting cursor voice to 1 for paste (mutatePasteVoice1=true)...
Cursor ready for paste at: { measureIndex: 2, voiceIndex: 1 }
Pasting copied notes via Ctrl+V...
Polling DOM and score until paste renders...
✓ Paste render verified in DOM and score.
Saved screenshot 2: C:\Users\Murat\Desktop\proje_mls1\docs\screenshots\m7a-3\02_pasted.png

--- DOWNLOAD CHECKPOINT: Checkpoint 2 (after paste) ---

Measure 4 Origin Explanation:
  8 quarter notes = 7680 total ticks.
  Measure 3 capacity = 3840 ticks in 4/4 time.
  Pasted notes 1..4 (3840 ticks) fill Measure 3.
  Pasted notes 5..8 (3840 ticks) spill into newly created Measure 4.
  Total measures in score: 4
Checkpoint 2 EndBarlines: m.1=single, m.2=single, m.3=single, m.4=final
Voice Selection E2E failed: Error: MUTATION_FAILURE: Paste went to Voice 1 instead of Voice 2!
    at runVoiceSelectionE2E (file:///C:/Users/Murat/Desktop/proje_mls1/scripts/test_voice_selection_e2e.mjs:531:15)
    at async file:///C:/Users/Murat/Desktop/proje_mls1/scripts/test_voice_selection_e2e.mjs:645:9
```

### f) Clean E2E Run Output
Raw verbatim output from `docs/review/evidence/f1_e2e_clean.txt`:
```
Detected existing Vite dev server running on http://localhost:5173
--- RUNNING MUTATION CHECK M (broken voice lookup) ---

=== Running Playwright Voice Selection E2E ===
Options: mutationBreakVoiceLookup=true, mutatePasteVoice1=false
Navigating to http://localhost:5173...
Configuring fresh 2-measure score in Eb major (-3), 4/4...
MEASURES IMMEDIATELY AFTER CREATE: length=2 [ 'm.1:single', 'm.2:final' ]
Entering note input mode (pressing "n")...
Entering Soprano mm. 1-2...
MEASURES AFTER SOPRANO: length=3 [ 'm.1:single', 'm.2:single', 'm.3:final' ]
Capturing Voice 1 selection screenshot for notehead tint verification (F2)...
Saved Voice 1 selection screenshot: C:\Users\Murat\Desktop\proje_mls1\docs\screenshots\m7a-3\voice1_selection.png
Navigating back to start of m.1...
Switching to Voice 2 via Tab...
Entering Alto mm. 1-2...
MEASURES AFTER ALTO: length=3 [ 'm.1:single', 'm.2:single', 'm.3:final' ]
Exiting to select mode (pressing Escape)...
Clicking first alto note (6e3c9ad5-b379-4d18-8967-067937b678e2)...
Shift+clicking last alto note (5bb28822-35f6-4e2f-8ab5-5ee0815164b4)...
Status bar range info: "1 öge seçildi (Ölçü 2)"
✓ Mutation check M caught failure as expected: "Status bar range text mismatch! Expected "8 öge seçildi (Ölçü 1–2)" or "8 items selected (Measures 1–2)", got: "1 öge seçildi (Ölçü 2)""

--- RUNNING NORMAL E2E (T5) ---

=== Running Playwright Voice Selection E2E ===
Options: mutationBreakVoiceLookup=false, mutatePasteVoice1=false
Navigating to http://localhost:5173...
Configuring fresh 2-measure score in Eb major (-3), 4/4...
MEASURES IMMEDIATELY AFTER CREATE: length=2 [ 'm.1:single', 'm.2:final' ]
Entering note input mode (pressing "n")...
Entering Soprano mm. 1-2...
MEASURES AFTER SOPRANO: length=3 [ 'm.1:single', 'm.2:single', 'm.3:final' ]
Capturing Voice 1 selection screenshot for notehead tint verification (F2)...
Saved Voice 1 selection screenshot: C:\Users\Murat\Desktop\proje_mls1\docs\screenshots\m7a-3\voice1_selection.png
Navigating back to start of m.1...
Switching to Voice 2 via Tab...
Entering Alto mm. 1-2...
MEASURES AFTER ALTO: length=3 [ 'm.1:single', 'm.2:single', 'm.3:final' ]
Exiting to select mode (pressing Escape)...
Clicking first alto note (14a4c3d2-993a-4f34-9b65-468dcecd2a56)...
Shift+clicking last alto note (5d832103-b094-474a-a115-7c3021914cac)...
Status bar range info: "8 öge seçildi (Ölçü 1–2)"
✓ Status bar correctly displays 8 selected items across measures 1–2.
Saved screenshot 1: C:\Users\Murat\Desktop\proje_mls1\docs\screenshots\m7a-3\01_selected.png
Pressing ArrowUp to transpose all 8 alto notes up one semitone...

--- DOWNLOAD CHECKPOINT: Checkpoint 1 (after transpose) ---
Checkpoint 1 EndBarlines: m.1=single, m.2=single, m.3=final
Checkpoint 1 Voice 1 (Soprano) Pitches: ["Eb4","G4","Bb4","Bb4","Bb4","Bb4","C5"]
Checkpoint 1 Voice 2 Original Alto:   ["Bb3","Eb4","G4","F4","G4","F4","G4","F4"]
Checkpoint 1 Voice 2 Transposed Alto: ["B3","E4","G#4","F#4","G#4","F#4","G#4","F#4"]
✓ Checkpoint 1 verified: Voice 1 untouched, Voice 2 all 8 pitches transposed +1 semitone.
Copying selection via Ctrl+C...
Current measure count before ensuring measure 3: 3
Score has 3 measures.
Switching into input mode and ensuring cursor at measure 3...
Setting cursor voice to 2 for paste (mutatePasteVoice1=false)...
Cursor ready for paste at: { measureIndex: 2, voiceIndex: 2 }
Pasting copied notes via Ctrl+V...
Polling DOM and score until paste renders...
✓ Paste render verified in DOM and score.
Saved screenshot 2: C:\Users\Murat\Desktop\proje_mls1\docs\screenshots\m7a-3\02_pasted.png

--- DOWNLOAD CHECKPOINT: Checkpoint 2 (after paste) ---

Measure 4 Origin Explanation:
  8 quarter notes = 7680 total ticks.
  Measure 3 capacity = 3840 ticks in 4/4 time.
  Pasted notes 1..4 (3840 ticks) fill Measure 3.
  Pasted notes 5..8 (3840 ticks) spill into newly created Measure 4.
  Total measures in score: 4
Checkpoint 2 EndBarlines: m.1=single, m.2=single, m.3=single, m.4=final
Checkpoint 2 Voice 1 in m.3 rests only: true
Checkpoint 2 Voice 1 in m.4 rests only: true
Checkpoint 2 Pasted Notes in Voice 2 (mm.3-4): [{"pitch":"B3","duration":960},{"pitch":"E4","duration":960},{"pitch":"G#4","duration":960},{"pitch":"F#4","duration":960},{"pitch":"G#4","duration":960},{"pitch":"F#4","duration":960},{"pitch":"G#4","duration":960},{"pitch":"F#4","duration":960}]
✓ Checkpoint 2 verified: Voice 2 contains all 8 transposed notes across mm.3-4, Voice 1 holds rests.
Pressing Delete to delete pasted voice 2 notes...
Polling DOM and score until notes in mm.3-4 become rests...
✓ Delete render verified in DOM and score.
Saved screenshot 3: C:\Users\Murat\Desktop\proje_mls1\docs\screenshots\m7a-3\03_after_delete.png

--- DOWNLOAD CHECKPOINT: Checkpoint 3 (after delete) ---
Checkpoint 3 Voice 2 in mm.3-4 holds rests only: true
Checkpoint 3 Voice 1 in mm.3-4 unchanged (rests only): true
Checkpoint 3 EndBarlines: m.1=single, m.2=single, m.3=single, m.4=final
✓ Checkpoint 3 verified: Voice 2 in mm.3-4 converted to rests, Voice 1 untouched.

--- SCREENSHOT SHA-256 HASHES ---
01_selected.png:     43f0c3703789a41148d6f9426ea5ea6a1cee80861b2436b46ed2b1c13aa0fbaa
02_pasted.png:       f486c4ebb3ec0b9fc514322de84d35cfa8105a725f580bfd50949cde36e987fa
03_after_delete.png: 13f447d8c761b7131b92f048d4b2fe6a053903c2059d1c80e88830c9e48e14d9
✓ All 3 screenshots have strictly distinct SHA-256 hashes.

✓ T5 PASS: Voice selection, transposition, cross-measure paste and delete E2E verified cleanly.

=== ALL PLAYWRIGHT VOICE SELECTION E2E TESTS (T5) PASSED ===
```

---

## F2: Selection Tint Analysis & Notehead Evidence

### Code Inspection
In `src/ui/ScoreView.tsx:397-406` and `414-424`, selection highlight rules are injected into the SVG stylesheet:
```css
svg g[data-event-id="${id}"] {
  fill: #2563eb !important;
  stroke: #2563eb !important;
}
svg g[data-event-id="${id}"] text {
  fill: #2563eb !important;
}
svg line[data-event-id="${id}"] {
  stroke: #2563eb !important;
}
```
However, notehead glyphs are rendered in `src/render/renderSvg.ts:342` and `src/ui/SystemView.tsx:148` as direct SVG `<use>` elements:
```html
<use data-event-id="${item.eventId}" href="#glyph-noteheadBlack" ... />
```
Because `ScoreView.tsx` targets only `svg g[...]`, `svg g[...] text`, and `svg line[...]`, `<use>` elements are not matched by the `#2563eb` style. As a result, notehead glyphs are rendered in their default black color, and only stems and ledger lines (`<line data-event-id="...">`) are tinted blue. Noteheads were therefore never tinted blue in voice 1 or voice 2.

### Visual Evidence
A screenshot of single-voice Voice 1 selection in a one-voice score was captured and saved to:
`docs/screenshots/m7a-3/voice1_selection.png`
It visually demonstrates that Voice 1 noteheads exhibit the identical behavior: black notehead glyphs with blue stems and ledger lines.

---

## F3: Orphan Process Prevention on Linux

### 1. Raw Output of Spawn Grep
Raw output from `docs/review/evidence/f3_grep_spawn.txt`:
```
scripts/bench.mjs:65:  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
scripts/bench.mjs-66-    shell: isWin,
scripts/bench.mjs-67-    detached: !isWin,
scripts/bench.mjs-68-    stdio: 'pipe',
scripts/bench.mjs-69-  });
scripts/cpu_profile.mjs:67:  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
scripts/cpu_profile.mjs-68-    shell: isWin,
scripts/cpu_profile.mjs-69-    detached: !isWin,
scripts/cpu_profile.mjs-70-    stdio: 'pipe',
scripts/cpu_profile.mjs-71-  });
scripts/multi_bench.mjs:150:  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
scripts/multi_bench.mjs-151-    shell: isWin,
scripts/multi_bench.mjs-152-    detached: !isWin,
scripts/multi_bench.mjs-153-    stdio: 'pipe',
scripts/multi_bench.mjs-154-  });
scripts/smoke.mjs:76:  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
scripts/smoke.mjs-77-    shell: isWin,
scripts/smoke.mjs-78-    detached: !isWin,
scripts/smoke.mjs-79-    stdio: 'ignore',
scripts/smoke.mjs-80-  });
scripts/test_dom_mutations.mjs:68:  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
scripts/test_dom_mutations.mjs-69-    shell: isWin,
scripts/test_dom_mutations.mjs-70-    detached: !isWin,
scripts/test_dom_mutations.mjs-71-    stdio: 'ignore',
scripts/test_dom_mutations.mjs-72-  });
scripts/test_i18n_dom.mjs:134:  previewProcess = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
scripts/test_i18n_dom.mjs-135-    shell: isWin,
scripts/test_i18n_dom.mjs-136-    detached: !isWin,
scripts/test_i18n_dom.mjs-137-    stdio: 'ignore',
scripts/test_i18n_dom.mjs-138-  });
scripts/test_voice_entry_e2e.mjs:179:  globalPreviewProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
scripts/test_voice_entry_e2e.mjs-180-    shell: isWin,
scripts/test_voice_entry_e2e.mjs-181-    detached: !isWin,
scripts/test_voice_entry_e2e.mjs-182-    stdio: 'ignore',
scripts/test_voice_entry_e2e.mjs-183-  });
scripts/test_voice_selection_e2e.mjs:108:  globalPreviewProcess = spawn('npx', ['vite', 'preview', '--port', '4173'], {
scripts/test_voice_selection_e2e.mjs-109-    shell: isWin,
scripts/test_voice_selection_e2e.mjs-110-    detached: !isWin,
scripts/test_voice_selection_e2e.mjs-111-    stdio: 'ignore',
scripts/test_voice_selection_e2e.mjs-112-  });
scripts/trace_and_profile.mjs:67:  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
scripts/trace_and_profile.mjs-68-    shell: isWin,
scripts/trace_and_profile.mjs-69-    detached: !isWin,
scripts/trace_and_profile.mjs-70-    stdio: 'pipe',
scripts/trace_and_profile.mjs-71-  });
```

### 2. Standardized `killProcessTree` Implementation
Every server-spawning script now uses:
```js
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
```

### 3. Workflow Invariant Assertion (.github/workflows/ci.yml)
Added as the final step in `.github/workflows/ci.yml` with `if: always()`:
```yaml
      - name: Verify no orphan background preview or vite processes
        if: always()
        run: |
          echo "Checking for orphan vite processes..."
          if pgrep -af "vite preview|vite.js"; then
            echo "Error: Orphan vite/preview process detected!"
            exit 1
          else
            echo "No orphan vite processes found."
          fi
```

### 4. Real Node Processes Before/After
Raw output from `docs/review/evidence/f3_get_process_real.txt`:
```
=== NODE PROCESSES BEFORE ===

   Id ProcessName StartTime          
   -- ----------- ---------          
12364 node        20.11.2026 01:51:24
17700 node        20.11.2026 01:51:24


=== RUNNING SMOKE TEST ===
Starting Vite preview server for smoke test on port 4198...
Vite preview ready at http://localhost:4198
Loading ScoreForge application...
Switching to Input mode...
Typing 4 notes: C, D, E, F...
Verified SVG event count: 11
Smoke test passed successfully!
=== NODE PROCESSES AFTER ===

   Id ProcessName StartTime          
   -- ----------- ---------          
12364 node        20.11.2026 01:51:24
17700 node        20.11.2026 01:51:24
```
Zero orphan Node processes created.

---

## F4: Mutation Patch Handling and Worktree Isolation

### 1. Stale Patch Failure at HEAD
Raw output from `docs/review/evidence/f4_stale_mutation_output.txt`:
```
=== RUNNING MUTATION TEST: MARQUEE-v1-fallback ===
Patch: C:\Users\Murat\Desktop\proje_mls1\tests\mutations\MARQUEE-v1-fallback.patch
Target test: tests/ui/marquee_voice_selection.test.ts
Creating isolated worktree at C:\Users\Murat\Desktop\proje_mls1\.wt-mutation-MARQUEE-v1-fallback-1795128362700...
Applying patch MARQUEE-v1-fallback.patch to isolated worktree...
ERROR: PATCH DID NOT APPLY: MARQUEE-v1-fallback.patch failed to apply to isolated worktree.
error: patch failed: src/ui/scoreView/useScoreMarquee.ts:98
error: src/ui/scoreView/useScoreMarquee.ts: patch does not apply
```

### 2. Clean Error Handling and Unit Test
- Updated `scripts/runMutation.mjs` to catch `git apply` errors, print `ERROR: PATCH DID NOT APPLY: <patchName> failed to apply to isolated worktree.`, and exit with code 2.
- Added unit test `tests/core/run_mutation_apply.test.ts` to assert that invalid patches fail cleanly with non-zero exit code and descriptive error message.

### 3. Replacement Mutation `MARQUEE-always-v1`
- Deleted stale `tests/mutations/MARQUEE-v1-fallback.patch`.
- Created `tests/mutations/MARQUEE-always-v1.patch` mutating `voiceIndex = 1` in `src/ui/scoreView/useScoreMarquee.ts:99`.
- Raw output from `docs/review/evidence/f4_new_mutation_output.txt`:
```
=== RUNNING MUTATION TEST: MARQUEE-always-v1 ===
Patch: C:\Users\Murat\Desktop\proje_mls1\tests\mutations\MARQUEE-always-v1.patch
Target test: tests/ui/marquee_voice_selection.test.ts
Creating isolated worktree at C:\Users\Murat\Desktop\proje_mls1\.wt-mutation-MARQUEE-always-v1-1795129521767...
Applying patch MARQUEE-always-v1.patch to isolated worktree...
Running test tests/ui/marquee_voice_selection.test.ts in worktree...

Mutation MARQUEE-always-v1 successfully caused test failure as expected.
--- FAILING TESTS ---
 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
 FAIL  tests/ui/marquee_voice_selection.test.ts > D3d & 0.3: Marquee selection on voice 2 > 0.3 useScoreMarquee hook dispatches onSelectRange with voiceIndex: 2 when enclosing voice 2 notes
 FAIL  tests/ui/marquee_voice_selection.test.ts > D3d & 0.3: Marquee selection on voice 2 > T6: marquee enclosing notes of BOTH voices selects ONLY voice of the first-hit event without voiceId

=== MUTATION CHECK MARQUEE-always-v1: PASS (Failure caught cleanly) ===

Cleaning up isolated worktree...
```

---

## F5: Traceability Matrix and Invariant Audits

### 1. `scripts/checkVoiceIdUsage.mjs`
- Created script scanning all files in `src/`.
- Asserts that `voiceId` does not occur outside allowed locations (`src/core/validate.ts` for error location reporting, and `src/io/migrations.ts` for deterministic migration IDs).
- Integrated into `package.json` `"check"` script.
- Mapped to S2 in `docs/design/m7a-3-traceability.json`.

### 2. S6 Navigation Test Added
Added to `tests/core/range_selection.test.ts`:
- `S6: Shift+Right in voice 2 extends within voice 2 and across measures to next measure in same voice`
- Validated passing.

### 3. Traceability Matrices Verification
- `docs/design/m7a-2b-traceability.json`:
  - D9 set to `status: "OUT_OF_SCOPE"`.
  - T5 mapped to `tests/ui/tab_voice_ui.test.tsx` (`Tab in input mode changes the status bar voice text immediately`).
  - T6 mapped to `scripts/test_i18n_dom.mjs` (`Turkish status bar shows "Ses 2" after entering input mode and pressing Tab`).
- `docs/design/m7a-3-traceability.json`:
  - Aligned all rows S1–S9 to exact definitions and test implementations.
  - S9 set to `status: "OUT_OF_SCOPE"`.

Raw output from `docs/review/evidence/f5_check_traceability.txt`:
```
--- Checking Machine Traceability Matrix: schema-v7-traceability.json ---
✓ All 37 DONE traceability rows statically verified against actual test files.
--- Checking Machine Traceability Matrix: m7a-2b-traceability.json ---
[SKIPPED] D9 (OUT_OF_SCOPE)
✓ All 16 DONE traceability rows statically verified against actual test files.
--- Checking Machine Traceability Matrix: m7a-3-traceability.json ---
[PASS] S1 -> tests/core/m7a_voice_selection_ops.test.ts :: "range-selects across m.1 and m.2 strictly in voice 2, excluding voice 1 notes"
[PASS] S2 -> scripts/checkVoiceIdUsage.mjs :: "asserts no voiceId in src/ outside validate.ts and migrations.ts"
[PASS] S3 -> tests/core/m7a_voice_selection_ops.test.ts :: "b) copy 2 notes from voice 2, paste into voice 2 of a measure with ONLY voice 1 -> voice 2 created in 1 undo step, surrounded by rests"
[PASS] S4 -> tests/core/m7a_voice_selection_ops.test.ts :: "delete (notes become rests)"
[PASS] S5 -> tests/ui/marquee_voice_selection.test.ts :: "T6: marquee enclosing notes of BOTH voices selects ONLY voice of the first-hit event without voiceId"
[PASS] S6 -> tests/core/range_selection.test.ts :: "S6: Shift+Right in voice 2 extends within voice 2 and across measures to next measure in same voice"
[PASS] S7 -> tests/core/m7a_voice_selection_ops.test.ts :: "transpose semitone up (+1)"
[PASS] S8 -> tests/core/m7a_voice_selection_ops.test.ts :: "c) copy 2 notes from voice 2, paste into voice 2 that already has content -> replaces content, validateScore 0 errors"
[SKIPPED] S9 (OUT_OF_SCOPE)
[PASS] T1 -> tests/core/m7a_voice_selection_ops.test.ts :: "range-selects across m.1 and m.2 strictly in voice 2, excluding voice 1 notes"
[PASS] T2-transpose-down -> tests/core/m7a_voice_selection_ops.test.ts :: "transpose semitone down (-1)"
[PASS] T2-octave-up -> tests/core/m7a_voice_selection_ops.test.ts :: "transpose octave up (+12)"
[PASS] T2-octave-down -> tests/core/m7a_voice_selection_ops.test.ts :: "transpose octave down (-12)"
[PASS] T2-tie -> tests/core/m7a_voice_selection_ops.test.ts :: "tie (toggleTie on two adjacent same-pitch notes in voice 2)"
[PASS] T2-slur -> tests/core/m7a_voice_selection_ops.test.ts :: "slur (toggleSlur across voice 2 notes)"
[PASS] T2-articulation -> tests/core/m7a_voice_selection_ops.test.ts :: "articulation (toggleArticulation staccato on voice 2)"
[PASS] T2-dynamic -> tests/core/m7a_voice_selection_ops.test.ts :: "dynamic (setDynamic mf on voice 2)"
[PASS] T3-existing -> tests/core/m7a_voice_selection_ops.test.ts :: "c) copy 2 notes from voice 2, paste into voice 2 that already has content -> replaces content, validateScore 0 errors"
[PASS] T6 -> tests/ui/marquee_voice_selection.test.ts :: "T6: marquee enclosing notes of BOTH voices selects ONLY voice of the first-hit event without voiceId"
----------------------------------------------------
✓ All 18 DONE traceability rows statically verified against actual test files.
```

### 4. `schema-v7-traceability.json` Row Count Note
- `docs/design/schema-v7-traceability.json` contains exactly 37 entries both at creation and at HEAD.
- The mention of "38" in the earlier closing report was an errant typographical error in prose; the machine-checked count has always been and remains 37.

---

## F6: Tie Command Voice Lookup & Mutation

### Code Inspection
In `src/core/notationCommands.ts:12, 17, 32, 61`:
```typescript
export function toggleTie(eventId: string, pitchIndex: number = 0): Command {
  return {
    name: 'Toggle Tie',
    apply(score: Score): Score {
      let foundStaffId: string | null = null;
      let foundVoiceIndex = 0;
      ...
      for (const v of sm.voices) {
        const idx = v.events.findIndex((e) => e.id === eventId);
        if (idx !== -1) {
          foundStaffId = staff.id;
          foundVoiceIndex = v.voiceIndex;
          ...
        }
      }
      ...
      const v = sm.voices.find((voice, idx) => (voice.voiceIndex ?? (idx + 1)) === foundVoiceIndex);
```
`toggleTie` receives `(eventId, pitchIndex)` directly. It locates the event within the score hierarchy, extracts `v.voiceIndex`, and queries subsequent measures for matching notes in the same `foundVoiceIndex`. It does not rely on the selection object or selection's voice.

### Mutation `TIE-wrong-voice`
- Created `tests/mutations/TIE-wrong-voice.patch` which mutates line 32 to `foundVoiceIndex = 1;`.
- Raw output from `docs/review/evidence/f6_tie_mutation_output.txt`:
```
=== RUNNING MUTATION TEST: TIE-wrong-voice ===
Patch: C:\Users\Murat\Desktop\proje_mls1\tests\mutations\TIE-wrong-voice.patch
Target test: tests/core/m7a_voice_selection_ops.test.ts
Creating isolated worktree at C:\Users\Murat\Desktop\proje_mls1\.wt-mutation-TIE-wrong-voice-1795129564063...
Applying patch TIE-wrong-voice.patch to isolated worktree...
Running test tests/core/m7a_voice_selection_ops.test.ts in worktree...

Mutation TIE-wrong-voice successfully caused test failure as expected.
--- FAILING TESTS ---
 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
 FAIL  tests/core/m7a_voice_selection_ops.test.ts > M7a-3: Voice 2 Selection, Isolation, Operations and Clipboard (T1, T2, T3) > T2: Operations on voice 2 selection (isolated tests per operation) > tie (toggleTie on two adjacent same-pitch notes in voice 2)

=== MUTATION CHECK TIE-wrong-voice: PASS (Failure caught cleanly) ===

Cleaning up isolated worktree...
```

---

## F7: Seeded Property Test T4 Seeds

In `tests/core/voice_property_m7a3.test.ts`, the seed array is explicitly printed on test execution.
Raw output from `docs/review/evidence/f7_t4_seeds.txt`:
```
stdout | tests/core/voice_property_m7a3.test.ts > T4: Seeded Property Test for Multi-Voice Operations and Clipboard (Rule R6) > verifies 20 seeds x 100 steps of random voice operations, isolation, and undo/redo reversibility
T4 Seeds: [2001,2044,2087,2130,2173,2216,2259,2302,2345,2388,2431,2474,2517,2560,2603,2646,2689,2732,2775,2818]

 ✓ tests/core/voice_property_m7a3.test.ts > T4: Seeded Property Test for Multi-Voice Operations and Clipboard (Rule R6) > verifies 20 seeds x 100 steps of random voice operations, isolation, and undo/redo reversibility 1677ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  02:06:23
   Duration  2.65s (transform 239ms, setup 0ms, collect 302ms, tests 1.68s, environment 0ms, prepare 238ms)
```

---

## F8: Pre-Commit Verification (Rule R5)

Full verification suite executed via `npm run check 2>&1 | Tee-Object docs/review/evidence/f8_npm_check.txt`:
```
> milasi@0.1.0 check
> tsc --noEmit && node scripts/checkImports.mjs && node scripts/checkLicenses.mjs && node scripts/checkSpdx.mjs && node scripts/checkVoiceIdUsage.mjs && node scripts/checkTraceability.mjs && node scripts/generateShortcuts.mjs --check && eslint src/ && npx knip && npm test && npm run build

✓ All folder boundary import rules verified cleanly across 104 files.
--- Production Dependency License Audit ---
- immer@10.2.0 -> [MIT]
- react@18.3.1 -> [MIT]
- react-dom@18.3.1 -> [MIT]
- tone@15.1.22 -> [MIT]
- loose-envify@1.4.0 -> [MIT]
- scheduler@0.23.2 -> [MIT]
- standardized-audio-context@25.3.77 -> [MIT]
- tslib@2.9.1 -> [0BSD]
- js-tokens@4.0.0 -> [MIT]
- @babel/runtime@7.29.13 -> [MIT]
- automation-events@7.1.19 -> [MIT]
Total audited production dependencies: 11

✓ All production dependencies comply with GPL-3.0 compatibility standards (MIT, 0BSD, OFL-1.1).
✓ All 247 source files have valid SPDX GPL-3.0-or-later headers.
PASS: No forbidden 'voiceId' usages found in src/ outside allowed files.
--- Checking Machine Traceability Matrix: schema-v7-traceability.json ---
✓ All 37 DONE traceability rows statically verified against actual test files.
--- Checking Machine Traceability Matrix: m7a-2b-traceability.json ---
✓ All 16 DONE traceability rows statically verified against actual test files.
--- Checking Machine Traceability Matrix: m7a-3-traceability.json ---
✓ All 18 DONE traceability rows statically verified against actual test files.
✓ docs/SHORTCUTS.md is up to date with src/ui/keymap.ts.

 Test Files  100 passed (100)
      Tests  711 passed (711)

> milasi@0.1.0 build
> node scripts/buildGlyphPaths.mjs && tsc && vite build

Bravura loaded: unitsPerEm = 1000, total font glyphs = 3715
Target glyphs to extract: 63
Extracted 63 glyph paths.
Wrote C:\Users\Murat\Desktop\proje_mls1\src\render\glyphPaths.generated.ts successfully (36.1 KB).
vite v5.4.21 building for production...
✓ 1096 modules transformed.
dist/index.html                    1.37 kB │ gzip:   0.63 kB
dist/assets/index-CDy55TNf.js  1,311.93 kB │ gzip: 326.91 kB
✓ built in 5.53s
```
All checks passed cleanly with 0 errors.
