# Note-name layer (replaces "auto solfège" lyrics)

Status: IMPLEMENTED.

## 1. Problem
The toolbar button "Hecele (Solfej)" wrote Do/Re/Mi into verse 1 of every note of the whole score. Consequences found by
the project owner while testing BWV 772:
- it overwrote the user's own lyrics and could not be switched off (not a toggle, no pressed state);
- the setting "Nota İsimleri: Harf / Solfej" only changed the status bar, never the staff;
- lyrics changes did not invalidate the measure layout cache (separate bug, fixed first: verse and text are now part of
  `eventsHash`), so syllables showed up only after a reload.

## 2. Decision
Note names are a **derived view**, not data on events.
- `Score.layoutSettings.showNoteNames?: boolean` (absent = off, so old files stay byte-identical; no schema bump).
- The label text follows the UI preference "Nota İsimleri" (solfège or letter) passed as `LayoutOptions.noteNameStyle`;
  the style is a per-user preference and is not stored in the file.
- Labels are drawn by the measure layout (`src/layout/noteLabels.ts`, `measureLayout.ts`) on their own line
  (y = 6.0 below the staff top line, `id = note-name-<eventId>`). When lyrics are present, verse 1 moves one line lower.
- Chords: tones listed bottom to top, `Do/Mi/Sol`. Accidentals: `Fa♯`, `Si♭`. Octave is not shown.
- Polyphonic measures: one label per voice in the column, stacked in voice order. Verse-1 lyrics of every voice are drawn
  too (`tests/layout/poly_lyrics.test.ts`): one line per voice below the note names, in voice order.
- Cache: `_nl<style>` is part of the measure chunk cache key, so toggling and switching style never serve stale layouts.
- Command `setShowNoteNames(show)` (undoable). The toolbar button "Nota adları" is a real toggle (`aria-pressed`).

## 3. User lyrics
Lyrics keep working as before (`lyrics: [{verse, text}]` on notes, saved in the file, several verses). Turning note names
on or off never reads or writes them. The `autoSolfege` command stays in core only for the built-in demo score.

## 4. Not done / later
- Fixed-do only (C = Do); movable-do and key-aware spelling later.
- Lyric entry (`U` mode) still targets the selected note only; verses above 1 are stored but not drawn yet.
- Copy/paste of lyrics between measures is a separate question.
