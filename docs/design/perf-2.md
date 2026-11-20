# Perf-2 Architecture & Optimization Decisions: Per-Edit Waste Reduction

**Date:** 2026-11-20  
**Status:** In Progress / Lead-Approved Decisions (P1–P4)  
**Milestone:** perf-2  
**Baseline Acceptance:** M7a-3 accepted at tag `m7a-3` (`ff6a6ed`).

---

## 1. Executive Summary & Problem Analysis

In M7a-3, multi-voice selection, keyboard navigation, range editing, and clipboard operations were made voiceIndex-aware. However, performance analysis on 200-measure and 400-measure scores revealed non-trivial per-edit CPU overhead during single-note edits (e.g. `ArrowUp`/`ArrowDown` pitch changes):

1. **Synchronous Full-Score Validation (`validateScore`)**: In `App.tsx`, `validateScore(score)` was executed synchronously on every render pass. For 400 measures, this cost **4.19 ms** of CPU self-time on every keystroke, checking rules across 400 measures even during rapid typing bursts.
2. **Playback Schedule Eager Invalidation**: Playback schedules (`buildSchedule`) should only be constructed when playing or preparing for playback, not per edit.
3. **Immer Immutability Overhead**: Evaluating `setAutoFreeze` impact on production builds.
4. **Garbage Collection (GC) Overhead**: Profiled at **0.73 ms - 1.36 ms / edit** in full scores due to array/object allocations in layout systems and measure chunk caches.

---

## 2. Baseline Profiling Tables (Step 1)

### 2.1 Multi-Bench (5 runs x 50 edits, vsync: ON)

| Scenario | Measure Count | Voices / Measure | Double rAF Medians (5 runs) (ms) | Double rAF Median (ms) | Double rAF p95s (5 runs) (ms) | Double rAF p95 Median (ms) | Double rAF p95 Range (ms) |
|---|---|---|---|---|---|---|---|
| **Mono Full** | 200 | 1 | 15.6, 15.6, 15.5, 15.0, 14.1 | 15.50 | 26.8, 22.4, 26.5, 20.3, 19.6 | 22.40 | 19.60 – 26.80 |
| **Mono Full** | 400 | 1 | 34.8, 34.2, 34.9, 35.7, 35.5 | 34.90 | 42.4, 42.9, 52.7, 46.6, 47.0 | 46.60 | 42.40 – 52.70 |
| **Polyphonic** | 200 | 2 | 10.5, 10.7, 10.8, 9.4, 10.9 | 10.70 | 17.5, 17.8, 17.3, 17.5, 18.2 | 17.50 | 17.30 – 18.20 |
| **Polyphonic** | 400 | 2 | 11.2, 10.6, 10.9, 11.7, 10.9 | 10.90 | 18.2, 17.4, 17.5, 16.7, 17.8 | 17.50 | 16.70 – 18.20 |

### 2.2 V8 CPU Profiler Per-Edit Breakdown (ms / edit)

| Scenario | buildSchedule | validateScore | Immer produce | layout | React commit | GC | other/idle |
|---|---|---|---|---|---|---|---|
| **200m 1-voice (Full)** | 0.00 ms | 1.87 ms | 0.38 ms | 8.70 ms | 0.24 ms | 0.73 ms | 109.48 ms |
| **400m 1-voice (Full)** | 0.00 ms | 4.19 ms | 0.63 ms | 28.83 ms | 0.21 ms | 1.36 ms | 111.22 ms |
| **200m 2-voice (Poly)** | 0.00 ms | 0.84 ms | 0.36 ms | 1.77 ms | 0.25 ms | 0.25 ms | 110.58 ms |
| **400m 2-voice (Poly)** | 0.00 ms | 1.63 ms | 0.62 ms | 2.53 ms | 0.18 ms | 0.59 ms | 109.81 ms |

---

## 3. Architecture Decisions (P1–P4)

### P1: Lazy `buildSchedule` & Frame-Throttled Playback Rebuild
- `buildSchedule` is not executed during edits.
- It is memoized by `Score` reference (`WeakMap<Score, ScheduleResult>`).
- When pressing Play, the schedule is built on-demand (exactly 1 build).
- If edits occur during active playback, the schedule is invalidated and rebuilt at most once per animation frame.
- **Instrumented Counter:** `scheduleBuildCounter`.

### P2: Deferred Validation Burst & Synchronous Checkpoints
- Single-note and range editing does not validate synchronously on every keystroke.
- Instead, validation is debounced by 100 ms with a maximum wait ceiling of 250 ms (`requestIdleCallback` / timer).
- If another edit arrives before the debounced timeout expires, the previous timer is cancelled and reset.
- Critical state transitions execute synchronous validation immediately:
  1. `Save` (file export / localStorage)
  2. `Play` (audio engine playback start)
  3. `Load` (opening file / template reset)
  4. `Undo` (restoring history state)
  5. `Redo` (re-applying history state)
- The status bar error and warning badges update immediately when synchronous checkpoints run, and asynchronously when edit bursts settle.
- **Instrumented Counter:** `validateRunCounter`.

### P3: Immer `setAutoFreeze(false)` Analysis
- On 400 measures, Immer `produce` self-time is **0.63 ms / edit**.
- Removing freezing saves < 0.25 ms, which is well below the lead-specified 0.5 ms threshold.
- Therefore, Immer auto-freezing remains enabled to preserve strict runtime immutability safety.

### P4: GC Reduction & Layout Array Reuse
- Top 3 allocation sources:
  1. Measure chunk and system items layout arrays in `layoutScore.ts` and `measureLayout.ts`.
  2. Transient validation problem objects during full-score scans.
  3. Audio preview node allocations during cursor pitch audition.
- Low-risk reduction implemented: Reusing and retaining pre-allocated arrays in per-measure and system layout caches, eliminating redundant allocations for unchanged measures.

---

## 4. Test Matrix & Verification

| Test ID | File | Test Description / Literal Name | Plan Item |
|---|---|---|---|
| **T1** | `tests/core/perf_optimizations.test.ts` | `T1: 100 edits without playing keep scheduleBuildCounter at 0; Play builds exactly 1; live edit during playback throttles to <= 1 rebuild per frame` | P1 |
| **T2** | `tests/core/perf_optimizations.test.ts` | `T2: 100 rapid edits defer validateScore (validateRunCounter <= 2); Save, Play, load, undo, redo validate synchronously` | P2 |
| **T3** | `tests/core/perf_optimizations.test.ts` | `T3: playing immediately after rapid edit burst compiles and plays the updated score without stale notes` | P1, P2 |
| **T4** | `tests/core/voice_property_m7a3.test.ts` | `verifies 20 seeds x 100 steps of random voice operations, isolation, and undo/redo reversibility` | Regression |
| **T5** | `scripts/multi_bench.mjs` | Multi-bench before/after comparison tables (200 & 400 measures, 1 & 2 voices) | Bench |
