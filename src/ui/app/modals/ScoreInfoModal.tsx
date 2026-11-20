// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import type { BeamGroupingMode } from '../../../core/model';
import { useI18n } from '../../i18n';

export interface ScoreInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  setTitle: (val: string) => void;
  subtitle: string;
  setSubtitle: (val: string) => void;
  composer: string;
  setComposer: (val: string) => void;
  arranger: string;
  setArranger: (val: string) => void;
  beamGrouping: BeamGroupingMode;
  setBeamGrouping: (val: BeamGroupingMode) => void;
  onSave: () => void;
}

export const ScoreInfoModal: React.FC<ScoreInfoModalProps> = ({
  isOpen,
  onClose,
  title,
  setTitle,
  subtitle,
  setSubtitle,
  composer,
  setComposer,
  arranger,
  setArranger,
  beamGrouping,
  setBeamGrouping,
  onSave,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
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
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.scoreInfo.title')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {t('dialog.scoreInfo.scoreTitle')}
          </label>
          <input
            type="text"
            data-testid="input-score-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              fontSize: '0.9rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {t('dialog.scoreInfo.subtitle')}
          </label>
          <input
            type="text"
            data-testid="input-score-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              fontSize: '0.9rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {t('dialog.scoreInfo.composer')}
          </label>
          <input
            type="text"
            data-testid="input-score-composer"
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              fontSize: '0.9rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {t('dialog.scoreInfo.arranger')}
          </label>
          <input
            type="text"
            data-testid="input-score-arranger"
            value={arranger}
            onChange={(e) => setArranger(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              fontSize: '0.9rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {t('dialog.scoreInfo.beamGrouping')}
          </label>
          <select
            data-testid="select-beam-grouping"
            value={beamGrouping}
            onChange={(e) => setBeamGrouping(e.target.value === 'half-bar' ? 'half-bar' : 'beat')}
            style={{
              padding: '0.45rem 0.65rem',
              fontSize: '0.9rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
            }}
          >
            <option value="beat">{t('dialog.scoreInfo.beamGrouping.beat')}</option>
            <option value="half-bar">{t('dialog.scoreInfo.beamGrouping.halfBar')}</option>
          </select>
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
            data-testid="btn-save-score-info"
            onClick={onSave}
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
            {t('dialog.scoreInfo.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
