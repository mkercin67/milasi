// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect } from 'react';
import { ArticulationType, DynamicType, Pitch, PitchStep, Score, ScoreEvent } from '../../core/model';
import { Command, convertToRest, transposeEvent } from '../../core/commands';
import { Player, PreviewPlayer } from '../../playback';
import { EditorMode, mapKeyEvent } from '../keymap';
import { PerfSample } from '../Diagnostics';
import { LayoutResult } from '../../layout/types';
import { SelectedEventInfo } from './types';

function findEventPitches(score: Score, eventId: string): Pitch[] | null {
  for (const p of score.parts) {
    for (const st of p.staves) {
      for (const m of Object.values(st.measures)) {
        for (const v of m.voices) {
          const ev = v.events.find((it) => it.id === eventId);
          if (ev && ev.kind === 'note') {
            return ev.pitches;
          }
        }
      }
    }
  }
  return null;
}

export interface UseAppKeyboardParams {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  togglePositionMode: () => void;
  toggleInputMode: () => void;
  exitInputMode: () => void;
  undo: () => void;
  redo: () => void;
  selectedEventId: string | null;
  selectEvent: (id: string | null) => void;
  selectNext: (direction: 'prev' | 'next') => void;
  selectedEventInfo: SelectedEventInfo | null;
  selectedRange: { anchorId: string; focusId: string } | null;
  selection: { kind: 'none' | 'event' | 'range' };
  selectAllInStaff: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: () => void;
  insertNewMeasure: () => void;
  handleDeleteMeasureWithPrompt: () => void;
  extendSelectionDirection: (direction: 'prev' | 'next') => void;
  cycleAccidentalSelection: (delta: number) => void;
  resetAccidentalSelection: () => void;
  toggleTieSelection: () => void;
  applySlur: () => void;
  clearNotations: () => void;
  moveCursorDirection: (direction: 'prev' | 'next') => void;
  cycleVoiceDirection: (direction: 'next' | 'prev') => void;
  transposeSelection: (semitones: number) => void;
  executeCommand: (cmd: Command) => Score;
  previewPlayer: PreviewPlayer;
  clearEventOverride: (eventId: string) => void;
  applyEventOverride: (
    eventId: string,
    dx: number,
    dy: number,
    isRelative?: boolean,
    layout?: LayoutResult
  ) => { dx: number; dy: number; isAtLimit: boolean };
  hasSelectedOverride: boolean;
  latestLayoutRef: React.RefObject<LayoutResult | null>;
  deleteSelection: () => void;
  enterRestAtCursor: (msgDoesNotFit: string, msgNoCursor: string) => void;
  enterPitchAtCursor: (
    letter: PitchStep,
    msgDoesNotFit: string,
    msgNoCursor: string,
    onPreview?: (p: Pitch) => void
  ) => void;
  toggleDot: () => void;
  triggerRejectedError: (msg: string) => void;
  setActiveDuration: (duration: ScoreEvent['baseType']) => void;
  setIsRestSelected: (val: boolean) => void;
  applyDynamic: (dynamic: DynamicType | null) => void;
  applyArticulation: (articulation: ArticulationType) => void;
  setDragStatus: (status: string | null) => void;
  perfSamplesRef: React.MutableRefObject<PerfSample[]>;
  isDiagnosticsOpen: boolean;
  setIsDiagnosticsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPerfSamples: (samples: PerfSample[]) => void;
  player: Player;
  handleSave: (saveAs?: boolean) => void;
  handleOpenClick: () => void;
  t: (key: string) => string;
}

export function useAppKeyboard(params: UseAppKeyboardParams) {
  const {
    mode,
    setMode,
    togglePositionMode,
    toggleInputMode,
    exitInputMode,
    undo,
    redo,
    selectedEventId,
    selectEvent,
    selectNext,
    selectedEventInfo,
    selectedRange,
    selection,
    selectAllInStaff,
    copySelection,
    cutSelection,
    pasteClipboard,
    insertNewMeasure,
    handleDeleteMeasureWithPrompt,
    extendSelectionDirection,
    cycleAccidentalSelection,
    resetAccidentalSelection,
    toggleTieSelection,
    applySlur,
    clearNotations,
    moveCursorDirection,
    cycleVoiceDirection,
    transposeSelection,
    executeCommand,
    previewPlayer,
    clearEventOverride,
    applyEventOverride,
    latestLayoutRef,
    deleteSelection,
    enterRestAtCursor,
    enterPitchAtCursor,
    toggleDot,
    triggerRejectedError,
    setActiveDuration,
    setIsRestSelected,
    applyDynamic,
    applyArticulation,
    setDragStatus,
    perfSamplesRef,
    isDiagnosticsOpen,
    setIsDiagnosticsOpen,
    setPerfSamples,
    player,
    handleSave,
    handleOpenClick,
    t,
  } = params;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore typing inside text / number inputs or textareas (e.g. modal form inputs)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // If a button or select is focused, release focus so it never swallows shortcuts
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement) {
        (e.target as HTMLElement).blur();
      }

      const isPlaying = player.state === 'playing' || player.state === 'paused';
      const action = mapKeyEvent(e, mode, { isPlaying });
      if (!action) return;

      e.preventDefault();

      if (action === 'toggle-diagnostics') {
        setIsDiagnosticsOpen((prev) => {
          if (!prev) setPerfSamples([...perfSamplesRef.current]);
          return !prev;
        });
        return;
      }

      if (action === 'save-score') {
        handleSave(false);
        return;
      }

      if (action === 'save-as-score') {
        handleSave(true);
        return;
      }

      if (action === 'open-score') {
        handleOpenClick();
        return;
      }

      if (action === 'toggle-playback') {
        if (player.state === 'playing') {
          player.pause();
        } else if (player.state === 'paused') {
          player.resume();
        } else {
          if (selectedRange) {
            player.playRange(selectedRange.anchorId, selectedRange.focusId);
          } else {
            player.play(selectedEventId ?? undefined);
          }
        }
        return;
      }

      if (action === 'play-from-start') {
        player.stop();
        player.play();
        return;
      }

      if (action === 'stop-playback') {
        player.stop();
        return;
      }

      const tInput = e.timeStamp;
      const tHandlerStart = performance.now();

      const recordSample = (key: string) => {
        const tHandlerEnd = performance.now();
        const inputDelay = Math.max(0, tHandlerStart - tInput);
        const handlerDuration = Math.max(0, tHandlerEnd - tHandlerStart);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const tPaint = performance.now();
            const paintDuration = Math.max(0, tPaint - tHandlerEnd);
            const totalDuration = Math.max(0, tPaint - tInput);
            const sample: PerfSample = {
              timestamp: Date.now(),
              key,
              inputDelay: Number(inputDelay.toFixed(2)),
              handlerDuration: Number(handlerDuration.toFixed(2)),
              paintDuration: Number(paintDuration.toFixed(2)),
              totalDuration: Number(totalDuration.toFixed(2)),
            };

            if (typeof window !== 'undefined') {
              if (!window.__perf) window.__perf = [];
              window.__perf.push(sample.totalDuration);
              const w = window as unknown as { __perfSamples?: PerfSample[] };
              if (!w.__perfSamples) w.__perfSamples = [];
              w.__perfSamples.push(sample);
            }

            perfSamplesRef.current.push(sample);
            if (perfSamplesRef.current.length > 100) perfSamplesRef.current.shift();
            if (isDiagnosticsOpen) {
              setPerfSamples([...perfSamplesRef.current]);
            }
          });
        });
      };

      if (typeof action === 'string') {
        switch (action) {
          case 'undo':
            undo();
            recordSample('Undo');
            break;
          case 'redo':
            redo();
            recordSample('Redo');
            break;
          case 'set-mode-select':
            setMode('select');
            setDragStatus(null);
            break;
          case 'toggle-position-mode':
            togglePositionMode();
            setDragStatus(null);
            break;
          case 'toggle-lyrics-mode':
            setMode(mode === 'lyrics' ? 'select' : 'lyrics');
            break;
          case 'lyrics-next-note':
            moveCursorDirection('next');
            break;
          case 'lyrics-prev-note':
            moveCursorDirection('prev');
            break;
          case 'toggle-note-input':
            toggleInputMode();
            break;
          case 'exit-note-input':
            exitInputMode();
            break;
          case 'clear-selection':
            selectEvent(null);
            break;
          case 'select-all':
            selectAllInStaff();
            break;
          case 'copy':
            copySelection();
            break;
          case 'cut':
            cutSelection();
            break;
          case 'paste':
            pasteClipboard();
            break;
          case 'insert-measure':
            insertNewMeasure();
            break;
          case 'delete-measure':
            handleDeleteMeasureWithPrompt();
            break;
          case 'extend-selection-prev':
            extendSelectionDirection('prev');
            break;
          case 'extend-selection-next':
            extendSelectionDirection('next');
            break;
          case 'cycle-accidental-up':
            cycleAccidentalSelection(1);
            break;
          case 'cycle-accidental-down':
            cycleAccidentalSelection(-1);
            break;
          case 'reset-accidental':
            resetAccidentalSelection();
            break;
          case 'next-voice':
            cycleVoiceDirection('next');
            break;
          case 'prev-voice':
            cycleVoiceDirection('prev');
            break;
          case 'toggle-tie':
            toggleTieSelection();
            break;
          case 'toggle-slur':
            applySlur();
            recordSample('Shift+S');
            break;
          case 'clear-notations':
            clearNotations();
            recordSample('ClearNotations');
            break;
          case 'select-prev':
            if (mode === 'input') {
              moveCursorDirection('prev');
            } else {
              selectNext('prev');
            }
            recordSample('ArrowLeft');
            break;
          case 'select-next':
            if (mode === 'input') {
              moveCursorDirection('next');
            } else {
              selectNext('next');
            }
            recordSample('ArrowRight');
            break;
          case 'transpose-semitone-up':
            if (selection.kind === 'range') {
              transposeSelection(1);
              recordSample('ArrowUp');
            } else if (selectedEventId) {
              if (mode === 'select') {
                const nextScore = executeCommand(transposeEvent(selectedEventId, 1));
                const p = findEventPitches(nextScore, selectedEventId);
                if (p) previewPlayer.previewPitches(p);
              }
              recordSample('ArrowUp');
            }
            break;
          case 'transpose-semitone-down':
            if (selection.kind === 'range') {
              transposeSelection(-1);
              recordSample('ArrowDown');
            } else if (selectedEventId) {
              if (mode === 'select') {
                const nextScore = executeCommand(transposeEvent(selectedEventId, -1));
                const p = findEventPitches(nextScore, selectedEventId);
                if (p) previewPlayer.previewPitches(p);
              }
              recordSample('ArrowDown');
            }
            break;
          case 'transpose-octave-up':
            if (selection.kind === 'range') {
              transposeSelection(12);
              recordSample('Ctrl+ArrowUp');
            } else if (selectedEventId) {
              if (mode === 'select') {
                const nextScore = executeCommand(transposeEvent(selectedEventId, 12));
                const p = findEventPitches(nextScore, selectedEventId);
                if (p) previewPlayer.previewPitches(p);
              }
              recordSample('Ctrl+ArrowUp');
            }
            break;
          case 'transpose-octave-down':
            if (selection.kind === 'range') {
              transposeSelection(-12);
              recordSample('Ctrl+ArrowDown');
            } else if (selectedEventId) {
              if (mode === 'select') {
                const nextScore = executeCommand(transposeEvent(selectedEventId, -12));
                const p = findEventPitches(nextScore, selectedEventId);
                if (p) previewPlayer.previewPitches(p);
              }
              recordSample('Ctrl+ArrowDown');
            }
            break;
          case 'reset-override':
            if (selectedEventId) {
              clearEventOverride(selectedEventId);
              recordSample('Ctrl+0');
            }
            break;
          case 'convert-to-rest':
            if (selection.kind === 'range') {
              deleteSelection();
              recordSample('Delete');
            } else if (selectedEventId) {
              if (mode === 'select') executeCommand(convertToRest(selectedEventId));
              recordSample('Delete');
            }
            break;
          case 'enter-rest':
            enterRestAtCursor(t('error.doesNotFit'), t('error.noCursor'));
            recordSample('Digit0');
            break;
          case 'toggle-dot':
            toggleDot();
            break;
          case 'show-input-off-hint':
            triggerRejectedError(t('status.inputOff'));
            break;
        }
      } else if (typeof action === 'object') {
        if (action.type === 'enter-pitch') {
          enterPitchAtCursor(
            action.letter as PitchStep,
            t('error.doesNotFit'),
            t('error.noCursor'),
            (p) => previewPlayer.previewPitches([p])
          );
          recordSample(`Key${action.letter}`);
        } else if (action.type === 'set-duration') {
          setActiveDuration(action.baseType);
          setIsRestSelected(false);
        } else if (action.type === 'apply-dynamic') {
          applyDynamic(action.dynamic as DynamicType);
          recordSample(`Dynamic-${action.dynamic}`);
        } else if (action.type === 'toggle-articulation') {
          applyArticulation(action.articulation as ArticulationType);
          recordSample(`Artic-${action.articulation}`);
        } else if (action.type === 'legacy-key-hint') {
          if (action.hintKey === 'accent') {
            triggerRejectedError(t('hint.accentKey'));
          } else if (action.hintKey === 'marcato') {
            triggerRejectedError(t('hint.marcatoKey'));
          } else if (action.hintKey === 'tenuto') {
            triggerRejectedError(t('hint.tenutoKey'));
          }
        } else if (action.type === 'nudge-override') {
          if (selectedEventId && selectedEventInfo) {
            if (action.dy !== 0 && (selectedEventInfo.isNote || selectedEventInfo.isChord)) {
              triggerRejectedError(t('status.noVerticalOffset'));
              recordSample('Arrow');
            } else {
              const res = applyEventOverride(
                selectedEventId,
                action.dx,
                action.dy,
                true,
                latestLayoutRef.current ?? undefined
              );
              if (res.isAtLimit) {
                setDragStatus(
                  `dx ${res.dx.toFixed(2)} · dy ${res.dy.toFixed(2)} · ${t('status.offsetLimit')}`
                );
                triggerRejectedError(t('status.offsetLimit'));
              } else {
                setDragStatus(`dx ${res.dx.toFixed(2)} · dy ${res.dy.toFixed(2)}`);
              }
              recordSample('Arrow');
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    mode,
    setMode,
    togglePositionMode,
    toggleInputMode,
    exitInputMode,
    undo,
    redo,
    selectedEventId,
    selectEvent,
    selectNext,
    selectedEventInfo,
    selectedRange,
    selection,
    selectAllInStaff,
    copySelection,
    cutSelection,
    pasteClipboard,
    insertNewMeasure,
    handleDeleteMeasureWithPrompt,
    extendSelectionDirection,
    cycleAccidentalSelection,
    resetAccidentalSelection,
    toggleTieSelection,
    applySlur,
    clearNotations,
    moveCursorDirection,
    cycleVoiceDirection,
    transposeSelection,
    executeCommand,
    previewPlayer,
    clearEventOverride,
    applyEventOverride,
    latestLayoutRef,
    deleteSelection,
    enterRestAtCursor,
    enterPitchAtCursor,
    toggleDot,
    triggerRejectedError,
    setActiveDuration,
    setIsRestSelected,
    applyDynamic,
    applyArticulation,
    setDragStatus,
    perfSamplesRef,
    isDiagnosticsOpen,
    setIsDiagnosticsOpen,
    setPerfSamples,
    player,
    handleSave,
    handleOpenClick,
    t,
  ]);
}
