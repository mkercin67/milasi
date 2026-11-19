// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useRef, useState } from 'react';
import { BaseDurationType, Pitch, PitchStep, Score } from '../../core/model';
import { EditorMode } from '../keymap';
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
} from '../../core/input';
import { durationTicks, measureTicks } from '../../core/time';
import { newId } from '../../core/factory';
import { Command } from '../../core/commands';

export interface UseEditorInputParams {
  score: Score;
  initialCursor: ScoreCursor | null;
  executeCommand: (cmd: Command) => Score;
  triggerRejectedError: (msg: string) => void;
  setSelectedEventId: (id: string | null) => void;
}

export function useEditorInput({
  score,
  initialCursor,
  executeCommand,
  triggerRejectedError,
  setSelectedEventId,
}: UseEditorInputParams) {
  const [mode, setModeState] = useState<EditorMode>('select');
  const isInputMode = mode === 'input';

  const [activeDuration, setActiveDuration] = useState<BaseDurationType>('quarter');
  const [activeDots, setActiveDots] = useState<number>(0);
  const [isRestSelected, setIsRestSelected] = useState<boolean>(false);

  const [cursor, setCursor] = useState<ScoreCursor | null>(initialCursor);
  const cursorRef = useRef<ScoreCursor | null>(cursor);
  cursorRef.current = cursor;

  const lastEnteredPitchRef = useRef<Pitch | null>(null);

  const setMode = useCallback(
    (nextMode: EditorMode) => {
      setModeState(nextMode);
      if (nextMode === 'input') {
        setCursor((curr) => {
          if (curr) return curr;
          const sId = score.parts[0]?.staves[0]?.id;
          const mId = score.measures[0]?.id;
          const voice1 = score.parts[0]?.staves[0]?.measures[mId]?.voices.find((v) => v.voiceIndex === 1);
          if (sId && mId && voice1) {
            return { staffId: sId, voiceIndex: 1, measureId: mId, tick: 0 };
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
          const voice1 = score.parts[0]?.staves[0]?.measures[mId]?.voices.find((v) => v.voiceIndex === 1);
          if (sId && mId && voice1) {
            return { staffId: sId, voiceIndex: 1, measureId: mId, tick: 0 };
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
        executeCommand(appendMeasure());
      }

      const nextScore = executeCommand(
        enterNote(activeCursor, {
          baseType: activeDuration,
          dots: activeDots,
          pitch,
          eventId,
        })
      );

      setSelectedEventId(eventId);
      lastEnteredPitchRef.current = pitch;

      const nextCursor = advanceCursor(nextScore, activeCursor, duration);
      setCursor(nextCursor);
    },
    [mode, cursor, score, activeDuration, activeDots, triggerRejectedError, executeCommand, setSelectedEventId]
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
        executeCommand(appendMeasure());
      }

      const nextScore = executeCommand(
        enterNote(activeCursor, {
          baseType: activeDuration,
          dots: activeDots,
          pitch,
          eventId,
        })
      );

      setSelectedEventId(eventId);
      lastEnteredPitchRef.current = pitch;

      const nextCursor = advanceCursor(nextScore, activeCursor, duration);
      setCursor(nextCursor);
    },
    [mode, cursor, score, activeDuration, activeDots, triggerRejectedError, executeCommand, setSelectedEventId]
  );

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
        executeCommand(appendMeasure());
      }

      const nextScore = executeCommand(
        enterRest(activeCursor, {
          baseType: activeDuration,
          dots: activeDots,
          eventId,
        })
      );

      setSelectedEventId(eventId);

      const nextCursor = advanceCursor(nextScore, activeCursor, duration);
      setCursor(nextCursor);
    },
    [mode, cursor, score, activeDuration, activeDots, triggerRejectedError, executeCommand, setSelectedEventId]
  );

  const moveCursorDirection = useCallback(
    (direction: 'prev' | 'next') => {
      if (!cursor) return;
      const nextCursor = moveCursor(score, cursor, direction);
      setCursor(nextCursor);
      lastEnteredPitchRef.current = getLastNotePitchBeforeCursor(score, nextCursor);

      const staff = score.parts[0]?.staves.find((s) => s.id === nextCursor.staffId);
      const sm = staff?.measures[nextCursor.measureId];
      const voice = sm?.voices.find((v) => v.voiceIndex === nextCursor.voiceIndex);
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
    [cursor, score, setSelectedEventId]
  );

  const setCursorToMeasure = useCallback(
    (measureId: string, tick = 0) => {
      const sId = score.parts[0]?.staves[0]?.id;
      const staff = score.parts[0]?.staves[0];
      const sm = staff?.measures[measureId];
      const voice1 = sm?.voices.find((v) => v.voiceIndex === 1);
      if (sId && voice1) {
        const nextC: ScoreCursor = { staffId: sId, voiceIndex: 1, measureId, tick };
        setCursor(nextC);
        lastEnteredPitchRef.current = getLastNotePitchBeforeCursor(score, nextC);
      }
    },
    [score]
  );

  return {
    mode,
    setMode,
    isInputMode,
    setIsInputMode,
    toggleInputMode,
    togglePositionMode,
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
    cursorRef,
    lastEnteredPitchRef,
    enterPitchAtCursor,
    enterPitchDirect,
    enterRestAtCursor,
    moveCursorDirection,
    setCursorToMeasure,
  };
}
