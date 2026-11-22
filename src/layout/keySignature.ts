// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Key signature layout calculation for G, F and C clefs (M7c-4).
 *
 * Provides standard engraving positions (in staff spaces) for sharps and flats.
 */

import { clefBottomLineDiatonic } from '../core/clef';
import { Clef, PitchStep } from '../core/model';

export interface KeySigAccidental {
  glyph: 'accidentalSharp' | 'accidentalFlat' | 'accidentalNatural';
  y: number; // Y coordinate in staff spaces
  step: PitchStep;
}

const SHARP_STEPS: PitchStep[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_STEPS: PitchStep[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/**
 * Staff positions (0 = bottom line, 1 = first space, 2 = second line, ...) of the sharps and flats in the order of the
 * circle of fifths, for the four standard clefs. Treble and bass are the long-standing tables; alto and tenor follow
 * Gould, Behind Bars (key signatures on C clefs). The C-clef rows are UNVERIFIED until compared with an IMSLP alto and
 * tenor example (see docs/design/m7c-4-clefs.md, section 5).
 */
interface KeySigTable {
  bottomLineDiatonic: number; // bottom line of the clef this table was written for
  sharps: number[];
  flats: number[];
}

const TREBLE: KeySigTable = { bottomLineDiatonic: 30, sharps: [8, 5, 9, 6, 3, 7, 4], flats: [4, 7, 3, 6, 2, 5, 1] };
const BASS: KeySigTable = { bottomLineDiatonic: 18, sharps: [6, 3, 7, 4, 1, 5, 2], flats: [2, 5, 1, 4, 0, 3, 6] };
const ALTO: KeySigTable = { bottomLineDiatonic: 24, sharps: [7, 4, 8, 5, 2, 6, 3], flats: [3, 6, 2, 5, 1, 4, 0] };
const TENOR: KeySigTable = { bottomLineDiatonic: 22, sharps: [2, 6, 3, 7, 4, 8, 5], flats: [5, 8, 4, 7, 3, 6, 2] };

function mean(a: number[]): number {
  return a.reduce((x, y) => x + y, 0) / a.length;
}

/** Re-places a table written for another bottom line: same letters, whole octaves chosen to keep the original shape. */
function shiftTable(positions: number[], delta: number): number[] {
  const target = mean(positions);
  const raw = positions.map((p) => p - delta);
  // Prefer no ledger lines (positions -1..9 need none), then the placement closest to the original shape.
  const overshoot = (a: number[]) => Math.max(0, Math.max(...a) - 9) + Math.max(0, -1 - Math.min(...a));
  let k = 0;
  let best = Infinity;
  for (let c = -3; c <= 3; c++) {
    const moved = raw.map((p) => p + 7 * c);
    const score = overshoot(moved) * 100 + Math.abs(mean(moved) - target);
    if (score < best) {
      best = score;
      k = c;
    }
  }
  return raw.map((p) => p + 7 * k);
}

function tablesFor(clef: Clef): { sharpYs: number[]; flatYs: number[] } {
  let base = TREBLE;
  if (clef.sign === 'F') base = BASS;
  else if (clef.sign === 'C') base = clef.line === 4 ? TENOR : ALTO;
  const delta = clefBottomLineDiatonic(clef) - base.bottomLineDiatonic;
  const toY = (pos: number) => 4 - 0.5 * pos;
  return {
    sharpYs: (delta === 0 ? base.sharps : shiftTable(base.sharps, delta)).map(toY),
    flatYs: (delta === 0 ? base.flats : shiftTable(base.flats, delta)).map(toY),
  };
}

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

  const { sharpYs, flatYs } = tablesFor(clef);

  if (keySig > 0) {
    const count = Math.min(keySig, 7);
    const ys = sharpYs;
    for (let i = 0; i < count; i++) {
      result.push({
        glyph: 'accidentalSharp',
        y: ys[i],
        step: SHARP_STEPS[i],
      });
    }
  } else {
    const count = Math.min(Math.abs(keySig), 7);
    const ys = flatYs;
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

  const { sharpYs, flatYs } = tablesFor(clef);
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

export { getKeySignatureAlter } from '../core/pitch';
