// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { CLEF_PRESETS } from '../../../core/clef';
import { useI18n } from '../../i18n';

export interface ClefModalProps {
  isOpen: boolean;
  onClose: () => void;
  clefInput: string;
  setClefInput: (val: string) => void;
  onApply: () => void;
}

export const ClefModal: React.FC<ClefModalProps> = ({ isOpen, onClose, clefInput, setClefInput, onApply }) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="modal-clef"
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
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.clef.title')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label htmlFor="clef-dialog-select" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {t('dialog.clef.label')}
          </label>
          <select
            id="clef-dialog-select"
            data-testid="select-clef"
            value={clefInput}
            onChange={(e) => setClefInput(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              fontSize: '0.9rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              backgroundColor: '#ffffff',
            }}
          >
            {CLEF_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {t(`dialog.clef.preset.${p.id}`)}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{t('dialog.clef.hint')}</span>
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
            data-testid="btn-apply-clef"
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
            {t('dialog.clef.apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
