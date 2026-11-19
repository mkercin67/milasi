// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';
import { renderSvgToString } from '../../src/render/renderSvg';
import { getPolyphonyGalleryCards } from '../../src/ui/polyphonyBuilders';

interface TransformedBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function parsePathPoints(d: string): Array<{ x: number; y: number }> {
  const matches = d.match(/[-+]?[0-9]*\.?[0-9]+/g);
  if (!matches) return [];
  const nums = matches.map(Number);
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < nums.length; i += 2) {
    if (i + 1 < nums.length) {
      pts.push({ x: nums[i], y: nums[i + 1] });
    }
  }
  return pts;
}

function computeTransformedBBox(d: string, transformAttr?: string | null): TransformedBox {
  let scaleX = 1;
  let scaleY = 1;
  let transX = 0;
  let transY = 0;

  if (transformAttr) {
    const transMatch = transformAttr.match(/translate\(([-0-9.]+),\s*([-0-9.]+)\)/);
    if (transMatch) {
      transX = parseFloat(transMatch[1]);
      transY = parseFloat(transMatch[2]);
    }
    const scaleMatch = transformAttr.match(/scale\(([-0-9.]+)(?:,\s*([-0-9.]+))?\)/);
    if (scaleMatch) {
      scaleX = parseFloat(scaleMatch[1]);
      scaleY = scaleMatch[2] ? parseFloat(scaleMatch[2]) : scaleX;
    }
  }

  const pts = parsePathPoints(d);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of pts) {
    const px = pt.x * scaleX + transX;
    const py = pt.y * scaleY + transY;
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  }

  return { minX, maxX, minY, maxY };
}

describe('Geometry verification of Ties and Slurs in rendered SVG', () => {
  it('prints Card 6 raw tie paths and notehead coordinates for diagnostic record', () => {
    const card6 = getPolyphonyGalleryCards().find((c) => c.id === 'poly-6-ties-in-both-voices')!;
    const score = card6.build();
    const layout = layoutScore(score, { width: 70 });
    const staffSpacePx = 10;
    const svg = renderSvgToString(layout, { staffSpacePx, score });

    const tieRegex = /<path\s+[^>]*class="score-tie[^"]*"[^>]*>/g;
    const tieMatches = [...svg.matchAll(tieRegex)];

    console.log(`[Card 6 Diagnostic] Found ${tieMatches.length} tie elements:`);
    for (const match of tieMatches) {
      const el = match[0];
      const dMatch = el.match(/\sd="([^"]+)"/);
      const d = dMatch ? dMatch[1] : '';
      const transform = el.match(/transform="([^"]+)"/)?.[1] ?? null;
      console.log(`  Raw element: ${el}`);
      console.log(`  d: ${d}`);
      console.log(`  transform: ${transform}`);
    }

    const noteheads: Array<{ id: string; glyph: string; pxX: number; pxY: number }> = [];
    for (const sys of layout.systems) {
      for (const it of sys.items) {
        if (it.glyph && it.glyph.startsWith('notehead')) {
          noteheads.push({
            id: it.id,
            glyph: it.glyph,
            pxX: it.x * staffSpacePx,
            pxY: (sys.y + it.y) * staffSpacePx,
          });
        }
      }
    }
    console.log('[Card 6 Diagnostic] Notehead pixel coordinates:');
    console.table(noteheads);
  });

  it('FAILING-FIRST: Card 6 tie bboxes lie between notehead X (+-1 sp) and within 3 sp of notehead Y, not near origin', () => {
    const card6 = getPolyphonyGalleryCards().find((c) => c.id === 'poly-6-ties-in-both-voices')!;
    const score = card6.build();
    const layout = layoutScore(score, { width: 70 });
    const staffSpacePx = 10;
    const svg = renderSvgToString(layout, { staffSpacePx, score });

    const tieMatches = [...svg.matchAll(/<path\s+[^>]*class="score-tie[^"]*"[^>]*>/g)];
    expect(tieMatches.length).toBe(2);

    // Get notehead pixel coords
    const sys0 = layout.systems[0];
    const sysYPx = sys0.y * staffSpacePx;

    // Source noteheads (m0)
    const v1Source = sys0.items.find((it) => it.id === 'v1-m0' || (it.glyph?.startsWith('notehead') && it.y < 2.0));
    const v2Source = sys0.items.find((it) => it.id === 'v2-m0' || (it.glyph?.startsWith('notehead') && it.y > 3.0));

    expect(v1Source).toBeDefined();
    expect(v2Source).toBeDefined();

    for (const match of tieMatches) {
      const el = match[0];
      const d = el.match(/\sd="([^"]+)"/)?.[1]!;
      const transform = el.match(/transform="([^"]+)"/)?.[1] ?? null;

      const bbox = computeTransformedBBox(d, transform);

      // (1) No tie bbox near origin (0,0) or containing NaN
      expect(Number.isNaN(bbox.minX)).toBe(false);
      expect(Number.isNaN(bbox.minY)).toBe(false);
      expect(bbox.minX).toBeGreaterThan(30); // Not near origin 0
      expect(bbox.minY).toBeGreaterThan(50); // Not near origin 0 (sysY is ~110px)

      // (2) Tie path bbox lies horizontally between its two heads (+- 1 staff space = 10px)
      // And vertically within 3 staff spaces (30px)
      expect(bbox.minX).toBeGreaterThanOrEqual((v1Source!.x - 1) * staffSpacePx);
      expect(bbox.maxX).toBeLessThanOrEqual(sys0.width * staffSpacePx);

      // Check vertical proximity to staff
      expect(bbox.minY).toBeGreaterThanOrEqual(sysYPx - 30);
      expect(bbox.maxY).toBeLessThanOrEqual(sysYPx + 70);
    }
  });

  it('FAILING-FIRST: Voice 1 tie curves above (ctrlYOuter < y1, y2) and Voice 2 curves below (ctrlYOuter > y1, y2)', () => {
    const card6 = getPolyphonyGalleryCards().find((c) => c.id === 'poly-6-ties-in-both-voices')!;
    const score = card6.build();
    const layout = layoutScore(score, { width: 70 });
    const staffSpacePx = 10;
    const svg = renderSvgToString(layout, { staffSpacePx, score });

    const tieMatches = [...svg.matchAll(/<path\s+[^>]*class="score-tie[^"]*"[^>]*>/g)];
    expect(tieMatches.length).toBe(2);

    // Identify V1 and V2 ties from data-tie-id or order
    const v1TieEl = tieMatches.find((m) => m[0].includes('v1')) ?? tieMatches[0];
    const v2TieEl = tieMatches.find((m) => m[0].includes('v2')) ?? tieMatches[1];

    const parseCtrlY = (el: string) => {
      const d = el.match(/\sd="([^"]+)"/)?.[1]!;
      const pts = parsePathPoints(d);
      // d format: M x1 y1 Q midX ctrlYOuter x2 y2 Q midX ctrlYInner x1 y1 Z
      return { y1: pts[0].y, ctrlYOuter: pts[1].y, y2: pts[2].y };
    };

    const v1Ctrl = parseCtrlY(v1TieEl[0]);
    const v2Ctrl = parseCtrlY(v2TieEl[0]);

    // Voice 1 curves ABOVE: ctrlYOuter < y1 and ctrlYOuter < y2
    expect(v1Ctrl.ctrlYOuter).toBeLessThan(v1Ctrl.y1);
    expect(v1Ctrl.ctrlYOuter).toBeLessThan(v1Ctrl.y2);

    // Voice 2 curves BELOW: ctrlYOuter > y1 and ctrlYOuter > y2
    expect(v2Ctrl.ctrlYOuter).toBeGreaterThan(v2Ctrl.y1);
    expect(v2Ctrl.ctrlYOuter).toBeGreaterThan(v2Ctrl.y2);
  });

  it('FAILING-FIRST: Cross-barline ties and slurs geometry have valid non-NaN bounding boxes and scale transforms', () => {
    // Create a 2-measure score with a slur across notes in voice 1 and voice 2
    const score = createEmptyScore({ measures: 2 });
    const staff = score.parts[0].staves[0];
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;

    const n1 = createNote({ pitches: [createPitch('E', 5)], baseType: 'half' });
    const n2 = createNote({ pitches: [createPitch('G', 5)], baseType: 'half' });
    const n3 = createNote({ pitches: [createPitch('C', 4)], baseType: 'half' });
    const n4 = createNote({ pitches: [createPitch('E', 4)], baseType: 'half' });

    staff.measures[m0Id].voices = [
      { id: 'v1-m0', voiceIndex: 1, events: [n1] },
      { id: 'v2-m0', voiceIndex: 2, events: [n3] },
    ];
    staff.measures[m1Id].voices = [
      { id: 'v1-m1', voiceIndex: 1, events: [n2] },
      { id: 'v2-m1', voiceIndex: 2, events: [n4] },
    ];

    staff.slurs = [
      { id: 'slur-v1', startEventId: n1.id, endEventId: n2.id },
      { id: 'slur-v2', startEventId: n3.id, endEventId: n4.id },
    ];

    const layout = layoutScore(score, { width: 70 });
    const staffSpacePx = 10;
    const svg = renderSvgToString(layout, { staffSpacePx, score });

    const slurMatches = [...svg.matchAll(/<path\s+[^>]*class="score-slur[^"]*"[^>]*>/g)];
    expect(slurMatches.length).toBe(2);

    for (const match of slurMatches) {
      const el = match[0];
      const d = el.match(/\sd="([^"]+)"/)?.[1]!;
      const transform = el.match(/transform="([^"]+)"/)?.[1] ?? null;

      const bbox = computeTransformedBBox(d, transform);
      expect(Number.isNaN(bbox.minX)).toBe(false);
      expect(Number.isNaN(bbox.minY)).toBe(false);
      // Must not be near origin 0
      expect(bbox.minX).toBeGreaterThan(20);
      expect(bbox.minY).toBeGreaterThan(50);
    }
  });
});
