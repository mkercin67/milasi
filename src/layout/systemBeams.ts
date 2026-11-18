// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Beam polygon generation across stretched & overridden system stems.
 */

import { computeBeamGroupGeometry, BeamStemInput } from './beamLayout';
import { staffPositionToY } from './pitch';
import { LayoutItem, LayoutSystem } from './types';
import { MeasureLayoutChunk, STEM_LENGTH } from './layoutPrimitives';

export interface SystemPlan {
  measures: MeasureLayoutChunk[];
  measureIndices: number[];
  headerWidth: number;
  headerItems: LayoutItem[];
}

export function generateSingleSystemBeams(sys: LayoutSystem, plan: SystemPlan): void {
  const stemByEventId = new Map<string, LayoutItem>();
  const noteByEventId = new Map<string, LayoutItem>();
  for (const item of sys.items) {
    if (item.eventId && item.id === `${item.eventId}-stem`) {
      stemByEventId.set(item.eventId, item);
    } else if (item.eventId && item.id === item.eventId) {
      noteByEventId.set(item.eventId, item);
    }
  }

  for (const chunk of plan.measures) {
    for (const bg of chunk.beamGroups) {
      const stemInputs: BeamStemInput[] = [];
      const stemItemsToUpdate: Array<{ eventId: string; item: LayoutItem }> = [];

      for (const evMeta of bg.events) {
        const stemItem = stemByEventId.get(evMeta.eventId);
        if (!stemItem || stemItem.hidden) continue;

        const noteItem = noteByEventId.get(evMeta.eventId);
        const lowestStep = evMeta.stepPositions[0] ?? 0;
        const highestStep = evMeta.stepPositions[evMeta.stepPositions.length - 1] ?? 0;
        const beamSideStep = bg.stemDir === 'up' ? highestStep : lowestStep;
        const beamSideNoteY = staffPositionToY(beamSideStep);
        const naturalStemEndY =
          beamSideNoteY + (bg.stemDir === 'up' ? -STEM_LENGTH : STEM_LENGTH);

        stemInputs.push({
          eventId: evMeta.eventId,
          baseType: evMeta.baseType,
          stepPositions: evMeta.stepPositions,
          noteX: noteItem ? noteItem.x : stemItem.x,
          stemX: stemItem.x,
          stemStartY: stemItem.y,
          beamSideNoteY,
          naturalStemEndY,
          startTick: evMeta.startTick,
        });
        stemItemsToUpdate.push({ eventId: evMeta.eventId, item: stemItem });
      }

      if (stemInputs.length < 2) continue;

      const geom = computeBeamGroupGeometry(bg.beamGroupId, stemInputs, bg.stemDir);

      for (const { eventId, item } of stemItemsToUpdate) {
        if (geom.stemEndYs[eventId] !== undefined) {
          item.y2 = geom.stemEndYs[eventId];
        }
      }

      sys.items.push(...geom.beamItems);
      if (sys.staves[0] && sys.staves[0].items !== sys.items) {
        sys.staves[0].items.push(...geom.beamItems);
      }
    }
  }
}

export function generateSystemBeams(systems: LayoutSystem[], systemPlans: SystemPlan[]): void {
  for (let sIdx = 0; sIdx < systems.length; sIdx++) {
    const sys = systems[sIdx];
    const plan = systemPlans[sIdx];
    if (!plan) continue;
    generateSingleSystemBeams(sys, plan);
  }
}
