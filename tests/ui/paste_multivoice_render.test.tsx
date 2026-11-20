// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScoreView } from '../../src/ui/ScoreView';
import { I18nProvider } from '../../src/ui/i18n';
import { createEmptyScore, createNote } from '../../src/core/factory';
import { pasteEvents } from '../../src/core/clipboard';
import { isStaffMeasurePolyphonic } from '../../src/layout/measureLayout';

describe('B1: Multi-Voice Layout & Rendering When Voice 1 Holds Rests Only', () => {
  it('FAILING-FIRST: renders note glyphs in mm.3-4 for Voice 2 when Voice 1 has rests only', () => {
    // 1. Create a 4-measure score in 4/4
    const score = createEmptyScore({ measures: 4 });
    const staff = score.parts[0].staves[0];
    const m3Id = score.measures[2].id;
    const m4Id = score.measures[3].id;

    // 2. Prepare 8 quarter notes for Voice 2 (4 in m.3, 4 in m.4)
    const notesToPaste = Array.from({ length: 8 }, (_, i) =>
      createNote({
        id: `v2-note-${i}`,
        baseType: 'quarter',
        pitches: [{ step: 'C', octave: 4, alter: 0 }],
      })
    );

    const placedIds: string[] = [];
    const pastedScore = pasteEvents(
      score,
      {
        staffId: staff.id,
        voiceIndex: 2,
        startMeasureId: m3Id,
        startOffsetTicks: 0,
      },
      notesToPaste,
      placedIds
    );

    expect(placedIds).toHaveLength(8);

    // Verify model state in m.3 and m.4:
    const sm3 = pastedScore.parts[0].staves[0].measures[m3Id];
    const sm4 = pastedScore.parts[0].staves[0].measures[m4Id];
    expect(sm3.voices.find((v) => v.voiceIndex === 2)?.events).toHaveLength(4);
    expect(sm4.voices.find((v) => v.voiceIndex === 2)?.events).toHaveLength(4);

    // Render to DOM via ScoreView
    const html = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <ScoreView
          score={pastedScore}
          selectedEventId={null}
          onSelectEvent={() => {}}
        />
      </I18nProvider>
    );

    // Assert that each of the 8 Voice 2 note IDs is rendered in the DOM
    for (const noteId of placedIds) {
      expect(html).toContain(`data-event-id="${noteId}"`);
    }

    // Also assert isStaffMeasurePolyphonic returns true for measures with active Voice 2 notes
    expect(isStaffMeasurePolyphonic(sm3)).toBe(true);
    expect(isStaffMeasurePolyphonic(sm4)).toBe(true);
  });
});
