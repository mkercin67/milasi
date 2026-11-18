// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { useI18n } from '../../i18n';

export interface TempoModalProps {
  isOpen: boolean;
  onClose: () => void;
  tempoBpmInput: number;
  setTempoBpmInput: (val: number) => void;
  tempoBeatUnitInput: number;
  setTempoBeatUnitInput: (val: number) => void;
  tempoTextInput: string;
  setTempoTextInput: (val: string) => void;
  onApply: () => void;
}

export const TempoModal: React.FC<TempoModalProps> = ({
  isOpen,
  onClose,
  tempoBpmInput,
  setTempoBpmInput,
  tempoBeatUnitInput,
  setTempoBeatUnitInput,
  tempoTextInput,
  setTempoTextInput,
  onApply,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="modal-tempo"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '1.5rem',
          width: '380px',
          maxWidth: '90vw',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.tempo.title')}</h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label htmlFor="tempo-bpm-input" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
              {t('dialog.tempo.bpm')} (20..300)
            </label>
            <input
              id="tempo-bpm-input"
              type="number"
              min={20}
              max={300}
              value={tempoBpmInput}
              onChange={(e) => setTempoBpmInput(parseInt(e.target.value, 10) || 120)}
              style={{
                padding: '0.45rem 0.65rem',
                fontSize: '0.9rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label htmlFor="tempo-unit-select" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
              {t('dialog.tempo.beatUnit')}
            </label>
            <select
              id="tempo-unit-select"
              value={tempoBeatUnitInput}
              onChange={(e) => setTempoBeatUnitInput(parseFloat(e.target.value))}
              style={{
                padding: '0.45rem 0.65rem',
                fontSize: '0.9rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="1">♩ Dörtlük (1.0)</option>
              <option value="1.5">♩. Noktalı Dörtlük (1.5)</option>
              <option value="0.5">♪ Sekizlik (0.5)</option>
              <option value="2">𝅗 İkilik (2.0)</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label htmlFor="tempo-prefix-input" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {t('dialog.tempo.prefix')}
          </label>
          <input
            id="tempo-prefix-input"
            type="text"
            placeholder="Örn: Allegro, Andante, Moderato"
            value={tempoTextInput}
            onChange={(e) => setTempoTextInput(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              fontSize: '0.9rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.875rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            {t('dialog.cancel')}
          </button>
          <button
            type="button"
            data-testid="btn-apply-tempo"
            onClick={onApply}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            {t('dialog.tempo.apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
