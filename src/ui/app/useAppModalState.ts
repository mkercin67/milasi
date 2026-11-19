// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useState } from 'react';
import { BarlineType, Score } from '../../core/model';
import {
  setEndBarline,
  setKeySignature,
  setPickup,
  setRepeatEnd,
  setRepeatStart,
  setScoreMetadata,
  setTempo,
  setTimeSignature,
  Command,
} from '../../core/commands';
import { createEmptyScore, createRest } from '../../core/factory';
import { SelectedEventInfo } from './types';
import { NewScoreConfig } from '../NewScoreModal';
import { EditorMode } from '../keymap';

export interface UseAppModalStateParams {
  score: Score;
  selectedEventInfo: SelectedEventInfo | null;
  executeCommand: (cmd: Command) => Score;
  resetScore: (score: Score) => void;
  setMode: (mode: EditorMode) => void;
  deleteCurrentMeasure: () => { targetIndex: number; hasNotes: boolean } | null;
  confirmDeleteMeasure: (targetIndex: number) => void;
}

export function useAppModalState({
  score,
  selectedEventInfo,
  executeCommand,
  resetScore,
  setMode,
  deleteCurrentMeasure,
  confirmDeleteMeasure,
}: UseAppModalStateParams) {
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

  const [isResetAllConfirmOpen, setIsResetAllConfirmOpen] = useState<boolean>(false);
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
      fresh.parts[0].staves[0].measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events = [
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

  return {
    isNewModalOpen,
    setIsNewModalOpen,
    isScoreInfoOpen,
    setIsScoreInfoOpen,
    scoreTitleInput,
    setScoreTitleInput,
    scoreSubtitleInput,
    setScoreSubtitleInput,
    scoreComposerInput,
    setScoreComposerInput,
    scoreArrangerInput,
    setScoreArrangerInput,
    isKeySigModalOpen,
    setIsKeySigModalOpen,
    keySigInput,
    setKeySigInput,
    keySigScope,
    setKeySigScope,
    isTimeSigModalOpen,
    setIsTimeSigModalOpen,
    timeSigStrInput,
    setTimeSigStrInput,
    timeSigScope,
    setTimeSigScope,
    isTempoModalOpen,
    setIsTempoModalOpen,
    tempoBpmInput,
    setTempoBpmInput,
    tempoBeatUnitInput,
    setTempoBeatUnitInput,
    tempoTextInput,
    setTempoTextInput,
    isBarlineModalOpen,
    setIsBarlineModalOpen,
    barlineInput,
    setBarlineInput,
    isRepeatStartInput,
    setIsRepeatStartInput,
    isRepeatEndInput,
    setIsRepeatEndInput,
    isPickupBarline,
    setIsPickupBarline,
    pickupTicksInput,
    setPickupTicksInput,
    isResetAllConfirmOpen,
    setIsResetAllConfirmOpen,
    isDeleteMeasurePromptOpen,
    setIsDeleteMeasurePromptOpen,
    pendingDeleteMeasureIdx,
    setPendingDeleteMeasureIdx,
    handleDeleteMeasureWithPrompt,
    handleSaveScoreInfo,
    handleOpenScoreInfo,
    handleOpenKeySigModal,
    handleApplyKeySig,
    handleOpenTimeSigModal,
    handleApplyTimeSig,
    handleOpenTempoModal,
    handleApplyTempo,
    handleOpenBarlineModal,
    handleApplyBarline,
    handleToggleRepeatStart,
    handleToggleRepeatEnd,
    handleCreateNewScore,
  };
}
