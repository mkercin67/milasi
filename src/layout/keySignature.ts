/**
 * Key signature layout calculation for treble and bass clefs.
 *
 * Provides standard engraving positions (in staff spaces) for sharps and flats.
 */

import { Clef, PitchStep } from '../core/model';

export interface KeySigAccidental {
  glyph: 'accidentalSharp' | 'accidentalFlat' | 'accidentalNatural';
  y: number; // Y coordinate in staff spaces
  step: PitchStep;
}

const SHARP_STEPS: PitchStep[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_STEPS: PitchStep[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

const TREBLE_SHARP_YS = [0.0, 1.5, -0.5, 1.0, 2.5, 0.5, 2.0];
const TREBLE_FLAT_YS = [2.0, 0.5, 2.5, 1.0, 3.0, 1.5, 3.5];

const BASS_SHARP_YS = [1.0, 2.5, 0.5, 2.0, 3.5, 1.5, 3.0];
const BASS_FLAT_YS = [3.0, 1.5, 3.5, 2.0, 4.0, 2.5, 1.0];

/**
 * Returns the list of accidentals and their vertical positions in staff spaces for a key signature.
 *
 * @param keySig - Key signature number (-7 to 7 on circle of fifths).
 * @param clef - Active staff clef.
 * @returns Array of accidental items to display in the key signature.
 */
export function getKeySignatureAccidentals(keySig: number, clef: Clef): KeySigAccidental[] {
  const result: KeySigAccidental[] = [];

  if (keySig === 0) return result;

  const isBass = clef.sign === 'F';

  if (keySig > 0) {
    const count = Math.min(keySig, 7);
    const ys = isBass ? BASS_SHARP_YS : TREBLE_SHARP_YS;
    for (let i = 0; i < count; i++) {
      result.push({
        glyph: 'accidentalSharp',
        y: ys[i],
        step: SHARP_STEPS[i],
      });
    }
  } else {
    const count = Math.min(Math.abs(keySig), 7);
    const ys = isBass ? BASS_FLAT_YS : TREBLE_FLAT_YS;
    for (let i = 0; i < count; i++) {
      result.push({
        glyph: 'accidentalFlat',
        y: ys[i],
        step: FLAT_STEPS[i],
      });
    }
  }

  return result;
}

/**
 * Returns accidentals for a key signature change mid-score, including
 * cancellation naturals for accidentals that were in the previous key signature
 * but are not in the new key signature.
 *
 * @param prevKeySig - Previous key signature (-7 to 7).
 * @param newKeySig - New key signature (-7 to 7).
 * @param clef - Active clef.
 * @returns Array of accidentals to display at the key change.
 */
export function getKeySignatureChangeAccidentals(
  prevKeySig: number,
  newKeySig: number,
  clef: Clef
): KeySigAccidental[] {
  if (prevKeySig === newKeySig) return [];

  const isBass = clef.sign === 'F';
  const sharpYs = isBass ? BASS_SHARP_YS : TREBLE_SHARP_YS;
  const flatYs = isBass ? BASS_FLAT_YS : TREBLE_FLAT_YS;
  const result: KeySigAccidental[] = [];

  // If previous was sharps (> 0):
  if (prevKeySig > 0) {
    if (newKeySig > 0) {
      // Sharps to fewer sharps: cancel the removed sharps with naturals
      if (newKeySig < prevKeySig) {
        for (let i = newKeySig; i < prevKeySig; i++) {
          result.push({
            glyph: 'accidentalNatural',
            y: sharpYs[i],
            step: SHARP_STEPS[i],
          });
        }
        for (let i = 0; i < newKeySig; i++) {
          result.push({
            glyph: 'accidentalSharp',
            y: sharpYs[i],
            step: SHARP_STEPS[i],
          });
        }
      } else {
        // Sharps to more sharps: just draw all new sharps
        for (let i = 0; i < newKeySig; i++) {
          result.push({
            glyph: 'accidentalSharp',
            y: sharpYs[i],
            step: SHARP_STEPS[i],
          });
        }
      }
    } else if (newKeySig === 0) {
      // Sharps to C major / A minor: cancel all old sharps with naturals
      for (let i = 0; i < prevKeySig; i++) {
        result.push({
          glyph: 'accidentalNatural',
          y: sharpYs[i],
          step: SHARP_STEPS[i],
        });
      }
    } else {
      // Sharps to flats: cancel all old sharps with naturals, then draw new flats
      for (let i = 0; i < prevKeySig; i++) {
        result.push({
          glyph: 'accidentalNatural',
          y: sharpYs[i],
          step: SHARP_STEPS[i],
        });
      }
      const flatCount = Math.abs(newKeySig);
      for (let i = 0; i < flatCount; i++) {
        result.push({
          glyph: 'accidentalFlat',
          y: flatYs[i],
          step: FLAT_STEPS[i],
        });
      }
    }
  } else if (prevKeySig < 0) {
    const prevFlatCount = Math.abs(prevKeySig);
    if (newKeySig < 0) {
      const newFlatCount = Math.abs(newKeySig);
      if (newFlatCount < prevFlatCount) {
        // Flats to fewer flats: cancel removed flats with naturals
        for (let i = newFlatCount; i < prevFlatCount; i++) {
          result.push({
            glyph: 'accidentalNatural',
            y: flatYs[i],
            step: FLAT_STEPS[i],
          });
        }
        for (let i = 0; i < newFlatCount; i++) {
          result.push({
            glyph: 'accidentalFlat',
            y: flatYs[i],
            step: FLAT_STEPS[i],
          });
        }
      } else {
        // Flats to more flats: just draw new flats
        for (let i = 0; i < newFlatCount; i++) {
          result.push({
            glyph: 'accidentalFlat',
            y: flatYs[i],
            step: FLAT_STEPS[i],
          });
        }
      }
    } else if (newKeySig === 0) {
      // Flats to C major / A minor: cancel all old flats with naturals
      for (let i = 0; i < prevFlatCount; i++) {
        result.push({
          glyph: 'accidentalNatural',
          y: flatYs[i],
          step: FLAT_STEPS[i],
        });
      }
    } else {
      // Flats to sharps: cancel all old flats with naturals, then draw new sharps
      for (let i = 0; i < prevFlatCount; i++) {
        result.push({
          glyph: 'accidentalNatural',
          y: flatYs[i],
          step: FLAT_STEPS[i],
        });
      }
      for (let i = 0; i < newKeySig; i++) {
        result.push({
          glyph: 'accidentalSharp',
          y: sharpYs[i],
          step: SHARP_STEPS[i],
        });
      }
    }
  } else {
    // prevKeySig === 0, newKeySig !== 0: just draw new key signature
    return getKeySignatureAccidentals(newKeySig, clef);
  }

  return result;
}

/**
 * Returns the default alter for a pitch step according to the key signature.
 *
 * @param step - Pitch step letter.
 * @param keySig - Circle of fifths value.
 * @returns Semitone alteration (-1, 0, or 1).
 */
export function getKeySignatureAlter(step: PitchStep, keySig: number): number {
  if (keySig > 0) {
    const sharps = SHARP_STEPS.slice(0, Math.min(keySig, 7));
    return sharps.includes(step) ? 1 : 0;
  }
  if (keySig < 0) {
    const flats = FLAT_STEPS.slice(0, Math.min(Math.abs(keySig), 7));
    return flats.includes(step) ? -1 : 0;
  }
  return 0;
}
