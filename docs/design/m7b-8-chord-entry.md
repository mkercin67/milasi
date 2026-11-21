# M7b-8: Chord entry from the keyboard

Status: IMPLEMENTED (found during the Mozart K. 545 acceptance, mm. 5-7 left hand).

## Behaviour
- Input mode only. Enter the lowest pitch as usual (letter key), then press **Shift + letter (C..B)**:
  the pitch with that letter directly above the current top pitch of the note just entered is added to it
  (`F3` then `Shift+C` gives `F3 + C4`; the same letter gives the octave above; at most one octave of leap).
- The accidental comes from the key signature, like normal entry. The cursor does not move; the chord stays
  selected. Further `Shift+letter` presses stack more pitches on top.
- Nothing before the cursor (or a rest) shows the existing "does not fit / no cursor" message.
- One undo step per added pitch (`changePitch`, the same command used for editing pitches).
- Playback preview sounds the added pitch.

## Known limits (accepted)
- Pitches can only be added upwards; build a chord from its lowest note. Removing a single pitch of a chord and
  entering a pitch below the top one are not covered (candidate for M7c).
- `Ctrl+Up/Down` and `Up/Down` act on the whole chord, as before.
- Ties and articulations apply to the event, so they cover every pitch of the chord.

## Code
- `src/core/input.ts`: `findNoteBeforeCursor`, `chordPitchAbove`, `topPitch` (pure, no score mutation).
- `src/ui/keymap.ts`: `add-chord-pitch` action, `Shift+C..B` in input mode (generated `docs/SHORTCUTS.md`).
- `src/ui/editor/useEditorInput.ts`: `addChordPitchAtCursor`; wired through `useEditor`, `App`, `useAppKeyboard`.
- Tests: `tests/core/chord_entry.test.ts` (C1-C6), `tests/ui/keymap.test.ts` (M7b-8 key mapping).
