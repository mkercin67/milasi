// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { ArticulationType, DynamicType, HairpinType, PhraseMark } from '../../core/model';
import { useI18n } from '../i18n';

export interface ToolbarNotationsProps {
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
  onTogglePhraseMark?: (mark: PhraseMark) => void;
  onClearNotations?: () => void;
  showNoteNames?: boolean;
  onToggleNoteNames?: () => void;
  onClearLyrics?: () => void;
  handleButtonClick: (cb: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => void;
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

const MARK_BUTTON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.2rem 0.5rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  backgroundColor: 'transparent',
  color: '#334155',
  border: '1px solid transparent',
  borderRadius: '4px',
  cursor: 'pointer',
};

export const ToolbarNotations: React.FC<ToolbarNotationsProps> = ({
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
  onTogglePhraseMark,
  onClearNotations,
  showNoteNames = false,
  onToggleNoteNames,
  onClearLyrics,
  handleButtonClick,
}) => {
  const { t } = useI18n();

  return (
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

      {/* Crescendo / diminuendo hairpins (M7c-2c) */}
      {onToggleHairpin && (
        <>
          <button
            type="button"
            data-testid="btn-crescendo"
            onClick={handleButtonClick(() => onToggleHairpin('crescendo'))}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.crescendoTitle')}
            style={MARK_BUTTON_STYLE}
          >
            &lt; {t('toolbar.crescendo')}
          </button>
          <button
            type="button"
            data-testid="btn-diminuendo"
            onClick={handleButtonClick(() => onToggleHairpin('diminuendo'))}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.diminuendoTitle')}
            style={MARK_BUTTON_STYLE}
          >
            &gt; {t('toolbar.diminuendo')}
          </button>
        </>
      )}

      {/* Fermata, breath mark and caesura (M7c-2) */}
      {onCycleFermata && (
        <button
          type="button"
          data-testid="btn-fermata"
          onClick={handleButtonClick(onCycleFermata)}
          onMouseDown={(e) => e.preventDefault()}
          title={t('toolbar.fermataTitle')}
          style={MARK_BUTTON_STYLE}
        >
          𝄐 {t('toolbar.fermata')}
        </button>
      )}
      {onTogglePhraseMark && (
        <>
          <button
            type="button"
            data-testid="btn-breath-mark"
            onClick={handleButtonClick(() => onTogglePhraseMark('breath'))}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.breathTitle')}
            style={MARK_BUTTON_STYLE}
          >
            ’ {t('toolbar.breath')}
          </button>
          <button
            type="button"
            data-testid="btn-caesura"
            onClick={handleButtonClick(() => onTogglePhraseMark('caesura'))}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.caesuraTitle')}
            style={MARK_BUTTON_STYLE}
          >
            ‖ {t('toolbar.caesura')}
          </button>
        </>
      )}

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
        ✕ {t('toolbar.clearNotationsShort')}
      </button>

      {onToggleNoteNames && (
        <button
          type="button"
          data-testid="btn-note-names"
          aria-pressed={showNoteNames}
          onClick={handleButtonClick(onToggleNoteNames)}
          onMouseDown={(e) => e.preventDefault()}
          title={t('toolbar.noteNamesTitle')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.2rem 0.5rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: showNoteNames ? '#bbf7d0' : '#f0fdf4',
            color: '#15803d',
            border: showNoteNames ? '1px solid #15803d' : '1px solid #bbf7d0',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ♪ {t('toolbar.noteNames')}
        </button>
      )}

      {onClearLyrics && (
        <button
          type="button"
          data-testid="btn-clear-lyrics"
          onClick={handleButtonClick(onClearLyrics)}
          onMouseDown={(e) => e.preventDefault()}
          title={t('toolbar.clearLyricsTitle')}
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
          ✕ {t('toolbar.clearLyrics')}
        </button>
      )}
    </div>
  );
};
