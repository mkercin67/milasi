// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Main application shell for ScoreForge editor.
 *
 * Coordinates toolbar, score canvas, status bar, modal dialogs,
 * keyboard interaction, and automated verification states.
 */

import React, { useRef, useState } from 'react';
import { Pitch, Score } from '../core/model';
import { ScoreCursor } from '../core/input';
import { validateScore } from '../core/validate';
import { clearAutosave, loadAutosave } from '../io/storage';
import { LayoutResult } from '../layout/types';
import { PerfSample } from './Diagnostics';
import { I18nProvider, useI18n } from './i18n';
import { EditorMode } from './keymap';
import { ErrorBoundary } from './ErrorBoundary';
import { ScoreView } from './ScoreView';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';
import { useEditor } from './useEditor';
import { AppModals } from './app/AppModals';
import { LyricsEditorOverlay } from './app/LyricsEditorOverlay';
import { useAppPlayback } from './app/useAppPlayback';
import { useAppStorage } from './app/useAppStorage';
import { useAppKeyboard } from './app/useAppKeyboard';
import { useAppModalState } from './app/useAppModalState';
import { useAppLyrics } from './app/useAppLyrics';
import { useAppVerificationStates } from './app/useAppVerificationStates';
import { useAppTestHooks } from './app/useAppTestHooks';

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
    cursor,
    activeDuration,
    setActiveDuration,
    activeDots,
    setActiveDots,
    toggleDot,
    isRestSelected,
    setIsRestSelected,
    toggleRestSelected,
    currentMeasureNumber,
    rejectedError,
    triggerRejectedError,
    toggleInputMode,
    exitInputMode,
    setCursorToMeasure,
    moveCursorDirection,
    enterPitchAtCursor,
    enterPitchDirect,
    changeEventPitch,
    enterRestAtCursor,
    applyEventOverride,
    clearEventOverride,
    clearAllEventOverrides,
    hasSelectedOverride,
    hasAnyOverride,
    selectedOverride,
    scoreRef,
    editorStateRef,
    selection,
    selectedEventIds,
    selectedRange,
    rangeInfo,
    setRangeSelection,
    extendSelectionTo,
    extendSelectionDirection,
    selectAllInStaff,
    copySelection,
    cutSelection,
    pasteClipboard,
    deleteSelection,
    transposeSelection,
    cycleAccidentalSelection,
    resetAccidentalSelection,
    toggleTieSelection,
    isDirty,
    markClean,
    insertNewMeasure,
    deleteCurrentMeasure,
    confirmDeleteMeasure,
    applyDynamic,
    applyArticulation,
    applySlur,
    clearNotations,
  } = useEditor();

  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const perfSamplesRef = useRef<PerfSample[]>([]);
  const [perfSamples, setPerfSamples] = useState<PerfSample[]>([]);
  const [hoverPitch, setHoverPitch] = useState<Pitch | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ pitch: Pitch; measureNumber: number } | null>(null);
  const [dragStatus, setDragStatus] = useState<string | null>(null);

  const latestLayoutRef = useRef<LayoutResult | null>(null);

  // Storage and autosave
  const {
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
    statusToast,
    setStatusToast,
    fileInputRef,
    handleSave,
    handleOpenClick,
    handleFileChange,
  } = useAppStorage({
    score,
    isDirty,
    markClean,
    resetScore,
  });

  // Playback engine and lookahead player
  const {
    player,
    previewPlayer,
    isPlaying,
    isPaused,
    activePlaybackEventIds,
    playbackSeconds,
    volume,
    isMuted,
    previewSound,
    handleTogglePlay,
    handleStop,
    handleChangeTempo,
    handleVolumeChange,
    handleToggleMute,
    handleTogglePreviewSound,
  } = useAppPlayback({
    score,
    selectedEventId,
    executeCommand,
  });

  // Modal dialog states & handlers
  const modalState = useAppModalState({
    score,
    selectedEventInfo,
    executeCommand,
    resetScore,
    setMode,
    deleteCurrentMeasure,
    confirmDeleteMeasure,
  });

  // Verification states (?state=...)
  useAppVerificationStates({
    resetScore,
    setMode,
    setActiveDuration,
    setActiveDots,
    enterPitchAtCursor,
    enterRestAtCursor,
    moveCursorDirection,
    undo,
    triggerRejectedError,
    setIsNewModalOpen: modalState.setIsNewModalOpen,
    t,
  });

  // Lyrics editing (Milestone 6d)
  const {
    lyricsInputValue,
    handleLyricsKeyDown,
    handleLyricsChange,
    handleLyricsPaste,
    handleAutoSolfege,
  } = useAppLyrics({
    score,
    selectedEventId,
    selectEvent,
    mode,
    setMode,
    executeCommand,
  });

  if (typeof window !== 'undefined') {
    const w = window as unknown as { __componentRenders?: Record<string, number> };
    if (!w.__componentRenders) w.__componentRenders = {};
    w.__componentRenders.EditorShell = (w.__componentRenders.EditorShell || 0) + 1;
  }

  // Keyboard integration
  useAppKeyboard({
    mode,
    setMode,
    togglePositionMode,
    toggleInputMode,
    exitInputMode,
    undo,
    redo,
    selectedEventId,
    selectEvent,
    selectNext,
    selectedEventInfo,
    selectedRange,
    selection,
    selectAllInStaff,
    copySelection,
    cutSelection,
    pasteClipboard,
    insertNewMeasure,
    handleDeleteMeasureWithPrompt: modalState.handleDeleteMeasureWithPrompt,
    extendSelectionDirection,
    cycleAccidentalSelection,
    resetAccidentalSelection,
    toggleTieSelection,
    applySlur,
    clearNotations,
    moveCursorDirection,
    transposeSelection,
    executeCommand,
    previewPlayer,
    clearEventOverride,
    applyEventOverride,
    hasSelectedOverride,
    latestLayoutRef,
    deleteSelection,
    enterRestAtCursor,
    enterPitchAtCursor,
    toggleDot,
    triggerRejectedError,
    setActiveDuration,
    setIsRestSelected,
    applyDynamic,
    applyArticulation,
    setDragStatus,
    perfSamplesRef,
    isDiagnosticsOpen,
    setIsDiagnosticsOpen,
    setPerfSamples,
    player,
    handleSave,
    handleOpenClick,
    t,
  });

  // Test and performance hooks
  useAppTestHooks({
    executeCommand,
    selectEvent,
    resetScore,
    scoreRef,
    editorStateRef,
  });

  const handlePreviewPitches = React.useCallback((pitches: Pitch[]) => {
    previewPlayer.previewPitches(pitches);
  }, [previewPlayer]);

  const handleLayoutChange = React.useCallback((layout: LayoutResult) => {
    latestLayoutRef.current = layout;
  }, []);

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
      <input
        ref={fileInputRef}
        type="file"
        accept=".sfscore,application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {statusToast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="status-toast"
          style={{
            position: 'fixed',
            top: '48px',
            right: '16px',
            backgroundColor: statusToast.type === 'error' ? '#ef4444' : '#10b981',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '0.875rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 9999,
          }}
        >
          {statusToast.message}
        </div>
      )}

      <Toolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        canResetOverride={hasSelectedOverride}
        onResetOverride={() => selectedEventId && clearEventOverride(selectedEventId)}
        canResetAllOverrides={hasAnyOverride}
        onResetAllOverrides={() => modalState.setIsResetAllConfirmOpen(true)}
        onOpenNewScore={() => {
          if (isDirty) {
            setPendingAction(() => () => modalState.setIsNewModalOpen(true));
            setIsUnsavedPromptOpen(true);
          } else {
            modalState.setIsNewModalOpen(true);
          }
        }}
        onOpen={handleOpenClick}
        onSave={() => handleSave(false)}
        onSaveAs={() => handleSave(true)}
        onOpenScoreInfo={modalState.handleOpenScoreInfo}
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
        onDeleteMeasure={modalState.handleDeleteMeasureWithPrompt}
        activeDynamic={selectedEventInfo?.dynamic}
        onSelectDynamic={applyDynamic}
        activeArticulations={selectedEventInfo?.articulations}
        onToggleArticulation={applyArticulation}
        hasTie={Boolean(selectedEventInfo?.pitches.some((p) => p.tiedToNext))}
        onToggleTie={toggleTieSelection}
        hasSlur={selectedEventInfo?.hasSlur}
        onToggleSlur={applySlur}
        onClearNotations={clearNotations}
        onOpenKeySig={modalState.handleOpenKeySigModal}
        onOpenTimeSig={modalState.handleOpenTimeSigModal}
        onOpenTempo={modalState.handleOpenTempoModal}
        onOpenBarline={modalState.handleOpenBarlineModal}
        isRepeatStart={Boolean(
          (score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0])?.repeatStart
        )}
        onToggleRepeatStart={modalState.handleToggleRepeatStart}
        isRepeatEnd={Boolean(
          (score.measures.find((m) => m.id === selectedEventInfo?.measureId) ?? score.measures[0])?.repeatEnd
        )}
        onToggleRepeatEnd={modalState.handleToggleRepeatEnd}
        onAutoSolfege={handleAutoSolfege}
      />

      <ErrorBoundary
        score={score}
        historyVersions={historyVersions}
        onRestoreAutosave={async (record) => {
          const target = record ?? (await loadAutosave());
          if (target?.score) {
            resetScore(target.score);
            markClean();
          }
        }}
      >
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
          onOpenScoreInfo={modalState.handleOpenScoreInfo}
          isPlaying={isPlaying}
          isPaused={isPaused}
          activePlaybackEventIds={activePlaybackEventIds}
          playbackSeconds={playbackSeconds}
          onPreviewPitches={handlePreviewPitches}
          onLayoutChange={handleLayoutChange}
          onHoverPitch={setHoverPitch}
          onHoverInfo={setHoverInfo}
          onDragStatus={setDragStatus}
        />
      </ErrorBoundary>

      {mode === 'lyrics' && (
        <LyricsEditorOverlay
          lyricsInputValue={lyricsInputValue}
          onLyricsChange={handleLyricsChange}
          onLyricsKeyDown={handleLyricsKeyDown}
          onLyricsPaste={handleLyricsPaste}
          onClose={() => setMode('select')}
        />
      )}

      {(() => {
        const problems = validateScore(score);
        const errorCount = problems.filter((p) => p.severity === 'error').length;
        const warningCount = problems.filter((p) => p.severity === 'warning').length;
        return (
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
            errorCount={errorCount}
            warningCount={warningCount}
          />
        );
      })()}

      <AppModals
        score={score}
        canUndo={canUndo}
        selectedEventInfo={selectedEventInfo}
        handleCreateNewScore={modalState.handleCreateNewScore}
        isNewModalOpen={modalState.isNewModalOpen}
        setIsNewModalOpen={modalState.setIsNewModalOpen}
        isScoreInfoOpen={modalState.isScoreInfoOpen}
        setIsScoreInfoOpen={modalState.setIsScoreInfoOpen}
        scoreTitleInput={modalState.scoreTitleInput}
        setScoreTitleInput={modalState.setScoreTitleInput}
        scoreSubtitleInput={modalState.scoreSubtitleInput}
        setScoreSubtitleInput={modalState.setScoreSubtitleInput}
        scoreComposerInput={modalState.scoreComposerInput}
        setScoreComposerInput={modalState.setScoreComposerInput}
        scoreArrangerInput={modalState.scoreArrangerInput}
        setScoreArrangerInput={modalState.setScoreArrangerInput}
        handleSaveScoreInfo={modalState.handleSaveScoreInfo}
        isKeySigModalOpen={modalState.isKeySigModalOpen}
        setIsKeySigModalOpen={modalState.setIsKeySigModalOpen}
        keySigInput={modalState.keySigInput}
        setKeySigInput={modalState.setKeySigInput}
        keySigScope={modalState.keySigScope}
        setKeySigScope={modalState.setKeySigScope}
        handleApplyKeySig={modalState.handleApplyKeySig}
        isTimeSigModalOpen={modalState.isTimeSigModalOpen}
        setIsTimeSigModalOpen={modalState.setIsTimeSigModalOpen}
        timeSigStrInput={modalState.timeSigStrInput}
        setTimeSigStrInput={modalState.setTimeSigStrInput}
        timeSigScope={modalState.timeSigScope}
        setTimeSigScope={modalState.setTimeSigScope}
        handleApplyTimeSig={modalState.handleApplyTimeSig}
        isTempoModalOpen={modalState.isTempoModalOpen}
        setIsTempoModalOpen={modalState.setIsTempoModalOpen}
        tempoBpmInput={modalState.tempoBpmInput}
        setTempoBpmInput={modalState.setTempoBpmInput}
        tempoBeatUnitInput={modalState.tempoBeatUnitInput}
        setTempoBeatUnitInput={modalState.setTempoBeatUnitInput}
        tempoTextInput={modalState.tempoTextInput}
        setTempoTextInput={modalState.setTempoTextInput}
        handleApplyTempo={modalState.handleApplyTempo}
        isBarlineModalOpen={modalState.isBarlineModalOpen}
        setIsBarlineModalOpen={modalState.setIsBarlineModalOpen}
        barlineInput={modalState.barlineInput}
        setBarlineInput={modalState.setBarlineInput}
        isRepeatStartInput={modalState.isRepeatStartInput}
        setIsRepeatStartInput={modalState.setIsRepeatStartInput}
        isRepeatEndInput={modalState.isRepeatEndInput}
        setIsRepeatEndInput={modalState.setIsRepeatEndInput}
        isPickupBarline={modalState.isPickupBarline}
        setIsPickupBarline={modalState.setIsPickupBarline}
        pickupTicksInput={modalState.pickupTicksInput}
        setPickupTicksInput={modalState.setPickupTicksInput}
        handleApplyBarline={modalState.handleApplyBarline}
        isDeleteMeasurePromptOpen={modalState.isDeleteMeasurePromptOpen}
        setIsDeleteMeasurePromptOpen={modalState.setIsDeleteMeasurePromptOpen}
        pendingDeleteMeasureIdx={modalState.pendingDeleteMeasureIdx}
        setPendingDeleteMeasureIdx={modalState.setPendingDeleteMeasureIdx}
        confirmDeleteMeasure={confirmDeleteMeasure}
        isResetAllConfirmOpen={modalState.isResetAllConfirmOpen}
        setIsResetAllConfirmOpen={modalState.setIsResetAllConfirmOpen}
        clearAllEventOverrides={clearAllEventOverrides}
        isUnsavedPromptOpen={isUnsavedPromptOpen}
        setIsUnsavedPromptOpen={setIsUnsavedPromptOpen}
        pendingAction={pendingAction}
        setPendingAction={setPendingAction}
        isRestorePromptOpen={isRestorePromptOpen}
        setIsRestorePromptOpen={setIsRestorePromptOpen}
        restoreData={restoreData}
        setRestoreData={setRestoreData}
        historyVersions={historyVersions}
        onSelectHistoryVersion={handleSelectHistoryVersion}
        resetScore={resetScore}
        markClean={markClean}
        clearAutosave={clearAutosave}
        setStatusToast={setStatusToast}
        isDiagnosticsOpen={isDiagnosticsOpen}
        setIsDiagnosticsOpen={setIsDiagnosticsOpen}
        perfSamples={perfSamples}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <I18nProvider>
      <EditorShell />
    </I18nProvider>
  );
};
export default App;
