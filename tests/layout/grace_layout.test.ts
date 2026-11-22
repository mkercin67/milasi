// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-3b part 2: grace notes drawn inside the measure chunk, left of the main note. Sizes are a first proposal.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { addGraceNote } from '../../src/core/notationCommands';
import { layoutScore } from '../../src/layout/layoutScore';
import { buildNoteheadIndex, layoutGraceSlurs } from '../../src/layout/notations';
import { renderSvgToString } from '../../src/render/renderSvg';
import type { GraceNote, Score } from '../../src/core/model';
import type { LayoutItem } from '../../src/layout/types';

const G = (
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B',
  octave: number,
  kind: GraceNote['kind'] = 'acciaccatura',
  baseType: GraceNote['baseType'] = '16th',
  alter = 0
): GraceNote => ({ kind, pitch: createPitch(step, octave, alter), baseType });

function setup(): { score: Score; ids: string[] } {
  const score = createEmptyScore({ numMeasures: 1 });
  const evs = [
    createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('E', 5, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('G', 5, 0)], baseType: 'quarter' }),
    createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'quarter' }),
  ];
  score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events = evs;
  return { score, ids: evs.map((e) => e.id) };
}

function items(score: Score, width = 70): LayoutItem[] {
  return layoutScore(score, { width }).systems[0].items;
}
const byId = (list: LayoutItem[], id: string) => list.find((it) => it.id === id);

describe('grace note layout (M7c-3b)', () => {
  it('GL1: a single acciaccatura has a small head, a stem, a flag and a slash, left of the main note', () => {
    const { score, ids } = setup();
    const s = addGraceNote(ids[1], G('D', 5)).apply(score);
    const list = items(s);
    const head = byId(list, `${ids[1]}-grace-0-head`)!;
    const main = byId(list, ids[1])!;
    expect(head.glyph).toBe('noteheadBlack');
    expect(head.glyphScale).toBe(0.65);
    expect(head.x).toBeLessThan(main.x);
    expect(byId(list, `${ids[1]}-grace-0-stem`)).toBeDefined();
    expect(byId(list, `${ids[1]}-grace-0-flag`)?.glyph).toBe('flag16thUp');
    expect(byId(list, `${ids[1]}-grace-0-slash`)).toBeDefined();
  });

  it('GL2: an appoggiatura has no slash', () => {
    const { score, ids } = setup();
    const s = addGraceNote(ids[1], G('D', 5, 'appoggiatura', 'eighth')).apply(score);
    const list = items(s);
    expect(byId(list, `${ids[1]}-grace-0-slash`)).toBeUndefined();
    expect(byId(list, `${ids[1]}-grace-0-flag`)?.glyph).toBe('flag8thUp');
  });

  it('GL3: two grace notes are joined by a beam and have no flags', () => {
    const { score, ids } = setup();
    let s = addGraceNote(ids[1], G('C', 5)).apply(score);
    s = addGraceNote(ids[1], G('D', 5)).apply(s);
    const list = items(s);
    expect(byId(list, `${ids[1]}-grace-0-beam-1`)).toBeDefined();
    expect(byId(list, `${ids[1]}-grace-0-beam-2`)).toBeDefined(); // both 16th: second beam too
    expect(byId(list, `${ids[1]}-grace-0-flag`)).toBeUndefined();
    const h0 = byId(list, `${ids[1]}-grace-0-head`)!;
    const h1 = byId(list, `${ids[1]}-grace-1-head`)!;
    expect(h0.x).toBeLessThan(h1.x);
  });

  it('GL4: grace notes take space: the main note moves right and the bar stays aligned to its width', () => {
    const { score, ids } = setup();
    const plain = byId(items(score), ids[1])!;
    const withGrace = byId(items(addGraceNote(ids[1], G('D', 5)).apply(score)), ids[1])!;
    expect(withGrace.x).toBeGreaterThan(plain.x);
    // notes before the grace group do not move
    expect(byId(items(addGraceNote(ids[1], G('D', 5)).apply(score)), ids[0])!.x).toBe(byId(items(score), ids[0])!.x);
  });

  it('GL5: the grace head keeps its distance to the main note when the system is stretched', () => {
    const { score, ids } = setup();
    const s = addGraceNote(ids[2], G('F', 5)).apply(score);
    const dist = (w: number) => {
      const list = items(s, w);
      return byId(list, ids[2])!.x - byId(list, `${ids[2]}-grace-0-head`)!.x;
    };
    expect(dist(120)).toBeCloseTo(dist(70), 5);
  });

  it('GL6: a sharp on a grace note carries on in the bar: the following natural note prints a natural sign', () => {
    const { score, ids } = setup();
    // grace C sharp before the E; the last C of the bar must then print a natural
    const s = addGraceNote(ids[1], G('C', 5, 'acciaccatura', '16th', 1)).apply(score);
    const list = items(s);
    expect(byId(list, `${ids[1]}-grace-0-acc`)?.glyph).toBe('accidentalSharp');
    expect(list.some((it) => it.id === `${ids[3]}-acc-0` && it.glyph === 'accidentalNatural')).toBe(true);
  });

  it('GL7: changing a grace pitch in place refreshes the cached measure layout', () => {
    const { score, ids } = setup();
    const s = structuredClone(addGraceNote(ids[1], G('D', 5)).apply(score));
    const y1 = byId(items(s), `${ids[1]}-grace-0-head`)!.y;
    const note = s.parts[0].staves[0].measures[s.measures[0].id].voices[0].events[1] as { graces: GraceNote[] };
    note.graces[0].pitch.step = 'A';
    const y2 = byId(items(s), `${ids[1]}-grace-0-head`)!.y;
    expect(y2).not.toBe(y1);
  });

  it('GL8: exports draw the small head with a reduced glyph scale', () => {
    const { score, ids } = setup();
    const s = addGraceNote(ids[1], G('D', 5)).apply(score);
    const svg = renderSvgToString(layoutScore(s, { width: 70 }));
    expect(svg).toContain(`data-id="${ids[1]}-grace-0-head"`);
    expect(svg).toMatch(/data-id="[^"]*-grace-0-head"[^>]*scale\(0\.\d+/);
  });

  it('GL9: grace items have no eventId, so the notehead index still sees only the main note', () => {
    const { score, ids } = setup();
    const s = addGraceNote(ids[1], G('D', 5)).apply(score);
    const layout = layoutScore(s, { width: 70 });
    for (const it of layout.systems[0].items) {
      if (it.id.includes('-grace-')) {
        expect(it.eventId).toBeUndefined();
        expect(it.graceOf).toBe(ids[1]);
      }
    }
    const index = buildNoteheadIndex(layout);
    const main = layout.systems[0].items.find((it) => it.id === ids[1])!;
    expect(index.get(ids[1])!.x).toBe(main.x);
  });

  it('GL10: a slur runs from the first grace note to the main note, one per group', () => {
    const { score, ids } = setup();
    let s = addGraceNote(ids[1], G('C', 5)).apply(score);
    s = addGraceNote(ids[1], G('D', 5)).apply(s);
    const slurs = layoutGraceSlurs(s, layoutScore(s, { width: 70 }));
    expect(slurs).toHaveLength(1);
    expect(slurs[0].slurId).toBe(`${ids[1]}-grace-slur`);
    expect(slurs[0].d.startsWith('M ')).toBe(true);
    expect(layoutGraceSlurs(score, layoutScore(score, { width: 70 }))).toHaveLength(0);
  });
});
