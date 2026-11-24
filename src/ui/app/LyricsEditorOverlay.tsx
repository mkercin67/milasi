// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useRef } from 'react';
import { MAX_LYRIC_VERSES } from '../../core/model';
import { useI18n } from '../i18n';

export interface LyricsEditorOverlayProps {
  lyricsInputValue: string;
  onLyricsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLyricsKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onLyricsPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
  /** Verse the box shows and writes (M7c-7). */
  lyricsVerse: number;
  onVerseChange: (verse: number) => void;
  onNewVerse: () => void;
  canAddVerse: boolean;
}

export const LyricsEditorOverlay: React.FC<LyricsEditorOverlayProps> = ({
  lyricsInputValue,
  onLyricsChange,
  onLyricsKeyDown,
  onLyricsPaste,
  onClose,
  lyricsVerse,
  onVerseChange,
  onNewVerse,
  canAddVerse,
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
      <label style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {t('dialog.lyrics.verse')}
        <select
          data-testid="select-lyrics-verse"
          value={lyricsVerse}
          onChange={(e) => {
            onVerseChange(Number(e.target.value));
            lyricsInputRef.current?.focus();
          }}
          style={{ fontSize: '0.85rem', padding: '3px 4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
        >
          {Array.from({ length: MAX_LYRIC_VERSES }, (_, i) => i + 1).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        data-testid="btn-new-verse"
        disabled={!canAddVerse}
        onClick={() => {
          onNewVerse();
          lyricsInputRef.current?.focus();
        }}
        onMouseDown={(e) => e.preventDefault()}
        style={{
          fontSize: '0.8rem',
          padding: '4px 8px',
          backgroundColor: '#f1f5f9',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          cursor: canAddVerse ? 'pointer' : 'not-allowed',
          opacity: canAddVerse ? 1 : 0.5,
        }}
      >
        + {t('dialog.lyrics.newVerse')}
      </button>
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
