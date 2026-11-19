<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# M7a-2b: Keyboard Voice Entry Design Document

## Lead-Specified Decisions

### D1: Keymap & Shortcuts
Tab / Shift+Tab in input mode cycle voice forward / backward. Outside input mode Tab keeps normal focus behaviour. Escape leaves input mode. No Ctrl+Alt+digit shortcuts.

### D2: Pure Cursor Functions
Cursor = { staffId, voiceIndex, measureId, tick }. Voice switching changes cursor only: never creates, never deletes, never modifies events or voices, never creates an undo entry. Invariant: tick is always at the START of a sounding event in that voice (or the barline); switching voices snaps to the start of the event sounding at the old tick, NEVER forward into silence or the next event. If the voice does not exist in that measure, cursor stays at the same tick (virtual cursor).

### D3: Voice Creation on Entry
First entry into a missing voice creates the voice in that measure in the SAME undo step: rests fill [0, t) via fillMeasureWithRests, then the entered event, then rests to the barline. Voices stay sorted by voiceIndex; gaps are allowed (voices 1 and 3 without 2).

### D4: Entry into Existing Voice
Reuses the existing entry path with voiceIndex.

### D5: Cursor Advance After Entry
Advances in the same voice, never dropping to voice 1; crossing barlines keeps voiceIndex (virtual if the target measure lacks that voice).

### D6: Status Bar Voice Indicator
Shows "Ses {N}" (tr) / "Voice {N}" (en) in input mode, with data-testid="status-voice-indicator", reactive to cursor.voiceIndex.

### D7: Undo/Redo Cursor Restoration
Undo and redo restore the exact cursor state (including voiceIndex).

### D8: Invariants
Voice 1 always exists. Voices cannot be deleted except by undo.

### D9: Out of Scope
Voice colours, moving notes between voices, voice crossing, deleting voices, selection across voices, grand staff, new entry keys.

## Test Matrix (T1–T8)

| Item | Description | Test File | Test Name | Status |
|------|-------------|-----------|-----------|--------|
| T1 | Pure cursor voice switching & snapping | `tests/ui/cursor_voice.test.ts` | `FAILING-FIRST: cycles forward (Tab) 1 -> 2 -> 3 -> 4 -> 1 and backward (Shift+Tab) 1 -> 4 -> 3 -> 2 -> 1` | DONE |
| T2 | Voice creation on entry with leading/trailing rests | `tests/core/voice_creation_entry.test.ts` | `T2: entry in missing voice 2 at tick 1920 of an empty 4/4 measure gives rests for [0, 1920) + the note + rests to the barline, total 3840; validateScore zero errors; voices sorted` | DONE |
| T3 | Gap case: voice 3 created while voice 2 missing | `tests/core/voice_creation_entry.test.ts` | `T3: gap case: voice 3 created while voice 2 is missing, sorted voices with gap allowed` | DONE |
| T4 | Seeded property test across multi-voice operations | `tests/core/voice_property.test.ts` | `verifies 20 seeds x 200 steps of random voice navigation, entry, and undo/redo` | DONE |
| T5 | UI voice switching and preventDefault | `tests/ui/tab_voice_ui.test.tsx` | `Tab in input mode changes the status bar voice text immediately` | DONE |
| T6 | Status bar i18n voice indicator "Ses N" / "Voice N" | `scripts/test_i18n_dom.mjs` | `CLI test script verifying DOM translation` | DONE |
| T7 | Playwright E2E 2-voice keyboard entry | `tests/e2e/m7a_voice_entry.spec.ts` | `E2E keyboard entry of BWV 140/7 mm. 1-2 voices 1 and 2` | COMMIT_4 |
| T8 | Playwright E2E undo/redo voice entry | `tests/e2e/m7a_voice_entry.spec.ts` | `E2E undo and redo of voice 2 entry restores previous state` | COMMIT_4 |
