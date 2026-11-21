// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Status bar presenting the active editor mode, details of the currently selected event,
 * temporary error messages, drag offset/pitch feedback, and context shortcuts.
 */

import React from 'react';
import { BaseDurationType, Pitch } from '../core/model';
import { PPQ } from '../core/time';
import { formatPitchName, useI18n } from './i18n';
import { EditorMode } from './keymap';
import { SelectedEventInfo } from './useEditor';
import { VOICE_COLORS } from './voiceColors';

export interface HoverInfo {
  pitch: Pitch;
  measureNumber: number;
}

export function computeBeatPosition(
  currentTick: number,
  timeSig?: { num: number; den: number }
): string {
  const ts = timeSig ?? { num: 4, den: 4 };
  let beatVal: number;

  // Compound meters count dotted-quarter pulses (1440 ticks per pulse)
  if ((ts.num === 6 || ts.num === 9 || ts.num === 12) && ts.den === 8) {
    beatVal = 1 + currentTick / 1440;
  } else {
    const ticksPerBeat = (4 / ts.den) * PPQ;
    beatVal = 1 + currentTick / ticksPerBeat;
  }

  // Format integer cleanly or decimal with up to 2 decimal places
  if (Math.abs(beatVal - Math.round(beatVal)) < 0.001) {
    return String(Math.round(beatVal));
  }
  return String(parseFloat(beatVal.toFixed(2)));
}

export interface StatusBarProps {
  selection: SelectedEventInfo | null;
  rangeInfo?: { count: number; startMeasureNumber: number; endMeasureNumber: number } | null;
  mode?: EditorMode;
  activeDuration?: BaseDurationType;
  currentMeasureNumber?: number;
  currentTick?: number;
  timeSig?: { num: number; den: number };
  rejectedMessage?: string | null;
  hasOverride?: boolean;
  override?: { dx?: number; dy?: number };
  hoverPitch?: Pitch | null;
  hoverInfo?: HoverInfo | null;
  dragStatus?: string | null;
  errorCount?: number;
  warningCount?: number;
  voiceIndex?: 1 | 2 | 3 | 4;
  /** Position of the cursor's staff inside its part; shown only when the part has several staves. */
  staffInfo?: { index: number; total: number } | null;
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
  currentTick = 0,
  timeSig,
  rejectedMessage = null,
  hasOverride = false,
  override,
  hoverPitch = null,
  hoverInfo = null,
  dragStatus = null,
  errorCount,
  warningCount,
  voiceIndex = 1,
  staffInfo = null,
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
      const beatText = computeBeatPosition(currentTick, timeSig);
      const voiceText = t('status.voice', { num: voiceIndex });
      const voiceColor = VOICE_COLORS[voiceIndex] ?? '#1e293b';

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
        <span style={{ color: '#1d4ed8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>
            {t('status.inputMode', {
              duration: durationText,
              measure: currentMeasureNumber,
              beat: beatText,
            })}
          </span>
          <span>·</span>
          <span
            data-testid="status-voice-indicator"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <span
              data-testid="status-voice-chip"
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: voiceColor,
                border: '1px solid rgba(0,0,0,0.15)',
              }}
            />
            <span>{voiceText}</span>
          </span>
          {staffInfo && staffInfo.total > 1 && (
            <>
              <span>·</span>
              <span data-testid="status-staff-indicator">
                {t('status.staff', { num: staffInfo.index, total: staffInfo.total })}
              </span>
            </>
          )}
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

  const hintKeys: string[] =
    mode === 'input'
      ? [
          'shortcut.inputVoice',
          ...(staffInfo && staffInfo.total > 1 ? ['shortcut.inputStaff'] : []),
          'shortcut.inputHome',
          'shortcut.inputArrows',
          'shortcut.inputScore',
        ]
      : mode === 'position'
        ? ['shortcut.positionArrows', 'shortcut.positionTab', 'shortcut.positionReset']
        : ['shortcut.transpose', 'shortcut.delete', 'shortcut.navigate'];

  const badgeColors = MODE_COLORS[mode];

  return (
    <footer
      data-testid="status-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        columnGap: '1rem',
        rowGap: '0.2rem',
        padding: '0.45rem 1.25rem',
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.875rem',
        color: '#334155',
        minHeight: '2.4rem',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.2rem 0.75rem' }}>
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
        {errorCount !== undefined && errorCount > 0 && (
          <span
            data-testid="status-error-count"
            style={{
              padding: '0.12rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fca5a5',
              borderRadius: '4px',
            }}
          >
            {t('status.errors', { count: errorCount })}
          </span>
        )}
        {warningCount !== undefined && warningCount > 0 && (
          <span
            data-testid="status-warning-count"
            style={{
              padding: '0.12rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: '#fef3c7',
              color: '#b45309',
              border: '1px solid #fcd34d',
              borderRadius: '4px',
            }}
          >
            {t('status.warnings', { count: warningCount })}
          </span>
        )}
        <span style={{ whiteSpace: 'nowrap' }}>{renderStatusContent()}</span>
      </div>

      <div
        data-testid="status-shortcut-hints"
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          marginLeft: 'auto',
          gap: '0.2rem 1rem',
          color: '#64748b',
          fontSize: '0.775rem',
        }}
      >
        {hintKeys.map((key) => (
          // Each hint stays in one piece; the bar wraps between hints, never inside one.
          <span key={key} style={{ whiteSpace: 'nowrap' }}>
            {t(key)}
          </span>
        ))}
      </div>
    </footer>
  );
};
