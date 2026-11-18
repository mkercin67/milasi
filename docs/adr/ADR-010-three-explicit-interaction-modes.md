# ADR-010: Three Explicit Interaction Modes (Select, Input, Position)

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
A score editor must support multiple distinct workflows:
1. Structural navigation, selection, copy/paste, transposition, and range editing.
2. Step-time note and rest entry with a persistent insertion cursor.
3. Micro-adjustments and visual nudging of glyph layout offsets (overrides).

Overloading keys (e.g., arrow keys or letter keys) without clear modal boundaries leads to user confusion, unexpected score edits, and complex condition trees in event handlers.

## Decision
We enforce three mutually exclusive, explicit editor interaction modes (`EditorMode = 'select' | 'input' | 'position'`):
1. **Select Mode (`select`):**
   - Active by default.
   - Arrow keys navigate between notes and measures or transpose selected notes.
   - Letter keys (A-G) do not enter notes; they provide informative status hints to switch to Input mode (KeyN).
   - Range selection (Shift+Click, Shift+Arrows, Marquee drag) operates in this mode.
2. **Note Input Mode (`input`):**
   - Activated via `KeyN` or toolbar toggle.
   - Displays a visible rhythmic cursor line and ghost note on the staff.
   - Letter keys (A-G) enter notes at cursor position; `Digit0` enters rests; `Digit2`..`Digit7` change input duration; `Period` toggles augmentation dots.
   - Navigation moves the cursor across voices and measures.
3. **Position Mode (`position`):**
   - Activated via `KeyP` when a single note or element is selected.
   - Arrow keys nudge visual offset overrides (`dx`, `dy`) in discrete increments (0.25 staff spaces; 1.0 staff spaces with Shift).
   - `Ctrl+Digit0` resets overrides to default zero.
   - `Escape` returns to Select mode.

4. **Centralized Key Routing:**
   - All keyboard shortcuts are mapped through `src/ui/keymap.ts` using strict `event.code` matching, partitioned cleanly by active `EditorMode`.

## Consequences
### Positive
- Zero ambiguous key bindings; clear predictability for keyboard navigation and typing.
- Visual feedback is unmistakably tied to active mode (cursor/ghost note in input mode, nudge indicators in position mode, blue selection box in select mode).
- Handlers in `useAppKeyboard` cleanly branch on mode without spaghetti conditional logic.

### Negative
- Users must explicitly switch modes (`KeyN`, `KeyP`, `KeyV` / `Escape`) to perform specific tasks.
