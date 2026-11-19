// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { layoutScore } from '../../src/layout/layoutScore';
import { renderSvgToString } from '../../src/render/renderSvg';
import { getPolyphonyGalleryCards } from '../../src/ui/polyphonyBuilders';

describe('Gallery Card SVG Containment (No Horizontal Clipping)', () => {
  const cards = getPolyphonyGalleryCards();
  // Standard card container width in gallery grid minmax(560px, 1fr) with padding
  const CARD_CONTAINER_WIDTH_PX = 560;

  for (const card of cards) {
    it(`FAILING-FIRST: card [${card.id}] rendered SVG width is scaled to fit within card container width without right-edge clipping`, () => {
      const score = card.build();
      const layout = layoutScore(score, {
        width: card.id === 'poly-9-bwv-140-reduction-whole-fixture' ? 140 : 70,
      });
      const svg = renderSvgToString(layout, { staffSpacePx: 10, score, responsive: true });

      // Extract viewBox and width attribute from SVG
      const svgMatch = svg.match(/<svg\s+([^>]+)>/);
      expect(svgMatch).toBeDefined();
      const attrs = svgMatch![1];

      const viewBoxMatch = attrs.match(/viewBox="([^"]+)"/);
      expect(viewBoxMatch).toBeDefined();

      const widthMatch = attrs.match(/\swidth="([^"]+)"/);
      expect(widthMatch).toBeDefined();
      const rawWidthVal = widthMatch![1];

      const styleMatch = attrs.match(/\sstyle="([^"]+)"/);
      const style = styleMatch ? styleMatch[1] : '';

      // The rendered SVG must either have width <= container width OR responsive scaling (width: 100% / max-width: 100%)
      const hasResponsiveScaling =
        rawWidthVal === '100%' ||
        style.includes('max-width: 100%') ||
        style.includes('width: 100%');

      const rawWidthPx = rawWidthVal.endsWith('%')
        ? CARD_CONTAINER_WIDTH_PX
        : parseFloat(rawWidthVal);

      const effectiveRenderedWidth = hasResponsiveScaling
        ? Math.min(rawWidthPx, CARD_CONTAINER_WIDTH_PX)
        : rawWidthPx;

      // Assert that rendered SVG right edge lies entirely within container box
      expect(effectiveRenderedWidth).toBeLessThanOrEqual(CARD_CONTAINER_WIDTH_PX);
    });
  }
});
