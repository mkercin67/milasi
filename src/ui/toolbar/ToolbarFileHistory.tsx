// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { useI18n } from '../i18n';
import { EditorMode } from '../keymap';

export interface ToolbarFileHistoryProps {
  onOpenNewScore: () => void;
  onOpen?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onOpenScoreInfo?: () => void;
  onOpenClef?: () => void;
  onOpenParts?: () => void;
  onOpenKeySig?: () => void;
  onOpenTimeSig?: () => void;
  onOpenTempo?: () => void;
  onOpenBarline?: () => void;
  isRepeatStart?: boolean;
  onToggleRepeatStart?: () => void;
  isRepeatEnd?: boolean;
  onToggleRepeatEnd?: () => void;
  onInsertMeasure?: () => void;
  onDeleteMeasure?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  mode: EditorMode;
  canResetOverride?: boolean;
  onResetOverride?: () => void;
  canResetAllOverrides?: boolean;
  onResetAllOverrides?: () => void;
  handleButtonClick: (cb: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const ToolbarFileHistory: React.FC<ToolbarFileHistoryProps> = ({
  onOpenNewScore,
  onOpen,
  onSave,
  onSaveAs,
  onOpenScoreInfo,
  onOpenClef,
  onOpenParts,
  onOpenKeySig,
  onOpenTimeSig,
  onOpenTempo,
  onOpenBarline,
  isRepeatStart = false,
  onToggleRepeatStart,
  isRepeatEnd = false,
  onToggleRepeatEnd,
  onInsertMeasure,
  onDeleteMeasure,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  mode,
  canResetOverride = false,
  onResetOverride,
  canResetAllOverrides = false,
  onResetAllOverrides,
  handleButtonClick,
}) => {
  const { t } = useI18n();

  return (
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
        MiLaSi
      </h1>

      <button
        type="button"
        data-testid="btn-new-score"
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
          title={`${t('toolbar.saveAs')} (Ctrl+Shift+S)`}
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
          ℹ {t('toolbar.scoreInfo')}
        </button>
      )}

      {/* Structure Controls */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        {onOpenParts && (
          <button
            type="button"
            data-testid="btn-open-parts"
            onClick={handleButtonClick(onOpenParts)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.parts')}
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
            🎻 {t('toolbar.parts')}
          </button>
        )}
        {onOpenClef && (
          <button
            type="button"
            data-testid="btn-open-clef"
            onClick={handleButtonClick(onOpenClef)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.clef')}
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
            𝄞 {t('toolbar.clef')}
          </button>
        )}
        {onOpenKeySig && (
          <button
            type="button"
            data-testid="btn-open-keysig"
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
            data-testid="btn-open-timesig"
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
            data-testid="btn-open-tempo"
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
            ♩ {t('toolbar.tempo')}
          </button>
        )}

        {onOpenBarline && (
          <button
            type="button"
            data-testid="btn-open-barline"
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
            𝄀 {t('toolbar.barline')}
          </button>
        )}

        {onToggleRepeatStart && (
          <button
            type="button"
            data-testid="btn-repeat-start"
            aria-pressed={isRepeatStart}
            onClick={handleButtonClick(onToggleRepeatStart)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.repeatStart')}
            style={{
              padding: '0.4rem 0.6rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: isRepeatStart ? '#1d4ed8' : '#334155',
              backgroundColor: isRepeatStart ? '#dbeafe' : '#f1f5f9',
              border: isRepeatStart ? '1px solid #93c5fd' : '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            |: {t('toolbar.repeatStart')}
          </button>
        )}

        {onToggleRepeatEnd && (
          <button
            type="button"
            data-testid="btn-repeat-end"
            aria-pressed={isRepeatEnd}
            onClick={handleButtonClick(onToggleRepeatEnd)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.repeatEnd')}
            style={{
              padding: '0.4rem 0.6rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: isRepeatEnd ? '#1d4ed8' : '#334155',
              backgroundColor: isRepeatEnd ? '#dbeafe' : '#f1f5f9',
              border: isRepeatEnd ? '1px solid #93c5fd' : '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            :| {t('toolbar.repeatEnd')}
          </button>
        )}
      </div>

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
  );
};
