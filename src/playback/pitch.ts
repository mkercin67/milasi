import { Pitch, PitchStep } from '../core/model';
import { MidiPitch } from './types';

const STEP_SEMITONES: Record<PitchStep, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Converts a musical pitch to an integer MIDI note number and microtonal detune in cents.
 *
 * Formula:
 * total = 12 * (octave + 1) + stepSemitone + alter
 * midi = Math.floor(total + 1e-9)
 * detuneCents = Math.round((total - midi) * 100)
 *
 * C4 = 60, A4 = 69.
 * Alter 0.5 on C4 -> 60 +50; alter -0.5 on D4 -> 61 +50.
 */
export function pitchToMidi(pitch: Pitch): MidiPitch {
  const stepSemitone = STEP_SEMITONES[pitch.step] ?? 0;
  const alter = pitch.alter ?? 0;
  const total = 12 * (pitch.octave + 1) + stepSemitone + alter;

  const midi = Math.floor(total + 1e-9);
  const detuneCents = Math.round((total - midi) * 100);

  return { midi, detuneCents };
}
