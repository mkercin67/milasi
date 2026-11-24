// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-8: markup of the mixer panel.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EMPTY_MIXER, setMuted, setSolo } from '../../src/playback/mixer';
import { I18nProvider } from '../../src/ui/i18n';
import { MixerPanel } from '../../src/ui/toolbar/MixerPanel';

const parts = [
  { id: 'p1', name: 'Soprano' },
  { id: 'p2', name: 'Piano' },
];

const render = (lang: 'tr' | 'en', ps = parts, mixer = EMPTY_MIXER, open = true) =>
  renderToStaticMarkup(
    <I18nProvider initialLanguage={lang}>
      <MixerPanel parts={ps} mixer={mixer} onMixerChange={() => undefined} defaultOpen={open} />
    </I18nProvider>
  );

describe('M7c-8 mixer panel', () => {
  it('MP1: lists every part with mute, solo and volume controls', () => {
    const html = render('en');
    for (const p of parts) {
      expect(html).toContain(`data-testid="mixer-row-${p.id}"`);
      expect(html).toContain(`data-testid="mixer-mute-${p.id}"`);
      expect(html).toContain(`data-testid="mixer-solo-${p.id}"`);
      expect(html).toContain(`data-testid="mixer-volume-${p.id}"`);
    }
  });

  it('MP2: pressed state follows the mixer and the panel is hidden for single-part scores', () => {
    const html = render('en', parts, setSolo(setMuted(EMPTY_MIXER, 'p1', true), 'p2', true));
    expect(/data-testid="mixer-mute-p1"[^>]*aria-pressed="true"/.test(html) || /aria-pressed="true"[^>]*data-testid="mixer-mute-p1"/.test(html)).toBe(true);
    expect(render('en', parts.slice(0, 1))).toBe('');
  });

  it('MP3: closed by default and labels are translated', () => {
    expect(render('en', parts, EMPTY_MIXER, false)).not.toContain('mixer-panel');
    expect(render('tr')).toContain('Mikser');
    expect(render('en')).toContain('Mixer');
  });
});
