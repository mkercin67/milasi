// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { ArticulationType, DynamicType } from '../../core/model';
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
  onClearNotations?: () => void;
  onAutoSolfege?: () => void;
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

export const ToolbarNotations: React.FC<ToolbarNotationsProps> = ({
  activeDynamic = null,
  onSelectDynamic,
  activeArticulations = [],
  onToggleArticulation,
  hasTie = false,
  onToggleTie,
  hasSlur = false,
  onToggleSlur,
  onClearNotations,
  onAutoSolfege,
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
  );
};
