// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import type { Clef, MeasureDef, ScoreEvent, StaffMeasure } from '../../src/core/model';
import { alignStaffColumns } from '../../src/layout/columnAlignment';
import type { MeasureAlignment, MeasureLayoutChunk } from '../../src/layout/layoutPrimitives';
import { layoutSingleMeasure } from '../../src/layout/measureLayout';

const TREBLE: Clef = { sign: 'G', line: 2 };
const BASS: Clef = { sign: 'F', line: 4 };

function mDef(): MeasureDef {
  return createEmptyScore({ measures: 2 }).measures[0];
}

function sm(...voices: ScoreEvent[][]): StaffMeasure {
  return {
    voices: voices.map((events, i) => ({
      id: `v${i + 1}-${Math.random().toString(36).slice(2)}`,
      voiceIndex: (i + 1) as 1 | 2 | 3 | 4,
      events,
    })),
  };
}

const q = (step: string, octave: number, alter = 0) =>
  createNote({ pitches: [{ ...createPitch(step as never, octave), alter }], baseType: 'quarter' });
const h = (step: string, octave: number) =>
  createNote({ pitches: [createPitch(step as never, octave)], baseType: 'half' });
const qr = () => createRest({ baseType: 'quarter' });

/** Pass 1 for every staff, alignment, pass 2: the flow layoutScore will use. */
function layoutTwoStaves(a: StaffMeasure, b: StaffMeasure, def: MeasureDef) {
  const first = [layoutSingleMeasure(a, def, TREBLE, true, false), layoutSingleMeasure(b, def, BASS, true, false)];
  const al = alignStaffColumns(
    first.map((c) => ({
      positions: c.columns!,
      width: c.naturalWidth,
      centered: c.centered,
    }))
  );
  const second: MeasureLayoutChunk[] = first.map((c, i) => {
    const tail = c.naturalWidth - c.contentEndX!;
    const alignment: MeasureAlignment = {
      shifts: al.shifts[i],
      centeredShift: al.centeredShift[i],
      contentEndX: al.width - tail,
    };
    return layoutSingleMeasure(i === 0 ? a : b, def, i === 0 ? TREBLE : BASS, true, false, undefined, alignment);
  });
  return { first, second, al };
}

function barlineX(c: MeasureLayoutChunk): number {
  return c.items[c.barlineItemIndex].item.x;
}

describe('layoutSingleMeasure with cross-staff alignment (M7b-1b)', () => {
  it('T1: without alignment the output is exactly what it was (cache key and items unchanged)', () => {
    const def = mDef();
    const m = sm([q('C', 5), q('D', 5), q('E', 5), q('F', 5)]);
    const plain = layoutSingleMeasure(m, def, TREBLE, true, false);
    const zero: MeasureAlignment = { shifts: new Map(), centeredShift: 0, contentEndX: 0 };
    const withZero = layoutSingleMeasure(sm([...m.voices[0].events]), def, TREBLE, true, false, undefined, zero);
    expect(plain.cacheKey).not.toContain('_al');
    expect(withZero.cacheKey).toContain('_al');
    expect(withZero.items.map((e) => e.item)).toEqual(plain.items.map((e) => e.item));
    expect(withZero.naturalWidth).toBe(plain.naturalWidth);
  });

  it('T2: quarter notes against a half-note staff: equal ticks share x, equal barline x, equal width', () => {
    const def = mDef();
    const upper = sm([q('C', 5), q('D', 5), q('E', 5), q('F', 5)]);
    const lower = sm([h('C', 3), h('G', 2)]);
    const { second, al } = layoutTwoStaves(upper, lower, def);
    for (const t of [0, 1920]) {
      expect(second[0].columns!.get(t)).toBeCloseTo(al.columnX.get(t)!, 9);
      expect(second[1].columns!.get(t)).toBeCloseTo(al.columnX.get(t)!, 9);
    }
    expect(barlineX(second[0])).toBeCloseTo(barlineX(second[1]), 9);
    expect(second[0].naturalWidth).toBeCloseTo(second[1].naturalWidth, 9);
  });

  it('T3: an accidental on one staff pushes the other staff right, noteheads stay aligned', () => {
    const def = mDef();
    const upper = sm([q('C', 5), q('D', 5), q('E', 5), q('F', 5)]);
    const lower = sm([q('C', 3, 1), q('D', 3), q('E', 3), q('F', 3)]); // C#3 outside the key
    const { second, al } = layoutTwoStaves(upper, lower, def);
    for (const t of [0, 960, 1920, 2880]) {
      expect(second[0].columns!.get(t)).toBeCloseTo(second[1].columns!.get(t)!, 9);
      expect(second[0].columns!.get(t)).toBeCloseTo(al.columnX.get(t)!, 9);
    }
  });

  it('T4: no staff is squeezed: every column gap is at least what the staff needed alone', () => {
    const def = mDef();
    const upper = sm([q('C', 5), q('D', 5), q('E', 5), q('F', 5)]);
    const lower = sm([h('C', 3), h('G', 2)]);
    const { first, second } = layoutTwoStaves(upper, lower, def);
    first.forEach((c, i) => {
      const ticks = [...c.columns!.keys()].sort((a, b) => a - b);
      for (let k = 1; k < ticks.length; k++) {
        const alone = c.columns!.get(ticks[k])! - c.columns!.get(ticks[k - 1])!;
        const aligned = second[i].columns!.get(ticks[k])! - second[i].columns!.get(ticks[k - 1])!;
        expect(aligned).toBeGreaterThanOrEqual(alone - 1e-9);
      }
      expect(second[i].naturalWidth).toBeGreaterThanOrEqual(c.naturalWidth - 1e-9);
    });
  });

  it('T5: a polyphonic staff aligns with a single-voice staff (voice 2 does not break the grid)', () => {
    const def = mDef();
    const poly = sm([q('C', 5), q('D', 5), q('E', 5), q('F', 5)], [h('C', 4), h('G', 3)]);
    const mono = sm([q('C', 3), q('D', 3), q('E', 3), q('F', 3)]);
    const { second, al } = layoutTwoStaves(poly, mono, def);
    for (const t of [0, 960, 1920, 2880]) {
      expect(second[0].columns!.get(t)).toBeCloseTo(al.columnX.get(t)!, 9);
      expect(second[1].columns!.get(t)).toBeCloseTo(al.columnX.get(t)!, 9);
    }
    expect(barlineX(second[0])).toBeCloseTo(barlineX(second[1]), 9);
  });

  it('T5b: a polyphonic staff that must be pushed right (wide accidental column on the other staff) is shifted', () => {
    const def = mDef();
    const poly = sm([q('C', 5), q('D', 5), q('E', 5), q('F', 5)], [h('C', 4), h('G', 3)]);
    const wide = sm([q('C', 3, 1), q('D', 3, 1), q('E', 3, 1), q('F', 3, 1)]); // accidentals everywhere
    const { first, second, al } = layoutTwoStaves(poly, wide, def);
    // the polyphonic staff really moved ...
    expect(al.shifts[0].get(960)!).toBeGreaterThan(0.1);
    expect(second[0].columns!.get(960)!).toBeGreaterThan(first[0].columns!.get(960)! + 0.1);
    // ... and everything is aligned
    for (const t of [0, 960, 1920, 2880]) {
      expect(second[0].columns!.get(t)).toBeCloseTo(al.columnX.get(t)!, 9);
      expect(second[1].columns!.get(t)).toBeCloseTo(al.columnX.get(t)!, 9);
    }
    expect(barlineX(second[0])).toBeCloseTo(barlineX(second[1]), 9);
  });

  it('T6: a staff with only a whole-measure rest is centred and constrains nothing', () => {
    const def = mDef();
    const upper = sm([q('C', 5), q('D', 5), q('E', 5), q('F', 5)]);
    const lower = sm([createRest({ baseType: 'whole', wholeMeasure: true } as never)]);
    const { first, second, al } = layoutTwoStaves(upper, lower, def);
    expect(first[1].centered).toBe(true);
    // the note staff is not pushed by the rest staff
    expect(second[0].naturalWidth).toBeCloseTo(first[0].naturalWidth, 9);
    expect(barlineX(second[0])).toBeCloseTo(barlineX(second[1]), 9);
    const restItem = second[1].items.find((e) => e.item.glyph === 'restWhole')!.item;
    const restItemAlone = first[1].items.find((e) => e.item.glyph === 'restWhole')!.item;
    expect(restItem.x).toBeCloseTo(restItemAlone.x + al.centeredShift[1], 9);
    expect(al.centeredShift[1]).toBeGreaterThan(0);
  });

  it('T7: rests on the second staff share the columns of the first staff', () => {
    const def = mDef();
    const upper = sm([q('C', 5), q('D', 5), q('E', 5), q('F', 5)]);
    const lower = sm([qr(), q('C', 3), qr(), q('D', 3)]);
    const { second, al } = layoutTwoStaves(upper, lower, def);
    for (const t of [0, 960, 1920, 2880]) {
      expect(second[1].columns!.get(t)).toBeCloseTo(al.columnX.get(t)!, 9);
    }
  });

  it('T8: the alignment is part of the cache key, so different alignments never share a chunk', () => {
    const def = mDef();
    const m = sm([q('C', 5), q('D', 5), q('E', 5), q('F', 5)]);
    const a1: MeasureAlignment = { shifts: new Map([[960, 2]]), centeredShift: 0, contentEndX: 40 };
    const a2: MeasureAlignment = { shifts: new Map([[960, 3]]), centeredShift: 0, contentEndX: 40 };
    const c1 = layoutSingleMeasure(m, def, TREBLE, true, false, undefined, a1);
    const c2 = layoutSingleMeasure(m, def, TREBLE, true, false, undefined, a2);
    expect(c1.cacheKey).not.toBe(c2.cacheKey);
    expect(c2.columns!.get(960)! - c1.columns!.get(960)!).toBeCloseTo(1, 9);
  });
});
