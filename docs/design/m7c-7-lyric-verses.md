# M7c-7 — Multi-verse lyrics

Status: APPROVED v1 (owner approved Q1–Q4 as proposed, 2026-11-24)

## 1. Where we are

The data model already carries verses: `NoteEvent.lyrics: {verse, text}[]`, `setLyrics(eventId, text, verse)`,
`pasteLyrics(startEventId, text, score, verse)`, `clearLyrics` (all verses). What is missing:

- Layout draws verse 1 only: in the single-voice path (`measureLayout.ts`, `lyricsToLayout`), in the
  polyphonic path (`polyLyrics`), in the column width estimate (both paths) and in the melisma extender stop
  rule (`lyricLayout.ts` looks at verse 1 of the next note).
- The lyric entry mode (`useAppLyrics.ts`) is hard-wired to verse 1.
- Skyline spacing keeps 1.5 sp between lyrics and the next staff; the design reference asks for 2.5 sp.

## 2. Layout rules

1. A verse sits on its own line: `y(v) = 6.8 + (v - 1) * 2.0` sp (verse 1 stays at 6.8, so every existing
   snapshot is byte-identical). The note-name line, when shown, still pushes the whole block down.
2. The line depends on the verse NUMBER, not on how many verses a measure has, so a verse is on the same
   height in every measure of a staff. A measure without verse 2 simply draws nothing on that line.
3. Hyphens and extenders are evaluated per verse: the hyphen goes to the next syllable OF THE SAME VERSE, the
   extender stops at the next syllable of the same verse. Ids of verse 1 stay `lyric-text-<event>`; verse v >= 2
   uses `lyric-v<v>-text-<event>` (and `-hyphen-`, `-extender-`), so cursor, mouse and cache filters see them.
4. Column width uses the widest syllable over all verses of the column.
5. Polyphonic measures (several voices on one staff): lines are stacked by (voice, verse) pairs that exist in
   THAT measure, in voice then verse order. Known limit: the height can differ between measures when a voice
   lacks a verse in one of them.
6. Skyline: lyric text counts 1.0 sp taller in the clearance rule, which gives the required 2.5 sp between the
   lowest verse and the staff below. A staff without lyrics keeps 7 sp.
7. SATB individual barlines already stop at the staff bottom (M7c-6), so they cannot cross a lyric line;
   a property test pins this down.

## 3. Entry UI

- In lyrics mode a verse selector (1..8 and "new verse") is shown next to the syllable box. It decides which
  verse the box shows and writes; Tab/Enter move along the notes inside that verse; paste of several words fills
  that verse.
- No new keyboard shortcut in v1 (the verse is chosen with the mouse), so the keymap and the shortcut table stay
  unchanged.
- "Clear lyrics" keeps clearing every verse.

## 4. Validation

New rule `invalid-lyric-verse`: verse must be an integer from 1 to 8. `setLyrics` and `pasteLyrics` ignore a
verse outside that range.

## 5. Order of work (each step ends with `npm run check` green)

1. Core: verse range, validation rule, command guards, tests.
2. Layout: verses in single-voice and polyphonic paths, per-verse hyphens/extenders, widths, ids, tests
   (snapshot of verse 1 unchanged).
3. Skyline: 2.5 sp lyric clearance and the SATB corridor property test.
4. UI: verse selector, entry along a verse, tests.
5. Gallery: card 36 (one staff, three verses with hyphens and a melisma), card 37 (SATB, two verses on
   soprano and bass, staves grow apart); docs, known limits.

## 6. Out of scope

Verse number labels in front of each line ("1.", "2."), lyrics in a different language per verse, chorus
lines, lyric text styles, justified or manually moved lyrics, lyrics for tied notes (unchanged: a tied second
note takes no syllable).

## 7. Decisions requested from the owner

- Q1. Up to 8 verses (proposed)?
- Q2. Verse number labels ("1.", "2.") before each line: left out of v1 (proposed) or included?
- Q3. Verse chosen with a selector in lyrics mode, no new keyboard shortcut in v1 (proposed)?
- Q4. Polyphonic measures stack lines per measure (alignment limit documented), as proposed?

## 8. Progress
- Step 1 DONE (CI #99). Step 2 DONE (CI #100). Step 3 implemented: lyric text counts 1.0 sp taller in the skyline rule (2.5 sp clearance), corridor property test.
