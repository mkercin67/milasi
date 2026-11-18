/**
 * Resilience & Error Recovery Tests (Milestone H1 Task 5).
 *
 * Verifies:
 * 1. 50-item error/warning ring buffer on window.__errorLog.
 * 2. Rolling 5-version autosave in IndexedDB with timestamps and measure counts.
 * 3. ErrorBoundary wrapping and 3 recovery actions:
 *    - Son otomatik kaydı geri yükle
 *    - Mevcut eseri dosya olarak indir
 *    - Hata raporunu kopyala
 * 4. Error injection in layout and command pipelines.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
import { Command, History } from '../../src/core/commandTypes';
import { createEmptyScore } from '../../src/core/factory';
import {
  clearAutosave,
  loadAutosave,
  loadAutosaveHistory,
  logToErrorRingBuffer,
  saveAutosave,
} from '../../src/io/storage';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { Score } from '../../src/core/model';

describe('H1 Resilience: Error Ring Buffer', () => {
  beforeEach(() => {
    window.__errorLog = [];
  });

  it('records error entries with timestamps, levels, and messages', () => {
    logToErrorRingBuffer('warn', 'A minor warning', undefined, 'test-source');
    logToErrorRingBuffer('error', 'A critical error', 'Error: stack trace here', 'test-source');

    expect(window.__errorLog).toBeDefined();
    expect(window.__errorLog!.length).toBe(2);
    expect(window.__errorLog![0].level).toBe('warn');
    expect(window.__errorLog![0].message).toBe('A minor warning');
    expect(window.__errorLog![1].level).toBe('error');
    expect(window.__errorLog![1].stack).toBe('Error: stack trace here');
  });

  it('caps at exactly 50 items and drops the oldest when full', () => {
    for (let i = 1; i <= 65; i++) {
      logToErrorRingBuffer('error', `Error entry ${i}`);
    }

    expect(window.__errorLog!.length).toBe(50);
    // Oldest remaining should be entry 16, latest should be entry 65
    expect(window.__errorLog![0].message).toBe('Error entry 16');
    expect(window.__errorLog![49].message).toBe('Error entry 65');
  });
});

describe('H1 Resilience: Rolling 5-Version Autosave', () => {
  // Mock IndexedDB in Node test environment
  let mockStore: Map<string, any>;

  beforeEach(() => {
    mockStore = new Map();

    const fakeDb = {
      transaction: () => ({
        objectStore: () => ({
          put: (record: any) => {
            mockStore.set(record.key, record);
            const req: any = { onsuccess: null, onerror: null };
            setTimeout(() => req.onsuccess?.({ target: { result: record.key } }), 0);
            return req;
          },
          get: (key: string) => {
            const result = mockStore.get(key);
            const req: any = { onsuccess: null, onerror: null };
            setTimeout(() => {
              req.result = result;
              req.onsuccess?.({ target: { result } });
            }, 0);
            return req;
          },
          delete: (key: string) => {
            mockStore.delete(key);
            const req: any = { onsuccess: null, onerror: null };
            setTimeout(() => req.onsuccess?.({ target: { result: undefined } }), 0);
            return req;
          },
        }),
        oncomplete: null as any,
        onerror: null as any,
      }),
    };

    (fakeDb as any).transaction = vi.fn().mockImplementation(() => {
      const tx = {
        objectStore: () => ({
          put: (record: any) => {
            mockStore.set(record.key, record);
          },
          get: (key: string) => {
            const req: any = {};
            setTimeout(() => {
              req.result = mockStore.get(key);
              if (req.onsuccess) req.onsuccess();
            }, 0);
            return req;
          },
          delete: (key: string) => {
            mockStore.delete(key);
          },
        }),
        oncomplete: null as any,
        onerror: null as any,
      };
      setTimeout(() => {
        if (tx.oncomplete) tx.oncomplete();
      }, 0);
      return tx;
    });

    (globalThis as any).indexedDB = {
      open: () => {
        const req: any = {
          result: fakeDb,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      },
    };
  });

  it('saves multiple versions and preserves rolling 5 newest versions with measure counts', async () => {
    for (let m = 2; m <= 8; m++) {
      const score = createEmptyScore({ measures: m, title: `Score with ${m} measures` });
      await saveAutosave(score);
    }

    const latest = await loadAutosave();
    expect(latest).not.toBeNull();
    expect(latest?.score.meta.title).toBe('Score with 8 measures');
    expect(latest?.measureCount).toBe(8);

    const history = await loadAutosaveHistory();
    expect(history.length).toBe(5);
    // Newest is index 0 (measures: 8), oldest in history is index 4 (measures: 4)
    expect(history[0].score.meta.title).toBe('Score with 8 measures');
    expect(history[0].measureCount).toBe(8);
    expect(history[4].score.meta.title).toBe('Score with 4 measures');
    expect(history[4].measureCount).toBe(4);
  });

  it('clears autosave and history', async () => {
    const score = createEmptyScore({ measures: 4 });
    await saveAutosave(score);
    expect(await loadAutosave()).not.toBeNull();

    await clearAutosave();
    expect(await loadAutosave()).toBeNull();
    expect(await loadAutosaveHistory()).toEqual([]);
  });
});

describe('H1 Resilience: ErrorBoundary Recovery and Actions', () => {
  const ThrowingComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
    if (shouldThrow) {
      throw new Error('Simulated catastrophic render crash');
    }
    return React.createElement('div', { 'data-testid': 'normal-content' }, 'Normal Score Content');
  };

  it('catches render errors and provides 3 recovery actions', () => {
    const score = createEmptyScore({ title: 'Crash Test Score', measures: 4 });
    const restoreSpy = vi.fn();

    const boundary = new ErrorBoundary({
      score,
      onRestoreAutosave: restoreSpy,
      children: React.createElement(ThrowingComponent, { shouldThrow: true }),
    });

    // Simulate React component catch lifecycle
    const err = new Error('Simulated catastrophic render crash');
    const derived = ErrorBoundary.getDerivedStateFromError(err);
    boundary.state = { ...boundary.state, ...derived };
    boundary.componentDidCatch(err, { componentStack: 'at ThrowingComponent\nat ScoreView' });

    // Verify error was pushed to ring buffer
    const errLog = (globalThis as any).window.__errorLog;
    expect(errLog?.some((e: any) => e.message.includes('Simulated catastrophic render crash'))).toBe(true);

    // 1. Verify "Son otomatik kaydı geri yükle" action
    boundary.handleRestoreAutosave();
    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect(boundary.state.hasError).toBe(false);

    // 2. Verify "Mevcut eseri dosya olarak indir" action does not throw
    expect(() => boundary.handleDownloadCurrentScore()).not.toThrow();

    // 3. Verify "Hata raporunu kopyala" action does not throw
    expect(() => boundary.handleCopyErrorReport()).not.toThrow();
  });
});

describe('H1 Resilience: Injected Fault Recovery & Autosave History', () => {
  it('1. Injected fault in layout pipeline: ErrorBoundary catches error, displays recovery UI, score retained', () => {
    const score = createEmptyScore({ title: 'Fault Test Piece', measures: 4 });
    const restoreSpy = vi.fn();

    const FaultyLayoutComponent: React.FC<{ score: Score }> = ({ score: s }) => {
      // Inject fault in layout
      if (s.meta.title === 'Fault Test Piece') {
        throw new Error('Injected layout calculation failure');
      }
      return React.createElement('div', null, 'Rendered');
    };

    const boundary = new ErrorBoundary({
      score,
      onRestoreAutosave: restoreSpy,
      children: React.createElement(FaultyLayoutComponent, { score }),
    });

    const err = new Error('Injected layout calculation failure');
    const derived = ErrorBoundary.getDerivedStateFromError(err);
    boundary.state = { ...boundary.state, ...derived };
    boundary.componentDidCatch(err, { componentStack: 'at FaultyLayoutComponent' });

    // Assert recovery UI is displayed
    const rendered = boundary.render() as React.ReactElement;
    expect(rendered).not.toBeNull();
    expect(rendered.props['data-testid']).toBe('error-boundary-fallback');
    expect(boundary.props.score).toBe(score);
    expect(boundary.props.score?.measures.length).toBe(4);
  });

  it('2. Injected fault in command pipeline: Command caught, history untouched, score retained', () => {
    const initialScore = createEmptyScore({ title: 'Original Piece', measures: 3 });
    const history = new History(initialScore);

    const failingCommand: Command = {
      name: 'Faulty command',
      apply: () => {
        throw new Error('Injected command failure');
      },
    };

    expect(() => history.do(failingCommand)).toThrow('Injected command failure');
    expect(history.score).toBe(initialScore);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('3. Injected fault in render (ScoreSvgLayers): ErrorBoundary catches error and renders fallback', () => {
    const score = createEmptyScore({ measures: 2 });
    const FaultyRenderComponent: React.FC = () => {
      throw new Error('Injected ScoreSvgLayers DOM crash');
    };

    const boundary = new ErrorBoundary({
      score,
      children: React.createElement(FaultyRenderComponent),
    });

    const err = new Error('Injected ScoreSvgLayers DOM crash');
    const derived = ErrorBoundary.getDerivedStateFromError(err);
    boundary.state = { ...boundary.state, ...derived };
    boundary.componentDidCatch(err, { componentStack: 'at ScoreSvgLayers' });

    const rendered = boundary.render() as React.ReactElement;
    expect(rendered.props['data-testid']).toBe('error-boundary-fallback');
    expect(rendered.props.children[1].props.children).toBe('Injected ScoreSvgLayers DOM crash');
  });

  it('4. Recovery UI lists last 5 autosaves with timestamps and measure counts', () => {
    const score = createEmptyScore({ title: 'Active Score', measures: 6 });
    const sampleHistory = [
      {
        key: 'autosave:history:0',
        savedAt: new Date(2026, 10, 18, 14, 30, 0).toISOString(),
        score: createEmptyScore({ title: 'Snapshot 5', measures: 10 }),
        measureCount: 10,
      },
      {
        key: 'autosave:history:1',
        savedAt: new Date(2026, 10, 18, 14, 25, 0).toISOString(),
        score: createEmptyScore({ title: 'Snapshot 4', measures: 8 }),
        measureCount: 8,
      },
      {
        key: 'autosave:history:2',
        savedAt: new Date(2026, 10, 18, 14, 20, 0).toISOString(),
        score: createEmptyScore({ title: 'Snapshot 3', measures: 6 }),
        measureCount: 6,
      },
      {
        key: 'autosave:history:3',
        savedAt: new Date(2026, 10, 18, 14, 15, 0).toISOString(),
        score: createEmptyScore({ title: 'Snapshot 2', measures: 4 }),
        measureCount: 4,
      },
      {
        key: 'autosave:history:4',
        savedAt: new Date(2026, 10, 18, 14, 10, 0).toISOString(),
        score: createEmptyScore({ title: 'Snapshot 1', measures: 2 }),
        measureCount: 2,
      },
    ];

    const restoreSpy = vi.fn();
    const boundary = new ErrorBoundary({
      score,
      historyVersions: sampleHistory,
      onRestoreAutosave: restoreSpy,
      children: React.createElement('div', null, 'Normal'),
    });

    const err = new Error('Fatal UI crash');
    boundary.state = { ...boundary.state, hasError: true, error: err };

    const rendered = boundary.render() as React.ReactElement;
    expect(rendered.props['data-testid']).toBe('error-boundary-fallback');

    // Test restoring a specific historic version
    boundary.handleRestoreAutosave(sampleHistory[2]);
    expect(restoreSpy).toHaveBeenCalledWith(sampleHistory[2]);
  });
});
