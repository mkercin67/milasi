import { describe, expect, it } from 'vitest';
import { getGalleryCases } from '../../src/ui/galleryCases';
import { layoutScore } from '../../src/layout/layoutScore';
import { renderSvgToString } from '../../src/render/renderSvg';

function normalizeSvg(svg: string): string {
  return svg.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'uuid-normalized');
}

describe('H1 Regression Gallery: Golden Snapshot Tests', () => {
  const cases = getGalleryCases();

  for (const c of cases) {
    it(`golden snapshot matches for case [${c.id}]: ${c.title}`, () => {
      const score = c.build();
      const layout = layoutScore(score, { width: 70 });
      const svg = normalizeSvg(renderSvgToString(layout, { staffSpacePx: 10 }));

      expect(svg).toBeDefined();
      expect(svg.length).toBeGreaterThan(100);
      expect(svg).toMatchSnapshot();
    });
  }
});
