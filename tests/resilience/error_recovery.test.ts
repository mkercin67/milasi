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
import { createEmptyScore } from '../../src/core/factory';
import {
  clearAutosave,
  loadAutosave,
  loadAutosaveHistory,
  logToErrorRingBuffer,
  saveAutosave,
} from '../../src/io/storage';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { layoutScore } from '../../src/layout/layoutScore';
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

describe('H1 Resilience: Error Injection in Layout and Score Pipelines', () => {
  it('layoutScore degrades gracefully and does not throw on empty/corrupt measures', () => {
    const corruptScore: Score = {
      schemaVersion: 6,
      id: 'corrupt',
      meta: { title: 'Corrupt Score', composer: 'Test' },
      measures: [],
      parts: [
        {
          id: 'p1',
          name: 'Piano',
          instrument: 'Piano',
          staves: [
            {
              id: 's1',
              clef: { sign: 'G', line: 2 },
              measures: {},
            },
          ],
        },
      ],
      overrides: {},
    };

    expect(() => {
      const res = layoutScore(corruptScore, { width: 70 });
      expect(res.systems.length).toBe(0);
    }).not.toThrow();
  });

  it('layoutScore does not crash on NaN or negative widths', () => {
    const score = createEmptyScore({ measures: 4 });
    expect(() => layoutScore(score, { width: NaN })).not.toThrow();
    expect(() => layoutScore(score, { width: -50 })).not.toThrow();
  });
});
