// SPDX-License-Identifier: GPL-3.0-or-later
import { Score } from '../../core/model';
import { Selection, eventExists } from '../../core/selection';
import { ScoreCursor, findNoteBeforeCursor } from '../../core/input';
import { EditorMode } from '../keymap';

/**
 * Which events a notation command (dynamic, articulation, fermata, breath mark) applies to.
 * Order: the selection, then the single selected event, then, in note-input mode only, the note
 * that was just entered (the one before the cursor). Anything else means no target.
 */
export function resolveNotationTarget(
  score: Score,
  selection: Selection,
  selectedEventId: string | null,
  mode: EditorMode | undefined,
  cursor: ScoreCursor | null
): Selection | null {
  // A selection that points at an event which no longer exists (for example after a measure was
  // deleted) is stale: skip it, otherwise the command silently does nothing.
  if (selection.kind === 'range' && eventExists(score, selection.anchorId) && eventExists(score, selection.focusId)) {
    return selection;
  }
  if (selection.kind === 'event' && eventExists(score, selection.id)) return selection;
  if (selectedEventId && eventExists(score, selectedEventId)) return { kind: 'event', id: selectedEventId };
  if (mode === 'input') {
    const justEntered = findNoteBeforeCursor(score, cursor);
    if (justEntered) return { kind: 'event', id: justEntered.id };
  }
  return null;
}
