# M7a-4: Voice Entry Ergonomics Closing Report

> **Milestone:** M7a-4  
> **Status:** PASSED / COMPLETE  
> **Date:** 20.11.2026  
> **Standards:** ISO 9001:2015, R1–R7, WCAG 2.1 AA Contrast ($\ge 4.5:1$)  

---

## 1. Executive Summary & Problem Resolution

Prior to M7a-4, entering multi-voice polyphony from the keyboard suffered from three critical ergonomic deficiencies reported during manual evaluation:
1. **Inability to enter a second voice on the same beat:** Entering notes in Voice 1 advanced the cursor. Pressing `Tab` preserved the cursor tick (by M7a-2b D4 design), but there was no key to jump back to beat 1, no on-screen hint, and no toolbar voice selector.
2. **Missing Voice / Boundary Inactivity:** Pressing `N` showed "Ses 2" when selecting or entering, but notes could not be placed when the cursor sat at measure boundaries or when no event existed in that voice.
3. **Lack of Visual Guidance & Beat Reference:** The UI gave no indication of which voices had notes in a measure, no visual beat guide, and the caret color did not clearly distinguish voices.

**M7a-4 systematically solves all these issues:**
- **Navigation (U1, U2):** `Home` and `End` jump to measure start (tick 0) and end boundary (tick `mLength`) in the active voice. `ArrowLeft` and `ArrowRight` move strictly between event starts in the active voice, crossing barlines, stopping at first event on Left and append position on Right without creating phantom events.
- **Voice Toolbar Buttons (U3):** Four dedicated toolbar buttons (`Ses 1` .. `Ses 4` / `Voice 1` .. `Voice 4`) highlight the active voice, display a small indicator dot for voices with content in the active measure, and allow clicking in input mode.
- **Enhanced Status Bar (U4):** Displays duration, measure number, beat position (e.g. `Ölçü 1 · Vuruş 1` for 4/4 or compound dotted-quarter pulses for 6/8, 9/8, 12/8), active voice chip, and contextual shortcut hints (`Tab: Ses • Home: Ölçü başı • Oklar: Gezinme`).
- **Voice Colors & WCAG 2.1 Contrast (U7):** 
  - Voice 1: `#1e293b` (Slate-800, contrast 14.63:1 against `#ffffff`)
  - Voice 2: `#b45309` (Amber-700, contrast 5.02:1 against `#ffffff`)
  - Voice 3: `#047857` (Emerald-700, contrast 5.48:1 against `#ffffff`)
  - Voice 4: `#7e22ce` (Purple-700, contrast 6.98:1 against `#ffffff`)
  - All colors exceed WCAG 2.1 AA minimum 4.5:1 and are distinct from selection blue (`#2563eb`).
  - Per-voice caret renders a numeric label badge (`1`..`4`) and color chip in the status bar.
- **Beat Guide & Pending Slot Band (U8):** Drawn completely in the SVG UI layer using existing layout event columns (piecewise monotonic linear interpolation) with **zero layout passes** on cursor moves. Verified by `window.__layoutRunCounter`.
- **Discoverability Tip (U9):** Dismissible banner rendered on first entry to note input mode, persisting dismissal state in `localStorage` wrapped in defensive `try/catch`.

---

## 2. Step 0 Evidence & Historical Clarifications

### 0.1 perf-2 C3 Retraction
In `docs/review/perf-2-closing-report.md`, the claim "GC 1.36 -> ~0.59 ms/edit" was corrected. The after-profile GC time for mono 400 measures is properly documented as $\le 0.63$ ms (upper bound), eliminating unverified claims.

### 0.2 Input Mode Key Mappings
Recorded in `docs/review/evidence/step0_keys_input_mode.txt`:
- `KeyC`..`KeyB`: Note entry relative to previous pitch / clef
- `Digit0`: Rest entry with active duration
- `Digit1`..`Digit7`: Duration palette selection
- `Period`: Toggle augmentation dot
- `Home` / `End`: Jump to measure start (tick 0) / end (`mLength`)
- `ArrowLeft` / `ArrowRight`: Move cursor by event start in active voice
- `Tab` / `Shift+Tab`: Cycle active voice forward / backward
- `ControlOrMeta+ArrowUp` / `ControlOrMeta+ArrowDown`: Transpose selected/last note octave $\pm 12$
- `ArrowUp` / `ArrowDown`: Transpose semitone $\pm 1$

### 0.3 Repro Script Execution
Executed via `scripts/repro_two_voice_entry.mjs` and recorded in `docs/review/evidence/step0_repro_output.txt`:
- **Scenario S-a:** Confirmed cursor advanced to next beat after note 1, leaving user on beat 2 unless navigation keys are available.
- **Scenario S-b:** Entering notes in Voice 2 directly creates Voice 2.
- **Scenario S-c & S-d:** Verified existing scores and multi-voice selections.

---

## 3. Test Matrix & Verification Results (T1 – T13)

| Test ID | Description | Test Location | Status |
|:---|:---|:---|:---:|
| **T1** | Keyboard two-voice measure (Voice 1 quarters, Home, Tab, Voice 2 quarters) | `tests/core/voice_entry_navigation.test.ts` | **PASS** |
| **T2** | Reverse order (Voice 2 first, Home, Shift+Tab, Voice 1) | `tests/core/voice_entry_navigation.test.ts` | **PASS** |
| **T3** | Mid-measure navigation with Left arrow back to beat 1 without touching notes | `tests/core/voice_entry_navigation.test.ts` | **PASS** |
| **T4** | Left/Right on missing voice stops at first event & append position, 0 phantom events | `tests/core/voice_entry_navigation.test.ts` | **PASS** |
| **T5** | Undo/redo restores cursor voiceIndex and tick across navigation key paths | `tests/core/voice_entry_navigation.test.ts` | **PASS** |
| **T6** | Toolbar voice buttons match Tab, highlight active voice, content dots, TR/EN | `tests/ui/voice_toolbar_buttons.test.tsx` | **PASS** |
| **T7** | Playwright E2E verifies real keystrokes, DOM notehead count 8, export verification | `scripts/test_two_voice_keyboard_e2e.mjs` | **PASS** |
| **T8** | Regression suite, golden snapshots, and existing suites remain unchanged | `tests/render/gallery_snapshots.test.ts` | **PASS** |
| **T9** | Beat guide aligns with event columns, 0 layout runs on 100 cursor moves | `tests/ui/beat_guide.test.tsx` | **PASS** |
| **T10** | Pending-slot band spans cursor tick to duration, updates on change, clamps to end | `tests/ui/beat_guide.test.tsx` | **PASS** |
| **T11** | Voice color contrast $\ge 4.5:1$, distinct from selection blue, caret badge | `tests/ui/voice_colors_contrast.test.ts` | **PASS** |
| **T12** | Status bar displays beat position for 4/4, 3/4, 6/8 in Turkish and English | `tests/ui/status_bar_beat.test.tsx` | **PASS** |
| **T13** | Two-voice entry tip shown on first entry, remembered, safe against storage errors | `tests/ui/input_tip.test.tsx` | **PASS** |

### Mutation Testing Evidence
- **Mutation M for T1:** Simulated `Home` key jumping to measure end (`tick: mLength`). Failed immediately (`expected 0, received 3840`). Recorded in `docs/review/evidence/m7a4_mutation_t1.txt`.
- **Mutation M for T3:** Simulated `Left` arrow moving by 1 tick instead of event start. Failed immediately (`expected 0, received 959`). Recorded in `docs/review/evidence/m7a4_mutation_t3.txt`.
- **Mutation M for T9:** Simulated `computeBeatGuide` invalidating layout memo. Failed immediately (`expected 1 layout run, received 101`). Recorded in `docs/review/evidence/m7a4_mutation_t9.txt`.

---

## 4. Visual Evidence Artifacts

Captured during automated Playwright E2E run (`scripts/test_two_voice_keyboard_e2e.mjs`) and stored in `docs/screenshots/m7a-4/` and `artifacts/`:

1. `01_two_voice_measure.png` — Completed two-voice measure (Voice 1 C5-D5-E5-F5 stem-up, Voice 2 C4-D4-E4-F4 stem-down, 8 distinct noteheads, captured BEFORE Ctrl+S download, no toast).
2. `02_beat_guide_pending_band_voice1.png` — Beat guide ticks (beats 1, 2, 3, 4) and blue pending-slot band for Voice 1 at tick 0.
3. `03_beat_guide_shared_beat_voice2.png` — Voice 2 caret (amber `#b45309`, labeled badge "2") on beat 1 with coincident vertical guide line aligned with existing Voice 1 note.
4. `04_toolbar_voice_buttons_dots.png` — Toolbar voice buttons showing `Ses 1` and `Ses 2` with content dots indicating notes in the active measure.
5. `05_one_time_tip.png` — Dismissible two-voice ergonomics helper banner rendered upon entering input mode.

---

## 5. Overall System Check (`npm run check`)

Output recorded in `docs/review/evidence/m7a4_npm_check.txt`:
```
Test Files  110 passed (110)
     Tests  731 passed (731)
  Duration  18.71s
✓ All folder boundary import rules verified cleanly across 109 files.
✓ All 11 production dependencies comply with GPL-3.0 compatibility standards.
✓ All 265 source files have valid SPDX GPL-3.0-or-later headers.
✓ PASS: No forbidden 'voiceId' usages found in src/.
✓ All 22 DONE traceability rows statically verified against actual test files.
✓ docs/SHORTCUTS.md is up to date with src/ui/keymap.ts.
✓ built in 5.53s
```
Total errors: **0**.
