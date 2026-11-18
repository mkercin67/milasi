// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Pure pitch manipulation and transposition functions for the ScoreForge core model.
 *
 * Implements semitone and octave transpositions following standard Western music rules:
 * ascending transposition prefers sharp spellings, descending prefers flat spellings.
 * Microtonal alterations (non-integer alter values) are safely preserved without mutation.
 */

import { Pitch } from './model';

const STEP_SEMITONES: Record<Pitch['step'], number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

interface Spelling {
  step: Pitch['step'];
  alter: number;
}

// Prefer sharp spellings when transposing upward
const ASCENDING_SPELLINGS: Spelling[] = [
  { step: 'C', alter: 0 },
  { step: 'C', alter: 1 },
  { step: 'D', alter: 0 },
  { step: 'D', alter: 1 },
  { step: 'E', alter: 0 },
  { step: 'F', alter: 0 },
  { step: 'F', alter: 1 },
  { step: 'G', alter: 0 },
  { step: 'G', alter: 1 },
  { step: 'A', alter: 0 },
  { step: 'A', alter: 1 },
  { step: 'B', alter: 0 },
];

// Prefer flat spellings when transposing downward
const DESCENDING_SPELLINGS: Spelling[] = [
  { step: 'C', alter: 0 },
  { step: 'D', alter: -1 },
  { step: 'D', alter: 0 },
  { step: 'E', alter: -1 },
  { step: 'E', alter: 0 },
  { step: 'F', alter: 0 },
  { step: 'G', alter: -1 },
  { step: 'G', alter: 0 },
  { step: 'A', alter: -1 },
  { step: 'A', alter: 0 },
  { step: 'B', alter: -1 },
  { step: 'B', alter: 0 },
];

export function getPitchMidi(pitch: Pitch): number {
  return 12 * (pitch.octave + 1) + STEP_SEMITONES[pitch.step] + pitch.alter;
}

const KEY_SIG_SHARP_STEPS: Pitch['step'][] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const KEY_SIG_FLAT_STEPS: Pitch['step'][] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/**
 * Returns the default alteration for a pitch step according to the key signature.
 *
 * @param step - Pitch step letter.
 * @param keySig - Circle of fifths value (-7..7).
 * @returns Semitone alteration (-1, 0, or 1).
 */
export function getKeySignatureAlter(step: Pitch['step'], keySig: number): number {
  if (keySig > 0) {
    const sharps = KEY_SIG_SHARP_STEPS.slice(0, Math.min(keySig, 7));
    return sharps.includes(step) ? 1 : 0;
  }
  if (keySig < 0) {
    const flats = KEY_SIG_FLAT_STEPS.slice(0, Math.min(Math.abs(keySig), 7));
    return flats.includes(step) ? -1 : 0;
  }
  return 0;
}

/**
 * Transposes a pitch by one semitone in the specified direction.
 *
 * Ascending movement spells chromatic notes with sharps (e.g. C -> C# -> D);
 * descending movement spells with flats (e.g. D -> Db -> C).
 * Non-integer alterations (microtones) are returned unchanged.
 *
 * @param pitch - The source pitch.
 * @param direction - 'up' or 'down'.
 * @returns New transposed Pitch instance.
 */
export function transposeSemitone(pitch: Pitch, direction: 'up' | 'down'): Pitch {
  if (!Number.isInteger(pitch.alter)) {
    return { ...pitch };
  }

  const currentMidi = 12 * (pitch.octave + 1) + STEP_SEMITONES[pitch.step] + pitch.alter;
  const targetMidi = direction === 'up' ? currentMidi + 1 : currentMidi - 1;

  // Standard piano pitch range limit: MIDI 21 (A0) to MIDI 108 (C8)
  if (targetMidi < 21 || targetMidi > 108) {
    return { ...pitch };
  }

  const targetOctave = Math.floor(targetMidi / 12) - 1;
  const pitchClass = ((targetMidi % 12) + 12) % 12;

  const spelling =
    direction === 'up' ? ASCENDING_SPELLINGS[pitchClass] : DESCENDING_SPELLINGS[pitchClass];

  return {
    step: spelling.step,
    octave: targetOctave,
    alter: spelling.alter,
  };
}

/**
 * Transposes a pitch by a number of octaves.
 *
 * Preserves the diatonic step and alteration, altering only the octave integer.
 * Clamps to standard piano pitch range (MIDI 21 to 108).
 *
 * @param pitch - The source pitch.
 * @param octaves - Positive or negative number of octaves to transpose.
 * @returns New transposed Pitch instance.
 */
export function transposeOctave(pitch: Pitch, octaves: number): Pitch {
  const currentMidi = 12 * (pitch.octave + 1) + STEP_SEMITONES[pitch.step] + pitch.alter;
  const targetMidi = currentMidi + octaves * 12;

  // Standard piano pitch range limit: MIDI 21 (A0) to MIDI 108 (C8)
  if (targetMidi < 21 || targetMidi > 108) {
    return { ...pitch };
  }

  return {
    ...pitch,
    octave: pitch.octave + octaves,
  };
}
