// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { useI18n } from '../i18n';
import { MixerState, gainFor, isAudible, setMuted, setPartVolume, setSolo } from '../../playback/mixer';

export interface MixerPart {
  id: string;
  name: string;
}

export interface MixerPanelProps {
  parts: MixerPart[];
  mixer: MixerState;
  onMixerChange: (next: MixerState) => void;
  /** Initial open state (tests render the open panel). */
  defaultOpen?: boolean;
}

/** M7c-8: per-part mute, solo and volume. A playback setting; nothing here touches the score. */
export const MixerPanel: React.FC<MixerPanelProps> = ({ parts, mixer, onMixerChange, defaultOpen = false }) => {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(defaultOpen);
  if (parts.length < 2) return null;

  const small: React.CSSProperties = {
    width: '1.7rem',
    padding: '0.1rem 0',
    fontSize: '0.75rem',
    fontWeight: 700,
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
  };

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        data-testid="btn-mixer"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseDown={(e) => e.preventDefault()}
        title={t('mixer.title')}
        style={{
          padding: '0.25rem 0.45rem',
          fontSize: '0.8rem',
          fontWeight: 500,
          backgroundColor: open ? '#e2e8f0' : 'transparent',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        🎚 {t('mixer.title')}
      </button>
      {open && (
        <div
          data-testid="mixer-panel"
          role="group"
          aria-label={t('mixer.title')}
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            zIndex: 20,
            minWidth: '280px',
            padding: '0.5rem',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {parts.map((p) => {
            const muted = mixer.muted.has(p.id);
            const solo = mixer.solo.has(p.id);
            const audible = isAudible(mixer, p.id);
            return (
              <div
                key={p.id}
                data-testid={`mixer-row-${p.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.15rem 0', opacity: audible ? 1 : 0.55 }}
              >
                <span style={{ flex: 1, fontSize: '0.8rem', color: '#1e293b' }}>{p.name}</span>
                <button
                  type="button"
                  data-testid={`mixer-mute-${p.id}`}
                  aria-pressed={muted}
                  title={t('mixer.mute')}
                  onClick={() => onMixerChange(setMuted(mixer, p.id, !muted))}
                  style={{ ...small, backgroundColor: muted ? '#f59e0b' : '#f1f5f9', color: muted ? '#fff' : '#1e293b' }}
                >
                  M
                </button>
                <button
                  type="button"
                  data-testid={`mixer-solo-${p.id}`}
                  aria-pressed={solo}
                  title={t('mixer.solo')}
                  onClick={() => onMixerChange(setSolo(mixer, p.id, !solo))}
                  style={{ ...small, backgroundColor: solo ? '#2563eb' : '#f1f5f9', color: solo ? '#fff' : '#1e293b' }}
                >
                  S
                </button>
                <input
                  type="range"
                  data-testid={`mixer-volume-${p.id}`}
                  min={0}
                  max={100}
                  value={Math.round(gainFor(mixer, p.id) * 100)}
                  title={t('mixer.volume')}
                  onChange={(e) => onMixerChange(setPartVolume(mixer, p.id, parseInt(e.target.value, 10) / 100))}
                  style={{ width: '80px' }}
                />
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
};
