// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Ensemble commands (M7c-6): add, remove and move parts, define groups, apply a template.
 * Music is never deleted except by removePart, which only removes the part asked for.
 */

import { produce } from 'immer';
import type { Command } from './commandTypes';
import { createRest, newId } from './factory';
import { ENSEMBLE_TEMPLATES, EnsembleTemplateId, nextFreeChannel, PART_PRESETS } from './ensemble';
import type { Id, Part, Score, Staff, StaffGroup } from './model';
import { fillMeasureWithRests, measureTicks } from './time';

/** A staff with a rest-filled measure for every measure definition of the score. */
function emptyStaffFor(score: Score, clef: Staff['clef']): Staff {
  const staff: Staff = { id: newId(), clef: { ...clef }, measures: {}, slurs: [] };
  for (const m of score.measures) {
    const full = measureTicks(m.timeSig);
    const ticks = m.actualTicks ?? full;
    const events =
      ticks === full
        ? [createRest({ baseType: 'whole', duration: full, wholeMeasure: true })]
        : fillMeasureWithRests(ticks, () => newId());
    staff.measures[m.id] = { voices: [{ id: newId(), voiceIndex: 1, events }] };
  }
  return staff;
}

function buildPart(score: Score, presetId: string, usedChannels: number[]): Part {
  const preset = PART_PRESETS[presetId];
  if (!preset) throw new Error(`Unknown part preset: ${presetId}`);
  return {
    id: newId(),
    name: preset.name,
    shortName: preset.shortName,
    instrument: preset.instrument,
    midiChannel: nextFreeChannel(usedChannels),
    staves: preset.clefs.map((c) => emptyStaffFor(score, c)),
  };
}

/** Adds a part built from a preset after `afterPartId` (default: at the end). Unknown preset/part: no change. */
export function addPart(presetId: string, afterPartId?: Id): Command {
  return {
    name: 'addPart',
    apply(score: Score): Score {
      if (!PART_PRESETS[presetId]) return score;
      if (afterPartId !== undefined && !score.parts.some((p) => p.id === afterPartId)) return score;
      return produce(score, (draft) => {
        const part = buildPart(score, presetId, score.parts.map((p) => p.midiChannel));
        const at = afterPartId === undefined ? draft.parts.length : draft.parts.findIndex((p) => p.id === afterPartId) + 1;
        draft.parts.splice(at, 0, part);
      });
    },
  };
}

/** Removes a part and its staves; groups lose the part and are dropped when empty. The last part stays. */
export function removePart(partId: Id): Command {
  return {
    name: 'removePart',
    apply(score: Score): Score {
      if (score.parts.length <= 1 || !score.parts.some((p) => p.id === partId)) return score;
      return produce(score, (draft) => {
        draft.parts = draft.parts.filter((p) => p.id !== partId);
        for (const g of draft.groups) g.partIds = g.partIds.filter((id) => id !== partId);
        draft.groups = draft.groups.filter((g) => g.partIds.length > 0);
      });
    },
  };
}

/** Moves a part one place up (-1) or down (+1); at the ends nothing changes. */
export function movePart(partId: Id, direction: -1 | 1): Command {
  return {
    name: 'movePart',
    apply(score: Score): Score {
      const i = score.parts.findIndex((p) => p.id === partId);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= score.parts.length) return score;
      return produce(score, (draft) => {
        const [p] = draft.parts.splice(i, 1);
        draft.parts.splice(j, 0, p);
      });
    },
  };
}

/** True when the part ids of two groups overlap without one containing the other. */
function crossing(a: Id[], b: Id[]): boolean {
  const inter = a.filter((x) => b.includes(x)).length;
  return inter > 0 && inter < a.length && inter < b.length;
}

/**
 * Defines a group over parts. Parts must exist and be adjacent in score order; a group that would cross an
 * existing one is refused (score unchanged). A group over exactly the same parts is replaced.
 */
export function setGroup(
  partIds: Id[],
  bracket: StaffGroup['bracket'],
  barlineSpan: StaffGroup['barlineSpan']
): Command {
  return {
    name: 'setGroup',
    apply(score: Score): Score {
      if (partIds.length === 0) return score;
      const idx = partIds.map((id) => score.parts.findIndex((p) => p.id === id));
      if (idx.some((i) => i < 0)) return score;
      const sorted = [...idx].sort((a, b) => a - b);
      if (new Set(sorted).size !== sorted.length || sorted[sorted.length - 1] - sorted[0] !== sorted.length - 1) {
        return score;
      }
      const ordered = sorted.map((i) => score.parts[i].id);
      const same = (g: StaffGroup) => g.partIds.length === ordered.length && ordered.every((id) => g.partIds.includes(id));
      const others = score.groups.filter((g) => !same(g));
      if (others.some((g) => crossing(g.partIds, ordered))) return score;
      return produce(score, (draft) => {
        const existing = draft.groups.find((g) => same(g));
        if (existing) {
          existing.bracket = bracket;
          existing.barlineSpan = barlineSpan;
        } else {
          draft.groups.push({ id: newId(), partIds: ordered, bracket, barlineSpan });
        }
      });
    },
  };
}

export function removeGroup(groupId: Id): Command {
  return {
    name: 'removeGroup',
    apply(score: Score): Score {
      if (!score.groups.some((g) => g.id === groupId)) return score;
      return produce(score, (draft) => {
        draft.groups = draft.groups.filter((g) => g.id !== groupId);
      });
    },
  };
}

/**
 * Applies a template. On a score whose every staff is empty (rests only) the parts are REPLACED by the
 * template; otherwise the template's parts are ADDED after the existing ones and no music is deleted.
 * Groups of the template are added over the new parts.
 */
export function applyTemplate(templateId: EnsembleTemplateId): Command {
  return {
    name: 'applyTemplate',
    apply(score: Score): Score {
      const tpl = ENSEMBLE_TEMPLATES[templateId];
      if (!tpl) return score;
      const empty = score.parts.every((p) =>
        p.staves.every((s) =>
          Object.values(s.measures).every((m) => m.voices.every((v) => v.events.every((e) => e.kind === 'rest')))
        )
      );
      return produce(score, (draft) => {
        if (empty) {
          draft.parts = [];
          draft.groups = [];
        }
        const used = draft.parts.map((p) => p.midiChannel);
        const created: Part[] = [];
        for (const presetId of tpl.parts) {
          const part = buildPart(score, presetId, used);
          used.push(part.midiChannel);
          created.push(part);
        }
        draft.parts.push(...created);
        for (const g of tpl.groups) {
          draft.groups.push({
            id: newId(),
            partIds: g.partIndexes.map((i) => created[i].id),
            bracket: g.bracket,
            barlineSpan: g.barlineSpan,
          });
        }
      });
    },
  };
}
