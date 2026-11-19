// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../../src/ui/i18n';
import { StatusBar } from '../../src/ui/StatusBar';
import { mapKeyEvent } from '../../src/ui/keymap';
import { createEmptyScore } from '../../src/core/factory';
import { cycleVoice, ScoreCursor } from '../../src/core/input';

describe('T5: UI Voice Switching & PreventDefault (Decision D1, D6)', () => {
  it('Tab in input mode changes the status bar voice text immediately', () => {
    const score = createEmptyScore({ measures: 2 });
    let cursor: ScoreCursor = {
      staffId: score.parts[0].staves[0].id,
      measureId: score.measures[0].id,
      voiceIndex: 1,
      tick: 0,
    };

    // 1. Initial input mode at Voice 1 (Turkish)
    const htmlV1Tr = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <StatusBar
          selection={null}
          mode="input"
          voiceIndex={cursor.voiceIndex}
          currentMeasureNumber={1}
        />
      </I18nProvider>
    );
    expect(htmlV1Tr).toContain('Ses 1');

    // 2. Press Tab -> cycleVoice to Voice 2
    cursor = cycleVoice(score, cursor, 'next');
    expect(cursor.voiceIndex).toBe(2);

    const htmlV2Tr = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <StatusBar
          selection={null}
          mode="input"
          voiceIndex={cursor.voiceIndex}
          currentMeasureNumber={1}
        />
      </I18nProvider>
    );
    expect(htmlV2Tr).toContain('Ses 2');

    // 3. In English locale: shows "Voice 2"
    const htmlV2En = renderToStaticMarkup(
      <I18nProvider initialLanguage="en">
        <StatusBar
          selection={null}
          mode="input"
          voiceIndex={cursor.voiceIndex}
          currentMeasureNumber={1}
        />
      </I18nProvider>
    );
    expect(htmlV2En).toContain('Voice 2');
  });

  it('Tab in input mode is mapped and default-prevented; Tab outside input mode is NOT default-prevented', () => {
    // Simulated keyboard event handler logic matching useAppKeyboard
    function simulateKey(code: string, mode: 'select' | 'input' | 'position' | 'lyrics') {
      const e = {
        code,
        key: code,
        preventDefault: vi.fn(),
      };
      const action = mapKeyEvent(e, mode);
      if (action) {
        e.preventDefault();
      }
      return { action, preventDefaultCalled: e.preventDefault.mock.calls.length > 0 };
    }

    // In input mode: Tab is mapped to next-voice and preventDefault IS called
    const inputTab = simulateKey('Tab', 'input');
    expect(inputTab.action).toBe('next-voice');
    expect(inputTab.preventDefaultCalled).toBe(true);

    // Outside input mode (select mode): Tab is NOT mapped and preventDefault is NOT called
    const selectTab = simulateKey('Tab', 'select');
    expect(selectTab.action).toBeNull();
    expect(selectTab.preventDefaultCalled).toBe(false);
  });
});
