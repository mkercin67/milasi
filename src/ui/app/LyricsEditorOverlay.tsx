import React, { useRef } from 'react';
import { useI18n } from '../i18n';

export interface LyricsEditorOverlayProps {
  lyricsInputValue: string;
  onLyricsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLyricsKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onLyricsPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
}

export const LyricsEditorOverlay: React.FC<LyricsEditorOverlayProps> = ({
  lyricsInputValue,
  onLyricsChange,
  onLyricsKeyDown,
  onLyricsPaste,
  onClose,
}) => {
  const { t } = useI18n();
  const lyricsInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      data-testid="lyrics-editor-overlay"
      style={{
        position: 'fixed',
        bottom: '48px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#ffffff',
        padding: '8px 16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '2px solid #0284c7',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0284c7' }}>
        {t('mode.lyrics')} (U):
      </span>
      <input
        ref={lyricsInputRef}
        data-testid="input-lyrics-editor"
        type="text"
        autoFocus
        value={lyricsInputValue}
        onChange={onLyricsChange}
        onKeyDown={onLyricsKeyDown}
        onPaste={onLyricsPaste}
        placeholder="Hece girin (Boşluk = sonraki, - = hece bağı)..."
        style={{
          fontSize: '1rem',
          padding: '4px 8px',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          outline: 'none',
          minWidth: '240px',
        }}
      />
      <button
        type="button"
        onClick={onClose}
        style={{
          fontSize: '0.8rem',
          padding: '4px 8px',
          backgroundColor: '#f1f5f9',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Tamam (Esc)
      </button>
    </div>
  );
};
