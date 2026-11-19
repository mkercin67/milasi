// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { getPolyphonyGalleryCards } from '../../src/ui/polyphonyBuilders';
import { layoutScore } from '../../src/layout/layoutScore';
import { renderSvgToString } from '../../src/render/renderSvg';

describe('Milestone 7a-2a: Polyphony Gallery Cards (1 - 9)', () => {
  const cards = getPolyphonyGalleryCards();

  it('contains exactly 9 cards with correct tags and IDs', () => {
    expect(cards).toHaveLength(9);
    expect(cards.map((c) => c.id)).toEqual([
      'poly-1-stems-opposite-thirds-aligned',
      'poly-2-second-shared-stem-line',
      'poly-3-unison-shared-and-displaced',
      'poly-4-rests-shared-and-elevated',
      'poly-5-voices-3-and-4-offsets',
      'poly-6-ties-in-both-voices',
      'poly-7-beams-in-both-voices',
      'poly-8-dots-in-both-voices',
      'poly-9-bwv-140-reduction-whole-fixture',
    ]);
  });

  for (const card of cards) {
    it(`renders card [${card.id}] with valid SVG and asserts DOM counts`, () => {
      const score = card.build();
      const layout = layoutScore(score, {
        width: card.id === 'poly-9-bwv-140-reduction-whole-fixture' ? 140 : 70,
      });
      const svg = renderSvgToString(layout, { staffSpacePx: 10, score });

      expect(svg).toBeDefined();
      expect(svg.length).toBeGreaterThan(200);

      // Assert DOM counts
      const glyphMatches = svg.match(/<use\s|<text\s/g) ?? [];
      const lineMatches = svg.match(/<line\s/g) ?? [];

      // Every card must render a non-trivial amount of musical glyphs and lines
      expect(glyphMatches.length).toBeGreaterThan(2);
      expect(lineMatches.length).toBeGreaterThan(0);

      // Verify tag presence
      expect(['OBSERVED', 'PROPOSED', 'OBSERVED / PROPOSED']).toContain(card.tag);

      // For Card 9, verify notes checklist
      if (card.id === 'poly-9-bwv-140-reduction-whole-fixture') {
        expect(card.notesChecklist).toBeDefined();
        expect(card.notesChecklist!.length).toBe(12);
      }
    });
  }
});
