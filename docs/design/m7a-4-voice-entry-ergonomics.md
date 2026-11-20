# M7a-4 Design Document: Voice Entry Ergonomics

## 1. Overview and Scope
Milestone M7a-4 solves keyboard-only multi-voice entry ergonomics and visibility in ScoreForge prior to M7b. It addresses human-reported friction where entering a second voice on the same beat was hindered by lack of navigation keys, absence of toolbar voice selectors, missing beat guides, and lack of visual voice state indication.

## 2. Architecture & Design Decisions (U1 – U9)

### U1: Event Navigation in Input Mode (Left / Right)
- In note input mode (`mode === 'input'`), `ArrowLeft` and `ArrowRight` move the cursor strictly within the active voice (`cursor.voiceIndex`).
- Missing voice measures utilize virtual cursor positioning (`tick: 0`).
- Rests count as events.
- Boundary rules:
  - Cursor never leaves the score boundaries.
  - At the first event of the score, `ArrowLeft` is a no-op.
  - At the last event of the score, `ArrowRight` advances to the append position (`tick: mLength` of the last measure). At the append position, `ArrowRight` is a no-op and never creates events.
  - From the append position, `ArrowLeft` returns to the preceding event start.
- `preventDefault()` is called for `ArrowLeft` and `ArrowRight` exclusively in input mode (allowing standard browser scroll/navigation in select or other modes).

### U2: Measure Boundary Navigation (Home / End)
- In input mode, `Home` moves the cursor to the start of the current measure (`tick: 0`) in the active voice.
- `End` moves the cursor to the end / append boundary of the current measure (`tick: mLength`) in the active voice.
- `preventDefault()` is called in input mode.
- Shortcut combinations do not conflict with AltGr (no `Ctrl+Alt`).

### U3: Toolbar Voice Buttons ("Ses 1" .. "Ses 4" / "Voice 1" .. "Voice 4")
- Visible in all editor modes.
- Clickable exclusively in `input` mode (`disabled` or inert in `select`, `position`, `lyrics`).
- Clicking a voice button has the exact semantics of `Tab` (M7a-2b Decisions D3–D5): updates cursor `voiceIndex` with zero score mutation until the first note entry.
- The active voice is visually highlighted with high contrast.
- Each button features a small indicator dot if that voice contains non-rest content (one or more `NoteEvent`) in the measure containing the cursor (or active selection).

### U4: Input-Mode Status Bar & Contextual Hints
- In input mode, the status bar displays:
  `<duration> · Ölçü {measure} · Vuruş {beat} · {voice}` (Turkish)
  `<duration> · Measure {measure} · Beat {beat} · {voice}` (English)
- Beat position calculation:
  - Simple meters (e.g. 4/4, 3/4, 2/4): `1 + currentTick / ticksPerBeat` where `ticksPerBeat = (4 / beatType) * PPQ`.
  - Compound meters (6/8, 9/8, 12/8): counts dotted-quarter pulses (1440 ticks per pulse).
  - Clean numeric formatting: integers formatted as whole numbers (e.g. `2`), fractions as decimals (e.g. `2.5`).
- Contextual shortcut hint line in input mode:
  - `Tab: Ses` / `Tab: Voice`
  - `Home: Ölçü başı` / `Home: Measure start`
  - `Oklar: Gezinme` / `Arrows: Move cursor`
- All strings sourced from `src/ui/i18n/locales/tr.json` and `en.json`.
- `scripts/generateShortcuts.mjs` is run to keep `docs/SHORTCUTS.md` synchronized.

### U5: Undo / Redo Cursor Restoration
- Undo and redo commands preserve and restore both `cursor.voiceIndex` and `cursor.tick` for all newly introduced key navigation paths (consistent with M7a-2b D9).

### U6: Out of Scope
- Multi-voice chord input within a single voice event.
- Automatic voice crossing conflict rules.
- Automatic stem collision resolution beyond standard polyphonic direction rules.
- Rest consolidation (individual rests in empty voices are preserved as designed).

### U7: Per-Voice Visual Indicator & Caret Contrast
- The score input caret is rendered in a distinct per-voice color.
- A numeric label badge (`1` .. `4`) is rendered directly adjacent to the caret line.
- The status bar voice indicator includes a color chip matching the voice color.
- Contrast verification:
  - All four voice colors achieve WCAG 2.1 contrast ratio $\ge 4.5:1$ against white background (`#ffffff`):
    - Voice 1: `#1e293b` (slate-800, ~14.6:1)
    - Voice 2: `#b45309` (amber-700, ~5.0:1)
    - Voice 3: `#047857` (emerald-700, ~5.5:1)
    - Voice 4: `#7e22ce` (purple-700, ~7.0:1)
  - All colors are distinct from selection blue (`#2563eb`).
  - Color is never the sole information carrier: textual label (`1`..`4` and `Ses N`/`Voice N`) is always present.

### U8: Beat Guide & Pending-Slot Band (UI Layer Only, Zero Layout Passes)
- Purely rendered within `ScoreSvgLayers.tsx` using already computed layout geometry.
- Moving the cursor 100 times results in zero calls to `layoutScore` (verified by `window.__layoutRunCounter`).
- Sub-components:
  a) **Beat Tick Marks & Labels**: Thin tick marks below the active staff lines ($Y \approx 4.4$ to $4.8$) with faint beat numbers ($1, 2, 3\dots$) for the measure containing the cursor.
     - Positioned using linear interpolation between layout event columns:
       $$x(t) = x_1 + \frac{t - t_1}{t_2 - t_1}(x_2 - x_1)$$
     - Boundary rule: For ticks before the first event column, interpolate from $(0, \text{measureStartX} + 0.8)$. For ticks after the last event column, interpolate to $(mLength, \text{endBarlineX} - 0.5)$.
  b) **Pending-Slot Translucent Band**: Spans from `cursor.tick` to `min(mLength, cursor.tick + selectedDuration)` in active voice color with ~15% opacity.
  c) **Coincident Event Guide Line**: When `cursor.tick` matches an existing event start in another voice, a faint dashed vertical guide line is drawn through that event column.

### U9: Discoverability Tip Banner
- First entry into note input mode renders a dismissible tip banner:
  "Birden fazla ses için Tab. Aynı vuruşa ikinci ses: Home, Tab." (Turkish)
  "For multiple voices use Tab. For a second voice on the same beat: Home, Tab." (English)
- Dismissal is persisted in `localStorage` under `scoreforge:dismissed_two_voice_tip` wrapped in `try/catch`.
- If `localStorage` throws or is unavailable (private browsing), the banner displays safely without errors.

---

## 3. Test Matrix (T1 – T13)

| ID | Test Name | File | Description |
|---|---|---|---|
| T1 | `T1: keyboard-only two-voice measure enters quarters in voice 1, Home, Tab, then quarters in voice 2` | `tests/core/voice_entry_navigation.test.ts` | Complete two-voice measure entry: N, 4 quarters in voice 1, Home to beat 1, Tab to voice 2, 4 quarters in voice 2. Validates ticks, pitches, zero errors. Mutation M: Home moves to measure end instead of start. |
| T2 | `T2: reverse order enters voice 2 notes first, Home, Shift+Tab, then voice 1 notes` | `tests/core/voice_entry_navigation.test.ts` | Enter voice 2 notes first, Home, Shift+Tab to voice 1, enter voice 1 notes. |
| T3 | `T3: mid-measure navigation with Left arrow moves back to beat 1 without touching existing notes` | `tests/core/voice_entry_navigation.test.ts` | Enter 2 quarters in voice 1, Left Left back to beat 1, Tab to voice 2, enter quarters from beat 1. Voice 1 notes untouched. Mutation M: Left moves by one tick instead of event start. |
| T4 | `T4: Left and Right navigation on missing voice stops at first event and append position without creating events` | `tests/core/voice_entry_navigation.test.ts` | Navigation on missing voice: Left at tick 0 is no-op, Right stops at append position without creating events. |
| T5 | `T5: undo and redo restore cursor voiceIndex and tick for every new key path` | `tests/core/voice_entry_navigation.test.ts` | Cursor voiceIndex and tick restored on undo and redo across Home, End, Left, Right, Tab workflows. |
| T6 | `T6: toolbar voice buttons match Tab behavior, highlight active voice, show content dots, and support tr/en` | `tests/ui/voice_toolbar_buttons.test.tsx` | Toolbar "Ses 1".."Ses 4" reflect active voice, show content dots when notes exist in measure, disabled outside input mode. |
| T7 | `T7: Playwright E2E verifies keyboard-only two-voice measure with real keystrokes and export verification` | `tests/ui/two_voice_keyboard_e2e_spec.test.ts` & `scripts/test_two_voice_keyboard_e2e.mjs` | Full Playwright E2E test executing T1 workflow, verifying DOM glyph counts, no toast in pre-download screenshot, and asserting exported score file. |
| T8 | `T8: existing test suite, Playwright suites, and gallery snapshots remain unchanged and green` | `tests/render/gallery_snapshots.test.ts` | Regression baseline verified. |
| T9 | `T9: beat guide aligns tick marks with event columns for 4/4 and 6/8 and moving cursor 100 times causes zero layout runs` | `tests/ui/beat_guide.test.tsx` | Beat marks align with columns, monotonic mapping for dotted/eighth notes, 6/8 has 2 pulses, moving cursor 100 times does not increment layoutRunCounter. Mutation M: guide forces a layout run. |
| T10 | `T10: pending-slot band spans cursor tick to duration, updates on duration change, clamps at measure end, and uses voice color` | `tests/ui/beat_guide.test.tsx` | Translucent pending band spans [tick, tick + dur], clamps at mLength, reflects active duration changes. |
| T11 | `T11: per-voice caret label equals active voice, chip matches, WCAG contrast >= 4.5:1, distinct from selection blue` | `tests/ui/voice_colors_contrast.test.ts` | Mathematical verification of luminance and contrast ratios $\ge 4.5:1$ against white, distinct from `#2563eb`, caret label matches voiceIndex. |
| T12 | `T12: status bar displays beat position for 4/4, 3/4, and compound 6/8 in Turkish and English` | `tests/ui/status_bar_beat.test.tsx` | Status bar displays formatted beat positions for simple and compound meters in both languages. |
| T13 | `T13: two-voice entry tip is shown on first input mode entry, remembered on dismiss, and survives localStorage throwing` | `tests/ui/input_tip.test.tsx` | First entry shows tip, dismissal persists, simulated storage failure does not crash and re-shows tip. |
