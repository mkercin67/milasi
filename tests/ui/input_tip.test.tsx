// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../../src/ui/i18n';
import { TwoVoiceTipBanner } from '../../src/ui/TwoVoiceTipBanner';

describe('Two-Voice Input Tip (T13)', () => {
  it('T13: two-voice entry tip is shown on first input mode entry, remembered on dismiss, and survives localStorage throwing', () => {
    // 1. In select mode: tip is NOT shown
    const htmlSelect = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <TwoVoiceTipBanner mode="select" />
      </I18nProvider>
    );
    expect(htmlSelect).not.toContain('data-testid="two-voice-tip-banner"');

    // 2. First entry to input mode: tip IS shown with Turkish text
    const mockStorageEmpty: Record<string, string> = {};
    const fakeStorage = {
      getItem: (k: string) => mockStorageEmpty[k] ?? null,
      setItem: (k: string, v: string) => {
        mockStorageEmpty[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStorageEmpty[k];
      },
      clear: () => {},
      length: 0,
      key: () => null,
    };

    const htmlInputTr = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <TwoVoiceTipBanner mode="input" storage={fakeStorage as Storage} />
      </I18nProvider>
    );
    expect(htmlInputTr).toContain('data-testid="two-voice-tip-banner"');
    expect(htmlInputTr).toContain('Birden fazla ses için Tab. Aynı vuruşa ikinci ses: Ctrl+Home (parça başı) veya Home (ölçü başı), sonra Tab.');

    // 3. English locale
    const htmlInputEn = renderToStaticMarkup(
      <I18nProvider initialLanguage="en">
        <TwoVoiceTipBanner mode="input" storage={fakeStorage as Storage} />
      </I18nProvider>
    );
    expect(htmlInputEn).toContain('For multiple voices use Tab. For a second voice on the same beat: Ctrl+Home (score start) or Home (measure start), then Tab.');

    // 4. Dismissal remembered: when storage has dismissed flag, tip is NOT shown
    fakeStorage.setItem('scoreforge:dismissed_two_voice_tip', 'true');
    const htmlDismissed = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <TwoVoiceTipBanner mode="input" storage={fakeStorage as Storage} />
      </I18nProvider>
    );
    expect(htmlDismissed).not.toContain('data-testid="two-voice-tip-banner"');

    // 5. Storage throwing error (private browsing / quota / restricted iframe)
    const throwingStorage = {
      getItem: () => {
        throw new Error('SecurityError: The operation is insecure.');
      },
      setItem: () => {
        throw new Error('SecurityError: The operation is insecure.');
      },
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };

    // Must NOT crash, and tip displays safely
    const htmlThrowing = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <TwoVoiceTipBanner mode="input" storage={throwingStorage as Storage} />
      </I18nProvider>
    );
    expect(htmlThrowing).toContain('data-testid="two-voice-tip-banner"');
    expect(htmlThrowing).toContain('Birden fazla ses için Tab. Aynı vuruşa ikinci ses: Ctrl+Home (parça başı) veya Home (ölçü başı), sonra Tab.');
  });
});
