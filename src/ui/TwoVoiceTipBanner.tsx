// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useState } from 'react';
import { useI18n } from './i18n';
import { EditorMode } from './keymap';

export const TWO_VOICE_TIP_KEY = 'scoreforge:dismissed_two_voice_tip';

export interface TwoVoiceTipBannerProps {
  mode: EditorMode;
  storage?: Storage | null;
}

export const TwoVoiceTipBanner: React.FC<TwoVoiceTipBannerProps> = ({
  mode,
  storage,
}) => {
  const { t } = useI18n();

  const getEffectiveStorage = (): Storage | null => {
    if (storage !== undefined) return storage;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch {
      return null;
    }
    return null;
  };

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      const s = getEffectiveStorage();
      if (!s) return false;
      return s.getItem(TWO_VOICE_TIP_KEY) === 'true';
    } catch {
      return false;
    }
  });

  if (mode !== 'input' || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      const s = getEffectiveStorage();
      s?.setItem(TWO_VOICE_TIP_KEY, 'true');
    } catch {
      // Safe fallback when storage is restricted
    }
  };

  return (
    <div
      role="region"
      aria-label="Note input tip"
      data-testid="two-voice-tip-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.45rem 1.25rem',
        backgroundColor: '#eff6ff',
        borderBottom: '1px solid #bfdbfe',
        color: '#1e40af',
        fontSize: '0.825rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1rem' }}>💡</span>
        <span style={{ fontWeight: 500 }}>{t('tip.twoVoice')}</span>
      </div>
      <button
        type="button"
        data-testid="btn-dismiss-tip"
        onClick={handleDismiss}
        style={{
          backgroundColor: '#dbeafe',
          color: '#1d4ed8',
          border: '1px solid #93c5fd',
          borderRadius: '4px',
          padding: '0.2rem 0.6rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {t('tip.dismiss')}
      </button>
    </div>
  );
};
