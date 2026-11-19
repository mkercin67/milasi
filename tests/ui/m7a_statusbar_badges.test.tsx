// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Tests for StatusBar error and warning badges in Turkish and English (Item 10).
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../src/ui/i18n';
import { StatusBar } from '../../src/ui/StatusBar';

describe('StatusBar Error and Warning Badges (Item 10)', () => {
  it('renders Turkish error and warning badges with correct pluralization and styling', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <StatusBar
          selection={null}
          mode="select"
          errorCount={2}
          warningCount={3}
        />
      </I18nProvider>
    );

    expect(html).toContain('data-testid="status-error-count"');
    expect(html).toContain('2 hata');

    expect(html).toContain('data-testid="status-warning-count"');
    expect(html).toContain('3 uyarı');
  });

  it('renders English error and warning badges with correct strings', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLanguage="en">
        <StatusBar
          selection={null}
          mode="select"
          errorCount={2}
          warningCount={3}
        />
      </I18nProvider>
    );

    expect(html).toContain('data-testid="status-error-count"');
    expect(html).toContain('2 errors');

    expect(html).toContain('data-testid="status-warning-count"');
    expect(html).toContain('3 warnings');
  });

  it('renders Turkish range selection info with count and measure span: 8 öge seçildi (Ölçü 1–2)', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <StatusBar
          selection={null}
          rangeInfo={{ count: 8, startMeasureNumber: 1, endMeasureNumber: 2 }}
          mode="select"
        />
      </I18nProvider>
    );

    expect(html).toContain('data-testid="status-range-info"');
    expect(html).toContain('8 öge seçildi (Ölçü 1–2)');
  });

  it('renders English range selection info with count and measure span: 8 items selected (Measures 1–2)', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLanguage="en">
        <StatusBar
          selection={null}
          rangeInfo={{ count: 8, startMeasureNumber: 1, endMeasureNumber: 2 }}
          mode="select"
        />
      </I18nProvider>
    );

    expect(html).toContain('data-testid="status-range-info"');
    expect(html).toContain('8 items selected (Measures 1–2)');
  });

  it('renders neither error badge nor warning badge when counts are 0 or undefined', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <StatusBar
          selection={null}
          mode="select"
          errorCount={0}
          warningCount={0}
        />
      </I18nProvider>
    );

    expect(html).not.toContain('data-testid="status-error-count"');
    expect(html).not.toContain('data-testid="status-warning-count"');
  });
});
