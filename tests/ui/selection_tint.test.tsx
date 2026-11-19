// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScoreView } from '../../src/ui/ScoreView';
import { I18nProvider } from '../../src/ui/i18n';
import { createEmptyScore } from '../../src/core/factory';
import { enterNote } from '../../src/core/input';

describe('0.1 Selection Tint for Noteheads and Glyphs (<use data-event-id>)', () => {
  it('FAILING-FIRST: asserts selection CSS targets <use> elements and <defs> glyph paths do not hard-code fill', () => {
    let score = createEmptyScore({ measures: 1 });
    const staffId = score.parts[0].staves[0].id;
    const mId = score.measures[0].id;
    score = enterNote(
      { staffId, measureId: mId, voiceIndex: 1, tick: 0 },
      { baseType: 'quarter', dots: 0, pitch: { step: 'C', octave: 4, alter: 0 } }
    ).apply(score);

    const eventId = score.parts[0].staves[0].measures[mId].voices[0].events[0].id;

    const html = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <ScoreView
          score={score}
          selectedEventId={eventId}
          selectedEventIds={new Set([eventId])}
          onSelectEvent={() => {}}
        />
      </I18nProvider>
    );

    // 1. Verify glyph path in <defs> does not have hard-coded fill blocking inheritance
    const defsMatch = html.match(/<defs>[\s\S]*?<\/defs>/);
    expect(defsMatch).toBeTruthy();
    const noteheadPathMatch = defsMatch![0].match(/<path[^>]*id="glyph-noteheadBlack"[^>]*>/);
    expect(noteheadPathMatch).toBeTruthy();
    expect(noteheadPathMatch![0]).not.toMatch(/\sfill="[^"]+"/);

    // 2. Verify rendered DOM has <use data-event-id="${eventId}">
    expect(html).toContain(`data-event-id="${eventId}"`);
    expect(html).toMatch(new RegExp(`<use[^>]*data-event-id="${eventId}"`));

    // 3. Verify CSS rules target <use data-event-id="${eventId}"> with #2563eb
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    expect(styleMatch).toBeTruthy();
    const styleContent = styleMatch![1];

    expect(styleContent).toMatch(
      new RegExp(`svg\\s+use\\[data-event-id=(?:"|&quot;)${eventId}(?:"|&quot;)\\][^{]*\\{[^}]*fill:\\s*#2563eb`, 'm')
    );
  });
});
