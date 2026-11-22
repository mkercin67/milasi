// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Clef geometry shared by the core and the layout (M7c-4).
 *
 * A pitch is the SOUNDING pitch. A clef only decides where it is written on the staff. The diatonic number of a pitch is
 * `octave * 7 + stepIndex` (C = 0 .. B = 6, so C4 = 28). Each clef sign has a reference note that sits on the clef's
 * staff line: G4 for the G clef, F3 for the F clef, C4 for the C clef. Lines are counted from the bottom (1 = bottom line).
 */
import { Clef, ClefSign, Pitch, PitchStep } from './model';

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

const STEPS: PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** True when sign and line are a legal pair and the octave shift is allowed (only -1 or +1, only on G and F clefs). */
export function isValidClef(clef: Clef): boolean {
  const lines = LEGAL_LINES[clef.sign];
  if (!lines || !Number.isInteger(clef.line) || !lines.includes(clef.line)) return false;
  const shift: number | undefined = clef.octaveShift;
  if (shift === undefined || shift === 0) return true;
  return (shift === -1 || shift === 1) && clef.sign !== 'C';
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
