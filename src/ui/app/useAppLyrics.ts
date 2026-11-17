import { useCallback, useEffect, useMemo, useState } from 'react';
import { Score } from '../../core/model';
import { autoSolfege, pasteLyrics, setLyrics, Command } from '../../core/commands';
import { EditorMode } from '../keymap';

export interface UseAppLyricsParams {
  score: Score;
  selectedEventId: string | null;
  selectEvent: (id: string | null) => void;
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  executeCommand: (cmd: Command) => Score;
}

export function useAppLyrics({
  score,
  selectedEventId,
  selectEvent,
  mode,
  setMode,
  executeCommand,
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

  useEffect(() => {
    if (selectedNote) {
      const v1 = selectedNote.lyrics?.find((l) => l.verse === 1);
      setLyricsInputValue(v1?.text ?? '');
    } else {
      setLyricsInputValue('');
    }
  }, [selectedNote]);

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
    if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter' || e.code === 'Enter') {
      e.preventDefault();
      if (selectedNote && lyricsInputValue.trim().length > 0) {
        executeCommand(setLyrics(selectedNote.id, lyricsInputValue.trim(), 1));
      }
      moveLyricsNote('next');
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (selectedNote && lyricsInputValue.trim().length > 0) {
        executeCommand(setLyrics(selectedNote.id, lyricsInputValue.trim(), 1));
      }
      moveLyricsNote(e.shiftKey ? 'prev' : 'next');
      return;
    }
    if (e.key === 'Backspace' && lyricsInputValue.length === 0) {
      e.preventDefault();
      moveLyricsNote('prev');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setMode('select');
      return;
    }
  };

  const handleLyricsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLyricsInputValue(val);
    if (selectedNote) {
      executeCommand(setLyrics(selectedNote.id, val.length > 0 ? val : undefined, 1));
    }
  };

  const handleLyricsPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (/\s+/.test(pastedText.trim()) && selectedNote) {
      e.preventDefault();
      executeCommand(pasteLyrics(selectedNote.id, pastedText, score));
      const syllables = pastedText.trim().split(/\s+/).filter(Boolean);
      if (syllables.length > 0) {
        setLyricsInputValue(syllables[0]);
      }
    }
  };

  const handleAutoSolfege = useCallback(() => {
    executeCommand(autoSolfege(score.id));
  }, [executeCommand, score.id]);

  return {
    lyricsInputValue,
    handleLyricsKeyDown,
    handleLyricsChange,
    handleLyricsPaste,
    handleAutoSolfege,
  };
}
