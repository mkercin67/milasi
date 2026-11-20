// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { useI18n } from '../i18n';
import { EditorMode } from '../keymap';
import { VOICE_COLORS } from '../voiceColors';

export interface ToolbarVoiceSelectorProps {
  mode: EditorMode;
  activeVoiceIndex: 1 | 2 | 3 | 4;
  onSelectVoice: (voiceIndex: 1 | 2 | 3 | 4) => void;
  voicesWithContent?: Set<number> | number[];
  handleButtonClick?: (cb: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const VOICES: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];

export const ToolbarVoiceSelector: React.FC<ToolbarVoiceSelectorProps> = ({
  mode,
  activeVoiceIndex,
  onSelectVoice,
  voicesWithContent = [],
  handleButtonClick,
}) => {
  const { t } = useI18n();
  const isInputMode = mode === 'input';

  const contentSet = React.useMemo(() => {
    return voicesWithContent instanceof Set ? voicesWithContent : new Set(voicesWithContent);
  }, [voicesWithContent]);

  return (
    <div
      role="group"
      aria-label="Voice"
      data-testid="toolbar-voice-selector"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        padding: '2px',
        gap: '2px',
      }}
    >
      {VOICES.map((v) => {
        const isActive = activeVoiceIndex === v;
        const hasContent = contentSet.has(v);
        const voiceColor = VOICE_COLORS[v];

        const onClickHandler = (e: React.MouseEvent<HTMLButtonElement>) => {
          if (!isInputMode) return;
          if (handleButtonClick) {
            handleButtonClick(() => onSelectVoice(v))(e);
          } else {
            e.currentTarget.blur();
            onSelectVoice(v);
          }
        };

        return (
          <button
            key={v}
            type="button"
            data-voice-btn={v}
            aria-pressed={isActive}
            disabled={!isInputMode}
            onClick={onClickHandler}
            onMouseDown={(e) => e.preventDefault()}
            title={t('toolbar.voice', { num: v })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.36rem 0.6rem',
              fontSize: '0.8rem',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#1d4ed8' : isInputMode ? '#334155' : '#94a3b8',
              backgroundColor: isActive ? '#dbeafe' : 'transparent',
              border: isActive ? '1px solid #93c5fd' : '1px solid transparent',
              borderRadius: '4px',
              cursor: isInputMode ? 'pointer' : 'default',
              boxShadow: isActive ? '0 1px 2px rgba(37,99,235,0.15)' : 'none',
              opacity: isInputMode ? 1 : 0.65,
              transition: 'all 0.15s ease',
            }}
          >
            <span>{t('toolbar.voice', { num: v })}</span>
            {hasContent && (
              <span
                data-testid={`voice-content-dot-${v}`}
                style={{
                  display: 'inline-block',
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: voiceColor,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
