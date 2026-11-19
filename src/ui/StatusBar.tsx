// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Status bar presenting the active editor mode, details of the currently selected event,
 * temporary error messages, drag offset/pitch feedback, and context shortcuts.
 */

import React from 'react';
import { BaseDurationType, Pitch } from '../core/model';
import { formatPitchName, useI18n } from './i18n';
import { EditorMode } from './keymap';
import { SelectedEventInfo } from './useEditor';

export interface HoverInfo {
  pitch: Pitch;
  measureNumber: number;
}

export interface StatusBarProps {
  selection: SelectedEventInfo | null;
  rangeInfo?: { count: number; startMeasureNumber: number; endMeasureNumber: number } | null;
  mode?: EditorMode;
  activeDuration?: BaseDurationType;
  currentMeasureNumber?: number;
  rejectedMessage?: string | null;
  hasOverride?: boolean;
  override?: { dx?: number; dy?: number };
  hoverPitch?: Pitch | null;
  hoverInfo?: HoverInfo | null;
  dragStatus?: string | null;
}

const MODE_COLORS: Record<EditorMode, { bg: string; fg: string; border: string }> = {
  select: { bg: '#e2e8f0', fg: '#1e293b', border: '#cbd5e1' },
  input: { bg: '#dbeafe', fg: '#1d4ed8', border: '#93c5fd' },
  position: { bg: '#ccfbf1', fg: '#0f766e', border: '#5eead4' },
  lyrics: { bg: '#fef3c7', fg: '#b45309', border: '#fcd34d' },
};

export const StatusBar: React.FC<StatusBarProps> = ({
  selection,
  rangeInfo = null,
  mode = 'select',
  activeDuration = 'quarter',
  currentMeasureNumber = 1,
  rejectedMessage = null,
  hasOverride = false,
  override,
  hoverPitch = null,
  hoverInfo = null,
  dragStatus = null,
}) => {
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __componentRenders?: Record<string, number> };
    if (!w.__componentRenders) w.__componentRenders = {};
    w.__componentRenders.StatusBar = (w.__componentRenders.StatusBar || 0) + 1;
  }
  const { t, language, noteNameStyle } = useI18n();

  const renderStatusContent = () => {
    if (rejectedMessage) {
      return (
        <span style={{ color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>⚠</span>
          <span>{rejectedMessage}</span>
        </span>
      );
    }

    if (dragStatus) {
      return (
        <span style={{ color: '#2563eb', fontWeight: 600 }}>
          {dragStatus}
        </span>
      );
    }

    if (mode === 'input') {
      const durationText = t(`duration.${activeDuration}.note`);
      let pointerText = '';
      if (hoverInfo) {
        pointerText = ` · ${t('status.pointerInfo', {
          measure: hoverInfo.measureNumber,
          pitch: formatPitchName(hoverInfo.pitch, noteNameStyle, language),
        })}`;
      } else if (hoverPitch) {
        pointerText = ` · ${formatPitchName(hoverPitch, noteNameStyle, language)}`;
      }

      return (
        <span style={{ color: '#1d4ed8', fontWeight: 600 }}>
          {t('status.inputMode', {
            duration: durationText,
            measure: currentMeasureNumber,
          })}
          {pointerText}
        </span>
      );
    }

    if (rangeInfo) {
      const measureText =
        rangeInfo.startMeasureNumber === rangeInfo.endMeasureNumber
          ? t('status.measureLabel', { num: rangeInfo.startMeasureNumber })
          : t('status.measureRangeLabel', { start: rangeInfo.startMeasureNumber, end: rangeInfo.endMeasureNumber });
      return (
        <span data-testid="status-range-info" style={{ color: '#1d4ed8', fontWeight: 600 }}>
          {t('status.rangeSelected', { count: rangeInfo.count, measures: measureText })}
        </span>
      );
    }

    if (!selection) {
      return (
        <span style={{ color: '#64748b', fontStyle: 'italic' }}>
          {t('status.noSelection')}
        </span>
      );
    }

    const { measureNumber, isChord, isNote, isRest, pitches, baseType } = selection;
    const durationKey = isRest ? `duration.${baseType}.rest` : `duration.${baseType}.note`;
    const durationText = t(durationKey);

    const notationBadges: string[] = [];
    if (selection.dynamic) notationBadges.push(selection.dynamic);
    if (selection.articulations && selection.articulations.length > 0) {
      notationBadges.push(...selection.articulations);
    }
    if (selection.pitches.some((p) => p.tiedToNext)) {
      notationBadges.push(t('status.tie'));
    }
    if (selection.hasSlur) {
      notationBadges.push(t('status.slur'));
    }
    const notationText = notationBadges.length > 0 ? ` · ${notationBadges.join(' · ')}` : '';

    const overrideBadge = (hasOverride || override) ? (
      <span
        style={{
          marginLeft: '0.6rem',
          padding: '0.1rem 0.45rem',
          fontSize: '0.75rem',
          backgroundColor: '#e0e7ff',
          color: '#3730a3',
          borderRadius: '4px',
          fontWeight: 600,
          fontFamily: 'monospace',
        }}
      >
        {override
          ? `dx ${(override.dx ?? 0).toFixed(2)} · dy ${(override.dy ?? 0).toFixed(2)}`
          : t('status.manuallyPositioned')}
      </span>
    ) : null;

    if (isChord) {
      const pitchesText = pitches
        .map((p) => formatPitchName(p, noteNameStyle, language))
        .join(', ');
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span>
            {t('status.chordInfo', {
              measure: measureNumber,
              pitches: pitchesText,
              duration: durationText,
            })}
            {notationText}
          </span>
          {overrideBadge}
        </span>
      );
    }

    if (isNote && pitches.length > 0) {
      const pitchText = formatPitchName(pitches[0], noteNameStyle, language);
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span>
            {t('status.noteInfo', {
              measure: measureNumber,
              pitch: pitchText,
              duration: durationText,
            })}
            {notationText}
          </span>
          {overrideBadge}
        </span>
      );
    }

    if (isRest) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span>
            {t('status.restInfo', {
              measure: measureNumber,
              duration: durationText,
            })}
          </span>
          {overrideBadge}
        </span>
      );
    }

    return null;
  };

  const badgeColors = MODE_COLORS[mode];

  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.45rem 1.25rem',
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.875rem',
        color: '#334155',
        minHeight: '2.4rem',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span
          data-status-mode={mode}
          style={{
            padding: '0.12rem 0.55rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            backgroundColor: badgeColors.bg,
            color: badgeColors.fg,
            border: `1px solid ${badgeColors.border}`,
            borderRadius: '4px',
          }}
        >
          {t(`mode.${mode}`)}
        </span>
        {renderStatusContent()}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64748b', fontSize: '0.775rem' }}>
        {mode === 'position' ? (
          <>
            <span>{t('shortcut.positionArrows')}</span>
            <span>•</span>
            <span>{t('shortcut.positionTab')}</span>
            <span>•</span>
            <span>{t('shortcut.positionReset')}</span>
          </>
        ) : (
          <>
            <span>{t('shortcut.transpose')}</span>
            <span>•</span>
            <span>{t('shortcut.delete')}</span>
            <span>•</span>
            <span>{t('shortcut.navigate')}</span>
          </>
        )}
      </div>
    </footer>
  );
};
