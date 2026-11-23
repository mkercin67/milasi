// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Builds the score a "New score" dialog asks for: single staff, grand staff or an ensemble template (M7c-6).
 */

import { applyTemplate } from '../../core/ensembleCommands';
import { createEmptyScore, createGrandStaffScore, createRest } from '../../core/factory';
import type { Score } from '../../core/model';
import { allStaves } from '../../core/staffLookup';
import type { NewScoreConfig } from '../NewScoreModal';

export function buildNewScore(config: NewScoreConfig): Score {
  const options = {
    clef: config.clef,
    keySig: config.keySig,
    timeSig: config.timeSig,
    measures: config.measures,
  };
  const template = config.template ?? 'single';
  let fresh: Score;
  if (template === 'piano') fresh = createGrandStaffScore(options);
  else if (template === 'single') fresh = createEmptyScore(options);
  else fresh = applyTemplate(template).apply(createEmptyScore(options));

  if (config.isPickup && config.pickupDurationTicks) {
    const pickupTicks = config.pickupDurationTicks;
    // structuredClone-free: the score is fresh, but applyTemplate results are frozen by immer.
    fresh = structuredClone(fresh);
    fresh.measures[0].actualTicks = pickupTicks;
    const m0Id = fresh.measures[0].id;
    // Every staff gets the pickup rest (one staff, both of a grand staff, or every part of a template).
    for (const st of allStaves(fresh)) {
      st.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events = [
        createRest({
          baseType: pickupTicks === 480 ? 'eighth' : pickupTicks === 1920 ? 'half' : 'quarter',
          duration: pickupTicks,
        }),
      ];
    }
  }
  return fresh;
}
