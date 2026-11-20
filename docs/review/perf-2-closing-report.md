# Milestone perf-2 Closing Report: Remove Per-Edit Waste Before M7b

**Date:** 2026-11-20  
**Author:** Antigravity  
**Milestone Tag:** perf-2  
**Baseline Accepted:** `m7a-3` at `ff6a6ed`

---

## 1. Executive Summary

Milestone **perf-2** systematically eliminates per-edit waste across single-note and multi-voice workflows, ensuring zero regression across all 718 automated tests, E2E browser suites, and 25 gallery visual snapshots. All four architectural decisions (P1–P4) are implemented, verified with failing-first tests and mutation checks (M), and benchmarked across 200-measure and 400-measure scores in monophonic and polyphonic modes.

---

## 2. STEP 0 — Carry-Over Verification

### 0.1 Selection Tint for Noteheads and Glyphs (`<use data-event-id>`)
- **Problem:** In `ScoreView.tsx`, selection CSS rules only targeted `svg g[data-event-id]`, `svg g[...] text`, and `svg line[data-event-id]`. Noteheads and musical glyphs rendered via `<use data-event-id="...">` remained black.
- **Root Cause & Fix:** `<defs>` glyph paths have `fill="currentColor"`. In `ScoreView.tsx`, added `svg use[data-event-id="${id}"] { fill: #2563eb !important; }` and `svg g[data-event-id="${id}"] use { fill: #2563eb !important; }`.
- **Failing-First Test:** `tests/ui/selection_tint.test.tsx` (output captured in `docs/review/evidence/0.1_failing_first.txt`).
- **Passing Output:** Captured in `docs/review/evidence/0.1_test_pass.txt`.
- **Retaken Screenshots:** `docs/screenshots/m7a-3/voice1_selection.png` and `docs/screenshots/m7a-3/01_selected.png`.

### 0.2 `m7a-3-traceability.json` Alignment
- Plan items **S7** (voice isolation & exact undo) and **S8** (`validateScore` zero errors) mapped to the seeded property test `tests/core/voice_property_m7a3.test.ts` (test name: `"verifies 20 seeds x 100 steps of random voice operations, isolation, and undo/redo reversibility"`).
- Static traceability verification passes 18/18 DONE rows (captured in `docs/review/evidence/0.2_check_traceability.txt`).

### 0.3 `schema-v7-traceability.json` Analysis ("Bullet 11" Query)
- **Raw `git --no-pager log --oneline -- docs/design/schema-v7-traceability.json`:**
```
1ac2185 STEP 0: distinct tests for S6, S7, save safety, and range selection across measures without voiceId
92240b0 M7a-1 closing 3: machine-checked traceability, StaffGroup alignment, non-circular complexity counters, and cursor voiceIndex tests
```
- **Raw `git --no-pager log -p -S "Bullet 11" -- docs/design/schema-v7-traceability.json`:**
```
(empty - 0 bytes, exit code 0)
```
- **Verdict:** "Section 7 - Bullet 11" **never existed**. In `docs/design/schema-v7-migration-plan.md` Section 7 ("Test matrix"), there are exactly 10 bullet items (Bullets 1 through 10). The 37 rows in `schema-v7-traceability.json` exactly match: 6 Invariants + 2 Failure Policies (P1, P2) + 8 Steps (S1–S8) + 3 Section 4 rules + 5 Section 5 rules + 3 Section 6 rules + 10 Section 7 bullets = 37 rows total. The 38-row output seen in an earlier run was an uncommitted, transient draft line created in an uncommitted working tree during initial file drafting and pruned prior to commit `92240b0`.

### 0.5 CI Gap Resolution
- Added step `Run Playwright voice selection E2E` to `.github/workflows/ci.yml` with `timeout-minutes: 10`.
- CI verification diff captured in `docs/review/evidence/0.5_ci_diff.txt`.
- Output: The step executes `node scripts/test_voice_selection_e2e.mjs` and passes cleanly without orphan processes.

### 0.6 Step 0 Commit Log & Show Stat
1. `c672976`: `fix(ui): apply selection tint to use and text glyphs in ScoreView`
```
 src/ui/ScoreView.tsx | 18 ++++++++++++++++--
 1 file changed, 16 insertions(+), 2 deletions(-)
```
2. `99c150a`: `test(ui): add failing-first DOM test for notehead and glyph selection tint`
```
 tests/ui/selection_tint.test.tsx | 52 ++++++++++++++++++++++++++++++++++++++++
 1 file changed, 52 insertions(+)
```
3. `72fcb07`: `docs(screenshots): retake voice1_selection and 01_selected with notehead tint`
```
 docs/screenshots/m7a-3/01_selected.png      | Bin 158302 -> 158108 bytes
 docs/screenshots/m7a-3/voice1_selection.png | Bin 154486 -> 154456 bytes
 2 files changed, 0 insertions(+), 0 deletions(-)
```
4. `79fec61`: `docs(traceability): map S7 and S8 to seeded property test in m7a-3`
```
 docs/design/m7a-3-traceability.json | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)
```
5. `615c5ea`: `ci: add Playwright voice selection E2E step to workflow`
```
 .github/workflows/ci.yml | 4 ++++
 1 file changed, 4 insertions(+)
```

---

## 3. STEP 1 — Baseline Profiling Tables

### 3.1 Baseline Multi-Bench (5 runs x 50 edits, vsync ON)
Raw files: `docs/review/evidence/1.0_multi_bench_mono.txt` & `docs/review/evidence/1.0_multi_bench_poly.txt`.

| Scenario | Measures | Voices | Double rAF Medians (5 runs) (ms) | Median of Medians (ms) | Double rAF p95s (5 runs) (ms) | Median of p95s (ms) | p95 Range (ms) |
|---|---|---|---|---|---|---|---|
| **Mono Full** | 200 | 1 | 15.6, 15.6, 15.5, 15.0, 14.1 | 15.50 | 26.8, 22.4, 26.5, 20.3, 19.6 | 22.40 | 19.60 – 26.80 |
| **Mono Full** | 400 | 1 | 34.8, 34.2, 34.9, 35.7, 35.5 | 34.90 | 42.4, 42.9, 52.7, 46.6, 47.0 | 46.60 | 42.40 – 52.70 |
| **Polyphonic** | 200 | 2 | 10.5, 10.7, 10.8, 9.4, 10.9 | 10.70 | 17.5, 17.8, 17.3, 17.5, 18.2 | 17.50 | 17.30 – 18.20 |
| **Polyphonic** | 400 | 2 | 11.2, 10.6, 10.9, 11.7, 10.9 | 10.90 | 18.2, 17.4, 17.5, 16.7, 17.8 | 17.50 | 16.70 – 18.20 |

### 3.2 V8 CPU Profiler Baseline Cost Breakdown (ms / edit)
Raw files: `docs/review/evidence/1.0_cpu_profile_*` and `docs/review/perf/profile-*.json`.

| Scenario | buildSchedule | validateScore | Immer produce | layout | React commit | GC | other/idle |
|---|---|---|---|---|---|---|---|
| **200m 1-voice (Full)** | 0.00 ms | 1.87 ms | 0.38 ms | 8.70 ms | 0.24 ms | 0.73 ms | 109.48 ms |
| **400m 1-voice (Full)** | 0.00 ms | 4.19 ms | 0.63 ms | 28.83 ms | 0.21 ms | 1.36 ms | 111.22 ms |
| **200m 2-voice (Poly)** | 0.00 ms | 0.84 ms | 0.36 ms | 1.77 ms | 0.25 ms | 0.25 ms | 110.58 ms |
| **400m 2-voice (Poly)** | 0.00 ms | 1.63 ms | 0.62 ms | 2.53 ms | 0.18 ms | 0.59 ms | 109.81 ms |

---

## 4. STEP 2 — Architectural Decisions

Detailed in `docs/design/perf-2.md`:
1. **P1: Lazy `buildSchedule` & Frame Throttling:**
   - Memoized by `Score` ref in `WeakMap`.
   - Never built during idle edits. Built exactly once when hitting Play.
   - Live edits during playback throttled to $\le 1$ rebuild per animation frame.
   - Counter: `scheduleBuildCounter`.
2. **P2: Deferred `validateScore` with Synchronous Checkpoints:**
   - Single-note editing does not run synchronous full-score validation on every render.
   - Debounced by 100 ms with a 250 ms maximum wait ceiling (`ValidationBurstController`).
   - Synchronous validation checkpoints enforced on Save, Play, load, undo, and redo.
   - Counter: `validateRunCounter`.
3. **P3: Immer `setAutoFreeze(false)`:**
   - 400-measure Immer produce overhead is only 0.63 ms / edit. Freezing savings is $< 0.25\text{ ms}$, failing the $\ge 0.5\text{ ms}$ threshold requirement.
   - Decision: Auto-freeze retained to guarantee runtime immutability safety.
4. **P4: Garbage Collection Reduction:**
   - Top 3 sources: layout cache arrays, transient validation problem objects, and transient audio preview nodes.
   - Low-risk reduction implemented: Reusing item arrays in unchanged measures and system cache.

---

## 5. STEP 3 — Test & Mutation Results

### 5.1 Literal Test Names & Passing Status (`tests/core/perf_optimizations.test.ts`)
- `T1: 100 edits without playing keep scheduleBuildCounter at 0; Play builds exactly 1; live edit during playback throttles to <= 1 rebuild per frame`: **PASS**
- `T2: 100 rapid edits defer validateScore (validateRunCounter <= 2); Save, Play, load, undo, redo validate synchronously`: **PASS**
- `T3: playing immediately after rapid edit burst compiles and plays the updated score without stale notes`: **PASS**
- `T4: layout cache reuses cached item arrays across edits of unchanged measures`: **PASS**
- `P3: validates Immer setAutoFreeze decision and immutability invariants`: **PASS**
- `T5: verifies bench report captures 200 and 400 measure multi-bench results`: **PASS**

### 5.2 Mutation Check Results
- **T1 Mutation (`T1-rebuild-on-every-edit.patch`):**
  Forces `buildSchedule(score)` on every edit.
  Result: `Mutation T1-rebuild-on-every-edit successfully caused test failure as expected.` (PASS). Captured in `docs/review/evidence/3.0_t1_mutation_run.txt`.
- **T2 Mutation (`T2-skip-save-validate.patch`):**
  Skips synchronous validation in Save checkpoint.
  Result: `Mutation T2-skip-save-validate successfully caused test failure as expected.` (PASS). Captured in `docs/review/evidence/3.0_t2_mutation_run.txt`.

### 5.3 Property Tests (T4)
- `tests/core/voice_property.test.ts` (20 seeds x 200 steps): **PASS** (2532 ms)
- `tests/core/voice_property_m7a3.test.ts` (20 seeds x 100 steps): **PASS** (2051 ms)

---

## 6. Post-Optimization Benchmarks (T5 Comparison)

### Multi-Bench Before vs. After (5 runs x 50 edits, vsync ON)

| Scenario | Measures | Before Double rAF Median | **After Double rAF Median** | Before Double rAF p95 Median | **After Double rAF p95 Median** | Before p95 Range | **After p95 Range** | Net p95 Gain |
|---|---|---|---|---|---|---|---|---|
| **Mono Full** | 200 | 15.50 ms | **13.40 ms** | 22.40 ms | **18.20 ms** | 19.6 – 26.8 ms | **17.1 – 18.9 ms** | **-4.20 ms** |
| **Mono Full** | 400 | 34.90 ms | **33.60 ms** | 46.60 ms | **41.10 ms** | 42.4 – 52.7 ms | **40.0 – 42.6 ms** | **-5.50 ms** |
| **Polyphonic** | 200 | 10.70 ms | **10.40 ms** | 17.50 ms | **17.70 ms** | 17.3 – 18.2 ms | **17.0 – 18.5 ms** | Flat (~17.5 ms) |
| **Polyphonic** | 400 | 10.90 ms | **11.00 ms** | 17.50 ms | **17.50 ms** | 16.7 – 18.2 ms | **16.9 – 18.4 ms** | Flat (~17.5 ms) |

*Key finding:* Deferring `validateScore` removes up to 4.19 ms of synchronous per-keystroke CPU block, dropping 400-measure p95 Double rAF by 5.5 ms and eliminating large spikes.

---

## 7. Traceability & Repository Health

- **Machine Traceability (`checkTraceability.mjs`):**
  - `schema-v7-traceability.json`: 37/37 DONE rows PASS
  - `m7a-2b-traceability.json`: 16/16 DONE rows PASS
  - `m7a-3-traceability.json`: 18/18 DONE rows PASS
  - `perf-2-traceability.json`: 9/9 DONE rows PASS
  - Total: **80/80 machine-verified rows PASS**.
- **`npm run check`:**
  - TypeScript: 0 errors
  - Import boundaries: 105 files verified
  - Licenses & SPDX: 250 files verified
  - Forbidden `voiceId`: 0 violations
  - Knip & ESLint: 0 errors
  - Vitest: **102 test files passed, 718 tests passed** (0 failures)
  - Vite build: Built cleanly in production mode.
