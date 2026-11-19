// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getPolyphonyGalleryCards } from '../../src/ui/polyphonyBuilders';
import { layoutScore } from '../../src/layout/layoutScore';
import { ScoreSvgLayers } from '../../src/ui/scoreView/ScoreSvgLayers';
import { renderSvgToString } from '../../src/render/renderSvg';
import { layoutTies } from '../../src/layout/ties';
import { layoutSlurs, layoutDynamics, layoutArticulations } from '../../src/layout/notations';

interface NormalizedElement {
  tag: string;
  class: string | null;
  d: string | null;
  x: string | null;
  y: string | null;
  x1: string | null;
  y1: string | null;
  x2: string | null;
  y2: string | null;
  transform: string | null;
}

function normalizeAttr(val: string | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  return val.replace(/\s+/g, ' ').trim();
}

function parseOverlayElements(html: string): NormalizedElement[] {
  const elements: NormalizedElement[] = [];
  // Match overlay elements: paths with score-tie/score-slur, groups with score-dynamic/score-articulation
  const regex = /<(path|g|use|text)\s+([^>]+)>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1];
    const attrsStr = match[2];

    const getAttr = (name: string): string | null => {
      const attrRegex = new RegExp(`(?:^|\\s)${name}="([^"]*)"`);
      const m = attrRegex.exec(attrsStr);
      return m ? m[1] : null;
    };

    const cls = getAttr('class') ?? '';
    // Only capture score overlay elements (ties, slurs, dynamics, articulations)
    if (
      !cls.includes('score-tie') &&
      !cls.includes('score-slur') &&
      !cls.includes('score-dynamic') &&
      !cls.includes('score-articulation')
    ) {
      continue;
    }

    elements.push({
      tag,
      class: normalizeAttr(cls),
      d: normalizeAttr(getAttr('d')),
      x: normalizeAttr(getAttr('x')),
      y: normalizeAttr(getAttr('y')),
      x1: normalizeAttr(getAttr('x1')),
      y1: normalizeAttr(getAttr('y1')),
      x2: normalizeAttr(getAttr('x2')),
      y2: normalizeAttr(getAttr('y2')),
      transform: normalizeAttr(getAttr('transform')),
    });
  }

  return elements;
}

describe('SVG Render Parity (React ScoreSvgLayers vs string renderSvg)', () => {
  const cards = getPolyphonyGalleryCards();

  for (const card of cards) {
    it(`card [${card.id}] maintains exact element parity across React and string SVG paths`, () => {
      const score = card.build();
      const layoutWidth = card.id === 'poly-9-bwv-140-reduction-whole-fixture' ? 140 : 70;
      const layout = layoutScore(score, { width: layoutWidth });
      const visibleTies = layoutTies(score, layout);
      const visibleSlurs = layoutSlurs(score, layout);
      const visibleDynamics = layoutDynamics(score, layout);
      const visibleArticulations = layoutArticulations(score, layout);

      // React path (ScoreSvgLayers)
      const reactHtml = renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(ScoreSvgLayers, {
            layout,
            visibleSystemIndices: new Set(layout.systems.map((s) => s.index)),
            staffSpacePx: 10,
            scale: 10 / (2048 / 4),
            zoom: 1,
            useTextFallback: false,
            visibleTies,
            visibleSlurs,
            visibleDynamics,
            visibleArticulations,
            marqueeRect: null,
            isInputMode: false,
            cursorLineRef: { current: null },
            ghostNote: null,
            isDraggingState: false,
            dragOverlayRef: { current: null },
          })
        )
      );

      // String path (renderSvgToString)
      const stringSvg = renderSvgToString(layout, { staffSpacePx: 10, score, responsive: false });

      const reactElements = parseOverlayElements(reactHtml);
      const stringElements = parseOverlayElements(stringSvg);

      expect(stringElements.length).toBe(reactElements.length);

      for (let i = 0; i < reactElements.length; i++) {
        const r = reactElements[i];
        const s = stringElements[i];

        expect(s.tag).toBe(r.tag);
        expect(s.class).toBe(r.class);
        expect(s.d).toBe(r.d);
        expect(s.x).toBe(r.x);
        expect(s.y).toBe(r.y);
        expect(s.x1).toBe(r.x1);
        expect(s.y1).toBe(r.y1);
        expect(s.x2).toBe(r.x2);
        expect(s.y2).toBe(r.y2);
        expect(s.transform).toBe(r.transform);
      }
    });
  }
});
