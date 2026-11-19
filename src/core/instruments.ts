// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Instrument definitions, abbreviations, and MIDI classifications.
 * Pure internal catalog with zero user-visible / localized strings.
 */

export interface InstrumentDefinition {
  id: string;
  name: string;
  shortName: string;
  isPercussion: boolean;
  clef?: { sign: 'G' | 'F' | 'C'; line: number };
}

export const INSTRUMENT_CATALOGUE: Record<string, InstrumentDefinition> = {
  violin: { id: 'violin', name: 'Violin', shortName: 'Vln.', isPercussion: false, clef: { sign: 'G', line: 2 } },
  viola: { id: 'viola', name: 'Viola', shortName: 'Vla.', isPercussion: false, clef: { sign: 'C', line: 3 } },
  cello: { id: 'cello', name: 'Cello', shortName: 'Vc.', isPercussion: false, clef: { sign: 'F', line: 4 } },
  contrabass: { id: 'contrabass', name: 'Contrabass', shortName: 'Cb.', isPercussion: false, clef: { sign: 'F', line: 4 } },
  piano: { id: 'piano', name: 'Piano', shortName: 'Pno.', isPercussion: false, clef: { sign: 'G', line: 2 } },
  flute: { id: 'flute', name: 'Flute', shortName: 'Fl.', isPercussion: false, clef: { sign: 'G', line: 2 } },
  oboe: { id: 'oboe', name: 'Oboe', shortName: 'Ob.', isPercussion: false, clef: { sign: 'G', line: 2 } },
  clarinet: { id: 'clarinet', name: 'Clarinet', shortName: 'Cl.', isPercussion: false, clef: { sign: 'G', line: 2 } },
  bassoon: { id: 'bassoon', name: 'Bassoon', shortName: 'Bsn.', isPercussion: false, clef: { sign: 'F', line: 4 } },
  trumpet: { id: 'trumpet', name: 'Trumpet', shortName: 'Tpt.', isPercussion: false, clef: { sign: 'G', line: 2 } },
  horn: { id: 'horn', name: 'French Horn', shortName: 'Hn.', isPercussion: false, clef: { sign: 'G', line: 2 } },
  trombone: { id: 'trombone', name: 'Trombone', shortName: 'Tbn.', isPercussion: false, clef: { sign: 'F', line: 4 } },
  tuba: { id: 'tuba', name: 'Tuba', shortName: 'Tba.', isPercussion: false, clef: { sign: 'F', line: 4 } },
  voice: { id: 'voice', name: 'Voice', shortName: 'Vo.', isPercussion: false, clef: { sign: 'G', line: 2 } },
  soprano: { id: 'soprano', name: 'Soprano', shortName: 'S.', isPercussion: false, clef: { sign: 'G', line: 2 } },
  alto: { id: 'alto', name: 'Alto', shortName: 'A.', isPercussion: false, clef: { sign: 'G', line: 2 } },
  tenor: { id: 'tenor', name: 'Tenor', shortName: 'T.', isPercussion: false, clef: { sign: 'G', line: 2 } },
  bass: { id: 'bass', name: 'Bass', shortName: 'B.', isPercussion: false, clef: { sign: 'F', line: 4 } },
  timpani: { id: 'timpani', name: 'Timpani', shortName: 'Timp.', isPercussion: true, clef: { sign: 'F', line: 4 } },
  percussion: { id: 'percussion', name: 'Percussion', shortName: 'Perc.', isPercussion: true },
  drums: { id: 'drums', name: 'Drums', shortName: 'Dr.', isPercussion: true },
};

/** Looks up an instrument in the catalogue by id or name. */
export function findInstrumentInCatalogue(nameOrId?: string): InstrumentDefinition | undefined {
  if (!nameOrId) return undefined;
  const norm = nameOrId.trim().toLowerCase();
  for (const [key, def] of Object.entries(INSTRUMENT_CATALOGUE)) {
    if (key === norm || def.id.toLowerCase() === norm || def.name.toLowerCase() === norm) {
      return def;
    }
  }
  return undefined;
}

/**
 * Resolves shortName for an instrument or part name.
 * Uses catalog if found; otherwise:
 * - If name is <= 6 characters: name unchanged
 * - If name is > 6 characters: first 4 characters followed by '.'
 */
export function resolveShortName(instrumentOrPartName: string): string {
  if (!instrumentOrPartName) return 'Part';
  const def = findInstrumentInCatalogue(instrumentOrPartName);
  if (def) {
    return def.shortName;
  }
  const clean = instrumentOrPartName.trim();
  if (clean.length <= 6) {
    return clean;
  }
  return clean.slice(0, 4) + '.';
}

/**
 * Resolves shortName for a Part given its instrument and name.
 */
export function resolvePartShortName(instrument?: string, partName?: string): string {
  const fromInst = findInstrumentInCatalogue(instrument);
  if (fromInst) return fromInst.shortName;

  const fromName = findInstrumentInCatalogue(partName);
  if (fromName) return fromName.shortName;

  return resolveShortName(partName || instrument || 'Part');
}

/**
 * Determines whether an instrument or part name represents percussion.
 */
export function isPercussionInstrument(instrumentOrPartName?: string): boolean {
  if (!instrumentOrPartName) return false;
  const def = findInstrumentInCatalogue(instrumentOrPartName);
  if (def) return def.isPercussion;

  const norm = instrumentOrPartName.trim().toLowerCase();
  return norm.includes('percussion') || norm.includes('drum') || norm.includes('timpani');
}
