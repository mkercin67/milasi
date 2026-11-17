import { useCallback, useEffect, useRef, useState } from 'react';
import { Score } from '../../core/model';
import { deserializeScore, serializeScore } from '../../io/json';
import { loadAutosave, saveAutosave } from '../../io/storage';
import { useI18n } from '../i18n';

export interface UseAppStorageParams {
  score: Score;
  isDirty: boolean;
  markClean: () => void;
  resetScore: (newScore: Score) => void;
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

  // 2s debounced autosave to IndexedDB
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const t0 = performance.now();
        await saveAutosave(score);
        const dt = performance.now() - t0;
        (window as any).__scoreforge_last_autosave_ms = dt;
      } catch (err) {
        console.warn('Autosave error:', err);
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [score]);

  // Startup autosave check
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__checkAutosaveForTest = async () => {
      const record = await loadAutosave();
      if (record && record.score) {
        setRestoreData({ score: record.score, savedAt: typeof record.savedAt === 'string' ? new Date(record.savedAt).getTime() : record.savedAt });
        setIsRestorePromptOpen(true);
      }
    };

    const params = new URLSearchParams(window.location.search);
    if (params.has('state')) return;

    loadAutosave()
      .then((record) => {
        if (record && record.score) {
          setRestoreData({ score: record.score, savedAt: typeof record.savedAt === 'string' ? new Date(record.savedAt).getTime() : record.savedAt });
          setIsRestorePromptOpen(true);
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

  const handleSave = useCallback(
    async (saveAs = false) => {
      try {
        const envelopeJson = serializeScore(score, 2, true);
        const cleanTitle = (score.meta.title || 'adsiz').trim().toLowerCase().replace(/[^a-z0-9]/gi, '_');
        const filename = `${cleanTitle}.sfscore`;

        const hasNativePicker =
          !saveAs &&
          typeof window !== 'undefined' &&
          'showSaveFilePicker' in window &&
          !window.navigator.webdriver &&
          !(window as any).__disableNativePickerForTest;

        if (hasNativePicker) {
          try {
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: filename,
              types: [
                {
                  description: 'ScoreForge Score (*.sfscore)',
                  accept: { 'application/json': ['.sfscore'] },
                },
              ],
            });
            const writable = await handle.createWritable();
            await writable.write(envelopeJson);
            await writable.close();
            markClean();
            setStatusToast({ message: t('status.saveSuccess'), type: 'success' });
            return;
          } catch (pickerErr: any) {
            if (pickerErr.name === 'AbortError') return;
          }
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
      } catch (err: any) {
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
      } catch (err: any) {
        console.error('File load failed:', err);
        setStatusToast({ message: `${t('status.saveError')}: ${err.message || 'Geçersiz dosya'}`, type: 'error' });
      } finally {
        e.target.value = '';
      }
    },
    [resetScore, markClean, t]
  );

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
    handleSave,
    handleOpenClick,
    handleFileChange,
  };
}
