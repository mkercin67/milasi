// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Clef geometry shared by the core and the layout (M7c-4).
 *
 * A pitch is the SOUNDING pitch. A clef only decides where it is written on the staff. The diatonic number of a pitch is
 * `octave * 7 + stepIndex` (C = 0 .. B = 6, so C4 = 28). Each clef sign has a reference note that sits on the clef's
 * staff line: G4 for the G clef, F3 for the F clef, C4 for the C clef. Lines are counted from the bottom (1 = bottom line).
 */
import { Clef, ClefSign, Id, Pitch, PitchStep, Score, Staff } from './model';

const REFERENCE_DIATONIC: Record<ClefSign, number> = {
  G: 32, // G4
  F: 24, // F3
  C: 28, // C4
};

/** Legal staff lines of each clef sign. */
const LEGAL_LINES: Record<ClefSign, readonly number[]> = {
  G: [1, 2],
  F: [3, 4, 5],
  C: [1, 2, 3, 4, 5],
};

/** The clefs offered to the user (M7c-4). `id` is stable and also the i18n key suffix (dialog.clef.preset.<id>). */
export const CLEF_PRESETS: readonly { id: string; clef: Clef }[] = [
  { id: 'treble', clef: { sign: 'G', line: 2 } },
  { id: 'treble8vb', clef: { sign: 'G', line: 2, octaveShift: -1 } },
  { id: 'treble8va', clef: { sign: 'G', line: 2, octaveShift: 1 } },
  { id: 'frenchViolin', clef: { sign: 'G', line: 1 } },
  { id: 'bass', clef: { sign: 'F', line: 4 } },
  { id: 'bass8vb', clef: { sign: 'F', line: 4, octaveShift: -1 } },
  { id: 'baritoneF', clef: { sign: 'F', line: 3 } },
  { id: 'subbass', clef: { sign: 'F', line: 5 } },
  { id: 'soprano', clef: { sign: 'C', line: 1 } },
  { id: 'mezzoSoprano', clef: { sign: 'C', line: 2 } },
  { id: 'alto', clef: { sign: 'C', line: 3 } },
  { id: 'tenor', clef: { sign: 'C', line: 4 } },
  { id: 'baritoneC', clef: { sign: 'C', line: 5 } },
];

/** Preset id of a clef; falls back to 'treble' for a clef that is not in the list. */
export function clefPresetId(clef: Clef): string {
  const shift = clef.octaveShift ?? 0;
  const hit = CLEF_PRESETS.find(
    (p) => p.clef.sign === clef.sign && p.clef.line === clef.line && (p.clef.octaveShift ?? 0) === shift
  );
  return hit ? hit.id : 'treble';
}

const STEPS: PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** True when sign and line are a legal pair and the octave shift is allowed (only -1 or +1, only on G and F clefs). */
export function isValidClef(clef: Clef): boolean {
  const lines = LEGAL_LINES[clef.sign];
  if (!lines || !Number.isInteger(clef.line) || !lines.includes(clef.line)) return false;
  const shift: number | undefined = clef.octaveShift;
  if (shift === undefined || shift === 0) return true;
  return (shift === -1 || shift === 1) && clef.sign !== 'C';
}

/** True when both clefs are the same clef (sign, line and octave shift; an absent shift equals 0). */
export function sameClef(a: Clef, b: Clef): boolean {
  return a.sign === b.sign && a.line === b.line && (a.octaveShift ?? 0) === (b.octaveShift ?? 0);
}

/**
 * The clef that holds at `tick` of the measure `measureId` on `staff` (M7c-5): the last clef change at or before that place,
 * or the opening clef of the staff. Layout and every entry path use this one rule.
 */
export function clefAt(score: Score, staff: Staff, measureId: Id, tick: number): Clef {
  const changes = staff.clefChanges;
  if (!changes || changes.length === 0) return staff.clef;
  const mIdx = score.measures.findIndex((m) => m.id === measureId);
  let current = staff.clef;
  for (const c of changes) {
    const cIdx = score.measures.findIndex((m) => m.id === c.measureId);
    if (cIdx < 0) continue;
    if (cIdx < mIdx || (cIdx === mIdx && c.tick <= tick)) current = c.clef;
    else break;
  }
  return current;
}

/** The clef in force at the start of a measure (a change at tick 0 of that measure counts). */
export function clefAtMeasureStart(score: Score, staff: Staff, measureId: Id): Clef {
  return clefAt(score, staff, measureId, 0);
}

/**
 * Diatonic number of the pitch written on the bottom line of the staff.
 * `octaveShift` -1 ("8vb", for example treble clef for tenor voice) means the written note sounds an octave lower, so
 * the bottom line stands for a pitch seven steps lower; +1 ("8va") seven steps higher.
 */
export function clefBottomLineDiatonic(clef: Clef): number {
  return REFERENCE_DIATONIC[clef.sign] - 2 * (clef.line - 1) + 7 * (clef.octaveShift ?? 0);
}

/** The pitch (natural) written on the middle line of the staff: where the first note of a staff is entered from. */
export function clefMiddleLinePitch(clef: Clef): Pitch {
  const d = clefBottomLineDiatonic(clef) + 4;
  return { step: STEPS[((d % 7) + 7) % 7], octave: Math.floor(d / 7), alter: 0 };
}
