// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-4 part 1: clef model, one staff-position formula, validation, first-note reference.
import { describe, expect, it } from 'vitest';
import { clefBottomLineDiatonic, clefMiddleLinePitch, isValidClef } from '../../src/core/clef';
import { createEmptyScore } from '../../src/core/factory';
import { pitchFromLetter } from '../../src/core/input';
import { validateScore } from '../../src/core/validate';
import { pitchToStaffPosition, yToStaffPosition } from '../../src/layout/pitch';
import type { Clef } from '../../src/core/model';

const ALL_CLEFS: Clef[] = [
  { sign: 'G', line: 2 },
  { sign: 'G', line: 1 },
  { sign: 'G', line: 2, octaveShift: -1 },
  { sign: 'G', line: 2, octaveShift: 1 },
  { sign: 'F', line: 4 },
  { sign: 'F', line: 3 },
  { sign: 'F', line: 5 },
  { sign: 'F', line: 4, octaveShift: -1 },
  { sign: 'C', line: 1 },
  { sign: 'C', line: 2 },
  { sign: 'C', line: 3 },
  { sign: 'C', line: 4 },
  { sign: 'C', line: 5 },
];

describe('M7c-4 clefs (part 1)', () => {
  it('CL1: bottom line diatonic number for every clef', () => {
    expect(clefBottomLineDiatonic({ sign: 'G', line: 2 })).toBe(30); // E4
    expect(clefBottomLineDiatonic({ sign: 'F', line: 4 })).toBe(18); // G2
    expect(clefBottomLineDiatonic({ sign: 'C', line: 3 })).toBe(24); // F3 (alto)
    expect(clefBottomLineDiatonic({ sign: 'C', line: 4 })).toBe(22); // D3 (tenor)
    expect(clefBottomLineDiatonic({ sign: 'C', line: 1 })).toBe(28); // C4 (soprano)
    expect(clefBottomLineDiatonic({ sign: 'C', line: 2 })).toBe(26); // A3 (mezzo)
    expect(clefBottomLineDiatonic({ sign: 'C', line: 5 })).toBe(20); // E3 (baritone C)
    expect(clefBottomLineDiatonic({ sign: 'G', line: 1 })).toBe(32); // G4 (French violin)
    expect(clefBottomLineDiatonic({ sign: 'F', line: 3 })).toBe(20); // baritone F
    expect(clefBottomLineDiatonic({ sign: 'F', line: 5 })).toBe(16); // subbass
    expect(clefBottomLineDiatonic({ sign: 'G', line: 2, octaveShift: -1 })).toBe(23); // E3 (treble 8vb)
    expect(clefBottomLineDiatonic({ sign: 'G', line: 2, octaveShift: 1 })).toBe(37);
  });

  it('CL2: pitchToStaffPosition and yToStaffPosition round trip for every clef', () => {
    for (const clef of ALL_CLEFS) {
      for (let pos = -3; pos <= 11; pos++) {
        const y = 4 - 0.5 * pos;
        const pitch = yToStaffPosition(clef, y, 0);
        expect(pitchToStaffPosition(pitch, clef)).toBe(pos);
      }
    }
  });

  it('CL3: first note starts from the middle-line pitch of the clef', () => {
    const mid = (c: Clef) => {
      const p = clefMiddleLinePitch(c);
      return `${p.step}${p.octave}`;
    };
    expect(mid({ sign: 'G', line: 2 })).toBe('B4');
    expect(mid({ sign: 'F', line: 4 })).toBe('D3');
    expect(mid({ sign: 'C', line: 3 })).toBe('C4');
    expect(mid({ sign: 'C', line: 4 })).toBe('A3');
    const p = pitchFromLetter('c', null, { sign: 'C', line: 3 }, 0);
    expect(`${p.step}${p.octave}`).toBe('C4');
    const t = pitchFromLetter('b', null, { sign: 'G', line: 2 }, 0);
    expect(`${t.step}${t.octave}`).toBe('B4');
  });

  it('CL4: validation reports illegal clefs', () => {
    for (const clef of ALL_CLEFS) expect(isValidClef(clef)).toBe(true);
    const bad: Clef[] = [
      { sign: 'G', line: 3 },
      { sign: 'F', line: 2 },
      { sign: 'C', line: 0 },
      { sign: 'C', line: 6 },
      { sign: 'G', line: 2.5 },
      { sign: 'C', line: 3, octaveShift: 1 },
    ];
    for (const clef of bad) expect(isValidClef(clef)).toBe(false);
    const score = createEmptyScore({ numMeasures: 1 });
    expect(validateScore(score).some((p) => p.code === 'invalid-clef')).toBe(false);
    score.parts[0].staves[0].clef = { sign: 'G', line: 3 };
    expect(validateScore(score).some((p) => p.code === 'invalid-clef')).toBe(true);
  });
});
