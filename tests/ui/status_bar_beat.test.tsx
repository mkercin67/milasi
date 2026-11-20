// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../../src/ui/i18n';
import { computeBeatPosition, StatusBar } from '../../src/ui/StatusBar';

describe('StatusBar Beat & Hint Display (T12)', () => {
  it('T12: status bar displays beat position for 4/4, 3/4, and compound 6/8 in Turkish and English', () => {
    // 1. Math verification via computeBeatPosition
    // 4/4 meter: beats are at ticks 0 (beat 1), 960 (beat 2), 1440 (beat 2.5), 1920 (beat 3)
    expect(computeBeatPosition(0, { num: 4, den: 4 })).toBe('1');
    expect(computeBeatPosition(960, { num: 4, den: 4 })).toBe('2');
    expect(computeBeatPosition(1440, { num: 4, den: 4 })).toBe('2.5');
    expect(computeBeatPosition(1920, { num: 4, den: 4 })).toBe('3');

    // 3/4 meter: beats at 0 (beat 1), 960 (beat 2), 1920 (beat 3)
    expect(computeBeatPosition(0, { num: 3, den: 4 })).toBe('1');
    expect(computeBeatPosition(960, { num: 3, den: 4 })).toBe('2');
    expect(computeBeatPosition(1920, { num: 3, den: 4 })).toBe('3');

    // 6/8 meter (compound): dotted-quarter pulses (1440 ticks) -> 2 beats
    // tick 0 = beat 1, tick 1440 = beat 2, tick 720 = beat 1.5
    expect(computeBeatPosition(0, { num: 6, den: 8 })).toBe('1');
    expect(computeBeatPosition(1440, { num: 6, den: 8 })).toBe('2');
    expect(computeBeatPosition(720, { num: 6, den: 8 })).toBe('1.5');

    // 2. DOM markup verification in Turkish for 4/4
    const htmlTr44 = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <StatusBar
          selection={null}
          mode="input"
          activeDuration="quarter"
          currentMeasureNumber={1}
          currentTick={960}
          timeSig={{ num: 4, den: 4 }}
          voiceIndex={2}
        />
      </I18nProvider>
    );
    expect(htmlTr44).toContain('Dörtlük nota');
    expect(htmlTr44).toContain('Ölçü 1');
    expect(htmlTr44).toContain('Vuruş 2');
    expect(htmlTr44).toContain('Ses 2');
    expect(htmlTr44).toContain('data-testid="status-voice-indicator"');
    // Contextual hints in input mode
    expect(htmlTr44).toContain('Tab: Ses');
    expect(htmlTr44).toContain('Home: Ölçü başı');
    expect(htmlTr44).toContain('Oklar: Gezinme');

    // 3. DOM markup verification in English for 6/8
    const htmlEn68 = renderToStaticMarkup(
      <I18nProvider initialLanguage="en">
        <StatusBar
          selection={null}
          mode="input"
          activeDuration="eighth"
          currentMeasureNumber={2}
          currentTick={1440}
          timeSig={{ num: 6, den: 8 }}
          voiceIndex={1}
        />
      </I18nProvider>
    );
    expect(htmlEn68).toContain('Eighth note');
    expect(htmlEn68).toContain('Measure 2');
    expect(htmlEn68).toContain('Beat 2');
    expect(htmlEn68).toContain('Voice 1');
    expect(htmlEn68).toContain('Tab: Voice');
    expect(htmlEn68).toContain('Home: Measure start');
    expect(htmlEn68).toContain('Arrows: Move cursor');
  });
});
