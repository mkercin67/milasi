# M7a-3 Closing Report: Selection, Clipboard and Operations by voiceIndex

This report provides verbatim evidence, raw outputs, and traceability for Milestone M7a-3.

---

## E0 — `git --no-pager log --oneline -6` (raw)

```
1c25291 test(e2e): add voice selection E2E verification, screenshots, and traceability (STEP 4)
6c1cd13 test(core): add voice selection, operation, clipboard, and property tests (T1-T4) (STEP 3)
1fbe0b2 refactor(selection): convert selection, clipboard, and marquee to voiceIndex only (STEP 2)
844b957 fix(core): carry-overs for insertMeasure barlines, orphan processes, marquee fallback mutation, and weak undo assertions (STEP 0)
7e81888 test(core): strengthen property test against T4 mutation, add marquee voice 2 test (D3)
cc04be4 fix(core): preserve final barline semantics on append and delete measure (D2)
```

---

## E1 — Step 0.1 (`insertMeasure` Barlines)

### Literal Test Names
1. `tests/core/barline_commands.test.ts`:
   - `0.1 insertMeasure at end: changes previous last from final to single, new measure gets final`
   - `0.1 insertMeasure in middle: changes no barline on existing measures`
   - `0.1 insertMeasure undo restores both barlines atomically in one step`
2. `tests/ui/m6b_ui_notations.test.ts`:
   - `0.1 toolbar handler insertNewMeasure applies final barline rule at end of score`

### Failing-First Output (Raw from `docs/review/evidence/0.1_failing_insert_measure.txt` and `0.1_failing_toolbar_insert_measure.txt`)

Command tests failing before `structureCommands.ts` update:
```
 RUN  v2.1.9 C:/Users/Murat/Desktop/proje_mls1

 ✓ tests/core/barline_commands.test.ts > D2: Barline commands specification > (i) appendMeasure on score ending with "final" changes previous to "single" and new to "final"
 ✓ tests/core/barline_commands.test.ts > D2: Barline commands specification > (i-b) appendMeasure on score ending with "double" preserves "double" and new gets "single"
 ✓ tests/core/barline_commands.test.ts > D2: Barline commands specification > (ii) deleteMeasure on last measure ending with "final" sets new last measure to "final"
 ✓ tests/core/barline_commands.test.ts > D2: Barline commands specification > (iii) mid-score explicit "final" barline is NEVER touched by appendMeasure or deleteMeasure
 ✓ tests/core/barline_commands.test.ts > D2: Barline commands specification > undo restores both barlines atomically in a single step
 × tests/core/barline_commands.test.ts > D2: Barline commands specification > 0.1 insertMeasure at end: changes previous last from final to single, new measure gets final
   → expected 'final' to be 'single' // Object.is equality
 × tests/core/barline_commands.test.ts > D2: Barline commands specification > 0.1 insertMeasure in middle: changes no barline on existing measures
   → expected undefined to be 'single' // Object.is equality
 × tests/core/barline_commands.test.ts > D2: Barline commands specification > 0.1 insertMeasure undo restores both barlines atomically in one step
   → expected 'final' to be 'single' // Object.is equality

 FAIL  tests/core/barline_commands.test.ts > D2: Barline commands specification > 0.1 insertMeasure at end: changes previous last from final to single, new measure gets final
```

Toolbar handler test failing before `useEditorNotations.ts` wiring:
```
 RUN  v2.1.9 C:/Users/Murat/Desktop/proje_mls1

 ✓ tests/ui/m6b_ui_notations.test.ts > M6b UI Notations & useEditor integration > applies dynamics to selected note and toggles off on repeat
 ✓ tests/ui/m6b_ui_notations.test.ts > M6b UI Notations & useEditor integration > toggles articulations with conflict resolution (marcato replaces accent)
 ✓ tests/ui/m6b_ui_notations.test.ts > M6b UI Notations & useEditor integration > toggles slur on range selection and triggers error toast on single note
 ✓ tests/ui/m6b_ui_notations.test.ts > M6b UI Notations & useEditor integration > clearNotations removes all dynamics, articulations, and slurs on selection
 × tests/ui/m6b_ui_notations.test.ts > M6b UI Notations & useEditor integration > 0.1 toolbar handler insertNewMeasure applies final barline rule at end of score
   → expected 'final' to be 'single' // Object.is equality

 FAIL  tests/ui/m6b_ui_notations.test.ts > M6b UI Notations & useEditor integration > 0.1 toolbar handler insertNewMeasure applies final barline rule at end of score
AssertionError: expected 'final' to be 'single' // Object.is equality

Expected: "single"
Received: "final"
```

Passing output after implementation ([0.1_passing_insert_measure.txt](file:///c:/Users/Murat/Desktop/proje_mls1/docs/review/evidence/0.1_passing_insert_measure.txt)):
```
 Test Files  2 passed (2)
      Tests  13 passed (13)
```

---

## E2 — Step 0.2 (Orphan Process Cleanup & Port 4198)

### Raw grep: `git --no-pager grep -n "4198" -- scripts .github`
```
scripts/smoke.mjs:71:  const port = 4198;
scripts/test_i18n_dom.mjs:199:    const is4198Up = await checkServer('http://localhost:4198');
scripts/test_i18n_dom.mjs:200:    if (is4198Up) {
scripts/test_i18n_dom.mjs:201:      serverUrl = 'http://localhost:4198';
scripts/test_i18n_dom.mjs:203:      console.log('No existing dev/preview server found; starting Vite preview on port 4198...');
scripts/test_i18n_dom.mjs:205:      previewProcess = spawn('npx', ['vite', 'preview', '--port', '4198', '--strictPort'], {
scripts/test_i18n_dom.mjs:210:      serverUrl = 'http://localhost:4198';
```
Port 4198 is owned by `scripts/smoke.mjs` and used as a fallback port in `scripts/test_i18n_dom.mjs`.

### `killProcessTree` Implementation
In `scripts/smoke.mjs`, `scripts/test_dom_mutations.mjs`, `scripts/test_i18n_dom.mjs`, `scripts/test_voice_entry_e2e.mjs`, and `scripts/test_voice_selection_e2e.mjs`:
```js
function killProcessTree(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${proc.pid} /f /t`, { stdio: 'ignore' });
    } else {
      process.kill(-proc.pid, 'SIGKILL');
    }
  } catch {
    try { proc.kill('SIGKILL'); } catch {}
  }
}
```
Invoked in `finally` blocks:
- `scripts/smoke.mjs:141`: `if (preview) { killProcessTree(preview); }`
- `scripts/test_dom_mutations.mjs:208`: `if (preview) { killProcessTree(preview); }`
- `scripts/test_i18n_dom.mjs:379`: `if (previewProcess) { killProcessTree(previewProcess); }`
- `scripts/test_voice_entry_e2e.mjs:529`: `if (globalPreviewProcess) { killProcessTree(globalPreviewProcess); }`
- `scripts/test_voice_selection_e2e.mjs:492`: `if (globalPreviewProcess) { killProcessTree(globalPreviewProcess); }`

### Local Run Without Dev Server (`Get-Process` Before and After)
Raw output from `docs/review/evidence/e2_local_run_get_process.txt`:
```
=== GET-PROCESS BEFORE ===
Starting Vite preview server for smoke test on port 4198...
Vite preview ready at http://localhost:4198
Loading ScoreForge application...
Switching to Input mode...
Typing 4 notes: C, D, E, F...
Verified SVG event count: 11
Smoke test passed successfully!
=== GET-PROCESS AFTER ===
```
No orphan Node.js or Vite processes remained after execution.

---

## E3 — Step 0.3: `MARQUEE-v1-fallback.patch`

### Patch Contents (`tests/mutations/MARQUEE-v1-fallback.patch`)
```diff
diff --git a/src/ui/scoreView/useScoreMarquee.ts b/src/ui/scoreView/useScoreMarquee.ts
index da12a20..1e61f81 100644
--- a/src/ui/scoreView/useScoreMarquee.ts
+++ b/src/ui/scoreView/useScoreMarquee.ts
@@ -96,13 +96,11 @@ export function useScoreMarquee(
             const firstEv = orderedEvents[0];
             const lastEv = orderedEvents[orderedEvents.length - 1];
             const firstCtx = findEventContext(score, firstEv.id);
-            const voiceIndex = (firstCtx?.voiceIndex ?? 1) as 1 | 2 | 3 | 4;
             const voiceId =
-              firstCtx?.voiceId ?? staff.measures[score.measures[0]?.id]?.voices.find((v) => v.voiceIndex === 1)?.id;
+              firstCtx?.voiceId ?? staff.measures[score.measures[0]?.id]?.voices.find((v) => v.voiceIndex === 1)?.id ?? 'v1';
             onSelectRange?.({
               staffId: staff.id,
-              voiceIndex,
-              ...(voiceId ? { voiceId } : {}),
+              voiceId,
               anchorId: firstEv.id,
               focusId: lastEv.id,
             });
```

### Raw `scripts/runMutation.mjs` Output (`docs/review/evidence/0.3_mutation_marquee_fallback.txt`)
```
=== RUNNING MUTATION TEST: MARQUEE-v1-fallback ===
Patch: C:\Users\Murat\Desktop\proje_mls1\tests\mutations\MARQUEE-v1-fallback.patch
Target test: tests/ui/marquee_voice_selection.test.ts
Creating isolated worktree at C:\Users\Murat\Desktop\proje_mls1\.wt-mutation-MARQUEE-v1-fallback-1795124802175...
Applying patch MARQUEE-v1-fallback.patch to isolated worktree...
Running test tests/ui/marquee_voice_selection.test.ts in worktree...

Mutation MARQUEE-v1-fallback successfully caused test failure as expected.
--- FAILING TESTS ---
 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
 FAIL  tests/ui/marquee_voice_selection.test.ts > D3d & 0.3: Marquee selection on voice 2 > 0.3 useScoreMarquee hook dispatches onSelectRange with voiceIndex: 2 when enclosing voice 2 notes

=== MUTATION CHECK MARQUEE-v1-fallback: PASS (Failure caught cleanly) ===

Cleaning up isolated worktree...
```
*(Note: Patch was created and verified against Commit 1 (`844b957`) before `voiceId` was completely removed from `useScoreMarquee.ts` in Commit 2 (`1fbe0b2`)).*

---

## E4 — Step 0.4: `toBe(initial` Assertions

### Raw `git --no-pager grep -n "toBe(initial" -- tests`
**BEFORE Change (commit `7e81888`):**
```
7e81888:tests/core/m7a_unproven_proofs.test.ts:390:    expect(JSON.stringify(mockStorage)).toBe(initialStorageState);
7e81888:tests/core/m7a_unproven_proofs.test.ts:428:    expect(JSON.stringify(mockStorage)).toBe(initialStorageState);
7e81888:tests/core/voice_property.test.ts:219:      expect(score).toBe(initialScore);
7e81888:tests/resilience/error_recovery.test.ts:258:    expect(history.score).toBe(initialScore);
7e81888:tests/ui/inputModeGate.test.ts:72:    expect(JSON.stringify(state.score)).toBe(initialScoreJson);
7e81888:tests/ui/inputModeGate.test.ts:79:    expect(scoreWithNoteJson).not.toBe(initialScoreJson);
```

**AFTER Change (HEAD):**
```
tests/core/m7a_unproven_proofs.test.ts:390:    expect(JSON.stringify(mockStorage)).toBe(initialStorageState);
tests/core/m7a_unproven_proofs.test.ts:428:    expect(JSON.stringify(mockStorage)).toBe(initialStorageState);
tests/core/voice_property.test.ts:219:      expect(score).toBe(initialScore);
tests/resilience/error_recovery.test.ts:259:    expect(history.score).toBe(initialScore);
tests/ui/inputModeGate.test.ts:72:    expect(JSON.stringify(state.score)).toBe(initialScoreJson);
tests/ui/inputModeGate.test.ts:79:    expect(scoreWithNoteJson).not.toBe(initialScoreJson);
```

### For the Changed Test (`tests/resilience/error_recovery.test.ts:246`)
- **Old assertion:**
  ```ts
  expect(history.score).toBe(initialScore);
  ```
- **New assertion:**
  ```ts
  const initialScoreSnapshot = JSON.parse(JSON.stringify(initialScore));
  // ...
  expect(history.score).toBe(initialScore);
  expect(history.score).toEqual(initialScoreSnapshot);
  ```
- **Break that makes it fail:** Mutating `initialScoreSnapshot.title = 'Injected Fault'` or mutating properties inside `history.score`. Failing output captured in `docs/review/evidence/0.4_failing_error_recovery.txt`:
  ```
  FAIL  tests/resilience/error_recovery.test.ts > H1 Resilience: Injected Fault Recovery & Autosave History > 2. Injected fault in command pipeline: Command caught, history untouched, score retained
  expected { schemaVersion: 7, …(6) } to deeply equal { schemaVersion: 7, …(6) }
  ```

### Analysis of "deep-equal" / "birebir" Claims in Past Reports
1. **Migration idempotence & round-trip:** Checked via `expect(secondMigration).toEqual(firstMigration)` and byte-identical JSON string checks in `tests/io/m7a_v7_migration.test.ts:74`.
2. **Undo reversibility in Voice Operations (T2, T3):** Checked via `expect(history.score).toEqual(initialScoreSnapshot)` in `tests/core/m7a_voice_selection_ops.test.ts` (lines 212, 233, 251, 269, 290, 344, 362, 381, 400).
3. **Property test reversibility (T4):** Checked via `expect(undoScore).toEqual(initialScoreSnapshot)` and `expect(redoScore).toEqual(finalScoreSnapshot)` across all 20 random seeds in `tests/core/voice_property_m7a3.test.ts:223, 237`.
4. **Voice 1 isolation:** Checked via `expect(getVoiceEvents(currentScore, 1)).toEqual(initialVoice1Events)` in every operation test of `tests/core/m7a_voice_selection_ops.test.ts`.

---

## E5 — S2: `voiceId` Grep Classification

### Raw `git --no-pager grep -n voiceId -- src`
```
src/core/validate.ts:24:  voiceId?: Id;
src/core/validate.ts:196:                voiceId: voice.id,
src/core/validate.ts:206:                voiceId: voice.id,
src/core/validate.ts:247:                  voiceId: voice.id,
src/core/validate.ts:267:                      voiceId: voice.id,
src/core/validate.ts:279:                      voiceId: voice.id,
src/core/validate.ts:296:                    voiceId: voice.id,
src/core/validate.ts:310:                  voiceId: voice.id,
src/core/validate.ts:323:                      voiceId: voice.id,
src/core/validate.ts:341:              voiceId: voice.id,
src/core/validate.ts:351:              voiceId: voice.id,
src/core/validate.ts:359:        const voiceNotesMap = new Map<number, Array<{ note: NoteEvent; measureId: Id; voiceId: Id; tickStart: number }>>();
src/core/validate.ts:375:                  const entry = { note: ev, measureId: mDef.id, voiceId: v.id, tickStart: vTick };
src/core/validate.ts:418:                      voiceId: current.voiceId,
src/io/migrations.ts:299:          const voiceId = getSafeDeterministicId(staff.id, mDef.id, 1, 0, 'voice');
src/io/migrations.ts:304:            id: voiceId,
```

### Classification of `src` Hits
- `src/core/validate.ts:24`: `ValidationError.voiceId?: Id` — **ALLOWED** by S2: error reporting metadata identifying which internal Voice entity failed validation.
- `src/core/validate.ts:196-418`: Internal entity traversal attributing error messages to the offending `voice.id` — **ALLOWED**.
- `src/io/migrations.ts:299, 304`: Migration synthesizing a fresh voice entity with internal deterministic ID `id: voiceId` — **ALLOWED**.
- **`selection.ts`, `clipboard.ts`, `commands.ts`, `model.ts`, `useEditorSelection.ts`, `useScoreMarquee.ts`:** **0 hits** (100% compliant with S2).

### Raw `git --no-pager grep -n voiceId -- tests` & Justifications
```
tests/core/m7a_validate_v7.test.ts:138:    expect(err?.voiceId).toBe(voice1Id);
tests/core/range_selection.test.ts:27:    const voiceId = staff.measures[m0Id].voices[0].id;
tests/core/range_selection.test.ts:29:    staff.measures[m1Id].voices[0] = { id: voiceId, voiceIndex: 1, events: [n4, n5, n6, n7] };
tests/core/range_selection.test.ts:30:    staff.measures[m2Id].voices[0] = { id: voiceId, voiceIndex: 1, events: [r8] };
tests/core/range_selection.test.ts:187:  it('range selection across measures works strictly with voiceIndex when each measure has distinct voice ids without any voiceId property', () => {
tests/core/range_selection.test.ts:205:    // Range selection without voiceId, purely using voiceIndex: 1
tests/mutations/MARQUEE-v1-fallback.patch:10:             const voiceId =
tests/mutations/MARQUEE-v1-fallback.patch:11:-              firstCtx?.voiceId ?? staff.measures[score.measures[0]?.id]?.voices.find((v) => v.voiceIndex === 1)?.id;
tests/mutations/MARQUEE-v1-fallback.patch:12:+              firstCtx?.voiceId ?? staff.measures[score.measures[0]?.id]?.voices.find((v) => v.voiceIndex === 1)?.id ?? 'v1';
tests/mutations/MARQUEE-v1-fallback.patch:16:-              ...(voiceId ? { voiceId } : {}),
tests/mutations/MARQUEE-v1-fallback.patch:17:+              voiceId,
tests/ui/marquee_voice_selection.test.ts:133:  it('T6: marquee enclosing notes of BOTH voices selects ONLY voice of the first-hit event without voiceId', () => {
tests/ui/marquee_voice_selection.test.ts:213:    // Assert NO voiceId property in dispatchedRange
tests/ui/marquee_voice_selection.test.ts:214:    expect((dispatchedRange as any).voiceId).toBeUndefined();
```
- `tests/core/m7a_validate_v7.test.ts:138`: Asserts `ValidationError.voiceId` matches offending Voice entity ID.
- `tests/core/range_selection.test.ts:27, 29, 30`: Test fixture constructing mock `Voice` objects with entity ID.
- `tests/core/range_selection.test.ts:187, 205`: Test title and comment documenting that cross-measure range selection operates solely on `voiceIndex`.
- `tests/mutations/MARQUEE-v1-fallback.patch`: Mutation patch testing legacy `voiceId` fallback detection.
- `tests/ui/marquee_voice_selection.test.ts:133, 213, 214`: Test T6 asserting that the range dispatched by marquee contains no `voiceId` property (`expect((dispatchedRange as any).voiceId).toBeUndefined()`).

---

## E6 — S3: Paste Target Voice Decision Code

### In `src/ui/editor/useEditorSelection.ts`
**Before (commit `7e81888`):**
```ts
    let startMId = curScore.measures[0]?.id;
    let startOffset = 0;
    let targetVoiceIndex: 1 | 2 | 3 | 4 = 1;
    let voiceId = staff.measures[startMId]?.voices.find((v) => v.voiceIndex === 1)?.id;

    if (curSel.kind === 'range') {
      const firstEv = curRangeEvents[0];
      if (firstEv) {
        const loc = findEventContext(curScore, firstEv.id);
        if (loc) {
          startMId = loc.measureId;
          voiceId = loc.voiceId;
          targetVoiceIndex = loc.voiceIndex;
          // ...
        }
      }
    } else if (curEventId) {
      const loc = findEventContext(curScore, curEventId);
      if (loc) {
        startMId = loc.measureId;
        voiceId = loc.voiceId;
        targetVoiceIndex = loc.voiceIndex;
        // ...
      }
    } else if (curCursor) {
      startMId = curCursor.measureId;
      targetVoiceIndex = curCursor.voiceIndex;
      const targetVoice = scoreRef.current.parts[0]?.staves[0]?.measures[curCursor.measureId]?.voices.find((vo) => vo.voiceIndex === curCursor.voiceIndex);
      voiceId = targetVoice?.id ?? '';
      startOffset = curCursor.tick;
    }
```

**After (HEAD, lines 410-460):**
```ts
    let startMId = curScore.measures[0]?.id;
    let startOffset = 0;
    let targetVoiceIndex: 1 | 2 | 3 | 4 = 1;

    if (modeRef.current === 'input' && curCursor) {
      startMId = curCursor.measureId;
      targetVoiceIndex = curCursor.voiceIndex;
      startOffset = curCursor.tick;
    } else if (curSel.kind === 'range') {
      const firstEv = curRangeEvents[0];
      if (firstEv) {
        const loc = findEventContext(curScore, firstEv.id);
        if (loc) {
          startMId = loc.measureId;
          targetVoiceIndex = loc.voiceIndex;
          const sm = staff.measures[startMId];
          const v = sm?.voices.find((vo) => vo.voiceIndex === targetVoiceIndex);
          if (v) {
            let t = 0;
            for (const ev of v.events) {
              if (ev.id === firstEv.id) {
                startOffset = t;
                break;
              }
              t += ev.duration;
            }
          }
        }
      }
    } else if (curEventId) {
      const loc = findEventContext(curScore, curEventId);
      if (loc) {
        startMId = loc.measureId;
        targetVoiceIndex = loc.voiceIndex;
        const sm = staff.measures[startMId];
        const v = sm?.voices.find((vo) => vo.voiceIndex === targetVoiceIndex);
        if (v) {
          let t = 0;
          for (const ev of v.events) {
            if (ev.id === curEventId) {
              startOffset = t;
              break;
            }
            t += ev.duration;
          }
        }
      }
    } else if (curCursor) {
      startMId = curCursor.measureId;
      targetVoiceIndex = curCursor.voiceIndex;
      startOffset = curCursor.tick;
    }
```

### In `src/core/clipboard.ts:pasteEvents` (Auto-Creation S3 Semantics)
**Before (commit `7e81888`):**
```ts
    const voice =
      target.voiceIndex !== undefined
        ? staffMeasure.voices.find((v) => v.voiceIndex === target.voiceIndex)
        : (target.voiceId ? staffMeasure.voices.find((v) => v.id === target.voiceId) : null) ??
          staffMeasure.voices.find((v) => v.voiceIndex === 1);
    if (!voice) continue;
```

**After (HEAD, lines 243-261):**
```ts
    const targetVoiceIndex = target.voiceIndex;
    let voice = staffMeasure.voices.find((v) => v.voiceIndex === targetVoiceIndex);
    if (!voice) {
      // S3: If the target measure lacks that voice, create it with D3 semantics:
      // initial rests filling [0, totalMTicks) via fillMeasureWithRests, sorted by voiceIndex.
      voice = {
        id: newId(),
        voiceIndex: targetVoiceIndex,
        events: fillMeasureWithRests(totalMTicks),
      };
      staffMeasure.voices.push(voice);
      staffMeasure.voices.sort((a, b) => a.voiceIndex - b.voiceIndex);
    }
```

### Clipboard Envelope Shape & Version
Grep check of envelope constant:
```
src/core/clipboard.ts:11:  app: 'scoreforge-clip';
src/core/clipboard.ts:29:    app: 'scoreforge-clip',
src/core/clipboard.ts:42:      parsed.app === 'scoreforge-clip' &&
```
**Status:** The clipboard envelope version (`1`) and shape (`{ app: 'scoreforge-clip', version: 1, events: ScoreEvent[] }`) did NOT change. Events inside the envelope serialize standard `ScoreEvent` objects.

---

## E7 — Tests T1–T6 Details & Mutations

### Test Files & Literal Test Names
1. **T1:** `tests/core/m7a_voice_selection_ops.test.ts`:
   - `range-selects across m.1 and m.2 strictly in voice 2, excluding voice 1 notes`
2. **T2:** `tests/core/m7a_voice_selection_ops.test.ts`:
   - `transpose semitone up (+1)`
   - `transpose semitone down (-1)`
   - `transpose octave up (+12)`
   - `transpose octave down (-12)`
   - `delete (notes become rests)`
   - `tie (toggleTie on two adjacent same-pitch notes in voice 2)`
   - `slur (toggleSlur across voice 2 notes)`
   - `articulation (toggleArticulation staccato on voice 2)`
   - `dynamic (setDynamic mf on voice 2)`
3. **T3:** `tests/core/m7a_voice_selection_ops.test.ts`:
   - `a) copy 2 notes from voice 2, paste into voice 1 of measure 1 -> pasted notes in voice 1, voice 2 unchanged`
   - `b) copy 2 notes from voice 2, paste into voice 2 of a measure with ONLY voice 1 -> voice 2 created in 1 undo step, surrounded by rests`
   - `c) copy 2 notes from voice 2, paste into voice 2 that already has content -> replaces content, validateScore 0 errors`
4. **T4:** `tests/core/voice_property_m7a3.test.ts`:
   - `verifies 20 seeds x 100 steps of random voice operations, isolation, and undo/redo reversibility`
5. **T5:** `scripts/test_voice_selection_e2e.mjs`:
   - Playwright E2E suite covering Alto range selection, status bar check, transposition, copy, paste into measure 3 voice 2, delete, and file download.
6. **T6:** `tests/ui/marquee_voice_selection.test.ts`:
   - `T6: marquee enclosing notes of BOTH voices selects ONLY voice of the first-hit event without voiceId`

### Raw Mutation Output for `T2-wrong-voice-op` (`docs/review/evidence/e7_mutation_t2.txt`)
```
=== RUNNING MUTATION TEST: T2-wrong-voice-op ===
Patch: C:\Users\Murat\Desktop\proje_mls1\tests\mutations\T2-wrong-voice-op.patch
Target test: tests/core/m7a_voice_selection_ops.test.ts
Creating isolated worktree at C:\Users\Murat\Desktop\proje_mls1\.wt-mutation-T2-wrong-voice-op-1795128289636...
Applying patch T2-wrong-voice-op.patch to isolated worktree...
Running test tests/core/m7a_voice_selection_ops.test.ts in worktree...

Mutation T2-wrong-voice-op successfully caused test failure as expected.
--- FAILING TESTS ---
 Test Files  1 failed (1)
      Tests  9 failed | 4 passed (13)
 FAIL  tests/core/m7a_voice_selection_ops.test.ts > M7a-3: Voice 2 Selection, Isolation, Operations and Clipboard (T1, T2, T3) > T1: Range selection in voice 2 across a barline > range-selects across m.1 and m.2 strictly in voice 2, excluding voice 1 notes
 FAIL  tests/core/m7a_voice_selection_ops.test.ts > M7a-3: Voice 2 Selection, Isolation, Operations and Clipboard (T1, T2, T3) > T2: Operations on voice 2 selection (isolated tests per operation) > transpose semitone up (+1)
 FAIL  tests/core/m7a_voice_selection_ops.test.ts > M7a-3: Voice 2 Selection, Isolation, Operations and Clipboard (T1, T2, T3) > T2: Operations on voice 2 selection (isolated tests per operation) > transpose semitone down (-1)
 FAIL  tests/core/m7a_voice_selection_ops.test.ts > M7a-3: Voice 2 Selection, Isolation, Operations and Clipboard (T1, T2, T3) > T2: Operations on voice 2 selection (isolated tests per operation) > transpose octave up (+12)
 FAIL  tests/core/m7a_voice_selection_ops.test.ts > M7a-3: Voice 2 Selection, Isolation, Operations and Clipboard (T1, T2, T3) > T2: Operations on voice 2 selection (isolated tests per operation) > transpose octave down (-12)
 FAIL  tests/core/m7a_voice_selection_ops.test.ts > M7a-3: Voice 2 Selection, Isolation, Operations and Clipboard (T1, T2, T3) > T2: Operations on voice 2 selection (isolated tests per operation) > delete (notes become rests)
 FAIL  tests/core/m7a_voice_selection_ops.test.ts > M7a-3: Voice 2 Selection, Isolation, Operations and Clipboard (T1, T2, T3) > T2: Operations on voice 2 selection (isolated tests per operation) > slur (toggleSlur across voice 2 notes)
 FAIL  tests/core/m7a_voice_selection_ops.test.ts > M7a-3: Voice 2 Selection, Isolation, Operations and Clipboard (T1, T2, T3) > T2: Operations on voice 2 selection (isolated tests per operation) > articulation (toggleArticulation staccato on voice 2)
 FAIL  tests/core/m7a_voice_selection_ops.test.ts > M7a-3: Voice 2 Selection, Isolation, Operations and Clipboard (T1, T2, T3) > T2: Operations on voice 2 selection (isolated tests per operation) > dynamic (setDynamic mf on voice 2)

=== MUTATION CHECK T2-wrong-voice-op: PASS (Failure caught cleanly) ===

Cleaning up isolated worktree...
```

### Raw Mutation Output for `T4-paste-wrong-voice` (`docs/review/evidence/e7_mutation_t4.txt`)
```
=== RUNNING MUTATION TEST: T4-paste-wrong-voice ===
Patch: C:\Users\Murat\Desktop\proje_mls1\tests\mutations\T4-paste-wrong-voice.patch
Target test: tests/core/voice_property_m7a3.test.ts
Creating isolated worktree at C:\Users\Murat\Desktop\proje_mls1\.wt-mutation-T4-paste-wrong-voice-1795128302003...
Applying patch T4-paste-wrong-voice.patch to isolated worktree...
Running test tests/core/voice_property_m7a3.test.ts in worktree...

Mutation T4-paste-wrong-voice successfully caused test failure as expected.
--- FAILING TESTS ---
 Test Files  1 failed (1)
      Tests  1 failed (1)
 FAIL  tests/core/voice_property_m7a3.test.ts > T4: Seeded Property Test for Multi-Voice Operations and Clipboard (Rule R6) > verifies 20 seeds x 100 steps of random voice operations, isolation, and undo/redo reversibility

=== MUTATION CHECK T4-paste-wrong-voice: PASS (Failure caught cleanly) ===

Cleaning up isolated worktree...
```

### T4 Random Seeds
Generated via `Array.from({ length: 20 }, (_, i) => 2001 + i * 43)`:
`[2001, 2044, 2087, 2130, 2173, 2216, 2259, 2302, 2345, 2388, 2431, 2474, 2517, 2560, 2603, 2646, 2689, 2732, 2775, 2818]`

---

## E8 — T5 Playwright E2E Results & Screenshots

### Raw E2E Console Lines (`docs/review/evidence/c4_t5_e2e_evidence.txt`)
```
--- RUNNING MUTATION CHECK M (broken voice lookup) ---
=== Running Playwright Voice Selection E2E (mutationBreakVoiceLookup: true) ===
Status bar range info: "1 öge seçildi (Ölçü 2)"
✓ Mutation check M caught failure as expected: "Status bar range text mismatch! Expected "8 öge seçildi (Ölçü 1–2)" or "8 items selected (Measures 1–2)", got: "1 öge seçildi (Ölçü 2)""

--- RUNNING NORMAL E2E (T5) ---
=== Running Playwright Voice Selection E2E (mutationBreakVoiceLookup: false) ===
Status bar range info: "8 öge seçildi (Ölçü 1–2)"
✓ Status bar correctly displays 8 selected items across measures 1–2.
Saved screenshot 1: C:\Users\Murat\Desktop\proje_mls1\docs\screenshots\m7a-3\01_voice2_range_selected.png
First alto note after transpose up: { step: 'B', octave: 3, alter: 0 }
✓ All 8 alto notes transposed up one semitone successfully.
Copying selection via Ctrl+C...
Current measure count before ensuring measure 3: 3
Score has 3 measures.
Switching into input mode and ensuring cursor at measure 3 voice 2...
Cursor state after entering input mode: { measureIndex: 2, voiceIndex: 2 }
Cursor ready for paste at: { measureIndex: 2, voiceIndex: 2 }
Pasting copied notes into voice 2 via Ctrl+V...
Saved screenshot 2: C:\Users\Murat\Desktop\proje_mls1\docs\screenshots\m7a-3\02_transposed_and_pasted.png
Measure 3 content verification: { v1IsRest: true, v2HasNotes: true, v2NoteCount: 4 }
✓ Pasted notes into voice 2: voice 2 has notes, voice 1 has whole rest.
Pressing Delete to delete selected voice 2 notes...
Saved screenshot 3: C:\Users\Murat\Desktop\proje_mls1\docs\screenshots\m7a-3\03_final_after_delete.png
After delete verification: { v2AllRests: true }
✓ Voice 2 notes became rests after Delete.
Saving final score via Ctrl+S...
Downloaded score: untitled_score.sfscore, schemaVersion=7
✓ T5 PASS: Voice selection, transposition, cross-measure paste and delete E2E verified cleanly.

=== ALL PLAYWRIGHT VOICE SELECTION E2E TESTS (T5) PASSED ===
```

### Three Screenshot Paths
1. `docs/screenshots/m7a-3/01_voice2_range_selected.png` (Alto range selected across mm. 1-2, status bar showing 8 items selected)
2. `docs/screenshots/m7a-3/02_transposed_and_pasted.png` (Transposed notes pasted into measure 3 voice 2)
3. `docs/screenshots/m7a-3/03_final_after_delete.png` (Selected voice 2 notes converted to rests via Delete)

---

## E9 — `npm run check` & Traceability Matrix Verification

### Raw Tail of `npm run check` (`docs/review/evidence/c4_npm_check_passing.txt`)
```
 Test Files  99 passed (99)
      Tests  709 passed (709)
   Start at  01:27:05
   Duration  17.97s (transform 9.06s, setup 0ms, collect 44.34s, tests 31.16s, environment 46ms, prepare 48.62s)


> milasi@0.1.0 build
> node scripts/buildGlyphPaths.mjs && tsc && vite build

Bravura loaded: unitsPerEm = 1000, total font glyphs = 3715
Target glyphs to extract: 63
Extracted 63 glyph paths.
Wrote C:\Users\Murat\Desktop\proje_mls1\src\render\glyphPaths.generated.ts successfully (36.1 KB).
vite v5.4.21 building for production...
transforming...
✓ 1096 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                    1.37 kB │ gzip:   0.63 kB
dist/assets/index-CDy55TNf.js  1,311.93 kB │ gzip: 326.91 kB
✓ built in 5.58s
```

### Raw Output of `node scripts/checkTraceability.mjs`
```
--- Checking Machine Traceability Matrix: schema-v7-traceability.json ---
[PASS] Invariant 1 -> tests/core/validate.test.ts :: "validateScore rejects duplicate voiceIndex in the same measure"
[PASS] Invariant 2 -> tests/core/validate.test.ts :: "validateScore rejects measure with empty voices array"
[PASS] Invariant 3 -> tests/core/validate.test.ts :: "rejects group whose partIds contains an id that is not a part with group-unknown-part"
[PASS] Invariant 4 -> tests/io/m7a_v7_migration.test.ts :: "assigns channel 9 to percussion and distinct non-percussion channels from [0..8, 10..15]"
[PASS] Invariant 5 -> tests/io/m7a_v7_migration.test.ts :: "defines CURRENT_SCHEMA_VERSION as 7"
[PASS] Invariant 6 -> tests/core/m7a_unproven_proofs.test.ts :: "Item 2b: Invariant 6: existing voice, event, measure and override IDs are preserved unchanged after migration"
[PASS] P1 -> tests/io/m7a_v7_migration.test.ts :: "rejects schemaVersion 8 with Turkish message"
[PASS] P2 -> tests/io/m7a_v7_migration.test.ts :: "rejects measures with more than 4 voices with Turkish message naming measure"
[PASS] S1 -> tests/core/m7a_unproven_proofs.test.ts :: "Item 2c: Step S1: the input object is not mutated during migration (deep-freeze verification)"
[PASS] S2 -> tests/io/m7a_v7_migration.test.ts :: "migrates v6 files carrying 0-based, 1-based, and contradictory voiceIndex values to position + 1"
[PASS] S3 -> tests/core/m7a_fill_measure_with_rests.test.ts :: "decomposes correctly and validates for 3/4"
[PASS] S4 -> tests/io/m7a_v7_migration.test.ts :: "aborts migration with descriptive error and leaves input untouched when an ID collides"
[PASS] S5 -> tests/io/m7a_v7_migration.test.ts :: "falls back to name <= 6 chars or first 4 chars + "." when instrument is unknown"
[PASS] S6 -> tests/io/m7a_v7_migration.test.ts :: "migration output always initializes groups as empty array [] (S6)"
[PASS] S7 -> tests/io/m7a_v7_migration.test.ts :: "migration output has schemaVersion 7 and an input with schemaVersion 6 is not mutated (S7)"
[PASS] S8 -> tests/core/m7a_unproven_proofs.test.ts :: "Item 2a: Fuzz/property test over 200 random valid v6 scores validates, is idempotent, round-trips, and preserves rendering"
[PASS] Section 4 - Ties -> tests/core/m7a_unproven_proofs.test.ts :: "Item 2d: Section 4: ties and slurs preserve identical event connections across migration in multi-voice scores"
[PASS] Section 4 - Slurs -> tests/core/validate.test.ts :: "validateScore rejects ties or slurs that cross voices"
[PASS] Section 4 - Migration -> tests/core/m7a_unproven_proofs.test.ts :: "Item 2d: Section 4: ties and slurs preserve identical event connections across migration in multi-voice scores"
[PASS] Section 5 - Rule 1 -> tests/core/validate.test.ts :: "validateScore rejects single voice with voiceIndex != 1"
[PASS] Section 5 - Rule 2 -> tests/core/validate.test.ts :: "validateScore rejects voice whose event durations do not match measure length"
[PASS] Section 5 - Rule 3 -> tests/core/validate.test.ts :: "validateScore rejects ties or slurs that cross voices"
[PASS] Section 5 - Rule 4 -> tests/core/validate.test.ts :: "validateScore rejects score when a StaffMeasure is missing for a MeasureDef"
[PASS] Section 5 - Rule 5 -> tests/core/validate.test.ts :: "validateScore warns when more than 15 non-percussion parts share MIDI channels"
[PASS] Section 6 - Abort Safety -> tests/core/m7a_unproven_proofs.test.ts :: "Item 2f: Section 6: Failure policy P1 and P2 leave storage record and loaded input untouched"
[PASS] Section 6 - Future Versions -> tests/io/m7a_v7_migration.test.ts :: "rejects schemaVersion 8 with Turkish message"
[PASS] Section 6 - Save Safety -> tests/io/m7a_v7_migration.test.ts :: "saving a migrated score writes schemaVersion 7 and never overwrites original v6 file unless saved over (Section 6 Save Safety)"
[PASS] Section 7 - Bullet 1 (Fixtures) -> tests/io/m7a_fixtures_migration.test.ts :: "loads generated v6_generated.sfscore and migrates to a valid v7 score"
[PASS] Section 7 - Bullet 2 (Idempotence) -> tests/io/m7a_v7_migration.test.ts :: "is idempotent: migrating a v7 score changes nothing, migrateV6ToV7 twice produces byte-identical JSON"
[PASS] Section 7 - Bullet 3 (Property/Fuzz) -> tests/core/m7a_unproven_proofs.test.ts :: "Item 2a: Fuzz/property test over 200 random valid v6 scores validates, is idempotent, round-trips, and preserves rendering"
[PASS] Section 7 - Bullet 4 (Voice Order) -> tests/core/range_selection.test.ts :: "FAILING-FIRST: asserts selection follows voiceIndex (1..4) regardless of array storage order across measures"
[PASS] Section 7 - Bullet 5 (Missing Voice 1 Rests) -> tests/core/m7a_fill_measure_with_rests.test.ts :: "decomposes correctly and validates for 5/8"
[PASS] Section 7 - Bullet 6 (More than 4 voices rejection) -> tests/io/m7a_v7_migration.test.ts :: "rejects measures with more than 4 voices with Turkish message naming measure"
[PASS] Section 7 - Bullet 7 (Voice ID Preserved) -> tests/core/m7a_unproven_proofs.test.ts :: "Item 2b: Invariant 6: existing voice, event, measure and override IDs are preserved unchanged after migration"
[PASS] Section 7 - Bullet 8 (Deterministic IDs) -> tests/io/m7a_v7_migration.test.ts :: "generates deterministic IDs: migrating the same v6 score twice yields identical IDs"
[PASS] Section 7 - Bullet 9 (Group Part IDs) -> tests/io/m7a_v7_migration.test.ts :: "preserves group partIds when all parts exist, drops non-existent part IDs"
[PASS] Section 7 - Bullet 10 (Zero Errors Postcondition) -> tests/core/m7a_unproven_proofs.test.ts :: "Item 2a: Fuzz/property test over 200 random valid v6 scores validates, is idempotent, round-trips, and preserves rendering"
[PASS] Section 7 - Bullet 11 (Ties preserved across system break) -> tests/core/m7a_unproven_proofs.test.ts :: "Item 2e: Section 7: ties across system breaks render both start and end ties after migration"
----------------------------------------------------
✓ All 38 DONE traceability rows statically verified against actual test files.
--- Checking Machine Traceability Matrix: m7a-2b-traceability.json ---
[PASS] D1 -> tests/ui/tab_voice_ui.test.tsx :: "Tab in input mode is mapped and default-prevented; Tab outside input mode is NOT default-prevented"
[PASS] D2 -> tests/ui/cursor_voice.test.ts :: "FAILING-FIRST: cycles forward (Tab) 1 -> 2 -> 3 -> 4 -> 1 and backward (Shift+Tab) 1 -> 4 -> 3 -> 2 -> 1"
[PASS] D3 -> tests/core/voice_creation_entry.test.ts :: "T2: entry in missing voice 2 at tick 1920 of an empty 4/4 measure gives rests for [0, 1920) + the note + rests to the barline, total 3840; validateScore zero errors; voices sorted"
[PASS] D4 -> tests/core/m7a_commands_v7.test.ts :: "inserts notes in voice 2 addressed by voiceIndex and leaves voice 1 untouched"
[PASS] D5 -> tests/core/voice_property.test.ts :: "verifies 20 seeds x 200 steps of random voice navigation, entry, and undo/redo"
[PASS] D6 -> tests/ui/tab_voice_ui.test.tsx :: "Tab in input mode changes the status bar voice text immediately"
[PASS] D7 -> tests/core/voice_property.test.ts :: "verifies 20 seeds x 200 steps of random voice navigation, entry, and undo/redo"
[PASS] D8 -> tests/core/voice_property.test.ts :: "verifies 20 seeds x 200 steps of random voice navigation, entry, and undo/redo"
[PASS] D9 -> tests/ui/cursor_voice.test.ts :: "FAILING-FIRST: cycles forward (Tab) 1 -> 2 -> 3 -> 4 -> 1 and backward (Shift+Tab) 1 -> 4 -> 3 -> 2 -> 1"
[PASS] T1 -> tests/ui/cursor_voice.test.ts :: "FAILING-FIRST: snaps cursor in the middle of a longer event to event start (never forward)"
[PASS] T2 -> tests/core/voice_creation_entry.test.ts :: "T2: entry in missing voice 2 at tick 1920 of an empty 4/4 measure gives rests for [0, 1920) + the note + rests to the barline, total 3840; validateScore zero errors; voices sorted"
[PASS] T3 -> tests/core/voice_creation_entry.test.ts :: "T3: gap case: voice 3 created while voice 2 is missing, sorted voices with gap allowed"
[PASS] T4 -> tests/core/voice_property.test.ts :: "verifies 20 seeds x 200 steps of random voice navigation, entry, and undo/redo"
[PASS] T5 -> tests/ui/tab_voice_ui.test.tsx :: "Tab in input mode changes the status bar voice text immediately"
[PASS] T6 -> tests/ui/tab_voice_ui.test.tsx :: "Tab in input mode changes the status bar voice text immediately"
[PASS] T7 -> scripts/test_voice_entry_e2e.mjs :: "E2E keyboard entry of BWV 140/7 mm. 1-2 voices 1 and 2"
[PASS] T8 -> scripts/test_voice_entry_e2e.mjs :: "E2E undo and redo of voice 2 entry restores previous state"
----------------------------------------------------
✓ All 17 DONE traceability rows statically verified against actual test files.
--- Checking Machine Traceability Matrix: m7a-3-traceability.json ---
[PASS] S1 -> tests/core/m7a_voice_selection_ops.test.ts :: "range-selects across m.1 and m.2 strictly in voice 2, excluding voice 1 notes"
[PASS] S2 -> tests/core/m7a_voice_selection_ops.test.ts :: "range-selects across m.1 and m.2 strictly in voice 2, excluding voice 1 notes"
[PASS] S3 -> tests/core/m7a_voice_selection_ops.test.ts :: "b) copy 2 notes from voice 2, paste into voice 2 of a measure with ONLY voice 1 -> voice 2 created in 1 undo step, surrounded by rests"
[PASS] S4 -> tests/core/m7a_voice_selection_ops.test.ts :: "transpose semitone up (+1)"
[PASS] S5 -> tests/ui/m7a_statusbar_badges.test.tsx :: "renders Turkish range selection info with count and measure span: 8 öge seçildi (Ölçü 1–2)"
[PASS] S6 -> tests/ui/marquee_voice_selection.test.ts :: "T6: marquee enclosing notes of BOTH voices selects ONLY voice of the first-hit event without voiceId"
[PASS] S7 -> tests/core/m7a_voice_selection_ops.test.ts :: "a) copy 2 notes from voice 2, paste into voice 1 of measure 1 -> pasted notes in voice 1, voice 2 unchanged"
[PASS] S8 -> tests/core/m7a_voice_selection_ops.test.ts :: "delete (notes become rests)"
[PASS] S9 -> tests/core/voice_property_m7a3.test.ts :: "verifies 20 seeds x 100 steps of random voice operations, isolation, and undo/redo reversibility"
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
✓ All 19 DONE traceability rows statically verified against actual test files.
```

### Explanation of Row Counts
- **`docs/design/schema-v7-traceability.json`:** 38 rows (all 38 `DONE`)
- **`docs/design/m7a-2b-traceability.json`:** 17 rows (all 17 `DONE`)
- **`docs/design/m7a-3-traceability.json`:** 19 rows (all 19 `DONE`)
- **Total across all three JSON files:** **74 rows verified (74/74 PASS)**. The previous mention of "19/19" referred specifically to the 19 rows defined in the newly added `m7a-3-traceability.json`.

---

## E10 — CI-Pushed HEAD & Run Status

- **CI-Pushed Commit on remote `origin/main`:** `1c25291` (`test(e2e): add voice selection E2E verification, screenshots, and traceability (STEP 4)`)
- **Remote `origin/main` SHA:** `1c2529176a30c9f3644b4114e68a54414350a36d`
- **Pushed Commits in M7a-3:**
  1. `844b957` — Carry-over (insertMeasure barlines, orphan processes, marquee fallback mutation, weak undo assertions)
  2. `1fbe0b2` — API conversion to `voiceIndex` only
  3. `6c1cd13` — Operations, clipboard, and property tests (T1–T4)
  4. `1c25291` — E2E tests, screenshots, and traceability matrix
- **CI Status:** Commit `1c25291` was pushed by the human developer to `origin/main`. CI job status will be verified from GitHub Actions.
- **Report Commit:** This report is committed on top of `1c25291`.
