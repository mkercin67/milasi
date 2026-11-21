// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { useI18n } from '../../i18n';

export interface TimeSigModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeSigStrInput: string;
  setTimeSigStrInput: (val: string) => void;
  timeSigScope: 'from-here' | 'score';
  setTimeSigScope: (val: 'from-here' | 'score') => void;
  onApply: () => void;
}

export const TimeSigModal: React.FC<TimeSigModalProps> = ({
  isOpen,
  onClose,
  timeSigStrInput,
  setTimeSigStrInput,
  timeSigScope,
  setTimeSigScope,
  onApply,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="modal-timesig"
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
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.timeSig.title')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label htmlFor="timesig-dialog-select" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {t('notation.timeSignature')}
          </label>
          <select
            id="timesig-dialog-select"
            value={['2/4', '3/4', '4/4', '4/4c', '6/8', '2/2', '2/2c', '3/8', '5/4', '7/8'].includes(timeSigStrInput) ? timeSigStrInput : 'custom'}
            onChange={(e) => {
              if (e.target.value !== 'custom') {
                setTimeSigStrInput(e.target.value);
              }
            }}
            style={{
              padding: '0.45rem 0.65rem',
              fontSize: '0.9rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              backgroundColor: '#ffffff',
            }}
          >
            <option value="4/4">4/4</option>
            <option value="4/4c">{t('dialog.timeSig.common')}</option>
            <option value="3/4">3/4</option>
            <option value="2/4">2/4</option>
            <option value="6/8">6/8</option>
            <option value="2/2">2/2</option>
            <option value="2/2c">{t('dialog.timeSig.cut')}</option>
            <option value="3/8">3/8</option>
            <option value="5/4">5/4</option>
            <option value="7/8">7/8</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>Kapsam</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="timesig-scope"
                checked={timeSigScope === 'from-here'}
                onChange={() => setTimeSigScope('from-here')}
              />
              {t('dialog.timeSig.scopeFromHere')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="timesig-scope"
                checked={timeSigScope === 'score'}
                onChange={() => setTimeSigScope('score')}
              />
              {t('dialog.timeSig.scopeScore')}
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
            data-testid="btn-apply-timesig"
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
            {t('dialog.timeSig.apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
