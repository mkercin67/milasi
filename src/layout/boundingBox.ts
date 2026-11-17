/**
 * Layout bounding box computation in staff spaces.
 *
 * Computes deterministic bounding boxes for layout items and complete LayoutResult
 * structures, taking into account SMuFL glyph metrics, line thicknesses, beam paths,
 * and text dimensions.
 */

import { LayoutItem, LayoutResult } from './types';
import { getGlyphBBox, getGlyphAdvanceWidth } from './smufl';

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Computes the bounding box of a single LayoutItem on a system at vertical offset sysY.
 * Coordinates are in staff spaces.
 */
export function computeItemBoundingBox(item: LayoutItem, sysY: number): BoundingBox {
  if (item.kind === 'line') {
    const x1 = item.x;
    const x2 = item.x2 ?? item.x;
    const y1 = sysY + item.y;
    const y2 = sysY + (item.y2 ?? item.y);
    const th = item.thickness ?? 0.13;
    const minX = Math.min(x1, x2) - th / 2;
    const maxX = Math.max(x1, x2) + th / 2;
    const minY = Math.min(y1, y2) - th / 2;
    const maxY = Math.max(y1, y2) + th / 2;
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  if (item.kind === 'beam' && item.points && item.points.length > 0) {
    const xs = item.points.map((p) => p.x);
    const ys = item.points.map((p) => sysY + p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  if (item.kind === 'glyph' && item.glyph) {
    const scale = item.scale ?? 1.0;
    const bbox = getGlyphBBox(item.glyph);
    if (bbox) {
      // SMuFL Y is positive upwards; screen Y is positive downwards
      const minX = item.x + bbox.bBoxSW[0] * scale;
      const maxX = item.x + bbox.bBoxNE[0] * scale;
      const minY = (sysY + item.y) - bbox.bBoxNE[1] * scale;
      const maxY = (sysY + item.y) - bbox.bBoxSW[1] * scale;
      return {
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }
    const adv = getGlyphAdvanceWidth(item.glyph);
    const minX = item.x;
    const maxX = item.x + adv * scale;
    const minY = (sysY + item.y) - 1.0 * scale;
    const maxY = (sysY + item.y) + 1.0 * scale;
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  if (item.kind === 'text' && item.text) {
    const sz = item.fontSize ?? 1.5;
    const fontScale = item.fontFamily && item.fontFamily.includes('Times') ? 0.50 : 0.55;
    const textWidth = item.text.length * sz * fontScale;
    let minX = item.x;
    let maxX = item.x + textWidth;
    if (item.textAnchor === 'middle') {
      minX = item.x - textWidth / 2;
      maxX = item.x + textWidth / 2;
    } else if (item.textAnchor === 'end') {
      minX = item.x - textWidth;
      maxX = item.x;
    }
    const minY = (sysY + item.y) - sz * 0.9;
    const maxY = (sysY + item.y) + sz * 0.3;
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  const minX = item.x;
  const maxX = item.x2 ?? item.x;
  const minY = sysY + item.y;
  const maxY = sysY + (item.y2 ?? item.y);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Computes the overall bounding box enclosing all visible items of a LayoutResult,
 * with an optional margin in staff spaces.
 *
 * @param layout - The layout to measure.
 * @param margin - Safety padding in staff spaces (default: 1.0).
 * @returns BoundingBox with margin applied.
 */
export function computeLayoutBoundingBox(layout: LayoutResult, margin: number = 1.0): BoundingBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let hasItems = false;

  for (const sys of layout.systems) {
    for (const item of sys.items) {
      if (item.hidden) continue;
      const b = computeItemBoundingBox(item, sys.y);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
      hasItems = true;
    }
  }

  if (!hasItems) {
    return {
      minX: 0,
      maxX: layout.width,
      minY: 0,
      maxY: layout.height,
      width: layout.width,
      height: layout.height,
    };
  }

  const boundedMinX = minX - margin;
  const boundedMaxX = maxX + margin;
  const boundedMinY = minY - margin;
  const boundedMaxY = maxY + margin;

  return {
    minX: boundedMinX,
    maxX: boundedMaxX,
    minY: boundedMinY,
    maxY: boundedMaxY,
    width: boundedMaxX - boundedMinX,
    height: boundedMaxY - boundedMinY,
  };
}
