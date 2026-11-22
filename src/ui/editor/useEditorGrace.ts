// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Grace note entry (M7c-3b part 3). Grace notes are edited through their main note: with one note selected, a toolbar
 * button switches "grace entry" on; then the letter keys C D E F G A B add a grace note before the selected note
 * (octave nearest to the main note, key signature applied), Shift+Up and Shift+Down raise and lower the last one by a
 * semitone, Backspace or Delete removes the last one, Escape or the same button leaves the mode. Any other key keeps
 * its normal meaning. The mode also ends when the selection changes. The key logic lives in `graceEntry.ts`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clearGraceNotes } from '../../core/notationCommands';
import { Command } from '../../core/commands';
import { BaseDurationType, GraceKind, Score } from '../../core/model';
import { findNoteEvent, graceKeyResult } from './graceEntry';

export interface UseEditorGraceParams {
  score: Score;
  executeCommand: (cmd: Command) => Score;
  triggerRejectedError: (msg: string) => void;
  selectedEventId: string | null;
  activeDuration: BaseDurationType;
}

export function useEditorGrace({
  score,
  executeCommand,
  triggerRejectedError,
  selectedEventId,
  activeDuration,
}: UseEditorGraceParams) {
  const [graceEntry, setGraceEntry] = useState<GraceKind | null>(null);
  const stateRef = useRef({ score, selectedEventId, activeDuration, graceEntry, executeCommand });
  stateRef.current = { score, selectedEventId, activeDuration, graceEntry, executeCommand };

  // The mode belongs to one main note: leave it when the selection moves.
  useEffect(() => {
    setGraceEntry(null);
  }, [selectedEventId]);

  const toggleGraceEntry = useCallback(
    (kind: GraceKind) => {
      const cur = stateRef.current;
      const note = cur.selectedEventId ? findNoteEvent(cur.score, cur.selectedEventId) : null;
      if (!note) {
        triggerRejectedError('Süs notası için önce bir nota seçin');
        return;
      }
      setGraceEntry(cur.graceEntry === kind ? null : kind);
    },
    [triggerRejectedError]
  );

  const clearGraces = useCallback(() => {
    const cur = stateRef.current;
    if (cur.selectedEventId) cur.executeCommand(clearGraceNotes(cur.selectedEventId));
    setGraceEntry(null);
  }, []);

  /** Returns true when the key was used by grace entry (the caller then stops handling it). */
  const handleGraceKey = useCallback(
    (e: KeyboardEvent): boolean => {
      const cur = stateRef.current;
      const r = graceKeyResult(cur.score, cur.selectedEventId, cur.graceEntry, cur.activeDuration, e);
      if (r.kind === 'ignore') return false;
      if (r.kind === 'exit') setGraceEntry(null);
      else if (r.kind === 'limit') triggerRejectedError('Bir notanın önüne en fazla 4 süs notası konabilir');
      else cur.executeCommand(r.command);
      return true;
    },
    [triggerRejectedError]
  );

  return { graceEntry, toggleGraceEntry, clearGraces, handleGraceKey };
}
