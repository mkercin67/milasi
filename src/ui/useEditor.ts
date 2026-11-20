// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * State management hook for ScoreForge editor.
 *
 * Encapsulates the Score data model, Command history stack, explicit editor mode
 * ('select' | 'input' | 'position'), selection state, cursor positioning, and error timing.
 */

import { useCallback, useRef, useState } from 'react';
import { Command, History } from '../core/commands';
import { Score } from '../core/model';
import { ScoreCursor } from '../core/input';
import { EditorMode } from './keymap';
import { eventExists } from '../core/selection';
import { getLastNotePitchBeforeCursor, snapCursor } from '../core/input';
import { createEmptyScore } from '../core/factory';
import { buildSampleScore, createBenchmark64Score } from './Demo';
import { useEditorSelection } from './editor/useEditorSelection';
import { useEditorInput } from './editor/useEditorInput';
import { useEditorNotations } from './editor/useEditorNotations';

export { type SelectedEventInfo } from './editor/useEditorSelection';

function getDefaultStartupScore(): Score {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('state') === 'sample') {
      return buildSampleScore('G');
    }
    if (params.get('state') === 'benchmark_64') {
      return createBenchmark64Score();
    }
  }
  return createEmptyScore({
    clef: { sign: 'G', line: 2 },
    keySig: 0,
    timeSig: { num: 4, den: 4 },
    measures: 8,
    title: 'Yeni Eser',
  });
}

export function useEditor(initialScore?: Score) {
  const historyRef = useRef<History>(new History(initialScore ?? getDefaultStartupScore()));
  const [score, setScore] = useState<Score>(() => historyRef.current.score);
  const [dirtyVersion, setDirtyVersion] = useState<number>(0);

  // Synchronous State Refs (R2: Anti-Stale-Closure Architecture)
  const scoreRef = useRef<Score>(score);
  scoreRef.current = score;

  const [rejectedError, setRejectedError] = useState<string | null>(null);
  const errorTimerRef = useRef<number | null>(null);

  const triggerRejectedError = useCallback((msg: string) => {
    if (typeof window === 'undefined') return;
    if (errorTimerRef.current) {
      window.clearTimeout(errorTimerRef.current);
    }
    setRejectedError(msg);
    errorTimerRef.current = window.setTimeout(() => {
      setRejectedError(null);
      errorTimerRef.current = null;
    }, 2000);
  }, []);

  const markClean = useCallback(() => {
    historyRef.current.markClean();
    setDirtyVersion((v) => v + 1);
  }, []);

  const currentCursorRef = useRef<ScoreCursor | null>(null);
  const cursorHistoryRef = useRef<{
    past: Array<ScoreCursor | null>;
    future: Array<ScoreCursor | null>;
  }>({ past: [], future: [] });

  const executeCommand = useCallback((cmd: Command) => {
    cursorHistoryRef.current.past.push(
      currentCursorRef.current ? { ...currentCursorRef.current } : null
    );
    cursorHistoryRef.current.future = [];
    const nextScore = historyRef.current.do(cmd);
    scoreRef.current = nextScore;
    setScore(nextScore);
    setDirtyVersion((v) => v + 1);
    return nextScore;
  }, []);

  const initialCursor = (() => {
    const sId = historyRef.current.score.parts[0]?.staves[0]?.id;
    const mId = historyRef.current.score.measures[0]?.id;
    const voice1 = historyRef.current.score.parts[0]?.staves[0]?.measures[mId]?.voices.find((v) => v.voiceIndex === 1);
    if (sId && mId && voice1) {
      return { staffId: sId, voiceIndex: 1 as const, measureId: mId, tick: 0 };
    }
    return null;
  })();

  const inputHook = useEditorInput({
    score,
    initialCursor,
    executeCommand,
    triggerRejectedError,
    setSelectedEventId: (id) => selectionHook.setSelectedEventId(id),
  });

  const selectionHook = useEditorSelection({
    score,
    scoreRef,
    executeCommand,
    triggerRejectedError,
    cursor: inputHook.cursor,
    cursorRef: inputHook.cursorRef,
    mode: inputHook.mode,
  });

  const notationsHook = useEditorNotations({
    score,
    executeCommand,
    triggerRejectedError,
    selectionRef: selectionHook.selectionRef,
    selectedEventIdRef: selectionHook.selectedEventIdRef,
    selectedEventId: selectionHook.selectedEventId,
    selection: selectionHook.selection,
    rangeEvents: selectionHook.rangeEvents,
    cursor: inputHook.cursor,
  });

  const resetScore = useCallback((newScore: Score) => {
    historyRef.current = new History(newScore);
    historyRef.current.markClean();
    setScore(historyRef.current.score);
    setDirtyVersion((v) => v + 1);
    selectionHook.setSelectedEventId(null);
    inputHook.lastEnteredPitchRef.current = null;

    const sId = newScore.parts[0]?.staves[0]?.id;
    const mId = newScore.measures[0]?.id;
    const voice1 = newScore.parts[0]?.staves[0]?.measures[mId]?.voices.find((v) => v.voiceIndex === 1);
    if (sId && mId && voice1) {
      inputHook.setCursor({ staffId: sId, voiceIndex: 1 as const, measureId: mId, tick: 0 });
    } else {
      inputHook.setCursor(null);
    }
    cursorHistoryRef.current = { past: [], future: [] };
  }, [selectionHook, inputHook]);

  currentCursorRef.current = inputHook.cursor;

  const undo = useCallback(() => {
    if (historyRef.current.canUndo()) {
      cursorHistoryRef.current.future.push(
        currentCursorRef.current ? { ...currentCursorRef.current } : null
      );
      const prevCursor = cursorHistoryRef.current.past.pop() ?? null;
      const prevScore = historyRef.current.undo();
      if (prevScore) {
        scoreRef.current = prevScore;
        setScore(prevScore);
        setDirtyVersion((v) => v + 1);
        selectionHook.setSelectedEventId((curr) => (curr && eventExists(prevScore, curr) ? curr : null));
        if (prevCursor) {
          inputHook.setCursor(prevCursor);
          inputHook.lastEnteredPitchRef.current = getLastNotePitchBeforeCursor(prevScore, prevCursor);
        } else {
          inputHook.setCursor((c) => (c ? snapCursor(prevScore, c) : null));
        }
      }
    }
  }, [selectionHook, inputHook]);

  const redo = useCallback(() => {
    if (historyRef.current.canRedo()) {
      cursorHistoryRef.current.past.push(
        currentCursorRef.current ? { ...currentCursorRef.current } : null
      );
      const nextCursor = cursorHistoryRef.current.future.pop() ?? null;
      const nextScore = historyRef.current.redo();
      if (nextScore) {
        scoreRef.current = nextScore;
        setScore(nextScore);
        setDirtyVersion((v) => v + 1);
        selectionHook.setSelectedEventId((curr) => (curr && eventExists(nextScore, curr) ? curr : null));
        if (nextCursor) {
          inputHook.setCursor(nextCursor);
          inputHook.lastEnteredPitchRef.current = getLastNotePitchBeforeCursor(nextScore, nextCursor);
        } else {
          inputHook.setCursor((c) => (c ? snapCursor(nextScore, c) : null));
        }
      }
    }
  }, [selectionHook, inputHook]);

  const editorStateRef = useRef<{ mode: EditorMode; selectedEventId: string | null; cursor: ScoreCursor | null }>({
    mode: inputHook.mode,
    selectedEventId: selectionHook.selectedEventId,
    cursor: inputHook.cursor,
  });
  editorStateRef.current = {
    mode: inputHook.mode,
    selectedEventId: selectionHook.selectedEventId,
    cursor: inputHook.cursor,
  };

  return {
    score,
    isDirty: dirtyVersion >= 0 && historyRef.current.isDirty(),
    markClean,
    canUndo: historyRef.current.canUndo(),
    canRedo: historyRef.current.canRedo(),
    executeCommand,
    undo,
    redo,
    resetScore,
    selectedEventId: selectionHook.selectedEventId,
    selectEvent: selectionHook.selectEvent,
    selectNext: selectionHook.selectNext,
    selectedEventInfo: selectionHook.selectedEventInfo,
    mode: inputHook.mode,
    setMode: inputHook.setMode,
    togglePositionMode: inputHook.togglePositionMode,
    isInputMode: inputHook.isInputMode,
    setIsInputMode: inputHook.setIsInputMode,
    toggleInputMode: inputHook.toggleInputMode,
    exitInputMode: inputHook.exitInputMode,
    activeDuration: inputHook.activeDuration,
    setActiveDuration: inputHook.setActiveDuration,
    activeDots: inputHook.activeDots,
    setActiveDots: inputHook.setActiveDots,
    toggleDot: inputHook.toggleDot,
    isRestSelected: inputHook.isRestSelected,
    setIsRestSelected: inputHook.setIsRestSelected,
    toggleRestSelected: inputHook.toggleRestSelected,
    cursor: inputHook.cursor,
    setCursor: inputHook.setCursor,
    setCursorToMeasure: inputHook.setCursorToMeasure,
    currentMeasureNumber: selectionHook.currentMeasureNumber,
    rejectedError,
    triggerRejectedError,
    cursorRef: inputHook.cursorRef,
    lastEnteredPitchRef: inputHook.lastEnteredPitchRef,
    enterPitchAtCursor: inputHook.enterPitchAtCursor,
    enterPitchDirect: inputHook.enterPitchDirect,
    applyEventOverride: notationsHook.applyEventOverride,
    clearEventOverride: notationsHook.clearEventOverride,
    hasSelectedOverride: Boolean(selectionHook.selectedEventId && score.overrides[selectionHook.selectedEventId]),
    hasAnyOverride: Object.keys(score.overrides || {}).length > 0,
    clearAllEventOverrides: notationsHook.clearAllEventOverrides,
    selectedOverride: selectionHook.selectedEventId ? score.overrides[selectionHook.selectedEventId] : undefined,
    changeEventPitch: selectionHook.changeEventPitch,
    enterRestAtCursor: inputHook.enterRestAtCursor,
    moveCursorDirection: inputHook.moveCursorDirection,
    moveCursorToBoundary: inputHook.moveCursorToBoundary,
    cycleVoiceDirection: inputHook.cycleVoiceDirection,
    selectVoice: inputHook.selectVoice,
    selection: selectionHook.selection,
    selectedRange: selectionHook.selectedRange,
    rangeEvents: selectionHook.rangeEvents,
    selectedEventIds: selectionHook.selectedEventIds,
    rangeInfo: selectionHook.rangeInfo,
    setRangeSelection: selectionHook.setRangeSelection,
    extendSelectionTo: selectionHook.extendSelectionTo,
    extendSelectionDirection: selectionHook.extendSelectionDirection,
    selectAllInStaff: selectionHook.selectAllInStaff,
    deleteSelection: selectionHook.deleteSelection,
    transposeSelection: selectionHook.transposeSelection,
    toggleTieSelection: selectionHook.toggleTieSelection,
    cycleAccidentalSelection: selectionHook.cycleAccidentalSelection,
    resetAccidentalSelection: selectionHook.resetAccidentalSelection,
    copySelection: selectionHook.copySelection,
    cutSelection: selectionHook.cutSelection,
    pasteClipboard: selectionHook.pasteClipboard,
    insertNewMeasure: notationsHook.insertNewMeasure,
    deleteCurrentMeasure: notationsHook.deleteCurrentMeasure,
    confirmDeleteMeasure: notationsHook.confirmDeleteMeasure,
    applyDynamic: notationsHook.applyDynamic,
    applyArticulation: notationsHook.applyArticulation,
    applySlur: notationsHook.applySlur,
    clearNotations: notationsHook.clearNotations,
    scoreRef,
    editorStateRef,
    getScore: () => scoreRef.current,
    getSelection: () => selectionHook.selectionRef.current,
  };
}
