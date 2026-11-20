// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { BarlineType, BeamGroupingMode, Score } from '../../core/model';
import { NewScoreConfig, NewScoreModal } from '../NewScoreModal';
import { Diagnostics, PerfSample } from '../Diagnostics';
import { ScoreInfoModal } from './modals/ScoreInfoModal';
import { KeySigModal } from './modals/KeySigModal';
import { TimeSigModal } from './modals/TimeSigModal';
import { TempoModal } from './modals/TempoModal';
import { BarlineModal } from './modals/BarlineModal';
import {
  DeleteMeasureConfirm,
  ResetAllConfirm,
  SessionRestoreConfirm,
  UnsavedConfirm,
} from './modals/ConfirmModals';
import { AutosaveRecord } from '../../io/storage';
import { SelectedEventInfo } from './types';
import { useI18n } from '../i18n';

export interface AppModalsProps {
  score: Score;
  canUndo: boolean;
  selectedEventInfo: SelectedEventInfo | null;
  handleCreateNewScore: (config: NewScoreConfig) => void;
  // New Score Modal
  isNewModalOpen: boolean;
  setIsNewModalOpen: (open: boolean) => void;
  // Score Info
  isScoreInfoOpen: boolean;
  setIsScoreInfoOpen: (open: boolean) => void;
  scoreTitleInput: string;
  setScoreTitleInput: (val: string) => void;
  scoreSubtitleInput: string;
  setScoreSubtitleInput: (val: string) => void;
  scoreComposerInput: string;
  setScoreComposerInput: (val: string) => void;
  scoreArrangerInput: string;
  setScoreArrangerInput: (val: string) => void;
  scoreBeamGroupingInput: BeamGroupingMode;
  setScoreBeamGroupingInput: (val: BeamGroupingMode) => void;
  handleSaveScoreInfo: () => void;
  // Key Sig
  isKeySigModalOpen: boolean;
  setIsKeySigModalOpen: (open: boolean) => void;
  keySigInput: number;
  setKeySigInput: (val: number) => void;
  keySigScope: 'from-here' | 'score';
  setKeySigScope: (val: 'from-here' | 'score') => void;
  handleApplyKeySig: () => void;
  // Time Sig
  isTimeSigModalOpen: boolean;
  setIsTimeSigModalOpen: (open: boolean) => void;
  timeSigStrInput: string;
  setTimeSigStrInput: (val: string) => void;
  timeSigScope: 'from-here' | 'score';
  setTimeSigScope: (val: 'from-here' | 'score') => void;
  handleApplyTimeSig: () => void;
  // Tempo
  isTempoModalOpen: boolean;
  setIsTempoModalOpen: (open: boolean) => void;
  tempoBpmInput: number;
  setTempoBpmInput: (val: number) => void;
  tempoBeatUnitInput: number;
  setTempoBeatUnitInput: (val: number) => void;
  tempoTextInput: string;
  setTempoTextInput: (val: string) => void;
  handleApplyTempo: () => void;
  // Barline
  isBarlineModalOpen: boolean;
  setIsBarlineModalOpen: (open: boolean) => void;
  barlineInput: BarlineType;
  setBarlineInput: (val: BarlineType) => void;
  isRepeatStartInput: boolean;
  setIsRepeatStartInput: (val: boolean) => void;
  isRepeatEndInput: boolean;
  setIsRepeatEndInput: (val: boolean) => void;
  isPickupBarline: boolean;
  setIsPickupBarline: (val: boolean) => void;
  pickupTicksInput: number;
  setPickupTicksInput: (val: number) => void;
  handleApplyBarline: () => void;
  // Delete Measure Confirm
  isDeleteMeasurePromptOpen: boolean;
  setIsDeleteMeasurePromptOpen: (open: boolean) => void;
  pendingDeleteMeasureIdx: number | null;
  setPendingDeleteMeasureIdx: (val: number | null) => void;
  confirmDeleteMeasure: (idx: number) => void;
  // Reset All Confirm
  isResetAllConfirmOpen: boolean;
  setIsResetAllConfirmOpen: (open: boolean) => void;
  clearAllEventOverrides: () => void;
  // Unsaved Prompt
  isUnsavedPromptOpen: boolean;
  setIsUnsavedPromptOpen: (open: boolean) => void;
  pendingAction: (() => void) | null;
  setPendingAction: (action: (() => void) | null) => void;
  // Session Restore
  isRestorePromptOpen: boolean;
  setIsRestorePromptOpen: (open: boolean) => void;
  restoreData: { score: Score; savedAt: number } | null;
  setRestoreData: (data: { score: Score; savedAt: number } | null) => void;
  historyVersions?: AutosaveRecord[];
  onSelectHistoryVersion?: (record: AutosaveRecord) => void;
  resetScore: (score: Score) => void;
  markClean: () => void;
  clearAutosave: () => Promise<void>;
  setStatusToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  // Diagnostics
  isDiagnosticsOpen: boolean;
  setIsDiagnosticsOpen: (open: boolean) => void;
  perfSamples: PerfSample[];
}

export const AppModals: React.FC<AppModalsProps> = ({
  score,
  canUndo,
  selectedEventInfo,
  handleCreateNewScore,
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
  scoreBeamGroupingInput,
  setScoreBeamGroupingInput,
  handleSaveScoreInfo,
  isKeySigModalOpen,
  setIsKeySigModalOpen,
  keySigInput,
  setKeySigInput,
  keySigScope,
  setKeySigScope,
  handleApplyKeySig,
  isTimeSigModalOpen,
  setIsTimeSigModalOpen,
  timeSigStrInput,
  setTimeSigStrInput,
  timeSigScope,
  setTimeSigScope,
  handleApplyTimeSig,
  isTempoModalOpen,
  setIsTempoModalOpen,
  tempoBpmInput,
  setTempoBpmInput,
  tempoBeatUnitInput,
  setTempoBeatUnitInput,
  tempoTextInput,
  setTempoTextInput,
  handleApplyTempo,
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
  handleApplyBarline,
  isDeleteMeasurePromptOpen,
  setIsDeleteMeasurePromptOpen,
  pendingDeleteMeasureIdx,
  setPendingDeleteMeasureIdx,
  confirmDeleteMeasure,
  isResetAllConfirmOpen,
  setIsResetAllConfirmOpen,
  clearAllEventOverrides,
  isUnsavedPromptOpen,
  setIsUnsavedPromptOpen,
  pendingAction,
  setPendingAction,
  isRestorePromptOpen,
  setIsRestorePromptOpen,
  restoreData,
  setRestoreData,
  historyVersions,
  onSelectHistoryVersion,
  resetScore,
  markClean,
  clearAutosave,
  setStatusToast,
  isDiagnosticsOpen,
  setIsDiagnosticsOpen,
  perfSamples,
}) => {
  const { t } = useI18n();

  return (
    <>
      <NewScoreModal
        isOpen={isNewModalOpen}
        canUndo={canUndo}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateNewScore}
      />

      <ScoreInfoModal
        isOpen={isScoreInfoOpen}
        onClose={() => setIsScoreInfoOpen(false)}
        title={scoreTitleInput}
        setTitle={setScoreTitleInput}
        subtitle={scoreSubtitleInput}
        setSubtitle={setScoreSubtitleInput}
        composer={scoreComposerInput}
        setComposer={setScoreComposerInput}
        arranger={scoreArrangerInput}
        setArranger={setScoreArrangerInput}
        beamGrouping={scoreBeamGroupingInput}
        setBeamGrouping={setScoreBeamGroupingInput}
        onSave={handleSaveScoreInfo}
      />

      <KeySigModal
        isOpen={isKeySigModalOpen}
        onClose={() => setIsKeySigModalOpen(false)}
        keySigInput={keySigInput}
        setKeySigInput={setKeySigInput}
        keySigScope={keySigScope}
        setKeySigScope={setKeySigScope}
        onApply={handleApplyKeySig}
      />

      <TimeSigModal
        isOpen={isTimeSigModalOpen}
        onClose={() => setIsTimeSigModalOpen(false)}
        timeSigStrInput={timeSigStrInput}
        setTimeSigStrInput={setTimeSigStrInput}
        timeSigScope={timeSigScope}
        setTimeSigScope={setTimeSigScope}
        onApply={handleApplyTimeSig}
      />

      <TempoModal
        isOpen={isTempoModalOpen}
        onClose={() => setIsTempoModalOpen(false)}
        tempoBpmInput={tempoBpmInput}
        setTempoBpmInput={setTempoBpmInput}
        tempoBeatUnitInput={tempoBeatUnitInput}
        setTempoBeatUnitInput={setTempoBeatUnitInput}
        tempoTextInput={tempoTextInput}
        setTempoTextInput={setTempoTextInput}
        onApply={handleApplyTempo}
      />

      <BarlineModal
        isOpen={isBarlineModalOpen}
        onClose={() => setIsBarlineModalOpen(false)}
        barlineInput={barlineInput}
        setBarlineInput={setBarlineInput}
        isRepeatStartInput={isRepeatStartInput}
        setIsRepeatStartInput={setIsRepeatStartInput}
        isRepeatEndInput={isRepeatEndInput}
        setIsRepeatEndInput={setIsRepeatEndInput}
        isPickupBarline={isPickupBarline}
        setIsPickupBarline={setIsPickupBarline}
        pickupTicksInput={pickupTicksInput}
        setPickupTicksInput={setPickupTicksInput}
        selectedEventInfo={selectedEventInfo}
        score={score}
        onApply={handleApplyBarline}
      />

      <DeleteMeasureConfirm
        isOpen={isDeleteMeasurePromptOpen && pendingDeleteMeasureIdx !== null}
        onCancel={() => {
          setIsDeleteMeasurePromptOpen(false);
          setPendingDeleteMeasureIdx(null);
        }}
        onConfirm={() => {
          if (pendingDeleteMeasureIdx !== null) {
            confirmDeleteMeasure(pendingDeleteMeasureIdx);
          }
          setIsDeleteMeasurePromptOpen(false);
          setPendingDeleteMeasureIdx(null);
        }}
      />

      <ResetAllConfirm
        isOpen={isResetAllConfirmOpen}
        onCancel={() => setIsResetAllConfirmOpen(false)}
        onConfirm={() => {
          clearAllEventOverrides();
          setIsResetAllConfirmOpen(false);
        }}
      />

      <UnsavedConfirm
        isOpen={isUnsavedPromptOpen}
        onCancel={() => {
          setIsUnsavedPromptOpen(false);
          setPendingAction(null);
        }}
        onProceed={() => {
          setIsUnsavedPromptOpen(false);
          if (pendingAction) {
            const action = pendingAction;
            setPendingAction(null);
            action();
          }
        }}
      />

      <SessionRestoreConfirm
        isOpen={isRestorePromptOpen}
        restoreData={restoreData}
        historyVersions={historyVersions}
        onSelectVersion={onSelectHistoryVersion}
        onDiscard={async () => {
          await clearAutosave();
          setIsRestorePromptOpen(false);
          setRestoreData(null);
        }}
        onRestore={() => {
          if (restoreData) {
            resetScore(restoreData.score);
            markClean();
            setIsRestorePromptOpen(false);
            setRestoreData(null);
            setStatusToast({ message: t('status.saveSuccess'), type: 'success' });
          }
        }}
      />

      <Diagnostics
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        samples={perfSamples}
      />
    </>
  );
};
