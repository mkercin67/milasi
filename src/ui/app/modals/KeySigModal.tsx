// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { useI18n } from '../../i18n';

export interface KeySigModalProps {
  isOpen: boolean;
  onClose: () => void;
  keySigInput: number;
  setKeySigInput: (val: number) => void;
  keySigScope: 'from-here' | 'score';
  setKeySigScope: (val: 'from-here' | 'score') => void;
  onApply: () => void;
}

export const KeySigModal: React.FC<KeySigModalProps> = ({
  isOpen,
  onClose,
  keySigInput,
  setKeySigInput,
  keySigScope,
  setKeySigScope,
  onApply,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="modal-keysig"
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
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.keySig.title')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label htmlFor="keysig-dialog-select" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {t('notation.keySignature')}
          </label>
          <select
            id="keysig-dialog-select"
            value={keySigInput}
            onChange={(e) => setKeySigInput(parseInt(e.target.value, 10))}
            style={{
              padding: '0.45rem 0.65rem',
              fontSize: '0.9rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              backgroundColor: '#ffffff',
            }}
          >
            <option value="-7">Do♭ Majör / La♭ Minör (7♭)</option>
            <option value="-6">Sol♭ Majör / Mi♭ Minör (6♭)</option>
            <option value="-5">Re♭ Majör / Si♭ Minör (5♭)</option>
            <option value="-4">La♭ Majör / Fa Minör (4♭)</option>
            <option value="-3">Mi♭ Majör / Do Minör (3♭)</option>
            <option value="-2">Si♭ Majör / Sol Minör (2♭)</option>
            <option value="-1">Fa Majör / Re Minör (1♭)</option>
            <option value="0">Do Majör / La Minör (0)</option>
            <option value="1">Sol Majör / Mi Minör (1♯)</option>
            <option value="2">Re Majör / Si Minör (2♯)</option>
            <option value="3">La Majör / Fa# Minör (3♯)</option>
            <option value="4">Mi Majör / Do# Minör (4♯)</option>
            <option value="5">Si Majör / Sol# Minör (5♯)</option>
            <option value="6">Fa# Majör / Re# Minör (6♯)</option>
            <option value="7">Do# Majör / La# Minör (7♯)</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>Kapsam</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="keysig-scope"
                checked={keySigScope === 'from-here'}
                onChange={() => setKeySigScope('from-here')}
              />
              {t('dialog.keySig.scopeFromHere')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="keysig-scope"
                checked={keySigScope === 'score'}
                onChange={() => setKeySigScope('score')}
              />
              {t('dialog.keySig.scopeScore')}
            </label>
          </div>
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
            data-testid="btn-apply-keysig"
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
            {t('dialog.keySig.apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
