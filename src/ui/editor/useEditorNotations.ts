// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback } from 'react';
import {
  ArticulationType,
  DynamicType,
  Score,
  PhraseMark,
  ScoreEvent,
} from '../../core/model';
import {
  Command,
  clearAllOverrides,
  clearOverride,
  clearSelectionNotations,
  deleteMeasure,
  insertMeasure,
  cycleFermata,
  setDynamic,
  setOverride,
  toggleArticulation,
  togglePhraseMark,
  toggleSlur,
} from '../../core/commands';
import { Selection, findEventContext } from '../../core/selection';
import { ScoreCursor } from '../../core/input';
import { LayoutResult } from '../../layout/types';
import { layoutScore } from '../../layout/layoutScore';
import { clampEventOverrideInLayout } from '../../layout/mouse';

export interface UseEditorNotationsParams {
  score: Score;
  executeCommand: (cmd: Command) => Score;
  triggerRejectedError: (msg: string) => void;
  selectionRef: React.MutableRefObject<Selection>;
  selectedEventIdRef: React.MutableRefObject<string | null>;
  selectedEventId: string | null;
  selection: Selection;
  rangeEvents: ScoreEvent[];
  cursor: ScoreCursor | null;
}

export function useEditorNotations({
  score,
  executeCommand,
  triggerRejectedError,
  selectionRef,
  selectedEventIdRef,
  selectedEventId,
  selection,
  rangeEvents,
  cursor,
}: UseEditorNotationsParams) {
  const applyDynamic = useCallback(
    (dyn: DynamicType | null) => {
      const curSel = selectionRef.current;
      if (curSel.kind === 'range' || curSel.kind === 'event') {
        executeCommand(setDynamic(curSel, dyn));
      } else if (selectedEventIdRef.current) {
        executeCommand(setDynamic({ kind: 'event', id: selectedEventIdRef.current }, dyn));
      }
    },
    [executeCommand, selectionRef, selectedEventIdRef]
  );

  const applyArticulation = useCallback(
    (art: ArticulationType) => {
      const curSel = selectionRef.current;
      if (curSel.kind === 'range' || curSel.kind === 'event') {
        executeCommand(toggleArticulation(curSel, art));
      } else if (selectedEventIdRef.current) {
        executeCommand(toggleArticulation({ kind: 'event', id: selectedEventIdRef.current }, art));
      }
    },
    [executeCommand, selectionRef, selectedEventIdRef]
  );

  const applySlur = useCallback(() => {
    const curSel = selectionRef.current;
    if (curSel.kind === 'range') {
      try {
        executeCommand(toggleSlur(curSel));
      } catch {
        triggerRejectedError('Legato bağı eklenemedi');
      }
    } else {
      triggerRejectedError('Legato bağı için en az iki nota seçmelisiniz (S)');
    }
  }, [executeCommand, triggerRejectedError, selectionRef]);

  const targetSelection = useCallback((): Selection | null => {
    const curSel = selectionRef.current;
    if (curSel.kind === 'range' || curSel.kind === 'event') return curSel;
    if (selectedEventIdRef.current) return { kind: 'event', id: selectedEventIdRef.current };
    return null;
  }, [selectionRef, selectedEventIdRef]);

  const applyFermata = useCallback(() => {
    const target = targetSelection();
    if (target) executeCommand(cycleFermata(target));
  }, [executeCommand, targetSelection]);

  const applyPhraseMark = useCallback(
    (mark: PhraseMark) => {
      const target = targetSelection();
      if (target) executeCommand(togglePhraseMark(target, mark));
    },
    [executeCommand, targetSelection]
  );

  const clearNotations = useCallback(() => {
    const curSel = selectionRef.current;
    if (curSel.kind === 'range' || curSel.kind === 'event') {
      executeCommand(clearSelectionNotations(curSel));
    } else if (selectedEventIdRef.current) {
      executeCommand(clearSelectionNotations({ kind: 'event', id: selectedEventIdRef.current }));
    }
  }, [executeCommand, selectionRef, selectedEventIdRef]);

  const applyEventOverride = useCallback(
    (
      eventId: string,
      dx: number,
      dy: number,
      accumulate = true,
      layoutArg?: LayoutResult
    ): { dx: number; dy: number; isAtLimit: boolean; isRest: boolean } => {
      const existing = score.overrides[eventId];
      const targetDx = accumulate ? (existing?.dx ?? 0) + dx : dx;
      const targetDy = accumulate ? (existing?.dy ?? 0) + dy : dy;
      const activeLayout = layoutArg ?? layoutScore(score, { width: 70 });
      const clamped = clampEventOverrideInLayout(activeLayout, score, eventId, targetDx, targetDy);

      executeCommand(setOverride(eventId, { dx: clamped.dx, dy: clamped.dy }, false));
      return clamped;
    },
    [score, executeCommand]
  );

  const clearEventOverride = useCallback(
    (eventId?: string) => {
      const targetId = eventId ?? selectedEventId;
      if (!targetId) return;
      executeCommand(clearOverride(targetId));
    },
    [selectedEventId, executeCommand]
  );

  const clearAllEventOverrides = useCallback(() => {
    executeCommand(clearAllOverrides());
  }, [executeCommand]);

  const insertNewMeasure = useCallback(
    (afterMeasureIndex?: number) => {
      let targetIdx = afterMeasureIndex;
      if (targetIdx === undefined) {
        if (selectedEventId) {
          const loc = findEventContext(score, selectedEventId);
          if (loc) targetIdx = loc.measureIndex;
        } else if (selection.kind === 'range' && rangeEvents.length > 0) {
          const loc = findEventContext(score, rangeEvents[rangeEvents.length - 1].id);
          if (loc) targetIdx = loc.measureIndex;
        } else if (cursor) {
          const idx = score.measures.findIndex((m) => m.id === cursor.measureId);
          if (idx !== -1) targetIdx = idx;
        }
      }
      executeCommand(insertMeasure(targetIdx));
    },
    [score, selectedEventId, selection, rangeEvents, cursor, executeCommand]
  );

  const deleteCurrentMeasure = useCallback(
    (measureIndex?: number): { targetIndex: number; hasNotes: boolean } | null => {
      if (score.measures.length <= 1) {
        triggerRejectedError('Eser en az 1 ölçü içermelidir');
        return null;
      }
      let targetIdx = measureIndex;
      if (targetIdx === undefined) {
        if (selectedEventId) {
          const loc = findEventContext(score, selectedEventId);
          if (loc) targetIdx = loc.measureIndex;
        } else if (selection.kind === 'range' && rangeEvents.length > 0) {
          const loc = findEventContext(score, rangeEvents[0].id);
          if (loc) targetIdx = loc.measureIndex;
        } else if (cursor) {
          const idx = score.measures.findIndex((m) => m.id === cursor.measureId);
          if (idx !== -1) targetIdx = idx;
        }
      }
      if (targetIdx === undefined) targetIdx = score.measures.length - 1;

      const mDef = score.measures[targetIdx];
      let hasNotes = false;
      if (mDef) {
        for (const part of score.parts) {
          for (const staff of part.staves) {
            const sm = staff.measures[mDef.id];
            if (sm) {
              for (const v of sm.voices) {
                if (v.events.some((e) => e.kind === 'note')) {
                  hasNotes = true;
                  break;
                }
              }
            }
          }
        }
      }

      return { targetIndex: targetIdx, hasNotes };
    },
    [score, selectedEventId, selection, rangeEvents, cursor, triggerRejectedError]
  );

  const confirmDeleteMeasure = useCallback(
    (idx: number) => {
      executeCommand(deleteMeasure(idx));
    },
    [executeCommand]
  );

  return {
    applyDynamic,
    applyArticulation,
    applySlur,
    applyFermata,
    applyPhraseMark,
    clearNotations,
    applyEventOverride,
    clearEventOverride,
    clearAllEventOverrides,
    insertNewMeasure,
    deleteCurrentMeasure,
    confirmDeleteMeasure,
  };
}
