// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../../src/ui/i18n';
import { ToolbarVoiceSelector } from '../../src/ui/toolbar/ToolbarVoiceSelector';
import { createEmptyScore } from '../../src/core/factory';
import { cycleVoice, enterNote, ScoreCursor, switchToVoice } from '../../src/core/input';

describe('Toolbar Voice Buttons (T6)', () => {
  it('T6: toolbar voice buttons match Tab behavior, highlight active voice, show content dots, and support tr/en', () => {
    let score = createEmptyScore({ measures: 1 });
    const staffId = score.parts[0].staves[0].id;
    const measureId = score.measures[0].id;

    // Enter note in Voice 1 so it has non-rest content
    let cursor: ScoreCursor = { staffId, measureId, voiceIndex: 1, tick: 0 };
    const cmd = enterNote(cursor, {
      baseType: 'quarter',
      dots: 0,
      pitch: { step: 'C', octave: 5, alter: 0 },
    });
    score = cmd.apply(score);

    // 1. In Turkish locale, input mode, Voice 1 active, Voice 1 has note
    const voicesWithNotes = [1];
    const onSelectVoice = vi.fn();

    const htmlTr = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <ToolbarVoiceSelector
          mode="input"
          activeVoiceIndex={1}
          voicesWithContent={voicesWithNotes}
          onSelectVoice={onSelectVoice}
        />
      </I18nProvider>
    );

    // Labels in Turkish
    expect(htmlTr).toContain('Ses 1');
    expect(htmlTr).toContain('Ses 2');
    expect(htmlTr).toContain('Ses 3');
    expect(htmlTr).toContain('Ses 4');

    // Active voice 1 highlighted (aria-pressed or active styling)
    expect(htmlTr).toContain('data-voice-btn="1"');
    expect(htmlTr).toContain('aria-pressed="true"');

    // Content dot for Voice 1, not for Voice 2
    expect(htmlTr).toContain('data-testid="voice-content-dot-1"');
    expect(htmlTr).not.toContain('data-testid="voice-content-dot-2"');

    // Buttons are enabled in input mode
    expect(htmlTr).not.toContain('disabled=""');

    // 2. In select mode: buttons are disabled / inert for clicks
    const htmlSelect = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <ToolbarVoiceSelector
          mode="select"
          activeVoiceIndex={1}
          voicesWithContent={voicesWithNotes}
          onSelectVoice={onSelectVoice}
        />
      </I18nProvider>
    );
    expect(htmlSelect).toContain('disabled=""');

    // 3. In English locale: shows "Voice 1".."Voice 4"
    const htmlEn = renderToStaticMarkup(
      <I18nProvider initialLanguage="en">
        <ToolbarVoiceSelector
          mode="input"
          activeVoiceIndex={2}
          voicesWithContent={[1, 2]}
          onSelectVoice={onSelectVoice}
        />
      </I18nProvider>
    );
    expect(htmlEn).toContain('Voice 1');
    expect(htmlEn).toContain('Voice 2');
    expect(htmlEn).toContain('data-testid="voice-content-dot-2"');

    // 4. Semantics match: switchToVoice to 2 produces exact same cursor as cycleVoice 'next'
    const tabCursor = cycleVoice(score, cursor, 'next');
    const directVoiceCursor = switchToVoice(score, cursor, 2);
    expect(directVoiceCursor).toEqual(tabCursor);
  });
});
