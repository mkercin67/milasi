// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { BaseDurationType } from '../../core/model';
import { useI18n } from '../i18n';
import { EditorMode } from '../keymap';

export interface ToolbarModePaletteProps {
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
  handleButtonClick: (cb: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const MODES: { id: EditorMode; labelKey: string; shortcut: string }[] = [
  { id: 'select', labelKey: 'mode.select', shortcut: 'V' },
  { id: 'input', labelKey: 'mode.input', shortcut: 'N' },
  { id: 'position', labelKey: 'mode.position', shortcut: 'P' },
  { id: 'lyrics', labelKey: 'mode.lyrics', shortcut: 'U' },
];

const DURATIONS: { type: BaseDurationType; label: string; shortcut: string; icon: string }[] = [
  { type: 'whole', label: 'palette.duration.whole', shortcut: '7', icon: '𝅝' },
  { type: 'half', label: 'palette.duration.half', shortcut: '6', icon: '𝅗𝅥' },
  { type: 'quarter', label: 'palette.duration.quarter', shortcut: '5', icon: '𝅘𝅥' },
  { type: 'eighth', label: 'palette.duration.eighth', shortcut: '4', icon: '𝅘𝅥𝅮' },
  { type: '16th', label: 'palette.duration.16th', shortcut: '3', icon: '𝅘𝅥𝅯' },
  { type: '32nd', label: 'palette.duration.32nd', shortcut: '2', icon: '𝅘𝅥𝅰' },
];

export const ToolbarModePalette: React.FC<ToolbarModePaletteProps> = ({
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
  handleButtonClick,
}) => {
  const { t } = useI18n();

  return (
    <>
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

        {/* Triplet toggle (M7c-2b): the next entry makes three notes in the time of two */}
        {onToggleTriplet && (
          <button
            type="button"
            data-testid="btn-triplet"
            aria-pressed={activeTriplet}
            onClick={handleButtonClick(onToggleTriplet)}
            onMouseDown={(e) => e.preventDefault()}
            title={t('palette.triplet')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              fontSize: '1.05rem',
              fontStyle: 'italic',
              lineHeight: 1,
              backgroundColor: activeTriplet ? '#dbeafe' : 'transparent',
              color: activeTriplet ? '#1d4ed8' : '#334155',
              border: activeTriplet ? '1px solid #93c5fd' : '1px solid transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            3
          </button>
        )}

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
    </>
  );
};
