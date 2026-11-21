# M7a-5: Multi-voice selection, copy and paste

Status: PROPOSED (decision needed from the project owner, section 4).

## 1. Problem
A range selection belongs to one voice of one staff (`Selection.range = { staffId, voiceIndex, anchorId, focusId }`).
Copy takes exactly those events, the clipboard is a flat `ScoreEvent[]`, and paste writes one voice. A measure written
in two voices (for example the Mozart K. 545 left hand of m. 6, or any SATB-on-two-staves score) therefore copies only
the voice that happened to be selected. Found during the K. 545 entry (the owner copied m. 6 of the left hand to m. 7
and only the second voice arrived).

## 2. Constraints
- Existing single-voice behaviour must not change (selection, delete, transpose, articulations all work per voice).
- Voice identity is `voiceIndex` (1..4); events keep their ids, paste creates new ids.
- Ties and slurs across the copied span must survive as today.
- The clipboard text format is versioned only implicitly; old single-voice payloads must still paste.

## 3. Options
**A. Explicit "all voices" flag.** `Selection.range` gets `allVoices?: true`. Shortcut `Ctrl+Shift+A` (select all voices of the
current measure span) or `Alt+Shift+Arrow` extends the range across voices. Copy then collects, per voice, the events inside
the tick span of the range; paste writes each voice to the same voice index at the target. Explicit, no surprises, a little
more UI and one more shortcut.

**B. Range always spans all voices of the staff.** Simple mental model (like most editors), but selecting only voice 2 (to
transpose or delete it) becomes impossible without a filter, so it breaks existing per-voice editing.

**C. Whole-measure shortcut only.** Keep ranges per voice; add "copy measure(s)" (`Ctrl+Alt+C`) that copies every voice of the
staff for the measure(s) of the current selection or cursor. Smallest change, solves the K. 545 case, does not cover a partial
span across voices.

## 4. Recommendation and open decision
Recommend **A with a measure-level entry point**: `allVoices` range, set by `Ctrl+Shift+A` ("select all voices of this measure")
and by extending with `Alt+Shift+Arrow`; copy/cut/paste/delete act on every voice in the span; transpose and notations stay
per-voice for the focused voice only (documented). The owner decides between A, B and C (or A later after C).

## 5. Clipboard format (for A and C)
`{ version: 2, ticks: <span length>, voices: [{ voiceIndex, events: ScoreEvent[] }] }`. A payload that is a bare array is read
as `version 1` (one voice, the old format). Paste at a cursor: each voice goes to the same `voiceIndex` of the target staff,
starting at the cursor tick; a voice missing in the target measure is created; events that do not fit are split with ties
exactly as `pasteEvents` does today.

## 6. Tests planned
- Copy of a two-voice measure and paste into another measure reproduces both voices (pitches, durations, ties).
- Old single-voice clipboard text still pastes.
- A range limited to voice 2 still copies only voice 2 (regression of the current behaviour).
- Paste across a barline with two voices splits and ties each voice independently.
- Undo restores both voices in one step.
