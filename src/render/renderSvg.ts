/**
 * SVG Renderer for ScoreForge layout structures.
 *
 * Performance optimized:
 * 1. By default, renders SMuFL musical glyphs as vector SVG <path> elements inside <defs>
 *    and references them via <use>, eliminating browser font layout, PUA codepoint styling
 *    and forced reflow issues.
 * 2. Supports ?text / useTextFallback: true for A/B testing with traditional <text> rendering.
 * 3. Attaches data-id and data-event-id attributes to every visual element for hit-testing.
 */

import { LayoutItem, LayoutResult, LayoutSystem } from '../layout/types';
import { computeLayoutBoundingBox } from '../layout/boundingBox';
import { layoutArticulations, layoutDynamics, layoutSlurs } from '../layout/notations';
import { layoutTies } from '../layout/ties';
import { Score } from '../core/model';
import { getGlyphChar } from './smufl';
import { getGlyphPath, UNITS_PER_EM } from './glyphPaths.generated';

export interface RenderSvgOptions {
  /** Number of screen pixels per staff space. Defaults to 10. */
  staffSpacePx?: number;
  /** Foreground fill/stroke color. Defaults to 'currentColor'. */
  color?: string;
  /** When true, renders glyphs as <text> using Bravura font instead of SVG paths. Defaults to false. */
  useTextFallback?: boolean;
  /** Margin in staff spaces around all items for the SVG viewBox. Defaults to 1.5. */
  viewBoxMargin?: number;
  /** Optional score to compute and render overlays (ties, slurs, dynamics, articulations). */
  score?: Score;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Generates an SVG element from a LayoutResult.
 *
 * @param layout - The layout to render.
 * @param options - Rendering scale and styling options.
 * @returns An SVGElement (SVGSVGElement).
 */
export function renderSvg(
  layout: LayoutResult,
  options: RenderSvgOptions = {}
): SVGSVGElement {
  const staffSpacePx = options.staffSpacePx ?? 10;
  const color = options.color ?? 'currentColor';
  const useTextFallback = options.useTextFallback ?? false;
  const margin = options.viewBoxMargin ?? 1.5;

  const bbox = computeLayoutBoundingBox(layout, margin);
  const minXPx = Math.floor(bbox.minX * staffSpacePx);
  const minYPx = Math.floor(bbox.minY * staffSpacePx);
  const totalWidthPx = Math.ceil(bbox.width * staffSpacePx);
  const totalHeightPx = Math.ceil(bbox.height * staffSpacePx);

  if (typeof document === 'undefined') {
    throw new Error('renderSvg requires a DOM environment (document is undefined).');
  }

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `${minXPx} ${minYPx} ${totalWidthPx} ${totalHeightPx}`);
  svg.setAttribute('width', `${totalWidthPx}px`);
  svg.setAttribute('height', `${totalHeightPx}px`);
  svg.setAttribute('style', `color: ${color}; overflow: visible; user-select: none;`);

  if (useTextFallback) {
    const styleEl = document.createElementNS(SVG_NS, 'style');
    styleEl.textContent = `
      @font-face {
        font-family: 'Bravura';
        src: url('/fonts/Bravura.woff2') format('woff2');
        font-weight: normal;
        font-style: normal;
      }
      .scoreforge-glyph {
        font-family: 'Bravura';
        dominant-baseline: alphabetic;
        text-anchor: start;
      }
      .event-hit-area {
        fill: transparent;
        stroke: none;
      }
    `;
    svg.appendChild(styleEl);
  } else {
    // Collect used glyphs and build <defs>
    const usedGlyphs = new Set<string>();
    for (const sys of layout.systems) {
      for (const it of sys.items) {
        if (!it.hidden && it.kind === 'glyph' && it.glyph) {
          usedGlyphs.add(it.glyph);
        }
      }
    }
    const scoreForDefs = options.score ?? layout.score;
    if (scoreForDefs) {
      for (const d of layoutDynamics(scoreForDefs, layout)) {
        if (d.glyph) usedGlyphs.add(d.glyph);
      }
      for (const a of layoutArticulations(scoreForDefs, layout)) {
        if (a.glyph) usedGlyphs.add(a.glyph);
      }
    }

    const defs = document.createElementNS(SVG_NS, 'defs');
    for (const glyphName of Array.from(usedGlyphs).sort()) {
      const pathD = getGlyphPath(glyphName);
      if (pathD) {
        const pathEl = document.createElementNS(SVG_NS, 'path');
        pathEl.setAttribute('id', `glyph-${glyphName}`);
        pathEl.setAttribute('d', pathD);
        defs.appendChild(pathEl);
      }
    }
    svg.appendChild(defs);
  }

  const fontSize = staffSpacePx * 4;
  const scale = staffSpacePx / (UNITS_PER_EM / 4);

  for (const sys of layout.systems) {
    const sysGroup = document.createElementNS(SVG_NS, 'g');
    sysGroup.setAttribute('data-system-index', sys.index.toString());

    // Map bounding boxes for event hit areas
    const eventBoxes = new Map<string, { minX: number; maxX: number; minY: number; maxY: number }>();

    for (const item of sys.items) {
      if (item.hidden) continue;

      if (item.eventId) {
        let b = eventBoxes.get(item.eventId);
        if (!b) {
          b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
          eventBoxes.set(item.eventId, b);
        }
        const itemX = item.x;
        const itemY = item.y;
        if (item.kind === 'line') {
          const itemX2 = item.x2 ?? itemX;
          const itemY2 = item.y2 ?? itemY;
          b.minX = Math.min(b.minX, itemX, itemX2);
          b.maxX = Math.max(b.maxX, itemX, itemX2);
          b.minY = Math.min(b.minY, itemY, itemY2);
          b.maxY = Math.max(b.maxY, itemY, itemY2);
        } else {
          b.minX = Math.min(b.minX, itemX);
          b.maxX = Math.max(b.maxX, itemX + 1.2);
          b.minY = Math.min(b.minY, itemY - 1.0);
          b.maxY = Math.max(b.maxY, itemY + 0.5);
        }
      }

      const element = renderItemToSvgElement(item, sys, staffSpacePx, fontSize, scale, useTextFallback);
      if (element) {
        sysGroup.appendChild(element);
      }
    }

    // Render hit areas with ~0.5 staff space margin for easy clicking
    const margin = 0.5;
    for (const [eventId, box] of eventBoxes.entries()) {
      const hitX = (box.minX - margin) * staffSpacePx;
      const hitY = (sys.y + box.minY - margin) * staffSpacePx;
      const hitW = (box.maxX - box.minX + 2 * margin) * staffSpacePx;
      const hitH = (box.maxY - box.minY + 2 * margin) * staffSpacePx;

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'event-hit-area');
      rect.setAttribute('data-event-id', eventId);
      rect.setAttribute('x', hitX.toString());
      rect.setAttribute('y', hitY.toString());
      rect.setAttribute('width', Math.max(1, hitW).toString());
      rect.setAttribute('height', Math.max(1, hitH).toString());
      rect.setAttribute('fill', 'transparent');
      rect.setAttribute('pointer-events', 'all');
      rect.setAttribute('style', 'cursor: pointer;');
      sysGroup.appendChild(rect);
    }

    svg.appendChild(sysGroup);
  }

  const score = options.score ?? layout.score;
  const ties = score ? layoutTies(score, layout) : [];
  const slurs = score ? layoutSlurs(score, layout) : [];
  const dynamics = score ? layoutDynamics(score, layout) : [];
  const articulations = score ? layoutArticulations(score, layout) : [];

  for (const t of ties) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('data-tie-id', t.id);
    path.setAttribute('class', 'score-tie notranslate');
    path.setAttribute('d', t.d);
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('stroke', 'none');
    path.setAttribute('pointer-events', 'none');
    svg.appendChild(path);
  }
  for (const s of slurs) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('data-slur-id', s.id);
    path.setAttribute('class', 'score-slur notranslate');
    path.setAttribute('d', s.d);
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('stroke', 'none');
    path.setAttribute('pointer-events', 'none');
    svg.appendChild(path);
  }
  const renderOverlayGlyphGroup = (
    items: LayoutItem[],
    className: string,
    idAttr: string,
    typeAttr: string
  ) => {
    for (const item of items) {
      const sysIdx = item.systemIndex ?? 0;
      const sys = layout.systems[sysIdx];
      const pxX = item.x * staffSpacePx;
      const pxY = ((sys ? sys.y : 0) + item.y) * staffSpacePx;
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', `${className} notranslate`);
      g.setAttribute(idAttr, item.id);
      if (item.eventId) g.setAttribute('data-event-id', item.eventId);
      if (item.type) g.setAttribute(typeAttr, item.type);
      g.setAttribute('pointer-events', 'none');
      if (useTextFallback && item.glyph) {
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', pxX.toString());
        text.setAttribute('y', pxY.toString());
        text.setAttribute('font-size', `${fontSize}px`);
        text.setAttribute('font-family', 'Bravura, BravuraText, sans-serif');
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('dominant-baseline', 'alphabetic');
        text.setAttribute('fill', 'currentColor');
        text.textContent = getGlyphChar(item.glyph);
        g.appendChild(text);
      } else if (item.glyph) {
        const use = document.createElementNS(SVG_NS, 'use');
        use.setAttribute('href', `#glyph-${item.glyph}`);
        use.setAttribute('transform', `translate(${pxX}, ${pxY}) scale(${scale})`);
        use.setAttribute('fill', 'currentColor');
        g.appendChild(use);
      }
      svg.appendChild(g);
    }
  };

  renderOverlayGlyphGroup(dynamics, 'score-dynamic', 'data-dynamic-id', 'data-dynamic-type');
  renderOverlayGlyphGroup(articulations, 'score-articulation', 'data-articulation-id', 'data-articulation-type');

  return svg;
}

/**
 * Converts a LayoutItem to an SVGElement.
 */
function renderItemToSvgElement(
  item: LayoutItem,
  sys: LayoutSystem,
  staffSpacePx: number,
  fontSize: number,
  scale: number,
  useTextFallback: boolean
): SVGElement | null {
  const pxX = item.x * staffSpacePx;
  const pxY = (sys.y + item.y) * staffSpacePx;

  if (item.kind === 'beam' && item.points && item.points.length > 0) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('data-id', item.id);
    if (item.beamGroupId) {
      path.setAttribute('data-beam-group', item.beamGroupId);
    }
    if (item.eventIds && item.eventIds.length > 0) {
      path.setAttribute('data-event-ids', item.eventIds.join(','));
    }
    if (item.level !== undefined) {
      path.setAttribute('data-beam-level', item.level.toString());
    }
    path.setAttribute('class', 'scoreforge-beam');
    const d =
      item.points
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * staffSpacePx} ${(sys.y + p.y) * staffSpacePx}`)
        .join(' ') + ' Z';
    path.setAttribute('d', d);
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('stroke', 'none');
    return path;
  }

  if (item.kind === 'line') {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('data-id', item.id);
    if (item.eventId) {
      line.setAttribute('data-event-id', item.eventId);
    }
    line.setAttribute('x1', pxX.toString());
    line.setAttribute('y1', pxY.toString());
    const pxX2 = (item.x2 ?? item.x) * staffSpacePx;
    const pxY2 = (sys.y + (item.y2 ?? item.y)) * staffSpacePx;
    line.setAttribute('x2', pxX2.toString());
    line.setAttribute('y2', pxY2.toString());
    line.setAttribute('stroke', 'currentColor');
    const strokeWidth = (item.thickness ?? 0.13) * staffSpacePx;
    line.setAttribute('stroke-width', strokeWidth.toString());
    line.setAttribute('stroke-linecap', 'butt');
    return line;
  }

  if (item.kind === 'glyph' && item.glyph) {
    if (useTextFallback) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('data-id', item.id);
      if (item.eventId) {
        text.setAttribute('data-event-id', item.eventId);
      }
      text.setAttribute('x', pxX.toString());
      text.setAttribute('y', pxY.toString());
      text.setAttribute('class', 'scoreforge-glyph');
      text.setAttribute('font-size', `${fontSize}px`);
      text.setAttribute('fill', 'currentColor');
      text.textContent = getGlyphChar(item.glyph);
      return text;
    }

    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('data-id', item.id);
    if (item.eventId) {
      use.setAttribute('data-event-id', item.eventId);
    }
    use.setAttribute('href', `#glyph-${item.glyph}`);
    use.setAttribute('transform', `translate(${pxX}, ${pxY}) scale(${scale})`);
    use.setAttribute('fill', 'currentColor');
    return use;
  }

  if (item.kind === 'text' && item.text) {
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('data-id', item.id);
    if (item.eventId) {
      text.setAttribute('data-event-id', item.eventId);
    }
    text.setAttribute('x', pxX.toString());
    text.setAttribute('y', pxY.toString());
    text.setAttribute('fill', 'currentColor');
    if (item.textAnchor) {
      text.setAttribute('text-anchor', item.textAnchor);
    }
    if (item.fontFamily) {
      text.setAttribute('font-family', item.fontFamily);
    }
    const sz = item.fontSize ? item.fontSize * staffSpacePx : staffSpacePx * 1.5;
    text.setAttribute('font-size', `${sz}px`);
    if (item.fontWeight) {
      text.setAttribute('font-weight', String(item.fontWeight));
    }
    if (item.fontStyle) {
      text.setAttribute('font-style', item.fontStyle);
    }
    text.textContent = item.text;
    return text;
  }

  return null;
}

/**
 * Serializes a LayoutResult into an SVG markup string.
 * Works in both browser and plain Node environments without DOM.
 *
 * @param layout - Layout data to render.
 * @param options - Scaling, fallback and color options.
 * @returns SVG XML string.
 */
export function renderSvgToString(
  layout: LayoutResult,
  options: RenderSvgOptions = {}
): string {
  const staffSpacePx = options.staffSpacePx ?? 10;
  const color = options.color ?? 'currentColor';
  const useTextFallback = options.useTextFallback ?? false;
  const margin = options.viewBoxMargin ?? 1.5;

  const bbox = computeLayoutBoundingBox(layout, margin);
  const minXPx = Math.floor(bbox.minX * staffSpacePx);
  const minYPx = Math.floor(bbox.minY * staffSpacePx);
  const totalWidthPx = Math.ceil(bbox.width * staffSpacePx);
  const totalHeightPx = Math.ceil(bbox.height * staffSpacePx);
  const fontSize = staffSpacePx * 4;
  const scale = staffSpacePx / (UNITS_PER_EM / 4);

  let defsXml = '';
  if (!useTextFallback) {
    const usedGlyphs = new Set<string>();
    for (const sys of layout.systems) {
      for (const it of sys.items) {
        if (!it.hidden && it.kind === 'glyph' && it.glyph) {
          usedGlyphs.add(it.glyph);
        }
      }
    }
    const scoreForDefs = options.score ?? layout.score;
    if (scoreForDefs) {
      for (const d of layoutDynamics(scoreForDefs, layout)) {
        if (d.glyph) usedGlyphs.add(d.glyph);
      }
      for (const a of layoutArticulations(scoreForDefs, layout)) {
        if (a.glyph) usedGlyphs.add(a.glyph);
      }
    }
    defsXml = '  <defs>\n';
    for (const glyphName of Array.from(usedGlyphs).sort()) {
      const pathD = getGlyphPath(glyphName);
      if (pathD) {
        defsXml += `    <path id="glyph-${glyphName}" d="${pathD}" />\n`;
      }
    }
    defsXml += '  </defs>\n';
  }

  let elementsXml = '';

  for (const sys of layout.systems) {
    elementsXml += `  <g data-system-index="${sys.index}">\n`;
    const eventBoxes = new Map<string, { minX: number; maxX: number; minY: number; maxY: number }>();

    for (const item of sys.items) {
      if (item.hidden) continue;

      if (item.eventId) {
        let b = eventBoxes.get(item.eventId);
        if (!b) {
          b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
          eventBoxes.set(item.eventId, b);
        }
        const itemX = item.x;
        const itemY = item.y;
        if (item.kind === 'line') {
          const itemX2 = item.x2 ?? itemX;
          const itemY2 = item.y2 ?? itemY;
          b.minX = Math.min(b.minX, itemX, itemX2);
          b.maxX = Math.max(b.maxX, itemX, itemX2);
          b.minY = Math.min(b.minY, itemY, itemY2);
          b.maxY = Math.max(b.maxY, itemY, itemY2);
        } else {
          b.minX = Math.min(b.minX, itemX);
          b.maxX = Math.max(b.maxX, itemX + 1.2);
          b.minY = Math.min(b.minY, itemY - 1.0);
          b.maxY = Math.max(b.maxY, itemY + 0.5);
        }
      }

      const pxX = item.x * staffSpacePx;
      const pxY = (sys.y + item.y) * staffSpacePx;
      const eventAttr = item.eventId ? ` data-event-id="${item.eventId}"` : '';

      if (item.kind === 'beam' && item.points && item.points.length > 0) {
        const d =
          item.points
            .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * staffSpacePx} ${(sys.y + p.y) * staffSpacePx}`)
            .join(' ') + ' Z';
        const bgAttr = item.beamGroupId ? ` data-beam-group="${item.beamGroupId}"` : '';
        const evIdsAttr =
          item.eventIds && item.eventIds.length > 0
            ? ` data-event-ids="${item.eventIds.join(',')}"`
            : '';
        const lvlAttr = item.level !== undefined ? ` data-beam-level="${item.level}"` : '';
        elementsXml += `    <path data-id="${item.id}"${bgAttr}${evIdsAttr}${lvlAttr} class="scoreforge-beam" d="${d}" fill="currentColor" stroke="none" />\n`;
      } else if (item.kind === 'line') {
        const pxX2 = (item.x2 ?? item.x) * staffSpacePx;
        const pxY2 = (sys.y + (item.y2 ?? item.y)) * staffSpacePx;
        const strokeWidth = (item.thickness ?? 0.13) * staffSpacePx;
        elementsXml += `    <line data-id="${item.id}"${eventAttr} x1="${pxX}" y1="${pxY}" x2="${pxX2}" y2="${pxY2}" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="butt" />\n`;
      } else if (item.kind === 'glyph' && item.glyph) {
        if (useTextFallback) {
          const char = getGlyphChar(item.glyph);
          elementsXml += `    <text data-id="${item.id}"${eventAttr} x="${pxX}" y="${pxY}" class="scoreforge-glyph" font-size="${fontSize}px" fill="currentColor">${char}</text>\n`;
        } else {
          elementsXml += `    <use data-id="${item.id}"${eventAttr} href="#glyph-${item.glyph}" transform="translate(${pxX}, ${pxY}) scale(${scale})" fill="currentColor" />\n`;
        }
      } else if (item.kind === 'text' && item.text) {
        const anchorAttr = item.textAnchor ? ` text-anchor="${item.textAnchor}"` : '';
        const fontAttr = item.fontFamily ? ` font-family="${item.fontFamily.replace(/"/g, '&quot;')}"` : '';
        const sz = item.fontSize ? item.fontSize * staffSpacePx : staffSpacePx * 1.5;
        const sizeAttr = ` font-size="${sz}px"`;
        const weightAttr = item.fontWeight ? ` font-weight="${item.fontWeight}"` : '';
        const styleAttr = item.fontStyle ? ` font-style="${item.fontStyle}"` : '';
        elementsXml += `    <text data-id="${item.id}"${eventAttr} x="${pxX}" y="${pxY}" fill="currentColor"${anchorAttr}${fontAttr}${sizeAttr}${weightAttr}${styleAttr}>${item.text}</text>\n`;
      }
    }

    const margin = 0.5;
    for (const [eventId, box] of eventBoxes.entries()) {
      const hitX = (box.minX - margin) * staffSpacePx;
      const hitY = (sys.y + box.minY - margin) * staffSpacePx;
      const hitW = (box.maxX - box.minX + 2 * margin) * staffSpacePx;
      const hitH = (box.maxY - box.minY + 2 * margin) * staffSpacePx;
      elementsXml += `    <rect class="event-hit-area" data-event-id="${eventId}" x="${hitX}" y="${hitY}" width="${Math.max(1, hitW)}" height="${Math.max(1, hitH)}" fill="transparent" pointer-events="all" style="cursor: pointer;" />\n`;
    }

    elementsXml += `  </g>\n`;
  }

  const score = options.score ?? layout.score;
  const ties = score ? layoutTies(score, layout) : [];
  const slurs = score ? layoutSlurs(score, layout) : [];
  const dynamics = score ? layoutDynamics(score, layout) : [];
  const articulations = score ? layoutArticulations(score, layout) : [];

  for (const t of ties) {
    elementsXml += `  <path data-tie-id="${t.id}" class="score-tie notranslate" d="${t.d}" fill="currentColor" stroke="none" pointer-events="none" />\n`;
  }
  for (const s of slurs) {
    elementsXml += `  <path data-slur-id="${s.id}" class="score-slur notranslate" d="${s.d}" fill="currentColor" stroke="none" pointer-events="none" />\n`;
  }
  for (const item of dynamics) {
    const sysIdx = item.systemIndex ?? 0;
    const sys = layout.systems[sysIdx];
    const sysY = sys ? sys.y : 0;
    const pxX = item.x * staffSpacePx;
    const pxY = (sysY + item.y) * staffSpacePx;
    const eventAttr = item.eventId ? ` data-event-id="${item.eventId}"` : '';
    const typeAttr = item.type ? ` data-dynamic-type="${item.type}"` : '';
    if (useTextFallback && item.glyph) {
      elementsXml += `  <g class="score-dynamic notranslate"${eventAttr} data-dynamic-id="${item.id}"${typeAttr} pointer-events="none">\n    <text x="${pxX}" y="${pxY}" font-size="${fontSize}px" font-family="Bravura, BravuraText, sans-serif" text-anchor="start" dominant-baseline="alphabetic" fill="currentColor">${getGlyphChar(item.glyph)}</text>\n  </g>\n`;
    } else if (item.glyph) {
      elementsXml += `  <g class="score-dynamic notranslate"${eventAttr} data-dynamic-id="${item.id}"${typeAttr} pointer-events="none">\n    <use href="#glyph-${item.glyph}" transform="translate(${pxX}, ${pxY}) scale(${scale})" fill="currentColor" />\n  </g>\n`;
    }
  }
  for (const item of articulations) {
    const sysIdx = item.systemIndex ?? 0;
    const sys = layout.systems[sysIdx];
    const sysY = sys ? sys.y : 0;
    const pxX = item.x * staffSpacePx;
    const pxY = (sysY + item.y) * staffSpacePx;
    const eventAttr = item.eventId ? ` data-event-id="${item.eventId}"` : '';
    const typeAttr = item.type ? ` data-articulation-type="${item.type}"` : '';
    if (useTextFallback && item.glyph) {
      elementsXml += `  <g class="score-articulation notranslate"${eventAttr} data-articulation-id="${item.id}"${typeAttr} pointer-events="none">\n    <text x="${pxX}" y="${pxY}" font-size="${fontSize}px" font-family="Bravura, BravuraText, sans-serif" text-anchor="start" dominant-baseline="alphabetic" fill="currentColor">${getGlyphChar(item.glyph)}</text>\n  </g>\n`;
    } else if (item.glyph) {
      elementsXml += `  <g class="score-articulation notranslate"${eventAttr} data-articulation-id="${item.id}"${typeAttr} pointer-events="none">\n    <use href="#glyph-${item.glyph}" transform="translate(${pxX}, ${pxY}) scale(${scale})" fill="currentColor" />\n  </g>\n`;
    }
  }

  const textStyleBlock = useTextFallback
    ? `  <style>
    @font-face {
      font-family: 'Bravura';
      src: url('/fonts/Bravura.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
    }
    .scoreforge-glyph {
      font-family: 'Bravura';
      dominant-baseline: alphabetic;
      text-anchor: start;
    }
  </style>\n`
    : '';

  return `<svg xmlns="${SVG_NS}" viewBox="${minXPx} ${minYPx} ${totalWidthPx} ${totalHeightPx}" width="${totalWidthPx}px" height="${totalHeightPx}px" style="color: ${color}; overflow: visible; user-select: none;">
${textStyleBlock}${defsXml}${elementsXml}</svg>`;
}
