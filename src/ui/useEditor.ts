/**
 * State management hook for ScoreForge editor.
 *
 * Encapsulates the Score data model, Command history stack, explicit editor mode
 * ('select' | 'input' | 'position'), selection state, cursor positioning, and error timing.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Command,
  History,
  setOverride,
  clearOverride,
  clearAllOverrides,
  changePitch,
  deleteRange,
  transposeRange,
  insertMeasure,
  deleteMeasure,
  toggleTie,
  setExplicitAccidental,
  resetAccidentalToKeySig,
  convertToRest,
  transposeEvent,
} from '../core/commands';
import {
  BaseDurationType,
  NoteEvent,
  Pitch,
  PitchStep,
  Score,
  ScoreEvent,
} from '../core/model';
import {
  Selection,
  RangeSelection,
  eventsInRange,
  extendSelection,
  getRangeMeasureSpan,
  findEventContext,
  eventExists,
  nextEventId,
} from '../core/selection';
import {
  deserializeClipboard,
  getMemoryClipboard,
  pasteEvents,
  serializeClipboard,
  setMemoryClipboard,
} from '../core/clipboard';
import {
  advanceCursor,
  appendMeasure,
  enterNote,
  enterRest,
  getLastNotePitchBeforeCursor,
  moveCursor,
  pitchFromLetter,
  planEnter,
  ScoreCursor,
  snapCursor,
} from '../core/input';
import { durationTicks, measureTicks } from '../core/time';
import { newId, createEmptyScore } from '../core/factory';
import { buildSampleScore, createBenchmark64Score } from './Demo';
import { EditorMode } from './keymap';
import { layoutScore } from '../layout/layoutScore';
import { LayoutResult } from '../layout/types';
import { clampEventOverrideInLayout } from '../layout/mouse';

export interface SelectedEventInfo {
  eventId: string;
  measureNumber: number;
  event: ScoreEvent;
  isNote: boolean;
  isChord: boolean;
  isRest: boolean;
  pitches: Pitch[];
  baseType: ScoreEvent['baseType'];
  dots: number;
}

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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(() => ({ kind: 'none' }));

  // Single source of truth for active editor mode
  const [mode, setModeState] = useState<EditorMode>('select');
  const isInputMode = mode === 'input';

  const [activeDuration, setActiveDuration] = useState<BaseDurationType>('quarter');
  const [activeDots, setActiveDots] = useState<number>(0);
  const [isRestSelected, setIsRestSelected] = useState<boolean>(false);

  const [cursor, setCursor] = useState<ScoreCursor | null>(() => {
    const sId = historyRef.current.score.parts[0]?.staves[0]?.id;
    const mId = historyRef.current.score.measures[0]?.id;
    const vId = historyRef.current.score.parts[0]?.staves[0]?.measures[mId]?.voices[0]?.id;
    if (sId && mId && vId) {
      return { staffId: sId, voiceId: vId, measureId: mId, tick: 0 };
    }
    return null;
  });

  const lastEnteredPitchRef = useRef<Pitch | null>(null);

  // Synchronous State Refs (R2: Anti-Stale-Closure Architecture)
  const scoreRef = useRef<Score>(score);
  scoreRef.current = score;
  const selectionRef = useRef<Selection>({ kind: 'none' });
  const selectedEventIdRef = useRef<string | null>(null);
  const cursorRef = useRef<ScoreCursor | null>(cursor);
  cursorRef.current = cursor;
  const rangeEventsRef = useRef<ScoreEvent[]>([]);
  const selectedEventInfoRef = useRef<SelectedEventInfo | null>(null);

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

  const resetScore = useCallback((newScore: Score) => {
    historyRef.current = new History(newScore);
    historyRef.current.markClean();
    setScore(historyRef.current.score);
    setDirtyVersion((v) => v + 1);
    setSelectedEventId(null);
    lastEnteredPitchRef.current = null;

    const sId = newScore.parts[0]?.staves[0]?.id;
    const mId = newScore.measures[0]?.id;
    const vId = newScore.parts[0]?.staves[0]?.measures[mId]?.voices[0]?.id;
    if (sId && mId && vId) {
      setCursor({ staffId: sId, voiceId: vId, measureId: mId, tick: 0 });
    } else {
      setCursor(null);
    }
  }, []);

  const executeCommand = useCallback((cmd: Command) => {
    const nextScore = historyRef.current.do(cmd);
    scoreRef.current = nextScore;
    setScore(nextScore);
    setDirtyVersion((v) => v + 1);
    return nextScore;
  }, []);

  const undo = useCallback(() => {
    const prevScore = historyRef.current.undo();
    if (prevScore) {
      scoreRef.current = prevScore;
      setScore(prevScore);
      setDirtyVersion((v) => v + 1);
      setSelectedEventId((curr) => (curr && eventExists(prevScore, curr) ? curr : null));
      setCursor((c) => {
        const nextC = c ? snapCursor(prevScore, c) : null;
        lastEnteredPitchRef.current = getLastNotePitchBeforeCursor(prevScore, nextC);
        return nextC;
      });
    }
  }, []);

  const redo = useCallback(() => {
    const nextScore = historyRef.current.redo();
    if (nextScore) {
      scoreRef.current = nextScore;
      setScore(nextScore);
      setDirtyVersion((v) => v + 1);
      setSelectedEventId((curr) => (curr && eventExists(nextScore, curr) ? curr : null));
      setCursor((c) => {
        const nextC = c ? snapCursor(nextScore, c) : null;
        lastEnteredPitchRef.current = getLastNotePitchBeforeCursor(nextScore, nextC);
        return nextC;
      });
    }
  }, []);

  const selectEvent = useCallback((id: string | null) => {
    selectedEventIdRef.current = id;
    const newSel: Selection = id ? { kind: 'event', id } : { kind: 'none' };
    selectionRef.current = newSel;
    rangeEventsRef.current = [];
    setSelectedEventId(id);
    setSelection(newSel);
  }, []);

  const setRangeSelection = useCallback((range: RangeSelection | null) => {
    selectedEventIdRef.current = null;
    if (range) {
      const newSel: Selection = { kind: 'range', ...range };
      selectionRef.current = newSel;
      rangeEventsRef.current = eventsInRange(scoreRef.current, range);
      setSelection(newSel);
      setSelectedEventId(null);
    } else {
      selectionRef.current = { kind: 'none' };
      rangeEventsRef.current = [];
      setSelection({ kind: 'none' });
      setSelectedEventId(null);
    }
  }, []);

  const extendSelectionTo = useCallback(
    (targetEventId: string) => {
      const curScore = scoreRef.current;
      const baseSel: Selection =
        selectionRef.current.kind !== 'none'
          ? selectionRef.current
          : selectedEventIdRef.current
          ? { kind: 'event', id: selectedEventIdRef.current }
          : { kind: 'none' };
      const nextSel = extendSelection(curScore, baseSel, targetEventId);
      selectionRef.current = nextSel;
      if (nextSel.kind === 'event') {
        selectedEventIdRef.current = nextSel.id;
        rangeEventsRef.current = [];
        setSelectedEventId(nextSel.id);
      } else if (nextSel.kind === 'range') {
        selectedEventIdRef.current = null;
        rangeEventsRef.current = eventsInRange(curScore, nextSel);
        setSelectedEventId(null);
      } else {
        selectedEventIdRef.current = null;
        rangeEventsRef.current = [];
        setSelectedEventId(null);
      }
      setSelection(nextSel);
    },
    []
  );

  const extendSelectionDirection = useCallback(
    (direction: 'prev' | 'next') => {
      const curScore = scoreRef.current;
      const staffId = curScore.parts[0]?.staves[0]?.id;
      if (!staffId) return;
      const curSel = selectionRef.current;
      const currentEventId =
        curSel.kind === 'range'
          ? curSel.focusId
          : curSel.kind === 'event'
          ? curSel.id
          : selectedEventIdRef.current;
      if (!currentEventId) return;
      const nextId = nextEventId(curScore, staffId, currentEventId, direction);
      if (nextId) {
        extendSelectionTo(nextId);
      }
    },
    [extendSelectionTo]
  );

  const selectAllInStaff = useCallback(() => {
    const curScore = scoreRef.current;
    const staff = curScore.parts[0]?.staves[0];
    if (!staff) return;
    const allEvents: ScoreEvent[] = [];
    for (const mDef of curScore.measures) {
      const sm = staff.measures[mDef.id];
      if (sm) {
        for (const v of sm.voices) {
          allEvents.push(...v.events);
        }
      }
    }
    if (allEvents.length > 0) {
      const firstEv = allEvents[0];
      const lastEv = allEvents[allEvents.length - 1];
      const firstCtx = findEventContext(curScore, firstEv.id);
      const voiceId = firstCtx?.voiceId ?? staff.measures[curScore.measures[0]?.id]?.voices[0]?.id;
      if (voiceId) {
        const nextSel: Selection = {
          kind: 'range',
          staffId: staff.id,
          voiceId,
          anchorId: firstEv.id,
          focusId: lastEv.id,
        };
        selectionRef.current = nextSel;
        selectedEventIdRef.current = null;
        rangeEventsRef.current = eventsInRange(curScore, nextSel);
        setSelection(nextSel);
        setSelectedEventId(null);
      }
    }
  }, []);

  const selectNext = useCallback(
    (direction: 'prev' | 'next') => {
      const staffId = score.parts[0]?.staves[0]?.id;
      if (!staffId) return;
      const nextId = nextEventId(score, staffId, selectedEventId, direction);
      if (nextId) {
        setSelectedEventId(nextId);
        setSelection({ kind: 'event', id: nextId });
      }
    },
    [score, selectedEventId]
  );

  // Set explicit mode ('select' | 'input' | 'position')
  const setMode = useCallback(
    (nextMode: EditorMode) => {
      setModeState(nextMode);
      if (nextMode === 'input') {
        setCursor((curr) => {
          if (curr) return curr;
          const sId = score.parts[0]?.staves[0]?.id;
          const mId = score.measures[0]?.id;
          const vId = score.parts[0]?.staves[0]?.measures[mId]?.voices[0]?.id;
          if (sId && mId && vId) {
            return { staffId: sId, voiceId: vId, measureId: mId, tick: 0 };
          }
          return null;
        });
      }
    },
    [score]
  );

  const setIsInputMode = useCallback(
    (val: boolean) => {
      setMode(val ? 'input' : 'select');
    },
    [setMode]
  );

  const toggleInputMode = useCallback(() => {
    setModeState((prev) => {
      const next: EditorMode = prev === 'input' ? 'select' : 'input';
      if (next === 'input') {
        setCursor((curr) => {
          if (curr) return curr;
          const sId = score.parts[0]?.staves[0]?.id;
          const mId = score.measures[0]?.id;
          const vId = score.parts[0]?.staves[0]?.measures[mId]?.voices[0]?.id;
          if (sId && mId && vId) {
            return { staffId: sId, voiceId: vId, measureId: mId, tick: 0 };
          }
          return null;
        });
      }
      return next;
    });
  }, [score]);

  const togglePositionMode = useCallback(() => {
    setModeState((prev) => (prev === 'position' ? 'select' : 'position'));
  }, []);

  const exitInputMode = useCallback(() => {
    setModeState('select');
  }, []);

  const toggleDot = useCallback(() => {
    setActiveDots((prev) => (prev > 0 ? 0 : 1));
  }, []);

  const toggleRestSelected = useCallback(() => {
    setIsRestSelected((prev) => !prev);
  }, []);

  // Enter a note with the keyboard
  const enterPitchAtCursor = useCallback(
    (letter: PitchStep, errorMsg: string, noCursorMsg?: string, onNoteEntered?: (p: Pitch) => void) => {
      if (mode !== 'input') return;
      if (!cursor) {
        triggerRejectedError(noCursorMsg ?? 'İmleç yok, bir ölçüye tıklayın');
        return;
      }

      const activeCursor = cursor;
      const mDef = score.measures.find((m) => m.id === activeCursor.measureId);
      if (!mDef) {
        triggerRejectedError(errorMsg);
        return;
      }

      const part = score.parts.find((p) => p.staves.some((s) => s.id === activeCursor.staffId));
      const staff = part?.staves.find((s) => s.id === activeCursor.staffId);
      const clef = staff?.clef ?? { sign: 'G' as const, line: 2 };
      const keySig = mDef.keySig;

      // Determine previous pitch reference: LAST ENTERED note, or note before cursor
      const refPitch =
        lastEnteredPitchRef.current ?? getLastNotePitchBeforeCursor(score, activeCursor);

      const pitch = pitchFromLetter(letter, refPitch, clef, keySig);
      const eventId = newId();

      const plan = planEnter(score, activeCursor, {
        kind: 'note',
        baseType: activeDuration,
        dots: activeDots,
        pitch,
        eventId,
      });

      if (!plan.ok) {
        triggerRejectedError(errorMsg);
        return;
      }

      onNoteEntered?.(pitch);

      const duration = durationTicks(activeDuration, activeDots);
      const mIdx = score.measures.findIndex((m) => m.id === activeCursor.measureId);
      const mLength = measureTicks(mDef.timeSig);
      const isLastMeasure = mIdx === score.measures.length - 1;
      const willFinishMeasure = activeCursor.tick + duration >= mLength;

      if (isLastMeasure && willFinishMeasure) {
        historyRef.current.do(appendMeasure());
      }

      const nextScore = historyRef.current.do(
        enterNote(activeCursor, {
          baseType: activeDuration,
          dots: activeDots,
          pitch,
          eventId,
        })
      );

      setScore(nextScore);
      setSelectedEventId(eventId);
      lastEnteredPitchRef.current = pitch;

      const nextCursor = advanceCursor(nextScore, activeCursor, duration);
      setCursor(nextCursor);
    },
    [mode, cursor, score, activeDuration, activeDots, triggerRejectedError]
  );

  const enterPitchDirect = useCallback(
    (pitch: Pitch, customCursor?: ScoreCursor, errorMsg = 'Nota ölçüye sığmıyor') => {
      if (mode !== 'input') return;
      const targetC = customCursor ?? cursor;
      if (!targetC) {
        triggerRejectedError('İmleç yok, bir ölçüye tıklayın');
        return;
      }

      const activeCursor = snapCursor(score, targetC);
      const mDef = score.measures.find((m) => m.id === activeCursor.measureId);
      if (!mDef) return;

      const eventId = newId();
      const plan = planEnter(score, activeCursor, {
        kind: 'note',
        baseType: activeDuration,
        dots: activeDots,
        pitch,
        eventId,
      });

      if (!plan.ok) {
        triggerRejectedError(errorMsg);
        return;
      }

      const duration = durationTicks(activeDuration, activeDots);
      const mIdx = score.measures.findIndex((m) => m.id === activeCursor.measureId);
      const mLength = measureTicks(mDef.timeSig);
      const isLastMeasure = mIdx === score.measures.length - 1;
      const willFinishMeasure = activeCursor.tick + duration >= mLength;

      if (isLastMeasure && willFinishMeasure) {
        historyRef.current.do(appendMeasure());
      }

      const nextScore = historyRef.current.do(
        enterNote(activeCursor, {
          baseType: activeDuration,
          dots: activeDots,
          pitch,
          eventId,
        })
      );

      setScore(nextScore);
      setSelectedEventId(eventId);
      lastEnteredPitchRef.current = pitch;

      const nextCursor = advanceCursor(nextScore, activeCursor, duration);
      setCursor(nextCursor);
    },
    [mode, cursor, score, activeDuration, activeDots, triggerRejectedError]
  );

  const applyEventOverride = useCallback(
    (
      eventId: string,
      dx: number,
      dy: number,
      accumulate = true,
      layoutArg?: LayoutResult
    ): { dx: number; dy: number; isAtLimit: boolean; isRest: boolean } => {
      const currScore = historyRef.current.score;
      const existing = currScore.overrides[eventId];
      const targetDx = accumulate ? (existing?.dx ?? 0) + dx : dx;
      const targetDy = accumulate ? (existing?.dy ?? 0) + dy : dy;
      const activeLayout = layoutArg ?? layoutScore(currScore, { width: 70 });
      const clamped = clampEventOverrideInLayout(activeLayout, currScore, eventId, targetDx, targetDy);

      const nextScore = historyRef.current.do(
        setOverride(eventId, { dx: clamped.dx, dy: clamped.dy }, false)
      );
      setScore(nextScore);
      return clamped;
    },
    []
  );

  const changeEventPitch = useCallback((eventId: string, pitches: Pitch[]) => {
    const nextScore = historyRef.current.do(changePitch(eventId, pitches));
    setScore(nextScore);
  }, []);

  const clearEventOverride = useCallback(
    (eventId?: string) => {
      const targetId = eventId ?? selectedEventId;
      if (!targetId) return;
      const nextScore = historyRef.current.do(clearOverride(targetId));
      setScore(nextScore);
    },
    [selectedEventId]
  );

  const clearAllEventOverrides = useCallback(() => {
    const nextScore = historyRef.current.do(clearAllOverrides());
    setScore(nextScore);
  }, []);

  const enterRestAtCursor = useCallback(
    (errorMsg: string, noCursorMsg?: string) => {
      if (mode !== 'input') return;
      if (!cursor) {
        triggerRejectedError(noCursorMsg ?? 'İmleç yok, bir ölçüye tıklayın');
        return;
      }

      const activeCursor = cursor;
      const mDef = score.measures.find((m) => m.id === activeCursor.measureId);
      if (!mDef) {
        triggerRejectedError(errorMsg);
        return;
      }

      const eventId = newId();
      const plan = planEnter(score, activeCursor, {
        kind: 'rest',
        baseType: activeDuration,
        dots: activeDots,
        eventId,
      });

      if (!plan.ok) {
        triggerRejectedError(errorMsg);
        return;
      }

      const duration = durationTicks(activeDuration, activeDots);
      const mIdx = score.measures.findIndex((m) => m.id === activeCursor.measureId);
      const mLength = measureTicks(mDef.timeSig);
      const isLastMeasure = mIdx === score.measures.length - 1;
      const willFinishMeasure = activeCursor.tick + duration >= mLength;

      if (isLastMeasure && willFinishMeasure) {
        historyRef.current.do(appendMeasure());
      }

      const nextScore = historyRef.current.do(
        enterRest(activeCursor, {
          baseType: activeDuration,
          dots: activeDots,
          eventId,
        })
      );

      setScore(nextScore);
      setSelectedEventId(eventId);

      const nextCursor = advanceCursor(nextScore, activeCursor, duration);
      setCursor(nextCursor);
    },
    [mode, cursor, score, activeDuration, activeDots, triggerRejectedError]
  );

  const moveCursorDirection = useCallback(
    (direction: 'prev' | 'next') => {
      if (!cursor) return;
      const nextCursor = moveCursor(score, cursor, direction);
      setCursor(nextCursor);
      lastEnteredPitchRef.current = getLastNotePitchBeforeCursor(score, nextCursor);

      const staff = score.parts[0]?.staves.find((s) => s.id === nextCursor.staffId);
      const sm = staff?.measures[nextCursor.measureId];
      const voice = sm?.voices.find((v) => v.id === nextCursor.voiceId) ?? sm?.voices[0];
      if (voice) {
        let t = 0;
        for (const ev of voice.events) {
          if (t === nextCursor.tick) {
            setSelectedEventId(ev.id);
            break;
          }
          t += ev.duration;
        }
      }
    },
    [cursor, score]
  );

  // Set cursor to a specific measure (e.g. on click)
  const setCursorToMeasure = useCallback(
    (measureId: string, tick = 0) => {
      const sId = score.parts[0]?.staves[0]?.id;
      const staff = score.parts[0]?.staves[0];
      const sm = staff?.measures[measureId];
      const vId = sm?.voices[0]?.id;
      if (sId && vId) {
        const nextC = { staffId: sId, voiceId: vId, measureId, tick };
        setCursor(nextC);
        lastEnteredPitchRef.current = getLastNotePitchBeforeCursor(score, nextC);
      }
    },
    [score]
  );

  // Locate the selected event and its measure index across the score
  const selectedEventInfo = useMemo<SelectedEventInfo | null>(() => {
    if (!selectedEventId) return null;

    const staff = score.parts[0]?.staves[0];
    if (!staff) return null;

    for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
      const mDef = score.measures[mIdx];
      const sm = staff.measures[mDef.id];
      if (!sm) continue;

      for (const voice of sm.voices) {
        const ev = voice.events.find((e) => e.id === selectedEventId);
        if (ev) {
          const isNote = ev.kind === 'note';
          const isRest = ev.kind === 'rest';
          const pitches = isNote ? (ev as NoteEvent).pitches : [];
          return {
            eventId: ev.id,
            measureNumber: mIdx + 1,
            event: ev,
            isNote,
            isChord: pitches.length > 1,
            isRest,
            pitches,
            baseType: ev.baseType,
            dots: ev.dots,
          };
        }
      }
    }
    return null;
  }, [score, selectedEventId]);

  const currentMeasureNumber = useMemo(() => {
    if (!cursor) return 1;
    const idx = score.measures.findIndex((m) => m.id === cursor.measureId);
    return idx >= 0 ? idx + 1 : 1;
  }, [score, cursor]);

  const selectedRange = useMemo<RangeSelection | null>(
    () => (selection.kind === 'range' ? selection : null),
    [selection]
  );

  const rangeEvents = useMemo<ScoreEvent[]>(
    () => (selectedRange ? eventsInRange(score, selectedRange) : []),
    [score, selectedRange]
  );

  const selectedEventIds = useMemo<Set<string>>(() => {
    if (selectedRange) return new Set(rangeEvents.map((e) => e.id));
    if (selectedEventId) return new Set([selectedEventId]);
    return new Set<string>();
  }, [selectedRange, rangeEvents, selectedEventId]);

  const rangeInfo = useMemo(() => {
    if (!selectedRange || rangeEvents.length === 0) return null;
    return getRangeMeasureSpan(score, rangeEvents);
  }, [score, selectedRange, rangeEvents]);

  selectionRef.current = selection;
  selectedEventIdRef.current = selectedEventId;
  rangeEventsRef.current = rangeEvents;
  selectedEventInfoRef.current = selectedEventInfo;

  const deleteSelection = useCallback(() => {
    const curSel = selectionRef.current;
    if (curSel.kind === 'range') {
      executeCommand(deleteRange(curSel));
      selectionRef.current = { kind: 'none' };
      rangeEventsRef.current = [];
      setSelection({ kind: 'none' });
    } else if (selectedEventIdRef.current) {
      executeCommand(convertToRest(selectedEventIdRef.current));
      selectedEventIdRef.current = null;
      selectionRef.current = { kind: 'none' };
      setSelectedEventId(null);
      setSelection({ kind: 'none' });
    }
  }, [executeCommand]);

  const transposeSelection = useCallback(
    (semitones: number) => {
      if (selection.kind === 'range') {
        try {
          executeCommand(transposeRange(selection, semitones));
        } catch {
          triggerRejectedError('Perde MIDI sınırları dışında (21..108)');
        }
      } else if (selectedEventId) {
        try {
          executeCommand(transposeEvent(selectedEventId, semitones));
        } catch {
          triggerRejectedError('Perde MIDI sınırları dışında (21..108)');
        }
      }
    },
    [selection, selectedEventId, executeCommand, triggerRejectedError]
  );

  const toggleTieSelection = useCallback(() => {
    if (selectedEventId) {
      try {
        executeCommand(toggleTie(selectedEventId, 0));
      } catch {
        triggerRejectedError('Bağlanacak sonraki nota bulunamadı');
      }
    } else if (selection.kind === 'range') {
      try {
        for (const ev of rangeEvents) {
          if (ev.kind === 'note') {
            executeCommand(toggleTie(ev.id, 0));
          }
        }
      } catch {
        triggerRejectedError('Bağlanacak sonraki nota bulunamadı');
      }
    }
  }, [selectedEventId, selection, rangeEvents, executeCommand, triggerRejectedError]);

  const cycleAccidentalSelection = useCallback(
    (delta: number) => {
      if (selectedEventId) {
        executeCommand(setExplicitAccidental(selectedEventId, delta, 0));
      } else if (selection.kind === 'range') {
        for (const ev of rangeEvents) {
          if (ev.kind === 'note') {
            executeCommand(setExplicitAccidental(ev.id, delta, 0));
          }
        }
      } else if (mode === 'input' && cursor) {
        const sm = score.parts[0]?.staves[0]?.measures[cursor.measureId];
        const v = sm?.voices.find((vo) => vo.id === cursor.voiceId);
        if (v) {
          const lastNote = [...v.events].reverse().find((e) => e.kind === 'note');
          if (lastNote) {
            executeCommand(setExplicitAccidental(lastNote.id, delta, 0));
          }
        }
      }
    },
    [selectedEventId, selection, rangeEvents, mode, cursor, score, executeCommand]
  );

  const resetAccidentalSelection = useCallback(() => {
    if (selectedEventId) {
      executeCommand(resetAccidentalToKeySig(selectedEventId, 0));
    } else if (selection.kind === 'range') {
      for (const ev of rangeEvents) {
        if (ev.kind === 'note') {
          executeCommand(resetAccidentalToKeySig(ev.id, 0));
        }
      }
    }
  }, [selectedEventId, selection, rangeEvents, executeCommand]);

  const copySelection = useCallback(() => {
    let evs: ScoreEvent[] = [];
    const curSel = selectionRef.current;
    if (curSel.kind === 'range') {
      evs = rangeEventsRef.current;
    } else if (selectedEventInfoRef.current) {
      evs = [selectedEventInfoRef.current.event];
    }
    if (evs.length > 0) {
      setMemoryClipboard(evs);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(serializeClipboard(evs)).catch(() => {});
      }
    }
  }, []);

  const cutSelection = useCallback(() => {
    copySelection();
    deleteSelection();
  }, [copySelection, deleteSelection]);

  const pasteClipboard = useCallback(async () => {
    let eventsToPaste = getMemoryClipboard();
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        const deserialized = deserializeClipboard(text);
        if (deserialized && deserialized.length > 0) {
          eventsToPaste = deserialized;
        }
      } catch {
        // Fallback to in-memory clipboard
      }
    }
    if (eventsToPaste.length === 0) return;

    const curScore = scoreRef.current;
    const curSel = selectionRef.current;
    const curRangeEvents = rangeEventsRef.current;
    const curEventId = selectedEventIdRef.current;
    const curCursor = cursorRef.current;

    const staff = curScore.parts[0]?.staves[0];
    if (!staff) return;

    let startMId = curScore.measures[0]?.id;
    let startOffset = 0;
    let voiceId = staff.measures[startMId]?.voices[0]?.id;

    if (curSel.kind === 'range') {
      const firstEv = curRangeEvents[0];
      if (firstEv) {
        const loc = findEventContext(curScore, firstEv.id);
        if (loc) {
          startMId = loc.measureId;
          voiceId = loc.voiceId;
          const sm = staff.measures[startMId];
          const v = sm?.voices.find((vo) => vo.id === voiceId);
          if (v) {
            let t = 0;
            for (const ev of v.events) {
              if (ev.id === firstEv.id) {
                startOffset = t;
                break;
              }
              t += ev.duration;
            }
          }
        }
      }
    } else if (curEventId) {
      const loc = findEventContext(curScore, curEventId);
      if (loc) {
        startMId = loc.measureId;
        voiceId = loc.voiceId;
        const sm = staff.measures[startMId];
        const v = sm?.voices.find((vo) => vo.id === voiceId);
        if (v) {
          let t = 0;
          for (const ev of v.events) {
            if (ev.id === curEventId) {
              startOffset = t;
              break;
            }
            t += ev.duration;
          }
        }
      }
    } else if (curCursor) {
      startMId = curCursor.measureId;
      voiceId = curCursor.voiceId;
      startOffset = curCursor.tick;
    }

    if (startMId && voiceId) {
      const placedIds: string[] = [];
      executeCommand({
        name: 'Paste Events',
        apply: (s) =>
          pasteEvents(
            s,
            {
              staffId: staff.id,
              voiceId,
              startMeasureId: startMId,
              startOffsetTicks: startOffset,
            },
            eventsToPaste,
            placedIds
          ),
      });

      if (placedIds.length > 0) {
        const firstId = placedIds[0];
        const lastId = placedIds[placedIds.length - 1];
        if (firstId === lastId) {
          selectEvent(firstId);
        } else {
          setRangeSelection({
            staffId: staff.id,
            voiceId,
            anchorId: firstId,
            focusId: lastId,
          });
        }
      }
    }
  }, [executeCommand, selectEvent, setRangeSelection]);

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
    score,
    isDirty: dirtyVersion >= 0 && historyRef.current.isDirty(),
    markClean,
    canUndo: historyRef.current.canUndo(),
    canRedo: historyRef.current.canRedo(),
    executeCommand,
    undo,
    redo,
    resetScore,
    selectedEventId,
    selectEvent,
    selectNext,
    selectedEventInfo,
    mode,
    setMode,
    togglePositionMode,
    isInputMode,
    setIsInputMode,
    toggleInputMode,
    exitInputMode,
    activeDuration,
    setActiveDuration,
    activeDots,
    setActiveDots,
    toggleDot,
    isRestSelected,
    setIsRestSelected,
    toggleRestSelected,
    cursor,
    setCursor,
    setCursorToMeasure,
    currentMeasureNumber,
    rejectedError,
    triggerRejectedError,
    enterPitchAtCursor,
    enterPitchDirect,
    applyEventOverride,
    clearEventOverride,
    hasSelectedOverride: Boolean(selectedEventId && score.overrides[selectedEventId]),
    hasAnyOverride: Object.keys(score.overrides || {}).length > 0,
    clearAllEventOverrides,
    selectedOverride: selectedEventId ? score.overrides[selectedEventId] : undefined,
    changeEventPitch,
    enterRestAtCursor,
    moveCursorDirection,
    selection,
    selectedRange,
    rangeEvents,
    selectedEventIds,
    rangeInfo,
    setRangeSelection,
    extendSelectionTo,
    extendSelectionDirection,
    selectAllInStaff,
    deleteSelection,
    transposeSelection,
    toggleTieSelection,
    cycleAccidentalSelection,
    resetAccidentalSelection,
    copySelection,
    cutSelection,
    pasteClipboard,
    insertNewMeasure,
    deleteCurrentMeasure,
    confirmDeleteMeasure,
    getScore: () => scoreRef.current,
    getSelection: () => selectionRef.current,
  };
}
