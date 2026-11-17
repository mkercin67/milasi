import React from 'react';
import { BarlineType, Score } from '../../../core/model';
import { SelectedEventInfo } from '../types';
import { useI18n } from '../../i18n';

export interface BarlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  barlineInput: BarlineType;
  setBarlineInput: (val: BarlineType) => void;
  isRepeatStartInput: boolean;
  setIsRepeatStartInput: (val: boolean) => void;
  isRepeatEndInput: boolean;
  setIsRepeatEndInput: (val: boolean) => void;
  isPickupBarline: boolean;
  setIsPickupBarline: (val: boolean) => void;
  pickupTicksInput: number;
  setPickupTicksInput: (val: number) => void;
  selectedEventInfo: SelectedEventInfo | null;
  score: Score;
  onApply: () => void;
}

export const BarlineModal: React.FC<BarlineModalProps> = ({
  isOpen,
  onClose,
  barlineInput,
  setBarlineInput,
  isRepeatStartInput,
  setIsRepeatStartInput,
  isRepeatEndInput,
  setIsRepeatEndInput,
  isPickupBarline,
  setIsPickupBarline,
  pickupTicksInput,
  setPickupTicksInput,
  selectedEventInfo,
  score,
  onApply,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="modal-barline"
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
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.barline.title')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {t('toolbar.barline')}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="barline-type"
                checked={barlineInput === 'single'}
                onChange={() => setBarlineInput('single')}
              />
              {t('dialog.barline.single')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="barline-type"
                checked={barlineInput === 'double'}
                onChange={() => setBarlineInput('double')}
              />
              {t('dialog.barline.double')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="barline-type"
                checked={barlineInput === 'final'}
                onChange={() => setBarlineInput('final')}
              />
              {t('dialog.barline.final')}
            </label>
          </div>
        </div>

        {/* Repeat options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {t('toolbar.repeatStart')} / {t('toolbar.repeatEnd')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              data-testid="input-barline-repeat-start"
              checked={isRepeatStartInput}
              onChange={(e) => setIsRepeatStartInput(e.target.checked)}
              style={{ accentColor: '#2563eb' }}
            />
            {t('dialog.barline.repeatStart')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              data-testid="input-barline-repeat-end"
              checked={isRepeatEndInput}
              onChange={(e) => setIsRepeatEndInput(e.target.checked)}
              style={{ accentColor: '#2563eb' }}
            />
            {t('dialog.barline.repeatEnd')}
          </label>
        </div>

        {/* Pickup measure option for measure 1 */}
        {(selectedEventInfo?.measureId === score.measures[0]?.id || !selectedEventInfo) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isPickupBarline}
                onChange={(e) => setIsPickupBarline(e.target.checked)}
                style={{ accentColor: '#2563eb' }}
              />
              {t('dialog.newScore.pickup')}
            </label>
            {isPickupBarline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                <label htmlFor="barline-pickup-select" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {t('dialog.newScore.pickupLength')}:
                </label>
                <select
                  id="barline-pickup-select"
                  value={pickupTicksInput}
                  onChange={(e) => setPickupTicksInput(parseInt(e.target.value, 10))}
                  style={{
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                  }}
                >
                  <option value="960">1/4 (960 tick)</option>
                  <option value="480">1/8 (480 tick)</option>
                  <option value="1440">3/8 (1440 tick)</option>
                  <option value="1920">1/2 (1920 tick)</option>
                </select>
              </div>
            )}
          </div>
        )}

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
            data-testid="btn-apply-barline"
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
            {t('dialog.barline.apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
