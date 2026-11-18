// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { Language, NoteNameStyle, useI18n } from '../i18n';

export const ToolbarSettings: React.FC = () => {
  const { t, language, setLanguage, noteNameStyle, setNoteNameStyle, zoom, setZoom } = useI18n();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <label htmlFor="zoom-select" style={{ fontSize: '0.825rem', color: '#64748b' }}>
          {t('toolbar.zoom')}:
        </label>
        <select
          id="zoom-select"
          value={zoom}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            e.target.blur();
            setZoom(val);
          }}
          style={{
            padding: '0.35rem 0.6rem',
            fontSize: '0.825rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          <option value={0.75}>75%</option>
          <option value={1.0}>100%</option>
          <option value={1.5}>150%</option>
          <option value={2.0}>200%</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <label htmlFor="notename-select" style={{ fontSize: '0.825rem', color: '#64748b' }}>
          {t('toolbar.noteNameStyle')}:
        </label>
        <select
          id="notename-select"
          value={noteNameStyle}
          onChange={(e) => {
            const val = e.target.value as NoteNameStyle;
            e.target.blur();
            setNoteNameStyle(val);
          }}
          style={{
            padding: '0.35rem 0.6rem',
            fontSize: '0.825rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          <option value="solfege">{t('toolbar.styleSolfege')}</option>
          <option value="letter">{t('toolbar.styleLetter')}</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <label htmlFor="language-select" style={{ fontSize: '0.825rem', color: '#64748b' }}>
          {t('toolbar.language')}:
        </label>
        <select
          id="language-select"
          value={language}
          onChange={(e) => {
            const val = e.target.value as Language;
            e.target.blur();
            setLanguage(val);
          }}
          style={{
            padding: '0.35rem 0.6rem',
            fontSize: '0.825rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          <option value="tr">{t('toolbar.langTr')}</option>
          <option value="en">{t('toolbar.langEn')}</option>
        </select>
      </div>
    </div>
  );
};
