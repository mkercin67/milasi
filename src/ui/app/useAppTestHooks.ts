// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useLayoutEffect } from 'react';
import { Score } from '../../core/model';
import { setOverride, Command } from '../../core/commands';
import { EditorMode } from '../keymap';
import { buildSampleScore, createBenchmark64Score } from '../Demo';

function calcPercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * (p / 100)));
  return Number(sorted[idx].toFixed(2));
}

export interface UseAppTestHooksParams {
  executeCommand: (cmd: Command) => Score;
  selectEvent: (id: string | null) => void;
  resetScore: (score: Score) => void;
  scoreRef: React.MutableRefObject<Score>;
  editorStateRef: React.MutableRefObject<{
    mode: EditorMode;
    selectedEventId: string | null;
    cursor: unknown;
  }>;
}

declare global {
  interface Window {
    __executeCommandForTest?: (cmd: (score: Score) => Score) => Score;
    __selectEventForTest?: (id: string | null) => void;
    __resetScoreForTest?: (newScore: Score) => void;
    __buildSampleScore?: () => Score;
    __createBenchmark64Score?: () => Score;
  }
}

export function useAppTestHooks({
  executeCommand,
  selectEvent,
  resetScore,
  scoreRef,
  editorStateRef,
}: UseAppTestHooksParams) {
  // Dev-only performance probe: measure keydown-to-paint (t1 - t0)
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const t0 = window.__perfT0;
    if (t0 !== undefined) {
      window.__perfT0 = undefined;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const t1 = performance.now();
          const duration = t1 - t0;
          if (!window.__perf) window.__perf = [];
          window.__perf.push(duration);
        });
      });
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__applyRawOverrideForTest = (eventId: string, dx: number, dy: number) => {
      executeCommand(setOverride(eventId, { dx, dy }));
    };
    window.__getScoreForTest = () => scoreRef.current;
    window.__executeCommandForTest = (cmd: (score: Score) => Score) => executeCommand(cmd);
    window.__selectEventForTest = (id: string | null) => selectEvent(id);
    window.__resetScoreForTest = (newScore: Score) => resetScore(newScore);
    window.__buildSampleScore = () => buildSampleScore('G');
    window.__createBenchmark64Score = () => createBenchmark64Score();
    window.__getEditorStateForTest = () => editorStateRef.current;
    window.__printPerfTable = () => {
      const arr = window.__perf ?? [];
      const first10 = arr.slice(0, 10);
      const last10 = arr.slice(Math.max(0, arr.length - 10));
      const stats = {
        first10: { p50: calcPercentile(first10, 50), p95: calcPercentile(first10, 95) },
        last10: { p50: calcPercentile(last10, 50), p95: calcPercentile(last10, 95) },
        total: { count: arr.length, p50: calcPercentile(arr, 50), p95: calcPercentile(arr, 95) },
      };
      console.table({
        'First 10 notes': { p50: `${stats.first10.p50} ms`, p95: `${stats.first10.p95} ms` },
        'Last 10 notes': { p50: `${stats.last10.p50} ms`, p95: `${stats.last10.p95} ms` },
        'Total Run': { p50: `${stats.total.p50} ms`, p95: `${stats.total.p95} ms` },
      });
      return stats;
    };
  }, [executeCommand, selectEvent, resetScore, scoreRef, editorStateRef]);
}
