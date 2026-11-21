// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Derived note-name labels (Do Re Mi / C D E) drawn under notes when the score asks for them.
 * They are computed from pitch at layout time and never stored on events.
 */

import type { Pitch } from '../core/model';
import type { NoteLabelStyle } from './types';

const SOLFEGE: Record<Pitch['step'], string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

const ACCIDENTAL: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', [1]: '♯', [2]: '𝄪' };

/** Label of one pitch, e.g. "Fa♯" or "B♭" (octave is intentionally left out). */
function pitchLabel(pitch: Pitch, style: NoteLabelStyle): string {
  const name = style === 'solfege' ? SOLFEGE[pitch.step] : pitch.step;
  return `${name}${ACCIDENTAL[pitch.alter] ?? ''}`;
}

/** Label of a note: chord tones are listed bottom to top, separated by "/". */
export function noteLabel(pitches: readonly Pitch[], style: NoteLabelStyle): string {
  const height = (p: Pitch) => p.octave * 7 + 'CDEFGAB'.indexOf(p.step);
  return [...pitches]
    .sort((a, b) => height(a) - height(b))
    .map((p) => pitchLabel(p, style))
    .join('/');
}

/** Estimated width (staff spaces) used to reserve horizontal room for a label. */
export function labelWidth(label: string): number {
  return label.length * 0.62;
}
