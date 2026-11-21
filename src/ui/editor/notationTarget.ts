// SPDX-License-Identifier: GPL-3.0-or-later
import { Score } from '../../core/model';
import { Selection } from '../../core/selection';
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
  if (selection.kind === 'range' || selection.kind === 'event') return selection;
  if (selectedEventId) return { kind: 'event', id: selectedEventId };
  if (mode === 'input') {
    const justEntered = findNoteBeforeCursor(score, cursor);
    if (justEntered) return { kind: 'event', id: justEntered.id };
  }
  return null;
}
