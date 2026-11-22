// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-4 part 2: clef glyphs, key signature positions per clef, notes on C clefs.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { getKeySignatureAccidentals } from '../../src/layout/keySignature';
import { layoutScore } from '../../src/layout/layoutScore';
import { getLedgerLineYs, pitchToStaffPosition } from '../../src/layout/pitch';
import type { Clef } from '../../src/core/model';
import type { LayoutItem, LayoutResult } from '../../src/layout/types';

function allItems(r: LayoutResult): LayoutItem[] {
  const out: LayoutItem[] = [...r.items];
  for (const s of r.systems) out.push(...((s as unknown as { items?: LayoutItem[] }).items ?? []));
  return out;
}

function clefItem(clef: Clef): LayoutItem | undefined {
  const score = createEmptyScore({ numMeasures: 1 });
  score.parts[0].staves[0].clef = clef;
  return allItems(layoutScore(score)).find((it) => it.id.includes('-clef-'));
}


describe('M7c-4 clef layout (part 2)', () => {
  it('CL5: the clef glyph sits on its own staff line', () => {
    const cases: [Clef, string, number][] = [
      [{ sign: 'G', line: 2 }, 'gClef', 3],
      [{ sign: 'G', line: 1 }, 'gClef', 4],
      [{ sign: 'F', line: 4 }, 'fClef', 1],
      [{ sign: 'F', line: 3 }, 'fClef', 2],
      [{ sign: 'C', line: 3 }, 'cClef', 2],
      [{ sign: 'C', line: 4 }, 'cClef', 1],
      [{ sign: 'C', line: 1 }, 'cClef', 4],
    ];
    for (const [clef, glyph, y] of cases) {
      const it = clefItem(clef);
      expect(it?.glyph).toBe(glyph);
      expect(it?.y).toBe(y);
    }
  });

  it('CL6: octave clefs use the SMuFL octave glyphs', () => {
    expect(clefItem({ sign: 'G', line: 2, octaveShift: -1 })?.glyph).toBe('gClef8vb');
    expect(clefItem({ sign: 'G', line: 2, octaveShift: 1 })?.glyph).toBe('gClef8va');
    expect(clefItem({ sign: 'F', line: 4, octaveShift: -1 })?.glyph).toBe('fClef8vb');
  });

  it('CL7: treble and bass key signatures keep their positions; octave clefs equal the base clef', () => {
    expect(getKeySignatureAccidentals(2, { sign: 'G', line: 2 }).map((a) => a.y)).toEqual([0, 1.5]);
    expect(getKeySignatureAccidentals(2, { sign: 'F', line: 4 }).map((a) => a.y)).toEqual([1, 2.5]);
    const base = getKeySignatureAccidentals(-3, { sign: 'G', line: 2 }).map((a) => a.y);
    expect(getKeySignatureAccidentals(-3, { sign: 'G', line: 2, octaveShift: -1 }).map((a) => a.y)).toEqual(base);
  });

  it('CL8: alto and tenor key signatures stay inside the staff area (UNVERIFIED against print, shape only)', () => {
    // Soprano, mezzo and baritone C clefs are derived from the alto table and may touch one ledger line (rare).
    for (const line of [1, 2, 5]) {
      expect(getKeySignatureAccidentals(7, { sign: 'C', line }).length).toBe(7);
      expect(getKeySignatureAccidentals(-7, { sign: 'C', line }).length).toBe(7);
    }
    for (const clef of [{ sign: 'C', line: 3 }, { sign: 'C', line: 4 }] as Clef[]) {
      for (const k of [7, -7]) {
        const ys = getKeySignatureAccidentals(k, clef).map((a) => a.y);
        expect(ys.length).toBe(7);
        for (const y of ys) {
          // from the space above the staff down to the space below
          expect(y >= -0.5 && y <= 4.5).toBe(true);
        }
      }
    }
    expect(getKeySignatureAccidentals(1, { sign: 'C', line: 3 })[0].y).toBe(0.5); // alto F#: top space
  });

  it('CL9: a note lands on the right line for each clef and gets ledger lines outside the staff', () => {
    expect(pitchToStaffPosition(createPitch('C', 4, 0), { sign: 'C', line: 3 })).toBe(4); // middle line
    expect(pitchToStaffPosition(createPitch('A', 3, 0), { sign: 'C', line: 4 })).toBe(4);
    expect(pitchToStaffPosition(createPitch('E', 3, 0), { sign: 'G', line: 2, octaveShift: -1 })).toBe(0);
    expect(getLedgerLineYs(pitchToStaffPosition(createPitch('C', 4, 0), { sign: 'G', line: 2 }))).toEqual([5]);
  });

  it('CL10: a score with a changed clef lays out the note at the clef-specific height', () => {
    const score = createEmptyScore({ numMeasures: 1 });
    const staff = score.parts[0].staves[0];
    staff.clef = { sign: 'C', line: 3 };
    staff.measures[score.measures[0].id].voices[0].events = [
      createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'whole' }),
    ];
    const head = allItems(layoutScore(score)).find((it) => it.kind === 'glyph' && String(it.glyph).startsWith('notehead'));
    expect(head?.y).toBe(2); // middle line of the staff
  });
});
