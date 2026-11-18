/**
 * Visual override resolution and render-time clamping across systems.
 */

import { Score } from '../core/model';
import { LayoutItem, LayoutSystem } from './types';
import { clampOverrideOffset, getSystemMeasureBounds, SystemMeasureBounds } from './mouse';

export function applyVisualOverrides(
  score: Score,
  systems: LayoutSystem[]
): Record<string, { dx: number; dy: number }> {
  if (!score.overrides || Object.keys(score.overrides).length === 0) {
    return {};
  }

  // Build lookup of event IDs to their kind and measure for layout override rules
  const eventKindMap = new Map<string, string>();
  const eventMeasureMap = new Map<string, string>();
  for (const part of score.parts) {
    for (const st of part.staves) {
      for (const mId of Object.keys(st.measures)) {
        for (const vc of st.measures[mId].voices) {
          for (const ev of vc.events) {
            eventKindMap.set(ev.id, ev.kind);
            eventMeasureMap.set(ev.id, mId);
          }
        }
      }
    }
  }

  const appliedOverrides: Record<string, { dx: number; dy: number }> = {};

  for (const sys of systems) {
    const measureBoundsList = getSystemMeasureBounds(sys);
    const measureBoundsMap = new Map<string, SystemMeasureBounds>();
    for (const mb of measureBoundsList) {
      measureBoundsMap.set(mb.measureId, mb);
    }

    const eventItemsMap = new Map<string, LayoutItem[]>();
    for (const item of sys.items) {
      if (item.eventId) {
        let list = eventItemsMap.get(item.eventId);
        if (!list) {
          list = [];
          eventItemsMap.set(item.eventId, list);
        }
        list.push(item);
      }
    }

    const processedItems = new Set<string>();

    for (const [eventId, items] of eventItemsMap.entries()) {
      const isRest = eventKindMap.get(eventId) === 'rest';
      const measureId = eventMeasureMap.get(eventId);
      const mBounds = measureId ? measureBoundsMap.get(measureId) : undefined;

      const evOverride = score.overrides[eventId];
      const rawDx = evOverride?.dx ?? 0;
      const rawDy = evOverride?.dy ?? 0;

      let effectiveDx = 0;
      let effectiveDy = 0;

      if (evOverride && (rawDx !== 0 || (isRest && rawDy !== 0))) {
        if (mBounds) {
          const clamped = clampOverrideOffset(items, mBounds, rawDx, rawDy, isRest, 0, 0);
          effectiveDx = clamped.dx;
          effectiveDy = clamped.dy;
        } else {
          effectiveDx = rawDx;
          effectiveDy = isRest ? rawDy : 0;
        }
      }

      if (effectiveDx !== 0 || effectiveDy !== 0) {
        appliedOverrides[eventId] = { dx: effectiveDx, dy: effectiveDy };
      }

      for (const item of items) {
        processedItems.add(item.id);
        const itemOverride = score.overrides[item.id];
        const itemExtraDx =
          itemOverride && item.id !== eventId
            ? itemOverride.dx ?? 0
            : 0;
        const itemExtraDy =
          itemOverride && item.id !== eventId && isRest
            ? itemOverride.dy ?? 0
            : 0;

        const totalDx = effectiveDx + itemExtraDx;
        const totalDy = effectiveDy + itemExtraDy;

        if (totalDx !== 0) {
          item.x += totalDx;
          if (item.x2 !== undefined) item.x2 += totalDx;
        }
        if (totalDy !== 0) {
          item.y += totalDy;
          if (item.y2 !== undefined) item.y2 += totalDy;
        }

        const scale = itemOverride?.scale ?? evOverride?.scale;
        if (scale !== undefined) {
          item.scale = scale;
        }

        const hidden = itemOverride?.hidden ?? evOverride?.hidden;
        if (hidden !== undefined) {
          item.hidden = hidden;
        }
      }
    }

    // Standalone items (lines, barlines, headers)
    for (const item of sys.items) {
      if (processedItems.has(item.id)) continue;
      const itemOverride = score.overrides[item.id];
      if (!itemOverride) continue;

      const rawDx = itemOverride.dx ?? 0;
      const rawDy = itemOverride.dy ?? 0;
      const clampedDx = rawDx;
      const clampedDy = rawDy;

      if (clampedDx !== 0) {
        item.x += clampedDx;
        if (item.x2 !== undefined) item.x2 += clampedDx;
      }
      if (clampedDy !== 0) {
        item.y += clampedDy;
        if (item.y2 !== undefined) item.y2 += clampedDy;
      }
      if (itemOverride.scale !== undefined) item.scale = itemOverride.scale;
      if (itemOverride.hidden !== undefined) item.hidden = itemOverride.hidden;
    }
  }

  return appliedOverrides;
}
