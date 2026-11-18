// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import { getGalleryCases } from '../../src/ui/galleryCases';
import { layoutScore } from '../../src/layout/layoutScore';
import { computeItemBoundingBox } from '../../src/layout/boundingBox';
import { renderSvgToString } from '../../src/render/renderSvg';

describe('Gallery SVG ViewBox Bounding Box Tests', () => {
  const cases = getGalleryCases();
  const testWidthsPx = [385, 600, 1200];
  const staffSpacePx = 10;

  for (const c of cases) {
    describe(`Case: ${c.title} [${c.id}]`, () => {
      for (const widthPx of testWidthsPx) {
        it(`encloses every layout item bounding box inside the SVG viewBox at width ${widthPx}px`, () => {
          const score = c.build();
          // width in staff spaces (e.g. 385px / 10px = 38.5 staff spaces)
          const widthInStaffSpaces = widthPx / staffSpacePx;
          const layout = layoutScore(score, { width: widthInStaffSpaces });

          // Render SVG
          const svg = renderSvgToString(layout, { staffSpacePx, viewBoxMargin: 1.5 });

          // Extract viewBox="minX minY width height"
          const match = svg.match(/viewBox="([^"]+)"/);
          expect(match).not.toBeNull();
          const [vbMinX, vbMinY, vbWidth, vbHeight] = match![1].split(' ').map(Number);
          const vbMaxX = vbMinX + vbWidth;
          const vbMaxY = vbMinY + vbHeight;

          // Check every layout item's bounding box in pixel coordinates
          for (const sys of layout.systems) {
            for (const item of sys.items) {
              if (item.hidden) continue;
              const itemBox = computeItemBoundingBox(item, sys.y);

              const itemMinXPx = itemBox.minX * staffSpacePx;
              const itemMaxXPx = itemBox.maxX * staffSpacePx;
              const itemMinYPx = itemBox.minY * staffSpacePx;
              const itemMaxYPx = itemBox.maxY * staffSpacePx;

              // Item bounding box must lie strictly inside viewBox (with 1e-4 tolerance for float roundings)
              expect(itemMinXPx).toBeGreaterThanOrEqual(vbMinX - 1e-4);
              expect(itemMaxXPx).toBeLessThanOrEqual(vbMaxX + 1e-4);
              expect(itemMinYPx).toBeGreaterThanOrEqual(vbMinY - 1e-4);
              expect(itemMaxYPx).toBeLessThanOrEqual(vbMaxY + 1e-4);
            }
          }
        });
      }
    });
  }
});
