# M7c-3b: Grace notes (appoggiatura, acciaccatura)

Status: IMPLEMENTED v1 (owner approved). Part 1 (model, validation, commands, transpose, clipboard) part 2 (layout), part 3 (editing) and part 4 (playback) are implemented. The gallery card is not added: the other M7c marks (fermata, hairpins, ornaments) have none either, so one combined card is left for a later step. Differences from the proposal: a grace note has no `id` (it is addressed by its index in `graces`); the clipboard did not carry event-level marks before, so `pasteEvents` now carries graces, ornament, fermata, breath mark/caesura and the courtesy flag on the first slice of a copied note.
Part of `docs/design/m7c-plan.md` (owner decision Q2: in scope). Engraving rules follow the literature (Gould,
*Behind Bars*, chapter on ornaments; Ross, *The Art of Music Engraving*). Sizes and distances are a first proposal and
stay **UNVERIFIED until the owner compares the result with a public-domain edition** (BWV 772 and flute literature).

## 1. What is added
| Kind | Look | Typical meaning |
|---|---|---|
| Acciaccatura | small note, stem up, slash across the stem, slur to the main note | very short, played before or on the beat |
| Appoggiatura | small note, stem up, no slash, slur to the main note | takes a share of the main note's value |

One to four grace notes may precede one main note (two or more are beamed together). Chords as grace notes are not in v1.

## 2. Model: grace notes belong to the next main note (decision D1)
```
NoteEvent.graces?: GraceNote[]        // absent = none; drawn left of the event, in order
GraceNote = { kind: 'acciaccatura' | 'appoggiatura', pitch: Pitch, baseType: 'eighth' | '16th' | '32nd' }
```
Reason: a grace note has **no duration in the bar**. If it were a normal event it would break bar-length validation,
tuplet checks, beaming, cursor movement, copy and paste, and every existing command. Stored on the main note, all of
that stays untouched: measure sums, tuplets, delete, transpose of ranges (graces transpose with the note), clipboard
(the field lives on the event), and the schema number does not change.
- Validation: at most 4 graces, known kind and baseType, valid pitch; graces only on notes (not rests, not inside a
  chord's per-pitch data).
- Deleting the main note deletes its graces (they have no other anchor).

## 3. Layout (inside the measure chunk, left of the main note)
- Notehead scale 0.65 of normal, stem up, stem length 2.6 sp (stem-up for every grace note, also over low notes, by convention).
- Acciaccatura: slash is a short oblique line across the stem. Appoggiatura: none.
- One grace note: a flag (8th flag glyph, scaled). Two or more: one common beam (straight, slightly sloped by the
  first-to-last pitch difference, clamped), the flags are omitted.
- Slur: from the first grace note to the main note, curve below the noteheads when the main note stem is up and above
  when it is down (reuses `SlurLayoutItem`; the slur is a layout item of the grace group, no model field needed).
- Spacing (decision D2): the grace group gets a fixed left reserve of `0.9 sp` per grace note plus accidental width,
  added in front of the main note's column. The reserve is part of the measure chunk (it changes the chunk's
  `eventsHash` input: grace data are hashed). The previous notes keep their normal spacing.
- Accidentals: grace pitches run through the same accidental tracker as normal notes, **before** the main note, so a
  sharp on a grace note correctly carries on within the bar.
- Ledger lines for grace notes follow the normal rule, drawn short.

### 3a. As built (part 2)
- Grace items are LayoutItems with `graceOf` (the main note's id) and **no `eventId`**, so mouse picking, the notehead
  index, ties, articulations and every other event-based pass ignore them. v1 consequence: a grace note cannot be
  clicked; click its main note.
- A new `LayoutItem.glyphScale` draws glyphs smaller (all three renderers and the bounding box honour it). The older
  `LayoutItem.scale` stays as it was (tempo glyphs), so no existing output changed.
- Beams of a grace group are thick `line` items (not polygons), so system justification can keep them at a fixed offset.
- Polyphonic staff measures (several voices in one staff) do **not** draw grace notes yet: documented gap.
- The slur is computed by `layoutGraceSlurs` (notation layer), like hairpins.

## 4. Editing (decision D3: no new "event" type to select)
Grace notes cannot be selected one by one in v1. They are edited through their main note:
- Toolbar (notation panel) buttons: "Acciaccatura" and "Appoggiatura" toggle **grace-entry mode** for the selected main note.
- With grace-entry mode on, the pitch keys (C D E F G A B) add a grace note of the current kind **before** the selected
  main note, at the octave nearest to the main note; `Shift+Up/Down` raises or lowers it by a semitone (same accidental
  rule as normal entry); `Backspace` removes the last grace note; `Esc` or the button leaves the mode.
- The duration of the new grace note is the current duration button, limited to eighth, 16th, 32nd (default 16th).
- A command layer works without the keyboard: `addGraceNote(eventId, graceNote, index?)`,
  `removeGraceNote(eventId, graceId)`, `clearGraceNotes(eventId)`. All through `eventsInRange`-free single-event commands, undoable.
- Clipboard: carried by the event. "Notasyonu temizle" also clears graces (documented in the button tooltip).

### 4a. As built (part 3)
- Entry is a small modal state (`useEditorGrace`, key logic in `graceEntry.ts`), not a new keymap mode: while it is on,
  the letter keys, Shift+Up/Down, Backspace/Delete and Escape are taken by grace entry before the normal keymap; every
  other key keeps its meaning. Because it is not in the keymap, these keys are **not** listed in `docs/SHORTCUTS.md`;
  they are described in the button tooltips. Folding them into the keymap is a later cleanup.
- Buttons: "Acciaccatura", "Appoggiatura" (toggle the mode for the selected note) and "Süsleri sil".
- The mode ends when the selection changes. A grace note takes the current input duration when it is an eighth, 16th or
  32nd, otherwise a 16th. Shift+Up/Down changes the accidental of the last grace note (-2..+2).

## 5. Playback (decision D4)
Metrical positions of all normal notes stay exactly as written. A grace group takes its time from the **main note**:
- Acciaccatura: each grace note lasts `min(120 ticks, mainDuration / (2 * graceCount))` (a 32nd or less).
- Appoggiatura: the group takes `mainDuration / 2` in total, shared equally (Baroque and Classical convention for
  an undotted main note). A dotted main note (long appoggiatura of 2/3) is **not** in v1; the rule is a documented gap.
- The main note starts after the grace notes and ends at its normal end.
This is only the schedule; sound output is unchanged otherwise. A pure unit test checks the numbers, and the test names say
"v1 convention", so nobody confuses it with a bug.

### 5a. As built (part 4)
`graceTicks` in `src/playback/schedule.ts` gives the lengths; the main note starts after its grace notes and ends at its normal end. Tied continuation notes ignore grace notes. Grace notes carry the main note's event id, so the playback highlight follows the main note.

## 6. Not in this step
Chords or ties as grace notes, grace notes after a note (post-grace), grace notes before a rest, selecting a single
grace note with the mouse, dotted-main-note appoggiatura rule, trill-with-grace-ending, MusicXML export of graces (M9).
These go to `KNOWN_ISSUES.md` when the step is closed.

## 7. Acceptance
- Unit tests: add, remove, clear, limit of four, undo, validation errors, transpose range carries graces, delete main
  note removes them, clipboard carry, bar length unchanged.
- Layout tests: width reserve, stem up and slash, common beam for two graces, accidental tracker order, slur side,
  measure cache refresh without clearing caches.
- Playback schedule tests: the numbers of section 5.
- Gallery card with acciaccatura, appoggiatura, a beamed pair and a grace note with an accidental; golden snapshots reviewed.
- The owner enters one real example from a public-domain edition (BWV 772 or a flute piece) and compares it with the print.

## 8. Order of work (each part ends with `npm run check` green)
1. Model, validation, commands, clipboard and delete behaviour (no drawing yet).
2. Layout: reserve, noteheads, stems, flag or beam, slash, slur, accidentals.
3. Editing: toolbar buttons, grace-entry mode, tooltips and translations.
4. Playback schedule, gallery card, docs and traceability.
