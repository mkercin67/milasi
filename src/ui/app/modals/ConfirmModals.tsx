import React from 'react';
import { Score } from '../../../core/model';
import { useI18n } from '../../i18n';

export interface DeleteMeasureConfirmProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteMeasureConfirm: React.FC<DeleteMeasureConfirmProps> = ({
  isOpen,
  onCancel,
  onConfirm,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="modal-delete-measure-confirm"
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
          width: '400px',
          maxWidth: '90vw',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', color: '#0f172a' }}>
          {t('dialog.deleteMeasure.title')}
        </h3>
        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
          {t('dialog.deleteMeasure.prompt')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button
            type="button"
            data-action="cancel-delete-measure"
            onClick={onCancel}
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
            data-action="confirm-delete-measure"
            onClick={onConfirm}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            {t('dialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export interface ResetAllConfirmProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ResetAllConfirm: React.FC<ResetAllConfirmProps> = ({
  isOpen,
  onCancel,
  onConfirm,
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
        zIndex: 60,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          padding: '1.5rem',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', color: '#0f172a' }}>
          {t('toolbar.resetAllPositions')}
        </h3>
        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.9rem', color: '#475569' }}>
          {t('dialog.confirmResetAll')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={onCancel}
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
            onClick={onConfirm}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            {t('dialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export interface UnsavedConfirmProps {
  isOpen: boolean;
  onCancel: () => void;
  onProceed: () => void;
}

export const UnsavedConfirm: React.FC<UnsavedConfirmProps> = ({
  isOpen,
  onCancel,
  onProceed,
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
          width: '400px',
          maxWidth: '90vw',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', color: '#0f172a' }}>
          {t('dialog.unsavedChanges.title')}
        </h3>
        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
          {t('dialog.unsavedChanges.prompt')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button
            type="button"
            data-action="cancel-unsaved"
            onClick={onCancel}
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
            onClick={onProceed}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            {t('dialog.unsavedChanges.discardAndProceed')}
          </button>
        </div>
      </div>
    </div>
  );
};

import { AutosaveRecord } from '../../../io/storage';

export interface SessionRestoreConfirmProps {
  isOpen: boolean;
  restoreData: { score: Score; savedAt: number } | null;
  historyVersions?: AutosaveRecord[];
  onSelectVersion?: (record: AutosaveRecord) => void;
  onDiscard: () => void;
  onRestore: () => void;
}

export const SessionRestoreConfirm: React.FC<SessionRestoreConfirmProps> = ({
  isOpen,
  restoreData,
  historyVersions,
  onSelectVersion,
  onDiscard,
  onRestore,
}) => {
  const { t } = useI18n();
  if (!isOpen || !restoreData) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="modal-session-restore"
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
          width: '460px',
          maxWidth: '90vw',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', color: '#0f172a' }}>
          {t('dialog.restore.title')}
        </h3>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
          {t('dialog.restore.prompt')}
        </p>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.825rem', color: '#64748b' }}>
          {restoreData.score.meta.title || 'Adsız Eser'} —{' '}
          {new Date(restoreData.savedAt).toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>

        {historyVersions && historyVersions.length > 1 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#334155' }}>
              Kaydedilen Son Versiyonlar ({historyVersions.length}):
            </h4>
            <div
              style={{
                maxHeight: '140px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '4px',
              }}
            >
              {historyVersions.map((v, idx) => (
                <div
                  key={`${v.savedAt}-${idx}`}
                  data-testid={`restore-history-item-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    backgroundColor: idx === 0 ? '#f0fdf4' : '#ffffff',
                    borderBottom: idx < historyVersions.length - 1 ? '1px solid #f1f5f9' : 'none',
                    fontSize: '0.825rem',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>
                      {v.score.meta.title || 'Adsız'}
                    </span>{' '}
                    <span style={{ color: '#64748b' }}>
                      ({v.score.measures.length} ölçü)
                    </span>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      {new Date(v.savedAt).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                  </div>
                  {onSelectVersion && (
                    <button
                      type="button"
                      data-testid={`btn-select-version-${idx}`}
                      onClick={() => onSelectVersion(v)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        border: '1px solid #bae6fd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Seç
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button
            type="button"
            data-action="restore-discard"
            onClick={onDiscard}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.875rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#dc2626',
              cursor: 'pointer',
            }}
          >
            {t('dialog.restore.discard')}
          </button>
          <button
            type="button"
            data-action="restore-confirm"
            onClick={onRestore}
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
            {t('dialog.restore.restore')}
          </button>
        </div>
      </div>
    </div>
  );
};
