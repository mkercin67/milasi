// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useEffect, useRef, useState } from 'react';
import { Score } from '../../core/model';
import { deserializeScore, serializeScore } from '../../io/json';
import { validateScore } from '../../core/validate';
import { AutosaveRecord, loadAutosave, loadAutosaveHistory, saveAutosave } from '../../io/storage';
import { useI18n } from '../i18n';

export interface UseAppStorageParams {
  score: Score;
  isDirty: boolean;
  markClean: () => void;
  resetScore: (newScore: Score) => void;
}

export interface SaveFileHandle {
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

interface StorageTestWindow extends Window {
  __scoreforge_last_autosave_ms?: number;
  __checkAutosaveForTest?: () => Promise<void>;
  __disableNativePickerForTest?: boolean;
  showSaveFilePicker?: (options?: unknown) => Promise<{
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

export type SaveFilePicker = (options?: unknown) => Promise<SaveFileHandle>;

export interface NativeSaveResult {
  status: 'saved' | 'aborted' | 'unavailable';
  handle: SaveFileHandle | null;
}

async function writeHandle(handle: SaveFileHandle, data: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

/** A remembered save target together with the score it belongs to. */
export interface RememberedSaveFile {
  scoreId: string;
  handle: SaveFileHandle;
}

/**
 * The remembered file may only be rewritten by the score it was chosen for. After "New", "Open" or
 * a restore the score has another id, so Save opens the picker instead of overwriting the old file.
 */
export function handleForScore(
  remembered: RememberedSaveFile | null,
  scoreId: string
): SaveFileHandle | null {
  return remembered && remembered.scoreId === scoreId ? remembered.handle : null;
}

/**
 * "Save As" (saveAs = true) always opens the native file picker.
 * Plain "Save" silently rewrites the previously chosen file, and opens the picker only the first time.
 * Without a picker the caller falls back to a download ('unavailable').
 */
export async function saveViaNativePicker(
  picker: SaveFilePicker | undefined,
  data: string,
  filename: string,
  saveAs: boolean,
  existing: SaveFileHandle | null
): Promise<NativeSaveResult> {
  if (!picker) return { status: 'unavailable', handle: existing };
  if (!saveAs && existing) {
    try {
      await writeHandle(existing, data);
      return { status: 'saved', handle: existing };
    } catch {
      existing = null; // handle no longer usable: fall through to the picker
    }
  }
  try {
    const handle = await picker({
      suggestedName: filename,
      types: [{ description: 'MiLaSi Score (*.sfscore)', accept: { 'application/json': ['.sfscore'] } }],
    });
    await writeHandle(handle, data);
    return { status: 'saved', handle };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return { status: 'aborted', handle: existing };
    return { status: 'unavailable', handle: existing };
  }
}

export function prepareScoreSave(score: Score): { problems: ReturnType<typeof validateScore>; envelopeJson: string } {
  const problems = validateScore(score);
  const envelopeJson = serializeScore(score, 2, true);
  return { problems, envelopeJson };
}

export function useAppStorage({
  score,
  isDirty,
  markClean,
  resetScore,
}: UseAppStorageParams) {
  const { t } = useI18n();

  const [isUnsavedPromptOpen, setIsUnsavedPromptOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isRestorePromptOpen, setIsRestorePromptOpen] = useState<boolean>(false);
  const [restoreData, setRestoreData] = useState<{ score: Score; savedAt: number } | null>(null);
  const [historyVersions, setHistoryVersions] = useState<AutosaveRecord[]>([]);
  const [statusToast, setStatusToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Warn on page close if score has unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // 1000 ms debounced autosave to IndexedDB
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const t0 = performance.now();
        await saveAutosave(score);
        const dt = performance.now() - t0;
        const testWin = window as unknown as StorageTestWindow;
        testWin.__scoreforge_last_autosave_ms = dt;
        loadAutosaveHistory().then(setHistoryVersions);
      } catch (err) {
        console.warn('Autosave error:', err);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [score]);

  // Startup autosave check
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const testWin = window as unknown as StorageTestWindow;
    testWin.__checkAutosaveForTest = async () => {
      const record = await loadAutosave();
      if (record && record.score) {
        setRestoreData({ score: record.score, savedAt: typeof record.savedAt === 'string' ? new Date(record.savedAt).getTime() : record.savedAt });
        setIsRestorePromptOpen(true);
        loadAutosaveHistory().then(setHistoryVersions);
      }
    };

    const params = new URLSearchParams(window.location.search);
    if (params.has('state')) return;

    loadAutosave()
      .then((record) => {
        if (record && record.score) {
          setRestoreData({ score: record.score, savedAt: typeof record.savedAt === 'string' ? new Date(record.savedAt).getTime() : record.savedAt });
          setIsRestorePromptOpen(true);
          loadAutosaveHistory().then(setHistoryVersions);
        }
      })
      .catch((e) => console.warn('Could not check autosave:', e));
  }, []);

  // Auto-dismiss status toast after 3s
  useEffect(() => {
    if (!statusToast) return;
    const timer = window.setTimeout(() => setStatusToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [statusToast]);

  // Handle of the file chosen by "Save As" (or the first native save); plain "Save" rewrites it silently.
  const fileHandleRef = useRef<RememberedSaveFile | null>(null);

  const handleSave = useCallback(
    async (saveAs = false) => {
      try {
        const { envelopeJson } = prepareScoreSave(score);
        const cleanTitle = (score.meta.title || 'adsiz').trim().toLowerCase().replace(/[^a-z0-9]/gi, '_');
        const filename = `${cleanTitle}.sfscore`;

        const testWin = typeof window !== 'undefined' ? (window as unknown as StorageTestWindow) : undefined;
        const nativeAllowed = !!testWin && !window.navigator.webdriver && !testWin.__disableNativePickerForTest;
        const result = await saveViaNativePicker(
          nativeAllowed ? testWin?.showSaveFilePicker?.bind(window) : undefined,
          envelopeJson,
          filename,
          saveAs,
          handleForScore(fileHandleRef.current, score.id)
        );
        fileHandleRef.current = result.handle ? { scoreId: score.id, handle: result.handle } : null;
        if (result.status === 'aborted') return;
        if (result.status === 'saved') {
          markClean();
          setStatusToast({ message: t('status.saveSuccess'), type: 'success' });
          return;
        }

        const blob = new Blob([envelopeJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        markClean();
        setStatusToast({ message: t('status.saveSuccess'), type: 'success' });
      } catch (err: unknown) {
        console.error('Save failed:', err);
        setStatusToast({ message: t('status.saveError'), type: 'error' });
      }
    },
    [score, markClean, t]
  );

  const handleOpenClick = useCallback(() => {
    if (isDirty) {
      setPendingAction(() => () => fileInputRef.current?.click());
      setIsUnsavedPromptOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  }, [isDirty]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const loaded = deserializeScore(text);
        resetScore(loaded);
        markClean();
        setStatusToast({ message: t('status.saveSuccess'), type: 'success' });
      } catch (err: unknown) {
        console.error('File load failed:', err);
        const message = err instanceof Error ? err.message : 'Geçersiz dosya';
        setStatusToast({ message: `${t('status.saveError')}: ${message}`, type: 'error' });
      } finally {
        e.target.value = '';
      }
    },
    [resetScore, markClean, t]
  );

  const handleSelectHistoryVersion = useCallback((record: AutosaveRecord) => {
    setRestoreData({
      score: record.score,
      savedAt: typeof record.savedAt === 'string' ? new Date(record.savedAt).getTime() : record.savedAt,
    });
  }, []);

  return {
    fileInputRef,
    statusToast,
    setStatusToast,
    isUnsavedPromptOpen,
    setIsUnsavedPromptOpen,
    pendingAction,
    setPendingAction,
    isRestorePromptOpen,
    setIsRestorePromptOpen,
    restoreData,
    setRestoreData,
    historyVersions,
    handleSelectHistoryVersion,
    handleSave,
    handleOpenClick,
    handleFileChange,
  };
}
