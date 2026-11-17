/**
 * IndexedDB storage management for ScoreForge autosave and recovery.
 *
 * Implements rolling 5-version autosave history and graceful degradation.
 */

import { Score } from '../core/model';

export const AUTOSAVE_KEY = 'autosave:current';
export const AUTOSAVE_HISTORY_KEY = 'autosave:history';
export const DB_NAME = 'scoreforge_db';
export const DB_VERSION = 2;
export const STORE_NAME = 'scores';

export interface AutosaveRecord {
  key: string;
  savedAt: string; // ISO 8601 string
  score: Score;
  measureCount?: number;
}

export interface ErrorLogEntry {
  timestamp: number;
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  source?: string;
}

declare global {
  interface Window {
    __errorLog?: ErrorLogEntry[];
  }
}

/** Pushes an entry to the global 50-item error ring buffer. */
export function logToErrorRingBuffer(
  level: 'error' | 'warn',
  message: string,
  stack?: string,
  source?: string
): void {
  const g = typeof window !== 'undefined' ? window : (globalThis as any);
  if (!g.__errorLog) {
    g.__errorLog = [];
  }
  g.__errorLog.push({
    timestamp: Date.now(),
    level,
    message,
    stack,
    source,
  });
  if (g.__errorLog.length > 50) {
    g.__errorLog.shift();
  }
}

// Attach unhandled error listeners once
if (typeof window !== 'undefined' && !(window as any).__errorLogInitialized) {
  (window as any).__errorLogInitialized = true;
  if (!window.__errorLog) window.__errorLog = [];

  window.addEventListener('error', (e) => {
    logToErrorRingBuffer(
      'error',
      e.message || String(e.error),
      e.error?.stack,
      e.filename
    );
  });

  window.addEventListener('unhandledrejection', (e) => {
    logToErrorRingBuffer(
      'error',
      e.reason?.message || String(e.reason),
      e.reason?.stack,
      'unhandledrejection'
    );
  });
}

/** Opens or initializes the ScoreForge IndexedDB database. */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Saves the current score to IndexedDB and updates the rolling 5-version history.
 */
export async function saveAutosave(score: Score): Promise<void> {
  try {
    const db = await openDatabase();
    const measureCount = score.measures?.length ?? 0;
    const currentRecord: AutosaveRecord = {
      key: AUTOSAVE_KEY,
      savedAt: new Date().toISOString(),
      score,
      measureCount,
    };

    // Load existing history to maintain rolling 5 versions
    const existingHistory = await loadAutosaveHistory();
    const updatedHistory = [currentRecord, ...existingHistory].slice(0, 5);

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const req = store.put(currentRecord);
        store.put({
          key: AUTOSAVE_HISTORY_KEY,
          savedAt: currentRecord.savedAt,
          history: updatedHistory,
        });

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    return;
  }
}

/**
 * Loads the latest autosaved score from IndexedDB, if present.
 */
export async function loadAutosave(): Promise<AutosaveRecord | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(AUTOSAVE_KEY);
        req.onsuccess = () => {
          const res = req.result as AutosaveRecord | undefined;
          resolve(res && res.score ? res : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/**
 * Loads rolling autosave history (up to 5 versions, newest first).
 */
export async function loadAutosaveHistory(): Promise<AutosaveRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(AUTOSAVE_HISTORY_KEY);
        req.onsuccess = () => {
          const res = req.result as { history?: AutosaveRecord[] } | undefined;
          resolve(Array.isArray(res?.history) ? res!.history : []);
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } catch {
    return [];
  }
}

/**
 * Clears the autosaved score and history from IndexedDB.
 */
export async function clearAutosave(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(AUTOSAVE_KEY);
        store.delete(AUTOSAVE_HISTORY_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    return;
  }
}
