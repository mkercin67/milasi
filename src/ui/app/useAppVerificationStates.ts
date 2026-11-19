// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useRef } from 'react';
import { PitchStep, Score, ScoreEvent } from '../../core/model';
import { createEmptyScore } from '../../core/factory';
import { buildBeamDemoScore } from '../beamDemoScore';
import {
  buildSampleScore,
  createBenchmark64Score,
  createBenchmarkFullFeaturedScore,
  createBenchmarkPolyphonicScore,
} from '../Demo';
import { buildSutIctimScore } from '../sutIctimScore';
import { EditorMode } from '../keymap';

export interface UseAppVerificationStatesParams {
  resetScore: (score: Score) => void;
  setMode: (mode: EditorMode) => void;
  setActiveDuration: (dur: ScoreEvent['baseType']) => void;
  setActiveDots: (dots: number) => void;
  enterPitchAtCursor: (letter: PitchStep, msgDoesNotFit: string, msgNoCursor: string) => void;
  enterRestAtCursor: (msgDoesNotFit: string, msgNoCursor: string) => void;
  moveCursorDirection: (dir: 'prev' | 'next') => void;
  undo: () => void;
  triggerRejectedError: (msg: string) => void;
  setIsNewModalOpen: (open: boolean) => void;
  t: (key: string) => string;
}

export function useAppVerificationStates({
  resetScore,
  setMode,
  setActiveDuration,
  setActiveDots,
  enterPitchAtCursor,
  enterRestAtCursor,
  moveCursorDirection,
  undo,
  triggerRejectedError,
  setIsNewModalOpen,
  t,
}: UseAppVerificationStatesParams) {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const stateParam = params.get('state');
    if (!stateParam) return;

    if (stateParam === 'sample') {
      const sampleScore = buildSampleScore('G');
      resetScore(sampleScore);
      setMode('select');
      return;
    }

    if (stateParam === 'sut_ictim') {
      const sutScore = buildSutIctimScore();
      resetScore(sutScore);
      setMode('select');
      return;
    }

    if (stateParam === 'm3d_demo' || stateParam === 'm3d_bass') {
      const m3dScore = buildBeamDemoScore(stateParam === 'm3d_bass' ? 'F' : 'G');
      resetScore(m3dScore);
      setMode('select');
      setActiveDuration('eighth');
      setActiveDots(0);
      return;
    }

    if (
      stateParam.startsWith('verify_') ||
      stateParam.startsWith('benchmark_') ||
      stateParam === 'demo_3_4' ||
      stateParam === 'demo_bass'
    ) {
      if (stateParam === 'benchmark_64') {
        const bScore = createBenchmark64Score();
        resetScore(bScore);
        setMode('select');
        return;
      }
      if (stateParam === 'benchmark_64_full') {
        const bScore = createBenchmarkFullFeaturedScore(64);
        resetScore(bScore);
        setMode('select');
        return;
      }
      if (stateParam === 'benchmark_200_full') {
        const bScore = createBenchmarkFullFeaturedScore(200);
        resetScore(bScore);
        setMode('select');
        return;
      }
      if (stateParam === 'benchmark_400_full') {
        const bScore = createBenchmarkFullFeaturedScore(400);
        resetScore(bScore);
        setMode('select');
        return;
      }
      if (stateParam === 'benchmark_200_poly') {
        const bScore = createBenchmarkPolyphonicScore(200);
        resetScore(bScore);
        setMode('select');
        return;
      }
      if (stateParam === 'benchmark_400_poly') {
        const bScore = createBenchmarkPolyphonicScore(400);
        resetScore(bScore);
        setMode('select');
        return;
      }
      if (stateParam === 'demo_3_4') {
        const s34 = createEmptyScore({
          clef: { sign: 'G', line: 2 },
          keySig: 0,
          timeSig: { num: 3, den: 4 },
          measures: 4,
        });
        resetScore(s34);
        setMode('input');
        setActiveDuration('quarter');
        setActiveDots(0);
        return;
      }

      if (stateParam === 'demo_bass') {
        const sb = createEmptyScore({
          clef: { sign: 'F', line: 4 },
          keySig: 1,
          timeSig: { num: 4, den: 4 },
          measures: 4,
        });
        resetScore(sb);
        setMode('input');
        setActiveDuration('quarter');
        setActiveDots(0);
        return;
      }

      const freshScore = createEmptyScore({
        clef: { sign: 'G', line: 2 },
        keySig: 0,
        timeSig: { num: 4, den: 4 },
        measures: 8,
      });
      resetScore(freshScore);
      setMode('select');
      setActiveDuration('quarter');
      setActiveDots(0);

      if (stateParam === 'verify_1') return;

      const enterNoteSeq = (letter: PitchStep, dur: ScoreEvent['baseType'], dots = 0) => {
        setActiveDuration(dur);
        setActiveDots(dots);
        enterPitchAtCursor(letter, t('error.doesNotFit'), t('error.noCursor'));
      };

      enterNoteSeq('C', 'quarter');
      enterNoteSeq('D', 'quarter');
      enterNoteSeq('E', 'quarter');
      enterNoteSeq('F', 'quarter');
      if (stateParam === 'verify_2') return;

      enterNoteSeq('G', 'eighth');
      enterNoteSeq('A', 'eighth');
      enterNoteSeq('B', 'eighth');
      enterNoteSeq('C', 'eighth');
      if (stateParam === 'verify_3') return;

      enterRestAtCursor(t('error.doesNotFit'), t('error.noCursor'));
      if (stateParam === 'verify_4') {
        setActiveDuration('half');
        triggerRejectedError(t('error.doesNotFit'));
        return;
      }

      enterNoteSeq('E', 'quarter', 1);
      if (stateParam === 'verify_5') return;

      moveCursorDirection('prev');
      enterNoteSeq('G', 'quarter', 0);
      if (stateParam === 'verify_6') return;

      undo();
      if (stateParam === 'verify_7') return;
      if (stateParam === 'verify_8') return;
      if (stateParam === 'verify_9') return;
      if (stateParam === 'verify_10') {
        setIsNewModalOpen(true);
        return;
      }
    }
  }, [
    resetScore,
    setMode,
    setActiveDuration,
    setActiveDots,
    enterPitchAtCursor,
    enterRestAtCursor,
    moveCursorDirection,
    undo,
    triggerRejectedError,
    setIsNewModalOpen,
    t,
  ]);
}
