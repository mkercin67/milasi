import React from 'react';
import { useI18n } from '../i18n';

export interface ToolbarPlaybackProps {
  isPlaying?: boolean;
  isPaused?: boolean;
  onTogglePlay?: () => void;
  onStop?: () => void;
  tempoBpm?: number;
  onChangeTempo?: (bpm: number) => void;
  volume?: number;
  isMuted?: boolean;
  onVolumeChange?: (vol: number) => void;
  onToggleMute?: () => void;
  previewSound?: boolean;
  onTogglePreviewSound?: () => void;
  handleButtonClick: (cb: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const ToolbarPlayback: React.FC<ToolbarPlaybackProps> = ({
  isPlaying = false,
  isPaused = false,
  onTogglePlay,
  onStop,
  tempoBpm = 120,
  onChangeTempo,
  volume = 0.8,
  isMuted = false,
  onVolumeChange,
  onToggleMute,
  previewSound = true,
  onTogglePreviewSound,
  handleButtonClick,
}) => {
  const { t } = useI18n();
  const [localTempo, setLocalTempo] = React.useState<string>(String(tempoBpm));

  React.useEffect(() => {
    setLocalTempo(String(tempoBpm));
  }, [tempoBpm]);

  const handleCommitTempo = (e?: React.FocusEvent<HTMLInputElement>) => {
    const raw = e?.target ? e.target.value : localTempo;
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(20, Math.min(300, parsed));
      setLocalTempo(String(clamped));
      onChangeTempo?.(clamped);
    } else {
      setLocalTempo(String(tempoBpm));
    }
  };

  return (
    <div
      role="group"
      aria-label="Playback"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        backgroundColor: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        padding: '2px 6px',
      }}
    >
      <button
        type="button"
        data-testid="btn-play-pause"
        onClick={handleButtonClick(onTogglePlay ?? (() => {}))}
        onMouseDown={(e) => e.preventDefault()}
        title={`${isPlaying ? t('toolbar.pause') : t('toolbar.play')} (Space)`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.35rem 0.65rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: isPlaying ? '#ffffff' : '#1e293b',
          backgroundColor: isPlaying ? '#16a34a' : '#f1f5f9',
          border: isPlaying ? '1px solid #15803d' : '1px solid #cbd5e1',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        {isPlaying ? `⏸ ${t('toolbar.pause')}` : `▶ ${t('toolbar.play')}`}
      </button>

      <button
        type="button"
        data-testid="btn-stop"
        onClick={handleButtonClick(onStop ?? (() => {}))}
        onMouseDown={(e) => e.preventDefault()}
        disabled={!isPlaying && !isPaused}
        title={`${t('toolbar.stop')} (Esc)`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.35rem 0.55rem',
          fontSize: '0.85rem',
          fontWeight: 500,
          color: isPlaying || isPaused ? '#1e293b' : '#94a3b8',
          backgroundColor: isPlaying || isPaused ? '#f1f5f9' : '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '5px',
          cursor: isPlaying || isPaused ? 'pointer' : 'not-allowed',
        }}
      >
        ⏹ {t('toolbar.stop')}
      </button>

      {/* Tempo field: "♩ = " [20-300] */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', margin: '0 0.15rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>♩ =</span>
        <input
          type="number"
          data-testid="input-tempo"
          min={20}
          max={300}
          value={localTempo}
          onChange={(e) => setLocalTempo(e.target.value)}
          onBlur={handleCommitTempo}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          style={{
            width: '54px',
            padding: '0.2rem 0.3rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            textAlign: 'center',
            borderRadius: '4px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#1e293b',
          }}
          title={t('notation.tempo')}
        />
      </div>

      {/* Volume slider & Mute button */}
      <button
        type="button"
        data-testid="btn-mute"
        onClick={handleButtonClick(onToggleMute ?? (() => {}))}
        onMouseDown={(e) => e.preventDefault()}
        title={isMuted ? t('toolbar.unmute') : t('toolbar.mute')}
        style={{
          padding: '0.2rem 0.35rem',
          fontSize: '0.85rem',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        data-testid="slider-volume"
        min={0}
        max={100}
        value={isMuted ? 0 : Math.round((volume ?? 0.8) * 100)}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          onVolumeChange?.(val / 100);
        }}
        title={t('toolbar.volume')}
        style={{ width: '56px', cursor: 'pointer' }}
      />

      {/* Audition / Preview sound toggle */}
      <button
        type="button"
        data-testid="toggle-preview-sound"
        onClick={handleButtonClick(onTogglePreviewSound ?? (() => {}))}
        onMouseDown={(e) => e.preventDefault()}
        title={t('toolbar.previewSound')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem 0.45rem',
          fontSize: '0.8rem',
          fontWeight: 500,
          color: previewSound ? '#1e293b' : '#94a3b8',
          backgroundColor: previewSound ? '#e2e8f0' : 'transparent',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        🔔 {t('toolbar.previewSound')}
      </button>
    </div>
  );
};
