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

export interface SessionRestoreConfirmProps {
  isOpen: boolean;
  restoreData: { score: Score; savedAt: number } | null;
  onDiscard: () => void;
  onRestore: () => void;
}

export const SessionRestoreConfirm: React.FC<SessionRestoreConfirmProps> = ({
  isOpen,
  restoreData,
  onDiscard,
  onRestore,
}) => {
  const { t } = useI18n();
  if (!isOpen || !restoreData) return null;

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
          width: '420px',
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
        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.825rem', color: '#64748b' }}>
          {restoreData.score.meta.title || 'Adsız Eser'} —{' '}
          {new Date(restoreData.savedAt).toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
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
