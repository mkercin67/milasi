// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Score } from '../../core/model';
import type { Selection } from '../../core/selection';
import { clearLyrics, pasteLyrics, setLyrics, setShowNoteNames, Command } from '../../core/commands';
import { isValidLyricVerse } from '../../core/model';
import { EditorMode, mapKeyEvent } from '../keymap';
import { canAddVerse, nextNewVerse } from './lyricVerses';

export interface UseAppLyricsParams {
  score: Score;
  selectedEventId: string | null;
  selectEvent: (id: string | null) => void;
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  executeCommand: (cmd: Command) => Score;
  selection: Selection;
}

export function useAppLyrics({
  score,
  selectedEventId,
  selectEvent,
  mode,
  setMode,
  executeCommand,
  selection,
}: UseAppLyricsParams) {
  // Selected note for lyrics editing (Milestone 6d)
  const selectedNote = useMemo(() => {
    if (!selectedEventId || !score) return null;
    for (const part of score.parts) {
      for (const staff of part.staves) {
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (!sm) continue;
          for (const v of sm.voices) {
            for (const ev of v.events) {
              if (ev.id === selectedEventId && ev.kind === 'note') {
                return ev;
              }
            }
          }
        }
      }
    }
    return null;
  }, [score, selectedEventId]);

  const [lyricsInputValue, setLyricsInputValue] = useState('');
  // Verse the entry box shows and writes (M7c-7)
  const [lyricsVerse, setLyricsVerseState] = useState(1);

  useEffect(() => {
    if (mode !== 'lyrics') return;
    const nextText = selectedNote ? (selectedNote.lyrics?.find((l) => l.verse === lyricsVerse)?.text ?? '') : '';
    if (lyricsInputValue !== nextText) {
      setLyricsInputValue(nextText);
    }
  }, [mode, selectedNote, lyricsInputValue, lyricsVerse]);

  const eligibleLyricsNoteIds = useMemo(() => {
    const ids: string[] = [];
    for (const part of score.parts) {
      for (const staff of part.staves) {
        let prevTied = false;
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (!sm) continue;
          for (const v of sm.voices) {
            for (const ev of v.events) {
              const isSecondTied = prevTied;
              if (ev.kind === 'note') {
                prevTied = Boolean(ev.tiedToNext || ev.pitches.some((p) => p.tiedToNext));
                if (!isSecondTied) {
                  ids.push(ev.id);
                }
              } else {
                prevTied = false;
              }
            }
          }
        }
      }
    }
    return ids;
  }, [score]);

  const moveLyricsNote = useCallback(
    (dir: 'next' | 'prev') => {
      if (!selectedNote || eligibleLyricsNoteIds.length === 0) return;
      const curIdx = eligibleLyricsNoteIds.indexOf(selectedNote.id);
      if (curIdx === -1) {
        selectEvent(eligibleLyricsNoteIds[0]);
        return;
      }
      const nextIdx = dir === 'next' ? curIdx + 1 : curIdx - 1;
      if (nextIdx >= 0 && nextIdx < eligibleLyricsNoteIds.length) {
        selectEvent(eligibleLyricsNoteIds[nextIdx]);
      }
    },
    [eligibleLyricsNoteIds, selectEvent, selectedNote]
  );

  useEffect(() => {
    if (mode === 'lyrics') {
      if (!selectedEventId && eligibleLyricsNoteIds.length > 0) {
        selectEvent(eligibleLyricsNoteIds[0]);
      }
    }
  }, [eligibleLyricsNoteIds, mode, selectEvent, selectedEventId]);

  const handleLyricsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const action = mapKeyEvent(e, 'lyrics', { lyricsInputEmpty: lyricsInputValue.length === 0 });
    if (!action) return;

    if (action === 'lyrics-commit-and-next' || action === 'lyrics-next-note') {
      e.preventDefault();
      if (selectedNote && lyricsInputValue.trim().length > 0) {
        executeCommand(setLyrics(selectedNote.id, lyricsInputValue.trim(), lyricsVerse));
      }
      moveLyricsNote('next');
      return;
    }
    if (action === 'lyrics-prev-note') {
      e.preventDefault();
      if (selectedNote && lyricsInputValue.trim().length > 0) {
        executeCommand(setLyrics(selectedNote.id, lyricsInputValue.trim(), lyricsVerse));
      }
      moveLyricsNote('prev');
      return;
    }
    if (action === 'lyrics-backspace-prev') {
      e.preventDefault();
      moveLyricsNote('prev');
      return;
    }
    if (action === 'set-mode-select') {
      e.preventDefault();
      setMode('select');
      return;
    }
  };

  const handleLyricsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLyricsInputValue(val);
    if (selectedNote) {
      executeCommand(setLyrics(selectedNote.id, val.length > 0 ? val : undefined, lyricsVerse));
    }
  };

  const handleLyricsPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (/\s+/.test(pastedText.trim()) && selectedNote) {
      e.preventDefault();
      executeCommand(pasteLyrics(selectedNote.id, pastedText, score, lyricsVerse));
      const syllables = pastedText.trim().split(/\s+/).filter(Boolean);
      if (syllables.length > 0) {
        setLyricsInputValue(syllables[0]);
      }
    }
  };

  const setLyricsVerse = useCallback((verse: number) => {
    if (isValidLyricVerse(verse)) setLyricsVerseState(verse);
  }, []);
  const handleNewVerse = useCallback(() => {
    setLyricsVerseState(nextNewVerse(score));
  }, [score]);

  // The note-name line is a derived view setting; it never writes or removes lyrics.
  const showNoteNames = Boolean(score.layoutSettings?.showNoteNames);
  const handleToggleNoteNames = useCallback(() => {
    executeCommand(setShowNoteNames(!showNoteNames));
  }, [executeCommand, showNoteNames]);

  // Clears lyrics of the selected notes, or of the whole score when nothing is selected (undoable).
  const handleClearLyrics = useCallback(() => {
    executeCommand(clearLyrics(selection));
  }, [executeCommand, selection]);

  return {
    lyricsInputValue,
    lyricsVerse,
    setLyricsVerse,
    handleNewVerse,
    canAddLyricsVerse: canAddVerse(score),
    handleLyricsKeyDown,
    handleLyricsChange,
    handleLyricsPaste,
    handleToggleNoteNames,
    handleClearLyrics,
  };
}
