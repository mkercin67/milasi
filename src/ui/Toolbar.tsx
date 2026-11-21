// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Main application toolbar containing score management, explicit 3-mode segmented control,
 * duration palette, position reset actions, zoom selector, and localization controls.
 */

import React from 'react';
import { ArticulationType, BaseDurationType, DynamicType, HairpinType, PhraseMark } from '../core/model';
import { EditorMode } from './keymap';
import { ToolbarFileHistory } from './toolbar/ToolbarFileHistory';
import { ToolbarPlayback } from './toolbar/ToolbarPlayback';
import { ToolbarModePalette } from './toolbar/ToolbarModePalette';
import { ToolbarVoiceSelector } from './toolbar/ToolbarVoiceSelector';
import { ToolbarNotations } from './toolbar/ToolbarNotations';
import { ToolbarSettings } from './toolbar/ToolbarSettings';

export interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canResetOverride?: boolean;
  onResetOverride?: () => void;
  canResetAllOverrides?: boolean;
  onResetAllOverrides?: () => void;
  onOpenNewScore: () => void;
  onOpen?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onOpenScoreInfo?: () => void;
  onInsertMeasure?: () => void;
  onDeleteMeasure?: () => void;
  mode: EditorMode;
  onChangeMode: (mode: EditorMode) => void;
  activeDuration: BaseDurationType;
  onChangeDuration: (d: BaseDurationType) => void;
  activeDots: number;
  onToggleDot: () => void;
  activeTriplet?: boolean;
  onToggleTriplet?: () => void;
  isRestSelected: boolean;
  onToggleRest: () => void;
  // Multi-voice selector (M7a-4)
  activeVoiceIndex?: 1 | 2 | 3 | 4;
  onSelectVoice?: (voiceIndex: 1 | 2 | 3 | 4) => void;
  voicesWithContent?: Set<number> | number[];
  // Playback transport controls
  isPlaying?: boolean;
  isPaused?: boolean;
  onTogglePlay?: () => void;
  onStop?: () => void;
  tempoBpm?: number;
  onChangeTempo?: (bpm: number) => void;
  volume?: number;
  isMuted?: boolean;
  onVolumeChange?: (vol: number) => void;
  onToggleMute?: () => void;
  previewSound?: boolean;
  onTogglePreviewSound?: () => void;
  // M6b Notations
  activeDynamic?: string | null;
  onSelectDynamic?: (dynamic: DynamicType | null) => void;
  activeArticulations?: string[];
  onToggleArticulation?: (art: ArticulationType) => void;
  hasTie?: boolean;
  onToggleTie?: () => void;
  hasSlur?: boolean;
  onToggleSlur?: () => void;
  onCycleFermata?: () => void;
  onToggleHairpin?: (type: HairpinType) => void;
  onToggleCourtesyAccidental?: () => void;
  onTogglePhraseMark?: (mark: PhraseMark) => void;
  onClearNotations?: () => void;
  // M6c Structure Modals
  onOpenKeySig?: () => void;
  onOpenTimeSig?: () => void;
  onOpenTempo?: () => void;
  onOpenBarline?: () => void;
  isRepeatStart?: boolean;
  onToggleRepeatStart?: () => void;
  isRepeatEnd?: boolean;
  onToggleRepeatEnd?: () => void;
  showNoteNames?: boolean;
  onToggleNoteNames?: () => void;
  onClearLyrics?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canResetOverride = false,
  onResetOverride,
  canResetAllOverrides = false,
  onResetAllOverrides,
  onOpenNewScore,
  onOpen,
  onSave,
  onSaveAs,
  onOpenScoreInfo,
  onInsertMeasure,
  onDeleteMeasure,
  mode,
  onChangeMode,
  activeDuration,
  onChangeDuration,
  activeDots,
  onToggleDot,
  activeTriplet = false,
  onToggleTriplet,
  isRestSelected,
  onToggleRest,
  activeVoiceIndex = 1,
  onSelectVoice,
  voicesWithContent = [],
  isPlaying = false,
  isPaused = false,
  onTogglePlay,
  onStop,
  tempoBpm = 120,
  onChangeTempo,
  volume = 0.8,
  isMuted = false,
  onVolumeChange,
  onToggleMute,
  previewSound = true,
  onTogglePreviewSound,
  activeDynamic = null,
  onSelectDynamic,
  activeArticulations = [],
  onToggleArticulation,
  hasTie = false,
  onToggleTie,
  hasSlur = false,
  onToggleSlur,
  onCycleFermata,
  onToggleHairpin,
  onToggleCourtesyAccidental,
  onTogglePhraseMark,
  onClearNotations,
  onOpenKeySig,
  onOpenTimeSig,
  onOpenTempo,
  onOpenBarline,
  isRepeatStart = false,
  onToggleRepeatStart,
  isRepeatEnd = false,
  onToggleRepeatEnd,
  showNoteNames,
  onToggleNoteNames,
  onClearLyrics,
}) => {
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __componentRenders?: Record<string, number> };
    if (!w.__componentRenders) w.__componentRenders = {};
    w.__componentRenders.Toolbar = (w.__componentRenders.Toolbar || 0) + 1;
  }
  const handleButtonClick = (cb: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    cb();
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.6rem 1.25rem',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      <ToolbarFileHistory
        onOpenNewScore={onOpenNewScore}
        onOpen={onOpen}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onOpenScoreInfo={onOpenScoreInfo}
        onOpenKeySig={onOpenKeySig}
        onOpenTimeSig={onOpenTimeSig}
        onOpenTempo={onOpenTempo}
        onOpenBarline={onOpenBarline}
        isRepeatStart={isRepeatStart}
        onToggleRepeatStart={onToggleRepeatStart}
        isRepeatEnd={isRepeatEnd}
        onToggleRepeatEnd={onToggleRepeatEnd}
        onInsertMeasure={onInsertMeasure}
        onDeleteMeasure={onDeleteMeasure}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        mode={mode}
        canResetOverride={canResetOverride}
        onResetOverride={onResetOverride}
        canResetAllOverrides={canResetAllOverrides}
        onResetAllOverrides={onResetAllOverrides}
        handleButtonClick={handleButtonClick}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <ToolbarPlayback
          isPlaying={isPlaying}
          isPaused={isPaused}
          onTogglePlay={onTogglePlay}
          onStop={onStop}
          tempoBpm={tempoBpm}
          onChangeTempo={onChangeTempo}
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={onVolumeChange}
          onToggleMute={onToggleMute}
          previewSound={previewSound}
          onTogglePreviewSound={onTogglePreviewSound}
          handleButtonClick={handleButtonClick}
        />

        <div style={{ width: '1px', height: '22px', backgroundColor: '#e2e8f0', margin: '0 0.2rem' }} />

        <ToolbarModePalette
          mode={mode}
          onChangeMode={onChangeMode}
          activeDuration={activeDuration}
          onChangeDuration={onChangeDuration}
          activeDots={activeDots}
          onToggleDot={onToggleDot}
          activeTriplet={activeTriplet}
          onToggleTriplet={onToggleTriplet}
          isRestSelected={isRestSelected}
          onToggleRest={onToggleRest}
          handleButtonClick={handleButtonClick}
        />

        <ToolbarVoiceSelector
          mode={mode}
          activeVoiceIndex={activeVoiceIndex}
          onSelectVoice={onSelectVoice ?? (() => {})}
          voicesWithContent={voicesWithContent}
          handleButtonClick={handleButtonClick}
        />

        <ToolbarNotations
          activeDynamic={activeDynamic}
          onSelectDynamic={onSelectDynamic}
          activeArticulations={activeArticulations}
          onToggleArticulation={onToggleArticulation}
          hasTie={hasTie}
          onToggleTie={onToggleTie}
          hasSlur={hasSlur}
          onToggleSlur={onToggleSlur}
          onCycleFermata={onCycleFermata}
          onToggleHairpin={onToggleHairpin}
          onToggleCourtesyAccidental={onToggleCourtesyAccidental}
          onTogglePhraseMark={onTogglePhraseMark}
          onClearNotations={onClearNotations}
          showNoteNames={showNoteNames}
          onToggleNoteNames={onToggleNoteNames}
          onClearLyrics={onClearLyrics}
          handleButtonClick={handleButtonClick}
        />
      </div>

      <ToolbarSettings />
    </header>
  );
};
