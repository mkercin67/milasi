# MiLaSi — Keyboard Shortcuts Reference

> **Generated dynamically from `src/ui/keymap.ts`**  
> **Physical Layout Rule:** All shortcuts operate exclusively on physical key positions (`event.code`). They function identically on US QWERTY, Turkish Q, AZERTY, Dvorak, or any other keyboard layout.

---

## 1. Global Shortcuts (All Modes)

| Key | Physical Code | Modifiers | Action |
|-----|---------------|-----------|--------|
| `Space` | `Space` | - | toggle-playback |
| `Space` | `Space` | `Shift` | play-from-start |
| `S` | `KeyS` | `Ctrl` | save-score |
| `S` | `KeyS` | `Ctrl+Shift` | save-as-score |
| `O` | `KeyO` | `Ctrl` | open-score |
| `Z` | `KeyZ` | `Ctrl` | undo |
| `Z` | `KeyZ` | `Ctrl+Shift` | redo |
| `Y` | `KeyY` | `Ctrl` | redo |
| `Up` | `ArrowUp` | `Ctrl` | transpose-octave-up |
| `Down` | `ArrowDown` | `Ctrl` | transpose-octave-down |
| `0` | `Digit0` | `Ctrl` | reset-override |
| `V` | `KeyV` | - | set-mode-select |
| `N` | `KeyN` | - | toggle-note-input |
| `P` | `KeyP` | - | toggle-position-mode |
| `U` | `KeyU` | - | toggle-lyrics-mode |
| `.` | `Period` | - | toggle-dot |

---

## 2. Select Mode (`mode: 'select'`)

Activated via `KeyV` or `Escape`. Primary mode for navigation, transposition, deletion, copying, and notation editing.

| Key | Physical Code | Modifiers | Action |
|-----|---------------|-----------|--------|
| `Esc` | `Escape` | - | clear-selection |
| `A` | `KeyA` | `Ctrl` | select-all |
| `M` | `KeyM` | - | select-measure-voices |
| `C` | `KeyC` | `Ctrl` | copy |
| `X` | `KeyX` | `Ctrl` | cut |
| `V` | `KeyV` | `Ctrl` | paste |
| `B` | `KeyB` | `Ctrl` | insert-measure |
| `S` | `KeyS` | - | toggle-slur |
| `T` | `KeyT` | - | toggle-tie |
| `X` | `KeyX` | - | reset-accidental |
| `J` | `KeyJ` | - | toggle-articulation: staccato |
| `K` | `KeyK` | - | toggle-articulation: tenuto |
| `L` | `KeyL` | - | toggle-articulation: accent |
| `L` | `KeyL` | `Shift` | toggle-articulation: marcato |
| `H` | `KeyH` | - | cycle-fermata |
| `H` | `KeyH` | `Shift` | toggle-breath-mark |
| `1` | `Digit1` | `Shift` | apply-dynamic: pp |
| `2` | `Digit2` | `Shift` | apply-dynamic: p |
| `3` | `Digit3` | `Shift` | apply-dynamic: mp |
| `4` | `Digit4` | `Shift` | apply-dynamic: mf |
| `5` | `Digit5` | `Shift` | apply-dynamic: f |
| `6` | `Digit6` | `Shift` | apply-dynamic: ff |
| `7` | `Digit7` | `Shift` | apply-dynamic: sfz |
| `8` | `Digit8` | `Shift` | apply-dynamic: fp |
| `2` | `Digit2` | - | set-duration: 32nd |
| `3` | `Digit3` | - | set-duration: 16th |
| `4` | `Digit4` | - | set-duration: eighth |
| `5` | `Digit5` | - | set-duration: quarter |
| `6` | `Digit6` | - | set-duration: half |
| `7` | `Digit7` | - | set-duration: whole |
| `Left` | `ArrowLeft` | - | select-prev |
| `Right` | `ArrowRight` | - | select-next |
| `Up` | `ArrowUp` | - | transpose-semitone-up |
| `Down` | `ArrowDown` | - | transpose-semitone-down |
| `Left` | `ArrowLeft` | `Shift` | extend-selection-prev |
| `Right` | `ArrowRight` | `Shift` | extend-selection-next |
| `Up` | `ArrowUp` | `Shift` | cycle-accidental-up |
| `Down` | `ArrowDown` | `Shift` | cycle-accidental-down |
| `Del` | `Delete` | - | convert-to-rest |
| `Backspace` | `Backspace` | - | convert-to-rest |

---

## 3. Note Input Mode (`mode: 'input'`)

Activated via `KeyN`. Enter pitches, rests, and note durations.

| Key | Physical Code | Modifiers | Action |
|-----|---------------|-----------|--------|
| `Esc` | `Escape` | - | exit-note-input |
| `1` | `Digit1` | `Shift` | apply-dynamic: pp |
| `2` | `Digit2` | `Shift` | apply-dynamic: p |
| `3` | `Digit3` | `Shift` | apply-dynamic: mp |
| `4` | `Digit4` | `Shift` | apply-dynamic: mf |
| `5` | `Digit5` | `Shift` | apply-dynamic: f |
| `6` | `Digit6` | `Shift` | apply-dynamic: ff |
| `7` | `Digit7` | `Shift` | apply-dynamic: sfz |
| `8` | `Digit8` | `Shift` | apply-dynamic: fp |
| `Tab` | `Tab` | - | next-voice |
| `Tab` | `Tab` | `Shift` | prev-voice |
| `[` | `BracketLeft` | - | staff-up |
| `]` | `BracketRight` | - | staff-down |
| `Home` | `Home` | - | cursor-measure-start |
| `End` | `End` | - | cursor-measure-end |
| `Home` | `Home` | `Ctrl` | cursor-score-start |
| `End` | `End` | `Ctrl` | cursor-score-end |
| `Left` | `ArrowLeft` | `Ctrl` | cursor-prev-measure |
| `Right` | `ArrowRight` | `Ctrl` | cursor-next-measure |
| `C..B` | `KeyC..KeyB` | - | enter-pitch |
| `C..B` | `KeyC..KeyB` | `Shift` | add-chord-pitch |
| `0` | `Digit0` | - | enter-rest |
| `B` | `KeyB` | `Ctrl` | insert-measure |
| `V` | `KeyV` | `Ctrl` | paste |
| `S` | `KeyS` | - | toggle-slur |
| `T` | `KeyT` | - | toggle-tie |
| `X` | `KeyX` | - | reset-accidental |
| `J` | `KeyJ` | - | toggle-articulation: staccato |
| `K` | `KeyK` | - | toggle-articulation: tenuto |
| `L` | `KeyL` | - | toggle-articulation: accent |
| `L` | `KeyL` | `Shift` | toggle-articulation: marcato |
| `H` | `KeyH` | - | cycle-fermata |
| `H` | `KeyH` | `Shift` | toggle-breath-mark |
| `2` | `Digit2` | - | set-duration: 32nd |
| `3` | `Digit3` | - | set-duration: 16th |
| `4` | `Digit4` | - | set-duration: eighth |
| `5` | `Digit5` | - | set-duration: quarter |
| `6` | `Digit6` | - | set-duration: half |
| `7` | `Digit7` | - | set-duration: whole |
| `Left` | `ArrowLeft` | - | select-prev |
| `Right` | `ArrowRight` | - | select-next |
| `Up` | `ArrowUp` | - | transpose-semitone-up |
| `Down` | `ArrowDown` | - | transpose-semitone-down |
| `Left` | `ArrowLeft` | `Shift` | extend-selection-prev |
| `Right` | `ArrowRight` | `Shift` | extend-selection-next |
| `Up` | `ArrowUp` | `Shift` | cycle-accidental-up |
| `Down` | `ArrowDown` | `Shift` | cycle-accidental-down |
| `Del` | `Delete` | - | convert-to-rest |
| `Backspace` | `Backspace` | - | convert-to-rest |

---

## 4. Position Mode (`mode: 'position'`)

Activated via `KeyP`. Fine engraving layout nudging (`dx` / `dy`).

| Key | Physical Code | Modifiers | Action |
|-----|---------------|-----------|--------|
| `Esc` | `Escape` | - | set-mode-select |
| `Left` | `ArrowLeft` | - | nudge dx: -0.25 |
| `Right` | `ArrowRight` | - | nudge dx: +0.25 |
| `Up` | `ArrowUp` | - | nudge dy: -0.25 |
| `Down` | `ArrowDown` | - | nudge dy: +0.25 |
| `Left` | `ArrowLeft` | `Shift` | nudge dx: -1.0 |
| `Right` | `ArrowRight` | `Shift` | nudge dx: +1.0 |
| `Up` | `ArrowUp` | `Shift` | nudge dy: -1.0 |
| `Down` | `ArrowDown` | `Shift` | nudge dy: +1.0 |
| `Tab` | `Tab` | - | select-next |
| `Tab` | `Tab` | `Shift` | select-prev |
| `S` | `KeyS` | - | toggle-slur |
| `T` | `KeyT` | - | toggle-tie |
| `X` | `KeyX` | - | reset-accidental |
| `J` | `KeyJ` | - | toggle-articulation: staccato |
| `K` | `KeyK` | - | toggle-articulation: tenuto |
| `L` | `KeyL` | - | toggle-articulation: accent |
| `L` | `KeyL` | `Shift` | toggle-articulation: marcato |
| `H` | `KeyH` | - | cycle-fermata |
| `H` | `KeyH` | `Shift` | toggle-breath-mark |
| `1` | `Digit1` | `Shift` | apply-dynamic: pp |
| `2` | `Digit2` | `Shift` | apply-dynamic: p |
| `3` | `Digit3` | `Shift` | apply-dynamic: mp |
| `4` | `Digit4` | `Shift` | apply-dynamic: mf |
| `5` | `Digit5` | `Shift` | apply-dynamic: f |
| `6` | `Digit6` | `Shift` | apply-dynamic: ff |
| `7` | `Digit7` | `Shift` | apply-dynamic: sfz |
| `8` | `Digit8` | `Shift` | apply-dynamic: fp |

---

## 5. Lyrics Mode (`mode: 'lyrics'`)

Activated via `KeyU`. Syllable entry and melisma extender input aligned to noteheads.

| Key | Physical Code | Modifiers | Action |
|-----|---------------|-----------|--------|
| `Esc` | `Escape` | - | set-mode-select |
| `Space` | `Space` | - | lyrics-commit-and-next |
| `Enter` | `Enter` | - | lyrics-commit-and-next |
| `Tab` | `Tab` | - | lyrics-next-note |
| `Tab` | `Tab` | `Shift` | lyrics-prev-note |
| `Backspace` | `Backspace` | - | lyrics-backspace-prev |

---

## 6. Summary of Key Notation Mappings

- **Tie (Bağ):** `KeyT` (Select and Position modes)
- **Slur (Legato bağı):** `KeyS` (Select and Position modes)
- **Fermata:** `KeyH` cycles none, above, below (all modes); **Breath mark:** `Shift+KeyH`
- **Articulations:**
  - Staccato: `KeyJ`
  - Tenuto: `KeyK`
  - Accent (Aksan): `KeyL`
  - Marcato: `Shift+KeyL`
- **Dynamics:** `Shift+Digit1` through `Shift+Digit8` (`pp`, `p`, `mp`, `mf`, `f`, `ff`, `sfz`, `fp`)
- **Pitch Entry:** Letters `KeyC`..`KeyB` (C, D, E, F, G, A, B)
- **Rest Entry:** `Digit0`
- **Augmentation Dot:** `Period` (never used for articulations)
