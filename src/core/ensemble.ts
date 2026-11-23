// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Ensemble presets and templates (M7c-6): which parts a score template contains, with their clefs,
 * names and group layout. Pure data plus small helpers; the commands live in ensembleCommands.ts.
 */

import type { Clef, StaffGroup } from './model';

/** One instrument a part can be created from. `clefs` has one entry per staff. */
export interface PartPreset {
  id: string;
  name: string;
  shortName: string;
  /** Key into INSTRUMENT_CATALOGUE (or a free string for voices). */
  instrument: string;
  clefs: Clef[];
}

const TREBLE: Clef = { sign: 'G', line: 2 };
const BASS: Clef = { sign: 'F', line: 4 };

export const PART_PRESETS: Record<string, PartPreset> = {
  flute: { id: 'flute', name: 'Flute', shortName: 'Fl.', instrument: 'flute', clefs: [TREBLE] },
  violin: { id: 'violin', name: 'Violin', shortName: 'Vln.', instrument: 'violin', clefs: [TREBLE] },
  violin1: { id: 'violin1', name: 'Violin I', shortName: 'Vln. I', instrument: 'violin', clefs: [TREBLE] },
  violin2: { id: 'violin2', name: 'Violin II', shortName: 'Vln. II', instrument: 'violin', clefs: [TREBLE] },
  viola: { id: 'viola', name: 'Viola', shortName: 'Vla.', instrument: 'viola', clefs: [{ sign: 'C', line: 3 }] },
  cello: { id: 'cello', name: 'Cello', shortName: 'Vc.', instrument: 'cello', clefs: [BASS] },
  soprano: { id: 'soprano', name: 'Soprano', shortName: 'S.', instrument: 'soprano', clefs: [TREBLE] },
  alto: { id: 'alto', name: 'Alto', shortName: 'A.', instrument: 'alto', clefs: [TREBLE] },
  tenor: {
    id: 'tenor',
    name: 'Tenor',
    shortName: 'T.',
    instrument: 'tenor',
    clefs: [{ sign: 'G', line: 2, octaveShift: -1 }],
  },
  bass: { id: 'bass', name: 'Bass', shortName: 'B.', instrument: 'bass', clefs: [BASS] },
  voice: { id: 'voice', name: 'Voice', shortName: 'Vo.', instrument: 'voice', clefs: [TREBLE] },
  piano: { id: 'piano', name: 'Piano', shortName: 'Pno.', instrument: 'piano', clefs: [TREBLE, BASS] },
};

export type EnsembleTemplateId = 'solo' | 'piano' | 'satb' | 'stringQuartet' | 'voicePiano';

export interface EnsembleTemplate {
  id: EnsembleTemplateId;
  /** Preset ids, in score order. */
  parts: string[];
  /** Groups over part INDEXES of `parts`. */
  groups: { partIndexes: number[]; bracket: StaffGroup['bracket']; barlineSpan: StaffGroup['barlineSpan'] }[];
}

export const ENSEMBLE_TEMPLATES: Record<EnsembleTemplateId, EnsembleTemplate> = {
  solo: { id: 'solo', parts: ['violin'], groups: [] },
  piano: { id: 'piano', parts: ['piano'], groups: [{ partIndexes: [0], bracket: 'brace', barlineSpan: 'through' }] },
  satb: {
    id: 'satb',
    parts: ['soprano', 'alto', 'tenor', 'bass'],
    groups: [{ partIndexes: [0, 1, 2, 3], bracket: 'bracket', barlineSpan: 'individual' }],
  },
  stringQuartet: {
    id: 'stringQuartet',
    parts: ['violin1', 'violin2', 'viola', 'cello'],
    groups: [{ partIndexes: [0, 1, 2, 3], bracket: 'bracket', barlineSpan: 'through' }],
  },
  voicePiano: {
    id: 'voicePiano',
    parts: ['voice', 'piano'],
    groups: [
      { partIndexes: [0], bracket: 'none', barlineSpan: 'individual' },
      { partIndexes: [1], bracket: 'brace', barlineSpan: 'through' },
    ],
  },
};

/** MIDI channels a pitched part may use (9 is percussion). */
export const PITCHED_CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];

/** The lowest pitched channel not used by `used`; falls back to the first when all are taken. */
export function nextFreeChannel(used: number[]): number {
  for (const ch of PITCHED_CHANNELS) if (!used.includes(ch)) return ch;
  return PITCHED_CHANNELS[0];
}
