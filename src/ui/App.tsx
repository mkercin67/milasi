/**
 * Main application shell for ScoreForge editor.
 *
 * Coordinates toolbar, score canvas, status bar, modal dialogs,
 * keyboard interaction, and automated verification states.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  convertToRest,
  setOverride,
  transposeEvent,
  setScoreMetadata,
  setTempo,
  setKeySignature,
  setTimeSignature,
  setPickup,
  setEndBarline,
  setRepeatStart,
  setRepeatEnd,
  autoSolfege,
  setLyrics,
  pasteLyrics,
} from '../core/commands';
import { createEmptyScore, createRest } from '../core/factory';
import { BarlineType, Pitch, Score } from '../core/model';
import { ScoreCursor } from '../core/input';
import { serializeScore, deserializeScore } from '../io/json';
import { saveAutosave, loadAutosave, clearAutosave } from '../io/storage';
import { LayoutResult } from '../layout/types';
import { AudioEngine, FakeEngine, Player, PreviewPlayer, ToneEngine } from '../playback';
import { Diagnostics, PerfSample } from './Diagnostics';
import { I18nProvider, useI18n } from './i18n';
import { EditorMode, mapKeyEvent } from './keymap';
import { NewScoreConfig, NewScoreModal } from './NewScoreModal';
import { buildBeamDemoScore } from './beamDemoScore';
import { buildSampleScore, createBenchmark64Score, createBenchmarkFullFeaturedScore } from './Demo';
import { buildSutIctimScore } from './sutIctimScore';
import { ScoreView } from './ScoreView';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';
import { useEditor } from './useEditor';

declare global {
  interface Window {
    __perf?: number[];
    __perfT0?: number;
    __applyRawOverrideForTest?: (eventId: string, dx: number, dy: number) => void;
    __getScoreForTest?: () => Score;
    __getEditorStateForTest?: () => {
      mode: EditorMode;
      selectedEventId: string | null;
      cursor: unknown;
    };
    __printPerfTable?: () => {
      first10: { p50: number; p95: number };
      last10: { p50: number; p95: number };
      total: { count: number; p50: number; p95: number };
    };
  }
}

function calcPercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * (p / 100)));
  return Number(sorted[idx].toFixed(2));
}

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

const EditorShell: React.FC = () => {
  const { t } = useI18n();
  const {
    score,
    canUndo,
    canRedo,
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
    setCursorToMeasure,
    currentMeasureNumber,
    rejectedError,
    triggerRejectedError,
    enterPitchAtCursor,
    enterRestAtCursor,
    moveCursorDirection,
    enterPitchDirect,
    applyEventOverride,
    clearEventOverride,
    clearAllEventOverrides,
    hasSelectedOverride,
    hasAnyOverride,
    selectedOverride,
    changeEventPitch,
    isDirty,
    markClean,
    selection,
    selectedRange,
    rangeEvents: _rangeEvents,
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
    applyDynamic,
    applyArticulation,
    applySlur,
    clearNotations,
  } = useEditor();

  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [isScoreInfoOpen, setIsScoreInfoOpen] = useState<boolean>(false);
  const [scoreTitleInput, setScoreTitleInput] = useState<string>(score.meta.title || '');
  const [scoreSubtitleInput, setScoreSubtitleInput] = useState<string>(score.meta.subtitle || '');
  const [scoreComposerInput, setScoreComposerInput] = useState<string>(score.meta.composer || '');
  const [scoreArrangerInput, setScoreArrangerInput] = useState<string>(score.meta.arranger || '');

  // M6c Modals State
  const [isKeySigModalOpen, setIsKeySigModalOpen] = useState<boolean>(false);
  const [keySigInput, setKeySigInput] = useState<number>(0);
  const [keySigScope, setKeySigScope] = useState<'from-here' | 'score'>('from-here');

  const [isTimeSigModalOpen, setIsTimeSigModalOpen] = useState<boolean>(false);
  const [timeSigStrInput, setTimeSigStrInput] = useState<string>('4/4');
  const [timeSigScope, setTimeSigScope] = useState<'from-here' | 'score'>('from-here');

  const [isTempoModalOpen, setIsTempoModalOpen] = useState<boolean>(false);
  const [tempoBpmInput, setTempoBpmInput] = useState<number>(120);
  const [tempoBeatUnitInput, setTempoBeatUnitInput] = useState<number>(1.0);
  const [tempoTextInput, setTempoTextInput] = useState<string>('');

  const [isBarlineModalOpen, setIsBarlineModalOpen] = useState<boolean>(false);
  const [barlineInput, setBarlineInput] = useState<BarlineType>('single');
  const [isRepeatStartInput, setIsRepeatStartInput] = useState<boolean>(false);
  const [isRepeatEndInput, setIsRepeatEndInput] = useState<boolean>(false);
  const [isPickupBarline, setIsPickupBarline] = useState<boolean>(false);
  const [pickupTicksInput, setPickupTicksInput] = useState<number>(960);
  const [isUnsavedPromptOpen, setIsUnsavedPromptOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isRestorePromptOpen, setIsRestorePromptOpen] = useState<boolean>(false);
  const [restoreData, setRestoreData] = useState<{ score: Score; savedAt: string } | null>(null);
  const [statusToast, setStatusToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isResetAllConfirmOpen, setIsResetAllConfirmOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const perfSamplesRef = useRef<PerfSample[]>([]);
  const [perfSamples, setPerfSamples] = useState<PerfSample[]>([]);
  const [hoverPitch, setHoverPitch] = useState<Pitch | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ pitch: Pitch; measureNumber: number } | null>(null);
  const [dragStatus, setDragStatus] = useState<string | null>(null);
  const [isDeleteMeasurePromptOpen, setIsDeleteMeasurePromptOpen] = useState<boolean>(false);
  const [pendingDeleteMeasureIdx, setPendingDeleteMeasureIdx] = useState<number | null>(null);

  const handleDeleteMeasureWithPrompt = useCallback(() => {
    const res = deleteCurrentMeasure();
    if (!res) return;
    if (res.hasNotes) {
      setPendingDeleteMeasureIdx(res.targetIndex);
      setIsDeleteMeasurePromptOpen(true);
    } else {
      confirmDeleteMeasure(res.targetIndex);
    }
  }, [deleteCurrentMeasure, confirmDeleteMeasure]);

  // Audio Engine & Scheduler (Milestone 4)
  const [audioEngine] = useState<AudioEngine>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('audio') === 'fake') {
        const fake = new FakeEngine();
        (window as any).__audioLog = fake.logs;
        (window as any).__audioEngine = fake;
        return fake;
      }
    }
    return new ToneEngine();
  });

  const [player] = useState<Player>(() => new Player(score, audioEngine));
  const [previewPlayer] = useState<PreviewPlayer>(() => new PreviewPlayer(audioEngine));

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [activePlaybackEventIds, setActivePlaybackEventIds] = useState<string[]>([]);
  const [playbackSeconds, setPlaybackSeconds] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [previewSound, setPreviewSound] = useState<boolean>(() => previewPlayer.enabled);

  // Sync score updates to player (and stop playback on score modifications)
  useEffect(() => {
    player.setScore(score);
    setIsPlaying(player.state === 'playing');
    setIsPaused(player.state === 'paused');
  }, [score, player]);

  // Listen to Player lookahead position updates
  useEffect(() => {
    const unsub = player.onPosition((pos) => {
      setIsPlaying(player.state === 'playing');
      setIsPaused(player.state === 'paused');
      setActivePlaybackEventIds(pos.activeEventIds);
      setPlaybackSeconds(pos.seconds);
    });
    return () => {
      unsub();
      player.dispose();
    };
  }, [player]);

  const handleTogglePlay = useCallback(() => {
    if (player.state === 'playing') {
      player.pause();
      setIsPlaying(false);
      setIsPaused(true);
    } else if (player.state === 'paused') {
      player.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } else {
      player.play(selectedEventId ?? undefined).then(() => {
        setIsPlaying(player.state === 'playing');
        setIsPaused(player.state === 'paused');
      });
    }
  }, [player, selectedEventId]);

  const handleStop = useCallback(() => {
    player.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setActivePlaybackEventIds([]);
    setPlaybackSeconds(0);
  }, [player]);

  const handleChangeTempo = useCallback(
    (bpm: number) => {
      if (player.state !== 'idle') {
        player.stop();
      }
      executeCommand(setTempo(0, { bpm }));
    },
    [executeCommand, player]
  );

  const handleVolumeChange = useCallback(
    (v: number) => {
      setVolume(v);
      if (!isMuted) audioEngine.setVolume(v);
    },
    [audioEngine, isMuted]
  );

  const handleToggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    audioEngine.setVolume(next ? 0 : volume);
  }, [audioEngine, isMuted, volume]);

  const handleTogglePreviewSound = useCallback(() => {
    const next = !previewSound;
    setPreviewSound(next);
    previewPlayer.enabled = next;
  }, [previewPlayer, previewSound]);

  const latestLayoutRef = useRef<LayoutResult | null>(null);
  const scoreRef = useRef<Score>(score);
  scoreRef.current = score;
  const editorStateRef = useRef<{
    mode: EditorMode;
    selectedEventId: string | null;
    cursor: unknown;
  }>({ mode, selectedEventId, cursor });
  editorStateRef.current = { mode, selectedEventId, cursor };

  useEffect(() => {
    setDragStatus(null);
  }, [selectedEventId, mode]);

  // Tab / Window Title with * when dirty
  useEffect(() => {
    const prefix = isDirty ? '* ' : '';
    const title = score.meta.title || 'ScoreForge';
    document.title = `${prefix}${title} — ScoreForge`;
  }, [isDirty, score.meta.title]);

  // Warn before leaving if dirty
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
        setRestoreData(record);
        setIsRestorePromptOpen(true);
      }
    };

    const params = new URLSearchParams(window.location.search);
    if (params.has('state')) return; // skip recovery modal in verification states

    loadAutosave().then((record) => {
      if (record && record.score) {
        setRestoreData(record);
        setIsRestorePromptOpen(true);
      }
    }).catch((e) => console.warn('Could not check autosave:', e));
  }, []);

  // Auto-dismiss status toast after 3s
  useEffect(() => {
    if (!statusToast) return;
    const timer = window.setTimeout(() => setStatusToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [statusToast]);

  const handleSave = useCallback(async (saveAs = false) => {
    console.log('[DEBUG] handleSave called with saveAs =', saveAs);
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
          // Fallback to download
        }
      }

      // Blob download fallback
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
  }, [score, markClean, t]);

  const handleOpenClick = useCallback(() => {
    if (isDirty) {
      setPendingAction(() => () => fileInputRef.current?.click());
      setIsUnsavedPromptOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  }, [isDirty]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [resetScore, markClean, t]);

  const handleSaveScoreInfo = useCallback(() => {
    executeCommand(
      setScoreMetadata({
        title: scoreTitleInput,
        subtitle: scoreSubtitleInput,
        composer: scoreComposerInput,
        arranger: scoreArrangerInput,
      })
    );
    setIsScoreInfoOpen(false);
  }, [executeCommand, scoreTitleInput, scoreSubtitleInput, scoreComposerInput, scoreArrangerInput]);

  const handleOpenScoreInfo = useCallback(() => {
    setScoreTitleInput(score.meta.title || '');
    setScoreSubtitleInput(score.meta.subtitle || '');
    setScoreComposerInput(score.meta.composer || '');
    setScoreArrangerInput(score.meta.arranger || '');
    setIsScoreInfoOpen(true);
  }, [score.meta.title, score.meta.subtitle, score.meta.composer, score.meta.arranger]);

  const handleOpenKeySigModal = useCallback(() => {
    const targetMeasure =
      score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0];
    setKeySigInput(targetMeasure?.keySig ?? 0);
    setIsKeySigModalOpen(true);
  }, [score.measures, selectedEventInfo?.measureId]);

  const handleApplyKeySig = useCallback(() => {
    const targetMeasure =
      score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0];
    if (targetMeasure) {
      executeCommand(setKeySignature(targetMeasure.id, keySigInput, keySigScope));
    }
    setIsKeySigModalOpen(false);
  }, [executeCommand, keySigInput, keySigScope, score.measures, selectedEventInfo?.measureId]);

  const handleOpenTimeSigModal = useCallback(() => {
    const targetMeasure =
      score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0];
    if (targetMeasure) {
      setTimeSigStrInput(`${targetMeasure.timeSig.num}/${targetMeasure.timeSig.den}`);
    }
    setIsTimeSigModalOpen(true);
  }, [score.measures, selectedEventInfo?.measureId]);

  const handleApplyTimeSig = useCallback(() => {
    const targetMeasure =
      score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0];
    if (targetMeasure) {
      const parts = timeSigStrInput.split('/').map((s) => parseInt(s, 10));
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        executeCommand(
          setTimeSignature(targetMeasure.id, { num: parts[0], den: parts[1] }, timeSigScope)
        );
      }
    }
    setIsTimeSigModalOpen(false);
  }, [executeCommand, score.measures, selectedEventInfo?.measureId, timeSigScope, timeSigStrInput]);

  const handleOpenTempoModal = useCallback(() => {
    const targetMeasure =
      score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0];
    setTempoBpmInput(targetMeasure?.tempo?.bpm ?? 120);
    setTempoBeatUnitInput(targetMeasure?.tempo?.beatUnit ?? 1.0);
    setTempoTextInput(targetMeasure?.tempo?.tempoText ?? '');
    setIsTempoModalOpen(true);
  }, [score.measures, selectedEventInfo?.measureId]);

  const handleApplyTempo = useCallback(() => {
    const targetMeasure =
      score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0];
    if (targetMeasure) {
      executeCommand(
        setTempo(targetMeasure.id, {
          bpm: tempoBpmInput,
          beatUnit: tempoBeatUnitInput,
          tempoText: tempoTextInput,
        })
      );
    }
    setIsTempoModalOpen(false);
  }, [
    executeCommand,
    score.measures,
    selectedEventInfo?.measureId,
    tempoBeatUnitInput,
    tempoBpmInput,
    tempoTextInput,
  ]);

  const handleOpenBarlineModal = useCallback(() => {
    const targetMeasure =
      score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0];
    setBarlineInput(targetMeasure?.endBarline ?? 'single');
    setIsRepeatStartInput(Boolean(targetMeasure?.repeatStart));
    setIsRepeatEndInput(Boolean(targetMeasure?.repeatEnd));
    setIsPickupBarline(Boolean(targetMeasure?.actualTicks));
    setPickupTicksInput(targetMeasure?.actualTicks ?? 960);
    setIsBarlineModalOpen(true);
  }, [score.measures, selectedEventInfo?.measureId]);

  const handleApplyBarline = useCallback(() => {
    const targetMeasure =
      score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0];
    if (targetMeasure) {
      executeCommand(setEndBarline(targetMeasure.id, barlineInput));
      executeCommand(setRepeatStart(targetMeasure.id, isRepeatStartInput));
      executeCommand(setRepeatEnd(targetMeasure.id, isRepeatEndInput));
      if (targetMeasure.id === score.measures[0].id) {
        executeCommand(setPickup(targetMeasure.id, isPickupBarline ? pickupTicksInput : null));
      }
    }
    setIsBarlineModalOpen(false);
  }, [
    barlineInput,
    executeCommand,
    isPickupBarline,
    isRepeatEndInput,
    isRepeatStartInput,
    pickupTicksInput,
    score.measures,
    selectedEventInfo?.measureId,
  ]);

  const handleToggleRepeatStart = useCallback(() => {
    const targetMeasure =
      score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0];
    if (targetMeasure) {
      executeCommand(setRepeatStart(targetMeasure.id, !targetMeasure.repeatStart));
    }
  }, [executeCommand, score.measures, selectedEventInfo?.measureId]);

  const handleToggleRepeatEnd = useCallback(() => {
    const targetMeasure =
      score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0];
    if (targetMeasure) {
      executeCommand(setRepeatEnd(targetMeasure.id, !targetMeasure.repeatEnd));
    }
  }, [executeCommand, score.measures, selectedEventInfo?.measureId]);

  const handleCreateNewScore = (config: NewScoreConfig) => {
    const t0 = performance.now();
    const fresh = createEmptyScore({
      clef: config.clef,
      keySig: config.keySig,
      timeSig: config.timeSig,
      measures: config.measures,
    });
    if (config.isPickup && config.pickupDurationTicks) {
      fresh.measures[0].actualTicks = config.pickupDurationTicks;
      const m0Id = fresh.measures[0].id;
      fresh.parts[0].staves[0].measures[m0Id].voices[0].events = [
        createRest({
          baseType:
            config.pickupDurationTicks === 480
              ? 'eighth'
              : config.pickupDurationTicks === 1920
              ? 'half'
              : 'quarter',
          duration: config.pickupDurationTicks,
        }),
      ];
    }
    resetScore(fresh);
    setMode('select');
    const elapsed = performance.now() - t0;
    console.log(`[PERF] createEmptyScore & resetScore took: ${elapsed.toFixed(2)} ms`);
  };

  // Support visual verification states via query parameters
  const initializedRef = React.useRef(false);
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

    // Milestone 3b Verification States
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
          keySig: 1, // G major
          timeSig: { num: 4, den: 4 },
          measures: 4,
        });
        resetScore(sb);
        setMode('input');
        setActiveDuration('quarter');
        setActiveDots(0);
        return;
      }

      // Default base for verify_1..verify_10: fresh score treble, C major, 4/4, 8 measures
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

      if (stateParam === 'verify_1') {
        return;
      }

      const enterNoteSeq = (letter: any, dur: any, dots = 0) => {
        setActiveDuration(dur);
        setActiveDots(dots);
        enterPitchAtCursor(letter, t('error.doesNotFit'), t('error.noCursor'));
      };

      // State 2: press N, Digit5, then C D E F (measure 1 holds C5 D5 E5 F5)
      enterNoteSeq('C', 'quarter');
      enterNoteSeq('D', 'quarter');
      enterNoteSeq('E', 'quarter');
      enterNoteSeq('F', 'quarter');
      if (stateParam === 'verify_2') return;

      // State 3: Digit4, then G A B C (measure 2 first half: G5 A5 B5 C6, C6 with two ledger lines)
      enterNoteSeq('G', 'eighth');
      enterNoteSeq('A', 'eighth');
      enterNoteSeq('B', 'eighth');
      enterNoteSeq('C', 'eighth');
      if (stateParam === 'verify_3') return;

      // State 4: Digit0 (eighth rest), then Digit6 and E: must be REJECTED, status message visible, nothing changed
      enterRestAtCursor(t('error.doesNotFit'), t('error.noCursor'));
      if (stateParam === 'verify_4') {
        setActiveDuration('half');
        triggerRejectedError(t('error.doesNotFit'));
        return;
      }

      // State 5: Period, Digit5, E: dotted quarter fits and fills measure 2, cursor moves to measure 3
      enterNoteSeq('E', 'quarter', 1);
      if (stateParam === 'verify_5') return;

      // State 6: Left (cursor on the dotted quarter), Digit5 (no dot), G: dotted quarter replaced by quarter + eighth rest
      moveCursorDirection('prev');
      enterNoteSeq('G', 'quarter', 0);
      if (stateParam === 'verify_6') return;

      // State 7: Undo: dotted quarter is back
      undo();
      if (stateParam === 'verify_7') return;

      // State 8: zoom 150% (handled in I18nProvider)
      if (stateParam === 'verify_8') return;

      // State 9: English UI with the palette visible
      if (stateParam === 'verify_9') return;

      // State 10: New dialog open
      if (stateParam === 'verify_10') {
        setIsNewModalOpen(true);
        return;
      }
    }
  }, [
    resetScore,

    setActiveDuration,
    setActiveDots,
    enterPitchAtCursor,
    enterRestAtCursor,
    moveCursorDirection,
    undo,
    triggerRejectedError,
    t,
  ]);

  // Dev-only performance probe: measure keydown-to-paint (t1 - t0) across 2 requestAnimationFrames
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
    (window as any).__executeCommandForTest = (cmd: (score: Score) => Score) => executeCommand(cmd);
    (window as any).__selectEventForTest = (id: string | null) => selectEvent(id);
    (window as any).__resetScoreForTest = (newScore: Score) => resetScore(newScore);
    (window as any).__buildSampleScore = () => buildSampleScore('G');
    (window as any).__createBenchmark64Score = () => createBenchmark64Score();
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
  }, []);

  // Selected note for lyrics editing (Milestone 6d)
  const selectedNote = useMemo(() => {
    if (!selectedEventId || !score) return null;
    for (const part of score.parts) {
      for (const staff of part.staves) {
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (!sm) continue;
          for (const v of sm.voices) {
            for (const ev of v.events) {
              if (ev.id === selectedEventId && ev.kind === 'note') {
                return ev;
              }
            }
          }
        }
      }
    }
    return null;
  }, [score, selectedEventId]);

  const [lyricsInputValue, setLyricsInputValue] = useState('');
  const lyricsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedNote) {
      const v1 = selectedNote.lyrics?.find((l) => l.verse === 1);
      setLyricsInputValue(v1?.text ?? '');
    } else {
      setLyricsInputValue('');
    }
  }, [selectedNote?.id, selectedNote?.lyrics]);

  // Collect all eligible note IDs (skipping rests and second tied notes)
  const eligibleLyricsNoteIds = useMemo(() => {
    const ids: string[] = [];
    for (const part of score.parts) {
      for (const staff of part.staves) {
        let prevTied = false;
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (!sm) continue;
          for (const v of sm.voices) {
            for (const ev of v.events) {
              const isSecondTied = prevTied;
              if (ev.kind === 'note') {
                prevTied = Boolean(ev.tiedToNext || ev.pitches.some((p) => p.tiedToNext));
                if (!isSecondTied) {
                  ids.push(ev.id);
                }
              } else {
                prevTied = false;
              }
            }
          }
        }
      }
    }
    return ids;
  }, [score]);

  const moveLyricsNote = useCallback(
    (dir: 'next' | 'prev') => {
      if (!selectedNote || eligibleLyricsNoteIds.length === 0) return;
      const curIdx = eligibleLyricsNoteIds.indexOf(selectedNote.id);
      if (curIdx === -1) {
        selectEvent(eligibleLyricsNoteIds[0]);
        return;
      }
      const nextIdx = dir === 'next' ? curIdx + 1 : curIdx - 1;
      if (nextIdx >= 0 && nextIdx < eligibleLyricsNoteIds.length) {
        selectEvent(eligibleLyricsNoteIds[nextIdx]);
      }
    },
    [eligibleLyricsNoteIds, selectEvent, selectedNote]
  );

  useEffect(() => {
    if (mode === 'lyrics') {
      if (!selectedEventId && eligibleLyricsNoteIds.length > 0) {
        selectEvent(eligibleLyricsNoteIds[0]);
      }
      setTimeout(() => {
        lyricsInputRef.current?.focus();
      }, 50);
    }
  }, [eligibleLyricsNoteIds, mode, selectEvent, selectedEventId]);

  const handleLyricsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter' || e.code === 'Enter') {
      e.preventDefault();
      if (selectedNote && lyricsInputValue.trim().length > 0) {
        executeCommand(setLyrics(selectedNote.id, lyricsInputValue.trim(), 1));
      }
      moveLyricsNote('next');
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (selectedNote && lyricsInputValue.trim().length > 0) {
        executeCommand(setLyrics(selectedNote.id, lyricsInputValue.trim(), 1));
      }
      moveLyricsNote(e.shiftKey ? 'prev' : 'next');
      return;
    }
    if (e.key === 'Backspace' && lyricsInputValue.length === 0) {
      e.preventDefault();
      moveLyricsNote('prev');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setMode('select');
      return;
    }
  };

  const handleLyricsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLyricsInputValue(val);
    if (selectedNote) {
      executeCommand(setLyrics(selectedNote.id, val.length > 0 ? val : undefined, 1));
    }
  };

  const handleLyricsPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (/\s+/.test(pastedText.trim()) && selectedNote) {
      e.preventDefault();
      executeCommand(pasteLyrics(selectedNote.id, pastedText, score));
      const syllables = pastedText.trim().split(/\s+/).filter(Boolean);
      if (syllables.length > 0) {
        setLyricsInputValue(syllables[0]);
      }
    }
  };

  const handleAutoSolfege = useCallback(() => {
    executeCommand(autoSolfege(score.id));
  }, [executeCommand, score.id]);

  // Global physical keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle hidden diagnostics panel (Ctrl+Alt+D or Cmd+Alt+D)
      if (e.ctrlKey && e.altKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        setIsDiagnosticsOpen((prev) => {
          if (!prev) setPerfSamples([...perfSamplesRef.current]);
          return !prev;
        });
        return;
      }

      // Ignore typing inside text / number inputs or textareas (e.g. modal form inputs)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // If a button or select is focused, release focus so it never swallows shortcuts
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
          return;
        }
        (e.target as HTMLElement).blur();
      }

      // Save and Open shortcuts (Ctrl+S / Cmd+S, Ctrl+O / Cmd+O)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        if (e.code === 'KeyS' || e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleSave(false);
          return;
        }
        if (e.code === 'KeyO' || e.key.toLowerCase() === 'o') {
          e.preventDefault();
          handleOpenClick();
          return;
        }
      }

      // Playback shortcuts: Space = play/pause (Shift+Space = play from start)
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.shiftKey) {
          player.stop();
          player.play();
        } else {
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
        }
        return;
      }

      // Esc stops playback first (if playing or paused)
      if (e.code === 'Escape') {
        if (player.state === 'playing' || player.state === 'paused') {
          e.preventDefault();
          player.stop();
          return;
        }
      }

      const action = mapKeyEvent(e, mode);
      if (!action) return;

      e.preventDefault();

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

            if (!window.__perf) window.__perf = [];
            window.__perf.push(sample.totalDuration);

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
            action.letter,
            t('error.doesNotFit'),
            t('error.noCursor'),
            (p) => previewPlayer.previewPitches([p])
          );
          recordSample(`Key${action.letter}`);
        } else if (action.type === 'set-duration') {
          setActiveDuration(action.baseType);
          setIsRestSelected(false);
        } else if (action.type === 'apply-dynamic') {
          applyDynamic(action.dynamic);
          recordSample(`Dynamic-${action.dynamic}`);
        } else if (action.type === 'toggle-articulation') {
          applyArticulation(action.articulation);
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
    isInputMode,
    selectedEventId,
    selectedEventInfo,
    executeCommand,
    undo,
    redo,
    toggleInputMode,
    exitInputMode,
    selectNext,
    selectEvent,
    moveCursorDirection,
    enterPitchAtCursor,
    enterRestAtCursor,
    toggleDot,
    setActiveDuration,
    setIsRestSelected,
    applyEventOverride,
    clearEventOverride,
    clearAllEventOverrides,
    hasSelectedOverride,
    hasAnyOverride,
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
    t,
  ]);

  const handleEnterPitchDirect = (pitch: Pitch, customCursor?: ScoreCursor) => {
    previewPlayer.previewPitches([pitch]);
    enterPitchDirect(pitch, customCursor);
  };

  const handleChangePitch = (eventId: string, pitches: Pitch[]) => {
    previewPlayer.previewPitches(pitches);
    changeEventPitch(eventId, pitches);
  };

  return (
    <div
      className="notranslate"
      translate="no"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
      }}
    >
      <Toolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        canResetOverride={hasSelectedOverride}
        onResetOverride={() => selectedEventId && clearEventOverride(selectedEventId)}
        canResetAllOverrides={hasAnyOverride}
        onResetAllOverrides={() => setIsResetAllConfirmOpen(true)}
        onOpenNewScore={() => {
          if (isDirty) {
            setPendingAction(() => () => setIsNewModalOpen(true));
            setIsUnsavedPromptOpen(true);
          } else {
            setIsNewModalOpen(true);
          }
        }}
        onOpen={handleOpenClick}
        onSave={() => handleSave(false)}
        onSaveAs={() => handleSave(true)}
        onOpenScoreInfo={handleOpenScoreInfo}
        mode={mode}
        onChangeMode={setMode}
        activeDuration={activeDuration}
        onChangeDuration={(d) => {
          setActiveDuration(d);
          setIsRestSelected(false);
        }}
        activeDots={activeDots}
        onToggleDot={toggleDot}
        isRestSelected={isRestSelected}
        onToggleRest={toggleRestSelected}
        isPlaying={isPlaying}
        isPaused={isPaused}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        tempoBpm={score.measures[0]?.tempo?.bpm ?? 120}
        onChangeTempo={handleChangeTempo}
        volume={volume}
        isMuted={isMuted}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        previewSound={previewSound}
        onTogglePreviewSound={handleTogglePreviewSound}
        onInsertMeasure={insertNewMeasure}
        onDeleteMeasure={handleDeleteMeasureWithPrompt}
        activeDynamic={selectedEventInfo?.dynamic}
        onSelectDynamic={applyDynamic}
        activeArticulations={selectedEventInfo?.articulations}
        onToggleArticulation={applyArticulation}
        hasTie={Boolean(selectedEventInfo?.pitches.some((p) => p.tiedToNext))}
        onToggleTie={toggleTieSelection}
        hasSlur={selectedEventInfo?.hasSlur}
        onToggleSlur={applySlur}
        onClearNotations={clearNotations}
        onOpenKeySig={handleOpenKeySigModal}
        onOpenTimeSig={handleOpenTimeSigModal}
        onOpenTempo={handleOpenTempoModal}
        onOpenBarline={handleOpenBarlineModal}
        isRepeatStart={Boolean(
          (score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0])?.repeatStart
        )}
        onToggleRepeatStart={handleToggleRepeatStart}
        isRepeatEnd={Boolean(
          (score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0])?.repeatEnd
        )}
        onToggleRepeatEnd={handleToggleRepeatEnd}
        onAutoSolfege={handleAutoSolfege}
      />
      <ScoreView
        score={score}
        selectedEventId={selectedEventId}
        onSelectEvent={selectEvent}
        selectedEventIds={selectedEventIds}
        selectedRange={selectedRange}
        onSelectRange={setRangeSelection}
        onExtendSelectionTo={extendSelectionTo}
        cursor={cursor}
        mode={mode}
        activeDuration={activeDuration}
        onSelectMeasure={setCursorToMeasure}
        onEnterPitchDirect={handleEnterPitchDirect}
        onApplyOverride={applyEventOverride}
        onChangePitch={handleChangePitch}
        onOpenScoreInfo={handleOpenScoreInfo}
        isPlaying={isPlaying}
        isPaused={isPaused}
        activePlaybackEventIds={activePlaybackEventIds}
        playbackSeconds={playbackSeconds}
        onPreviewPitches={(pitches) => previewPlayer.previewPitches(pitches)}
        onLayoutChange={(layout) => {
          latestLayoutRef.current = layout;
        }}
        onHoverPitch={setHoverPitch}
        onHoverInfo={setHoverInfo}
        onDragStatus={setDragStatus}
      />

      {mode === 'lyrics' && (
        <div
          data-testid="lyrics-editor-overlay"
          style={{
            position: 'fixed',
            bottom: '48px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#ffffff',
            padding: '8px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '2px solid #0284c7',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0284c7' }}>
            {t('mode.lyrics')} (U):
          </span>
          <input
            ref={lyricsInputRef}
            data-testid="input-lyrics-editor"
            type="text"
            autoFocus
            value={lyricsInputValue}
            onChange={handleLyricsChange}
            onKeyDown={handleLyricsKeyDown}
            onPaste={handleLyricsPaste}
            placeholder="Hece girin (Boşluk = sonraki, - = hece bağı)..."
            style={{
              fontSize: '1rem',
              padding: '4px 8px',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              outline: 'none',
              minWidth: '240px',
            }}
          />
          <button
            type="button"
            onClick={() => setMode('select')}
            style={{
              fontSize: '0.8rem',
              padding: '4px 8px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Tamam (Esc)
          </button>
        </div>
      )}

      <StatusBar
        selection={selectedEventInfo}
        rangeInfo={rangeInfo}
        mode={mode}
        activeDuration={activeDuration}
        currentMeasureNumber={currentMeasureNumber}
        rejectedMessage={rejectedError}
        hasOverride={hasSelectedOverride}
        override={selectedOverride}
        hoverPitch={hoverPitch}
        hoverInfo={hoverInfo}
        dragStatus={dragStatus}
      />

      {/* Delete Measure Confirmation Modal */}
      {isDeleteMeasurePromptOpen && pendingDeleteMeasureIdx !== null && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="modal-delete-measure-confirm"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '400px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', color: '#0f172a' }}>
              {t('dialog.deleteMeasure.title')}
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
              {t('dialog.deleteMeasure.prompt')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                data-action="cancel-delete-measure"
                onClick={() => {
                  setIsDeleteMeasurePromptOpen(false);
                  setPendingDeleteMeasureIdx(null);
                }}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                data-action="confirm-delete-measure"
                onClick={() => {
                  confirmDeleteMeasure(pendingDeleteMeasureIdx);
                  setIsDeleteMeasurePromptOpen(false);
                  setPendingDeleteMeasureIdx(null);
                }}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <NewScoreModal
        isOpen={isNewModalOpen}
        canUndo={canUndo}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateNewScore}
      />

      {isResetAllConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', color: '#0f172a' }}>
              {t('toolbar.resetAllPositions')}
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.9rem', color: '#475569' }}>
              {t('dialog.confirmResetAll')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setIsResetAllConfirmOpen(false)}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllEventOverrides();
                  setIsResetAllConfirmOpen(false);
                }}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for opening .sfscore or .json */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".sfscore,.json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Status Toast Banner */}
      {statusToast && (
        <div
          role="status"
          className="scoreforge-toast"
          style={{
            position: 'fixed',
            top: '4.5rem',
            right: '1.5rem',
            zIndex: 9999,
            padding: '0.6rem 1.1rem',
            borderRadius: '8px',
            backgroundColor: statusToast.type === 'success' ? '#16a34a' : '#dc2626',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>{statusToast.message}</span>
        </div>
      )}

      {/* Score Info Modal */}
      {isScoreInfoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '380px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.scoreInfo.title')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                {t('dialog.scoreInfo.scoreTitle')}
              </label>
              <input
                type="text"
                data-testid="input-score-title"
                value={scoreTitleInput}
                onChange={(e) => setScoreTitleInput(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                {t('dialog.scoreInfo.subtitle')}
              </label>
              <input
                type="text"
                data-testid="input-score-subtitle"
                value={scoreSubtitleInput}
                onChange={(e) => setScoreSubtitleInput(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                {t('dialog.scoreInfo.composer')}
              </label>
              <input
                type="text"
                data-testid="input-score-composer"
                value={scoreComposerInput}
                onChange={(e) => setScoreComposerInput(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                {t('dialog.scoreInfo.arranger')}
              </label>
              <input
                type="text"
                data-testid="input-score-arranger"
                value={scoreArrangerInput}
                onChange={(e) => setScoreArrangerInput(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsScoreInfoOpen(false)}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                data-testid="btn-save-score-info"
                onClick={handleSaveScoreInfo}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.scoreInfo.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key Signature Modal */}
      {isKeySigModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="modal-keysig"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '380px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.keySig.title')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="keysig-dialog-select" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                {t('notation.keySignature')}
              </label>
              <select
                id="keysig-dialog-select"
                value={keySigInput}
                onChange={(e) => setKeySigInput(parseInt(e.target.value, 10))}
                style={{
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="-7">Do♭ Majör / La♭ Minör (7♭)</option>
                <option value="-6">Sol♭ Majör / Mi♭ Minör (6♭)</option>
                <option value="-5">Re♭ Majör / Si♭ Minör (5♭)</option>
                <option value="-4">La♭ Majör / Fa Minör (4♭)</option>
                <option value="-3">Mi♭ Majör / Do Minör (3♭)</option>
                <option value="-2">Si♭ Majör / Sol Minör (2♭)</option>
                <option value="-1">Fa Majör / Re Minör (1♭)</option>
                <option value="0">Do Majör / La Minör (0)</option>
                <option value="1">Sol Majör / Mi Minör (1♯)</option>
                <option value="2">Re Majör / Si Minör (2♯)</option>
                <option value="3">La Majör / Fa# Minör (3♯)</option>
                <option value="4">Mi Majör / Do# Minör (4♯)</option>
                <option value="5">Si Majör / Sol# Minör (5♯)</option>
                <option value="6">Fa# Majör / Re# Minör (6♯)</option>
                <option value="7">Do# Majör / La# Minör (7♯)</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>Kapsam</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="keysig-scope"
                    checked={keySigScope === 'from-here'}
                    onChange={() => setKeySigScope('from-here')}
                  />
                  {t('dialog.keySig.scopeFromHere')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="keysig-scope"
                    checked={keySigScope === 'score'}
                    onChange={() => setKeySigScope('score')}
                  />
                  {t('dialog.keySig.scopeScore')}
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsKeySigModalOpen(false)}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                data-testid="btn-apply-keysig"
                onClick={handleApplyKeySig}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.keySig.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Signature Modal */}
      {isTimeSigModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="modal-timesig"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '380px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.timeSig.title')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="timesig-dialog-select" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                {t('notation.timeSignature')}
              </label>
              <select
                id="timesig-dialog-select"
                value={['2/4', '3/4', '4/4', '6/8', '2/2', '3/8', '5/4', '7/8'].includes(timeSigStrInput) ? timeSigStrInput : 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    setTimeSigStrInput(e.target.value);
                  }
                }}
                style={{
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="2/4">2/4</option>
                <option value="6/8">6/8</option>
                <option value="2/2">2/2</option>
                <option value="3/8">3/8</option>
                <option value="5/4">5/4</option>
                <option value="7/8">7/8</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>Kapsam</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="timesig-scope"
                    checked={timeSigScope === 'from-here'}
                    onChange={() => setTimeSigScope('from-here')}
                  />
                  {t('dialog.timeSig.scopeFromHere')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="timesig-scope"
                    checked={timeSigScope === 'score'}
                    onChange={() => setTimeSigScope('score')}
                  />
                  {t('dialog.timeSig.scopeScore')}
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsTimeSigModalOpen(false)}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                data-testid="btn-apply-timesig"
                onClick={handleApplyTimeSig}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.timeSig.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tempo Modal */}
      {isTempoModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="modal-tempo"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '380px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.tempo.title')}</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label htmlFor="tempo-bpm-input" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                  {t('dialog.tempo.bpm')} (20..300)
                </label>
                <input
                  id="tempo-bpm-input"
                  type="number"
                  min={20}
                  max={300}
                  value={tempoBpmInput}
                  onChange={(e) => setTempoBpmInput(parseInt(e.target.value, 10) || 120)}
                  style={{
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.9rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label htmlFor="tempo-unit-select" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                  {t('dialog.tempo.beatUnit')}
                </label>
                <select
                  id="tempo-unit-select"
                  value={tempoBeatUnitInput}
                  onChange={(e) => setTempoBeatUnitInput(parseFloat(e.target.value))}
                  style={{
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.9rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="1">♩ Dörtlük (1.0)</option>
                  <option value="1.5">♩. Noktalı Dörtlük (1.5)</option>
                  <option value="0.5">♪ Sekizlik (0.5)</option>
                  <option value="2">𝅗 İkilik (2.0)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="tempo-prefix-input" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                {t('dialog.tempo.prefix')}
              </label>
              <input
                id="tempo-prefix-input"
                type="text"
                placeholder="Örn: Allegro, Andante, Moderato"
                value={tempoTextInput}
                onChange={(e) => setTempoTextInput(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsTempoModalOpen(false)}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                data-testid="btn-apply-tempo"
                onClick={handleApplyTempo}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.tempo.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barline & Pickup Modal */}
      {isBarlineModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="modal-barline"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '380px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.barline.title')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                {t('toolbar.barline')}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="barline-type"
                    checked={barlineInput === 'single'}
                    onChange={() => setBarlineInput('single')}
                  />
                  {t('dialog.barline.single')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="barline-type"
                    checked={barlineInput === 'double'}
                    onChange={() => setBarlineInput('double')}
                  />
                  {t('dialog.barline.double')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="barline-type"
                    checked={barlineInput === 'final'}
                    onChange={() => setBarlineInput('final')}
                  />
                  {t('dialog.barline.final')}
                </label>
              </div>
            </div>

            {/* Repeat options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                {t('toolbar.repeatStart')} / {t('toolbar.repeatEnd')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  data-testid="input-barline-repeat-start"
                  checked={isRepeatStartInput}
                  onChange={(e) => setIsRepeatStartInput(e.target.checked)}
                  style={{ accentColor: '#2563eb' }}
                />
                {t('dialog.barline.repeatStart')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  data-testid="input-barline-repeat-end"
                  checked={isRepeatEndInput}
                  onChange={(e) => setIsRepeatEndInput(e.target.checked)}
                  style={{ accentColor: '#2563eb' }}
                />
                {t('dialog.barline.repeatEnd')}
              </label>
            </div>

            {/* Pickup measure option for measure 1 */}
            {(selectedEventInfo?.measureId === score.measures[0]?.id || !selectedEventInfo) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isPickupBarline}
                    onChange={(e) => setIsPickupBarline(e.target.checked)}
                    style={{ accentColor: '#2563eb' }}
                  />
                  {t('dialog.newScore.pickup')}
                </label>
                {isPickupBarline && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                    <label htmlFor="barline-pickup-select" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {t('dialog.newScore.pickupLength')}:
                    </label>
                    <select
                      id="barline-pickup-select"
                      value={pickupTicksInput}
                      onChange={(e) => setPickupTicksInput(parseInt(e.target.value, 10))}
                      style={{
                        padding: '0.35rem 0.6rem',
                        fontSize: '0.85rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#1e293b',
                      }}
                    >
                      <option value="960">1/4 (960 tick)</option>
                      <option value="480">1/8 (480 tick)</option>
                      <option value="1440">3/8 (1440 tick)</option>
                      <option value="1920">1/2 (1920 tick)</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsBarlineModalOpen(false)}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                data-testid="btn-apply-barline"
                onClick={handleApplyBarline}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.barline.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {isUnsavedPromptOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '400px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', color: '#0f172a' }}>
              {t('dialog.unsavedChanges.title')}
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
              {t('dialog.unsavedChanges.prompt')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                data-action="cancel-unsaved"
                onClick={() => {
                  setIsUnsavedPromptOpen(false);
                  setPendingAction(null);
                }}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsUnsavedPromptOpen(false);
                  if (pendingAction) {
                    const action = pendingAction;
                    setPendingAction(null);
                    action();
                  }
                }}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.unsavedChanges.discardAndProceed')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Restore Prompt Modal */}
      {isRestorePromptOpen && restoreData && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '420px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', color: '#0f172a' }}>
              {t('dialog.restore.title')}
            </h3>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
              {t('dialog.restore.prompt')}
            </p>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.825rem', color: '#64748b' }}>
              {restoreData.score.meta.title || 'Adsız Eser'} —{' '}
              {new Date(restoreData.savedAt).toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                data-action="restore-discard"
                onClick={async () => {
                  await clearAutosave();
                  setIsRestorePromptOpen(false);
                  setRestoreData(null);
                }}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.restore.discard')}
              </button>
              <button
                type="button"
                data-action="restore-confirm"
                onClick={() => {
                  resetScore(restoreData.score);
                  markClean();
                  setIsRestorePromptOpen(false);
                  setRestoreData(null);
                  setStatusToast({ message: t('status.saveSuccess'), type: 'success' });
                }}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.restore.restore')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Diagnostics
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        samples={perfSamples}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <EditorShell />
    </I18nProvider>
  );
};

export default App;
