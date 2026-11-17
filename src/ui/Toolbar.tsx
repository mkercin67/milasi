/**
 * Main application toolbar containing score management, explicit 3-mode segmented control,
 * duration palette, position reset actions, zoom selector, and localization controls.
 */

import React from 'react';
import { ArticulationType, BaseDurationType, DynamicType } from '../core/model';
import { Language, NoteNameStyle, useI18n } from './i18n';
import { EditorMode } from './keymap';

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
  isRestSelected: boolean;
  onToggleRest: () => void;
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
  onClearNotations?: () => void;
  // M6c Structure Modals
  onOpenKeySig?: () => void;
  onOpenTimeSig?: () => void;
  onOpenTempo?: () => void;
  onOpenBarline?: () => void;
  onAutoSolfege?: () => void;
}

const DYNAMICS: { type: DynamicType; label: string; shortcut: string }[] = [
  { type: 'pp', label: 'pp', shortcut: 'Shift+1' },
  { type: 'p', label: 'p', shortcut: 'Shift+2' },
  { type: 'mp', label: 'mp', shortcut: 'Shift+3' },
  { type: 'mf', label: 'mf', shortcut: 'Shift+4' },
  { type: 'f', label: 'f', shortcut: 'Shift+5' },
  { type: 'ff', label: 'ff', shortcut: 'Shift+6' },
  { type: 'sfz', label: 'sfz', shortcut: 'Shift+7' },
  { type: 'fp', label: 'fp', shortcut: 'Shift+8' },
];

const ARTICULATIONS: { type: ArticulationType; label: string; symbol: string; shortcut: string }[] = [
  { type: 'staccato', label: 'Staccato', symbol: '•', shortcut: 'J' },
  { type: 'tenuto', label: 'Tenuto', symbol: '—', shortcut: 'K' },
  { type: 'accent', label: 'Aksan', symbol: '>', shortcut: 'L' },
  { type: 'marcato', label: 'Markato', symbol: '^', shortcut: 'Shift+L' },
];

const DURATIONS: { type: BaseDurationType; label: string; shortcut: string; icon: string }[] = [
  { type: 'whole', label: 'palette.duration.whole', shortcut: '7', icon: '𝅝' },
  { type: 'half', label: 'palette.duration.half', shortcut: '6', icon: '𝅗𝅥' },
  { type: 'quarter', label: 'palette.duration.quarter', shortcut: '5', icon: '𝅘𝅥' },
  { type: 'eighth', label: 'palette.duration.eighth', shortcut: '4', icon: '𝅘𝅥𝅮' },
  { type: '16th', label: 'palette.duration.16th', shortcut: '3', icon: '𝅘𝅥𝅯' },
  { type: '32nd', label: 'palette.duration.32nd', shortcut: '2', icon: '𝅘𝅥𝅰' },
];

const MODES: { id: EditorMode; labelKey: string; shortcut: string }[] = [
  { id: 'select', labelKey: 'mode.select', shortcut: 'V' },
  { id: 'input', labelKey: 'mode.input', shortcut: 'N' },
  { id: 'position', labelKey: 'mode.position', shortcut: 'P' },
  { id: 'lyrics', labelKey: 'mode.lyrics', shortcut: 'U' },
];

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
  isRestSelected,
  onToggleRest,
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
  onClearNotations,
  onOpenKeySig,
  onOpenTimeSig,
  onOpenTempo,
  onOpenBarline,
  onAutoSolfege,
}) => {
  const { t, language, setLanguage, noteNameStyle, setNoteNameStyle, zoom, setZoom } = useI18n();

  const [localTempo, setLocalTempo] = React.useState<string>(String(tempoBpm));
  React.useEffect(() => {
    setLocalTempo(String(tempoBpm));
  }, [tempoBpm]);

  const handleCommitTempo = (e?: React.FocusEvent<HTMLInputElement>) => {
    const raw = e?.target ? e.target.value : localTempo;
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(20, Math.min(300, parsed));
      setLocalTempo(String(clamped));
      onChangeTempo?.(clamped);
    } else {
      setLocalTempo(String(tempoBpm));
    }
  };

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
      {/* Left section: App Title, New, Undo, Redo, and Position-only reset buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h1
          style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            margin: 0,
            color: '#0f172a',
            letterSpacing: '-0.025em',
            marginRight: '0.25rem',
          }}
        >
          ScoreForge
        </h1>

        <button
          type="button"
          onClick={handleButtonClick(onOpenNewScore)}
          onMouseDown={(e) => e.preventDefault()}
          title={t('dialog.newScore.title')}
          style={{
            padding: '0.4rem 0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#ffffff',
            backgroundColor: '#0284c7',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          + {t('toolbar.new')}
        </button>

        {onOpen && (
          <button
            type="button"
            onClick={handleButtonClick(onOpen)}
            onMouseDown={(e) => e.preventDefault()}
            title={`${t('toolbar.open')} (Ctrl+O)`}
            style={{
              padding: '0.4rem 0.7rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#1e293b',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {t('toolbar.open')}
          </button>
        )}

        {onSave && (
          <button
            type="button"
            onClick={handleButtonClick(onSave)}
            onMouseDown={(e) => e.preventDefault()}
            title={`${t('toolbar.save')} (Ctrl+S)`}
            style={{
              padding: '0.4rem 0.7rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#1e293b',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {t('toolbar.save')}
          </button>
        )}

        {onSaveAs && (
          <button
            type="button"
            onClick={handleButtonClick(onSaveAs)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.saveAs')}
            style={{
              padding: '0.4rem 0.7rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#1e293b',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {t('toolbar.saveAs')}
          </button>
        )}

        {onOpenScoreInfo && (
          <button
            type="button"
            data-testid="btn-score-info"
            onClick={handleButtonClick(onOpenScoreInfo)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.scoreInfo')}
            style={{
              padding: '0.4rem 0.7rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#1e293b',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {t('toolbar.scoreInfo')}
          </button>
        )}

        {onOpenKeySig && (
          <button
            type="button"
            data-testid="btn-key-sig"
            onClick={handleButtonClick(onOpenKeySig)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.keySig')}
            style={{
              padding: '0.4rem 0.65rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#1e293b',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            ♯♭ {t('toolbar.keySig')}
          </button>
        )}

        {onOpenTimeSig && (
          <button
            type="button"
            data-testid="btn-time-sig"
            onClick={handleButtonClick(onOpenTimeSig)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.timeSig')}
            style={{
              padding: '0.4rem 0.65rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#1e293b',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            𝄴 {t('toolbar.timeSig')}
          </button>
        )}

        {onOpenTempo && (
          <button
            type="button"
            data-testid="btn-tempo"
            onClick={handleButtonClick(onOpenTempo)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.tempo')}
            style={{
              padding: '0.4rem 0.65rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#1e293b',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            ♩= {t('toolbar.tempo')}
          </button>
        )}

        {onOpenBarline && (
          <button
            type="button"
            data-testid="btn-barline"
            onClick={handleButtonClick(onOpenBarline)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.barline')}
            style={{
              padding: '0.4rem 0.65rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#1e293b',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            𝄀𝄂 {t('toolbar.barline')}
          </button>
        )}

        {onInsertMeasure && (
          <button
            type="button"
            data-testid="btn-insert-measure"
            onClick={handleButtonClick(onInsertMeasure)}
            onMouseDown={(e) => e.preventDefault()}
            title={`${t('toolbar.insertMeasure')} (Ctrl+B)`}
            style={{
              padding: '0.4rem 0.65rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#1e293b',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            + {t('toolbar.insertMeasure')}
          </button>
        )}

        {onDeleteMeasure && (
          <button
            type="button"
            data-testid="btn-delete-measure"
            onClick={handleButtonClick(onDeleteMeasure)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.deleteMeasure')}
            style={{
              padding: '0.4rem 0.65rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#dc2626',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            - {t('toolbar.deleteMeasure')}
          </button>
        )}

        <div style={{ width: '1px', height: '22px', backgroundColor: '#e2e8f0', margin: '0 0.25rem' }} />

        <button
          type="button"
          onClick={handleButtonClick(onUndo)}
          onMouseDown={(e) => e.preventDefault()}
          disabled={!canUndo}
          title={`${t('toolbar.undo')} (Ctrl+Z)`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.4rem 0.65rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: canUndo ? '#1e293b' : '#94a3b8',
            backgroundColor: canUndo ? '#f1f5f9' : '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            cursor: canUndo ? 'pointer' : 'not-allowed',
          }}
        >
          ↶ {t('toolbar.undo')}
        </button>
        <button
          type="button"
          onClick={handleButtonClick(onRedo)}
          onMouseDown={(e) => e.preventDefault()}
          disabled={!canRedo}
          title={`${t('toolbar.redo')} (Ctrl+Shift+Z)`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.4rem 0.65rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: canRedo ? '#1e293b' : '#94a3b8',
            backgroundColor: canRedo ? '#f1f5f9' : '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            cursor: canRedo ? 'pointer' : 'not-allowed',
          }}
        >
          ↷ {t('toolbar.redo')}
        </button>

        {mode === 'position' && (
          <>
            <button
              type="button"
              onClick={handleButtonClick(onResetOverride ?? (() => {}))}
              onMouseDown={(e) => e.preventDefault()}
              disabled={!canResetOverride}
              title={`${t('toolbar.resetPosition')} (Ctrl+0)`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.4rem 0.65rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: canResetOverride ? '#1e293b' : '#94a3b8',
                backgroundColor: canResetOverride ? '#f1f5f9' : '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: canResetOverride ? 'pointer' : 'not-allowed',
              }}
            >
              ⟲ {t('toolbar.resetPosition')}
            </button>
            <button
              type="button"
              onClick={handleButtonClick(onResetAllOverrides ?? (() => {}))}
              onMouseDown={(e) => e.preventDefault()}
              disabled={!canResetAllOverrides}
              title={t('toolbar.resetAllPositions')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.4rem 0.65rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: canResetAllOverrides ? '#1e293b' : '#94a3b8',
                backgroundColor: canResetAllOverrides ? '#f1f5f9' : '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: canResetAllOverrides ? 'pointer' : 'not-allowed',
              }}
            >
              ⟲ {t('toolbar.resetAllPositions')}
            </button>
          </>
        )}
      </div>

      {/* Middle section: Playback Transport, Explicit 3-mode segmented control & Duration Palette */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        {/* Playback Transport Controls */}
        <div
          role="group"
          aria-label="Playback"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '2px 6px',
          }}
        >
          <button
            type="button"
            data-testid="btn-play-pause"
            onClick={handleButtonClick(onTogglePlay ?? (() => {}))}
            onMouseDown={(e) => e.preventDefault()}
            title={`${isPlaying ? t('toolbar.pause') : t('toolbar.play')} (Space)`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.35rem 0.65rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: isPlaying ? '#ffffff' : '#1e293b',
              backgroundColor: isPlaying ? '#16a34a' : '#f1f5f9',
              border: isPlaying ? '1px solid #15803d' : '1px solid #cbd5e1',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            {isPlaying ? `⏸ ${t('toolbar.pause')}` : `▶ ${t('toolbar.play')}`}
          </button>

          <button
            type="button"
            data-testid="btn-stop"
            onClick={handleButtonClick(onStop ?? (() => {}))}
            onMouseDown={(e) => e.preventDefault()}
            disabled={!isPlaying && !isPaused}
            title={`${t('toolbar.stop')} (Esc)`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.35rem 0.55rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: isPlaying || isPaused ? '#1e293b' : '#94a3b8',
              backgroundColor: isPlaying || isPaused ? '#f1f5f9' : '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '5px',
              cursor: isPlaying || isPaused ? 'pointer' : 'not-allowed',
            }}
          >
            ⏹ {t('toolbar.stop')}
          </button>

          {/* Tempo field: "♩ = " [20-300] */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', margin: '0 0.15rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>♩ =</span>
            <input
              type="number"
              data-testid="input-tempo"
              min={20}
              max={300}
              value={localTempo}
              onChange={(e) => setLocalTempo(e.target.value)}
              onBlur={handleCommitTempo}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              style={{
                width: '54px',
                padding: '0.2rem 0.3rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                textAlign: 'center',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
              }}
              title={t('notation.tempo')}
            />
          </div>

          {/* Volume slider & Mute button */}
          <button
            type="button"
            data-testid="btn-mute"
            onClick={handleButtonClick(onToggleMute ?? (() => {}))}
            onMouseDown={(e) => e.preventDefault()}
            title={isMuted ? t('toolbar.unmute') : t('toolbar.mute')}
            style={{
              padding: '0.2rem 0.35rem',
              fontSize: '0.85rem',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <input
            type="range"
            data-testid="slider-volume"
            min={0}
            max={100}
            value={isMuted ? 0 : Math.round((volume ?? 0.8) * 100)}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              onVolumeChange?.(val / 100);
            }}
            title={t('toolbar.volume')}
            style={{ width: '56px', cursor: 'pointer' }}
          />

          {/* Audition / Preview sound toggle */}
          <button
            type="button"
            data-testid="toggle-preview-sound"
            onClick={handleButtonClick(onTogglePreviewSound ?? (() => {}))}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.previewSound')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.25rem 0.45rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: previewSound ? '#1e293b' : '#94a3b8',
              backgroundColor: previewSound ? '#e2e8f0' : 'transparent',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            🔔 {t('toolbar.previewSound')}
          </button>
        </div>

        <div style={{ width: '1px', height: '22px', backgroundColor: '#e2e8f0', margin: '0 0.2rem' }} />

        <div
          role="group"
          aria-label="Mode"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '2px',
            gap: '2px',
          }}
        >
          {MODES.map((m) => {
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                data-mode-btn={m.id}
                aria-pressed={isActive}
                onClick={handleButtonClick(() => onChangeMode(m.id))}
                onMouseDown={(e) => e.preventDefault()}
                title={`${t(m.labelKey)} (${m.shortcut})`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.36rem 0.72rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: isActive ? '#ffffff' : '#334155',
                  backgroundColor: isActive ? '#2563eb' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 2px rgba(37,99,235,0.25)' : 'none',
                }}
              >
                {t(m.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Palette buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '2px',
            gap: '2px',
          }}
        >
          {DURATIONS.map((dur) => {
            const isActive = activeDuration === dur.type && !isRestSelected;
            return (
              <button
                key={dur.type}
                type="button"
                onClick={handleButtonClick(() => onChangeDuration(dur.type))}
                onMouseDown={(e) => e.preventDefault()}
                title={t(dur.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '30px',
                  fontSize: '1.2rem',
                  lineHeight: 1,
                  backgroundColor: isActive ? '#dbeafe' : 'transparent',
                  color: isActive ? '#1d4ed8' : '#334155',
                  border: isActive ? '1px solid #93c5fd' : '1px solid transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                {dur.icon}
              </button>
            );
          })}

          <div style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0', margin: '0 2px' }} />

          {/* Dot button */}
          <button
            type="button"
            onClick={handleButtonClick(onToggleDot)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('palette.dot')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              fontSize: '1.3rem',
              lineHeight: 1,
              backgroundColor: activeDots > 0 ? '#dbeafe' : 'transparent',
              color: activeDots > 0 ? '#1d4ed8' : '#334155',
              border: activeDots > 0 ? '1px solid #93c5fd' : '1px solid transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            •
          </button>

          {/* Rest toggle button */}
          <button
            type="button"
            onClick={handleButtonClick(onToggleRest)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('palette.rest')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 6px',
              height: '30px',
              fontSize: '1rem',
              lineHeight: 1,
              backgroundColor: isRestSelected ? '#dbeafe' : 'transparent',
              color: isRestSelected ? '#1d4ed8' : '#334155',
              border: isRestSelected ? '1px solid #93c5fd' : '1px solid transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            𝄽
          </button>
        </div>

        {/* Notasyon Panel */}
        <div
          data-testid="panel-notations"
          role="group"
          aria-label="Notasyon"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '2px 4px',
            gap: '3px',
            flexWrap: 'wrap',
          }}
        >
          {/* Dynamics subsection */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            {DYNAMICS.map((dyn) => {
              const isActive = activeDynamic === dyn.type;
              return (
                <button
                  key={dyn.type}
                  type="button"
                  data-testid={`btn-dynamic-${dyn.type}`}
                  aria-pressed={isActive}
                  onClick={handleButtonClick(() => {
                    onSelectDynamic?.(isActive ? null : dyn.type);
                  })}
                  onMouseDown={(e) => e.preventDefault()}
                  title={`${dyn.label} (${dyn.shortcut})`}
                  style={{
                    padding: '0.2rem 0.4rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    fontStyle: 'italic',
                    fontFamily: 'serif',
                    backgroundColor: isActive ? '#dbeafe' : 'transparent',
                    color: isActive ? '#1d4ed8' : '#334155',
                    border: isActive ? '1px solid #93c5fd' : '1px solid transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {dyn.label}
                </button>
              );
            })}
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0', margin: '0 2px' }} />

          {/* Articulations subsection */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            {ARTICULATIONS.map((art) => {
              const isActive = Boolean(activeArticulations?.includes(art.type));
              return (
                <button
                  key={art.type}
                  type="button"
                  data-testid={`btn-artic-${art.type}`}
                  aria-pressed={isActive}
                  onClick={handleButtonClick(() => {
                    onToggleArticulation?.(art.type);
                  })}
                  onMouseDown={(e) => e.preventDefault()}
                  title={`${art.label} (${art.shortcut})`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '28px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    backgroundColor: isActive ? '#dbeafe' : 'transparent',
                    color: isActive ? '#1d4ed8' : '#334155',
                    border: isActive ? '1px solid #93c5fd' : '1px solid transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {art.symbol}
                </button>
              );
            })}
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0', margin: '0 2px' }} />

          {/* Tie button */}
          <button
            type="button"
            data-testid="btn-tie"
            aria-pressed={hasTie}
            onClick={handleButtonClick(onToggleTie ?? (() => {}))}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.tie')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.2rem 0.5rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: hasTie ? '#dbeafe' : 'transparent',
              color: hasTie ? '#1d4ed8' : '#334155',
              border: hasTie ? '1px solid #93c5fd' : '1px solid transparent',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ‿ {t('notation.tie')}
          </button>

          {/* Slur button */}
          <button
            type="button"
            data-testid="btn-slur"
            aria-pressed={hasSlur}
            onClick={handleButtonClick(onToggleSlur ?? (() => {}))}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.slur')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.2rem 0.5rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: hasSlur ? '#dbeafe' : 'transparent',
              color: hasSlur ? '#1d4ed8' : '#334155',
              border: hasSlur ? '1px solid #93c5fd' : '1px solid transparent',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ⌒ {t('notation.slur')}
          </button>

          {/* Clear Notations button */}
          <button
            type="button"
            data-testid="btn-clear-notations"
            onClick={handleButtonClick(onClearNotations ?? (() => {}))}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.clearNotations')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.2rem 0.4rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: 'transparent',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ✕ Temizle
          </button>

          {onAutoSolfege && (
            <button
              type="button"
              data-testid="btn-auto-solfege"
              onClick={handleButtonClick(onAutoSolfege)}
              onMouseDown={(e) => e.preventDefault()}
              title="Notanın perdesine göre Türkçe solfej hecesi ekler"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.2rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #bbf7d0',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ♪ {t('toolbar.autoSolfege')}
            </button>
          )}
        </div>
      </div>

      {/* Right section: Zoom, NoteNameStyle, Language */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <label htmlFor="zoom-select" style={{ fontSize: '0.825rem', color: '#64748b' }}>
            {t('toolbar.zoom')}:
          </label>
          <select
            id="zoom-select"
            value={zoom}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              e.target.blur();
              setZoom(val);
            }}
            style={{
              padding: '0.35rem 0.6rem',
              fontSize: '0.825rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value={0.75}>75%</option>
            <option value={1.0}>100%</option>
            <option value={1.5}>150%</option>
            <option value={2.0}>200%</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <label htmlFor="notename-select" style={{ fontSize: '0.825rem', color: '#64748b' }}>
            {t('toolbar.noteNameStyle')}:
          </label>
          <select
            id="notename-select"
            value={noteNameStyle}
            onChange={(e) => {
              const val = e.target.value as NoteNameStyle;
              e.target.blur();
              setNoteNameStyle(val);
            }}
            style={{
              padding: '0.35rem 0.6rem',
              fontSize: '0.825rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value="solfege">{t('toolbar.styleSolfege')}</option>
            <option value="letter">{t('toolbar.styleLetter')}</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <label htmlFor="language-select" style={{ fontSize: '0.825rem', color: '#64748b' }}>
            {t('toolbar.language')}:
          </label>
          <select
            id="language-select"
            value={language}
            onChange={(e) => {
              const val = e.target.value as Language;
              e.target.blur();
              setLanguage(val);
            }}
            style={{
              padding: '0.35rem 0.6rem',
              fontSize: '0.825rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value="tr">{t('toolbar.langTr')}</option>
            <option value="en">{t('toolbar.langEn')}</option>
          </select>
        </div>
      </div>
    </header>
  );
};
