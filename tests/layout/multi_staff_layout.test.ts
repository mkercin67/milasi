// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { createEmptyScore, createGrandStaffScore, createNote, createPitch, newId } from '../../src/core/factory';
import type { Score, ScoreEvent, Staff } from '../../src/core/model';
import { layoutScore } from '../../src/layout/layoutScore';
import { renderSvgToString } from '../../src/render/renderSvg';
import type { LayoutItem, LayoutSystem } from '../../src/layout/types';

type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
const note = (step: Step, octave: number, baseType: 'quarter' | 'half' | 'whole' | 'eighth') =>
  createNote({ pitches: [createPitch(step, octave)], baseType });

/** Grand staff: staff 0 = treble, staff 1 = bass. Measure i holds the given event lists (or its default rest). */
function grand(upper: ScoreEvent[][], lower: ScoreEvent[][]): Score {
  const score = createEmptyScore({ measures: Math.max(upper.length, lower.length) });
  const part = score.parts[0];
  const bass: Staff = { id: newId(), clef: { sign: 'F', line: 4 }, measures: {}, slurs: [] };
  score.measures.forEach((m, i) => {
    const rest = part.staves[0].measures[m.id].voices[0].events;
    if (upper[i]) part.staves[0].measures[m.id].voices[0].events = upper[i];
    bass.measures[m.id] = {
      voices: [{ id: newId(), voiceIndex: 1, events: lower[i] ?? rest.map((e) => ({ ...e, id: newId() })) }],
    };
  });
  part.staves.push(bass);
  return score;
}

function quiet<T>(fn: () => T): T {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

const eventItems = (sys: LayoutSystem, staffId: string) =>
  sys.items.filter((i) => i.eventId && i.staffId === staffId);

function noteheadXByEvent(sys: LayoutSystem, staffId: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of eventItems(sys, staffId)) if (it.kind === 'glyph' && !m.has(it.eventId!)) m.set(it.eventId!, it.x);
  return m;
}

const isBarline = (i: LayoutItem) => i.kind === 'line' && i.id.startsWith('barline');

describe('layoutScore with two staves (M7b-1c)', () => {
  const qs = (...p: Array<[Step, number]>) => p.map(([s, o]) => note(s, o, 'quarter'));
  const build = () =>
    grand(
      [qs(['C', 5], ['D', 5], ['E', 5], ['F', 5]), qs(['G', 5], ['A', 5], ['B', 5], ['C', 6])],
      [[note('C', 3, 'half'), note('G', 2, 'half')], [note('E', 3, 'whole')]]
    );

  it('G1: one system with two staff containers, staff 1 lower by 4 + 7 sp, system height covers both', () => {
    const score = build();
    const r = quiet(() => layoutScore(score, { width: 100 }));
    expect(r.systems).toHaveLength(1);
    const sys = r.systems[0];
    const [a, b] = score.parts[0].staves;
    expect(sys.staves.map((s) => s.id)).toEqual([a.id, b.id]);
    expect(sys.staves[1].y - sys.staves[0].y).toBeCloseTo(11, 9);
    expect(sys.height).toBeGreaterThanOrEqual(sys.staves[1].y - sys.staves[0].y + 4);
  });

  it('G2: every staff has 5 staff lines, a clef of its own and event items tagged with its staffId', () => {
    const score = build();
    const sys = quiet(() => layoutScore(score, { width: 100 })).systems[0];
    const [a, b] = score.parts[0].staves;
    for (const st of [a, b]) {
      const own = sys.items.filter((i) => i.staffId === st.id);
      expect(own.filter((i) => i.id.includes('staffline'))).toHaveLength(5);
      expect(own.filter((i) => i.id.includes('clef'))).toHaveLength(1);
    }
    expect(sys.items.find((i) => i.glyph === 'gClef')!.staffId).toBe(a.id);
    expect(sys.items.find((i) => i.glyph === 'fClef')!.staffId).toBe(b.id);
    // No event item may be left without an owner.
    expect(sys.items.filter((i) => i.eventId && !i.staffId)).toEqual([]);
  });

  it('G3: equal ticks have equal x on both staves (beat 3 of measure 1: treble E5 vs bass G2)', () => {
    const score = build();
    const sys = quiet(() => layoutScore(score, { width: 100 })).systems[0];
    const [a, b] = score.parts[0].staves;
    const m1 = score.measures[0].id;
    const upper = a.measures[m1].voices[0].events;
    const lower = b.measures[m1].voices[0].events;
    const ux = noteheadXByEvent(sys, a.id);
    const lx = noteheadXByEvent(sys, b.id);
    expect(ux.get(upper[0].id)).toBeCloseTo(lx.get(lower[0].id)!, 9); // tick 0
    expect(ux.get(upper[2].id)).toBeCloseTo(lx.get(lower[1].id)!, 9); // tick 1920
  });

  it('G4: barlines are drawn once, span staff 0 top to the last staff bottom, and none is duplicated per staff', () => {
    const score = build();
    const sys = quiet(() => layoutScore(score, { width: 100 })).systems[0];
    const bars = sys.items.filter(isBarline);
    expect(bars.length).toBeGreaterThanOrEqual(3); // single + final thin + final thick
    for (const bar of bars) {
      expect(bar.y).toBeCloseTo(0, 9);
      expect(bar.y2).toBeCloseTo(sys.staves[1].y - sys.staves[0].y + 4, 9);
    }
    const xs = bars.map((b) => b.x.toFixed(6));
    // thin+thick final barline have distinct x; a per-staff duplicate would repeat an (id, x) pair.
    expect(new Set(bars.map((b) => `${b.id}@${b.x.toFixed(6)}`)).size).toBe(bars.length);
    expect(xs.length).toBe(bars.length);
    const start = sys.items.find((i) => i.id.endsWith('sys-start-barline'))!;
    expect(start.y2).toBeCloseTo(bars[0].y2!, 9);
  });

  it('G5: layout is deterministic (two runs, identical JSON)', () => {
    const score = build();
    const a = quiet(() => layoutScore(score, { width: 60 }));
    const b = quiet(() => layoutScore(score, { width: 60 }));
    expect(JSON.stringify(a.systems)).toBe(JSON.stringify(b.systems));
  });

  it('G6: wrapping into several systems keeps both staves in every system, with equal barline x per measure', () => {
    const many = Array.from({ length: 6 }, () => qs(['C', 5], ['D', 5], ['E', 5], ['F', 5]));
    const low = Array.from({ length: 6 }, () => [note('C', 3, 'whole')]);
    const score = grand(many, low);
    const r = quiet(() => layoutScore(score, { width: 45 }));
    expect(r.systems.length).toBeGreaterThan(1);
    const [a, b] = score.parts[0].staves;
    for (const sys of r.systems) {
      expect(sys.staves.map((s) => s.id)).toEqual([a.id, b.id]);
      expect(sys.items.filter((i) => i.staffId === a.id && i.id.includes('staffline'))).toHaveLength(5);
      expect(sys.items.filter((i) => i.staffId === b.id && i.id.includes('staffline'))).toHaveLength(5);
    }
    // Systems are stacked with enough room for the second staff (no overlap).
    for (let i = 1; i < r.systems.length; i++) {
      const prev = r.systems[i - 1];
      expect(r.systems[i].y).toBeGreaterThanOrEqual(prev.y + prev.staves[1].y + 4);
    }
  });

  it('G7: a staff with only a rest still lines up its barline with a busy staff', () => {
    const score = grand([qs(['C', 5], ['D', 5], ['E', 5], ['F', 5])], []);
    const sys = quiet(() => layoutScore(score, { width: 100 })).systems[0];
    const lines = sys.items.filter((i) => i.kind === 'line' && i.id.includes('staffline') && i.staffId);
    const byStaff = (id: string) => lines.filter((l) => l.staffId === id).map((l) => (l.x2 ?? 0) + 0);
    const [a, b] = score.parts[0].staves;
    expect(Math.max(...byStaff(a.id))).toBeCloseTo(Math.max(...byStaff(b.id)), 9);
  });

  it('G8: the single-staff result carries no staffId (unchanged format)', () => {
    const score = createEmptyScore({ measures: 2 });
    const r = quiet(() => layoutScore(score, { width: 100 }));
    expect(r.systems[0].items.some((i) => i.staffId !== undefined)).toBe(false);
  });

  it('G9: the grand-staff template gets a brace stretched to the whole system span, left of the start barline', () => {
    const score = createGrandStaffScore({ measures: 2 });
    const sys = quiet(() => layoutScore(score, { width: 100 })).systems[0];
    const brace = sys.items.filter((i) => i.glyph === 'brace');
    expect(brace).toHaveLength(1);
    const span = sys.staves[1].y - sys.staves[0].y + 4;
    expect(brace[0].y).toBeCloseTo(span, 9); // baseline at the bottom line of the last staff
    expect(brace[0].scaleY! * 4).toBeCloseTo(span, 9); // 4 sp natural height stretched to the span
    const start = sys.items.find((i) => i.id.endsWith('sys-start-barline'))!;
    expect(brace[0].x).toBeLessThan(start.x);
  });

  it('G10: group semantics: bracket "none" draws no brace; a part without a group defaults to a brace', () => {
    const none = createGrandStaffScore({ measures: 1 });
    none.groups[0].bracket = 'none';
    expect(quiet(() => layoutScore(none, { width: 100 })).systems[0].items.some((i) => i.glyph === 'brace')).toBe(false);
    const bare = createGrandStaffScore({ measures: 1 });
    bare.groups = [];
    expect(quiet(() => layoutScore(bare, { width: 100 })).systems[0].items.some((i) => i.glyph === 'brace')).toBe(true);
  });

  it('G11: a single-staff score never gets a brace, even with a brace group', () => {
    const score = createEmptyScore({ measures: 1 });
    score.groups = [{ id: newId(), partIds: [score.parts[0].id], bracket: 'brace', barlineSpan: 'through' }];
    expect(quiet(() => layoutScore(score, { width: 100 })).systems[0].items.some((i) => i.glyph === 'brace')).toBe(false);
  });

  it('G12: the renderer stretches the brace vertically (non-uniform scale) and nothing else', () => {
    const score = createGrandStaffScore({ measures: 1 });
    const svg = renderSvgToString(quiet(() => layoutScore(score, { width: 100 })), { staffSpacePx: 10 });
    const braceUse = svg.match(/<use[^>]*href="#glyph-brace"[^>]*>/)![0];
    const [sx, sy] = braceUse.match(/scale\(([0-9.]+), ([0-9.]+)\)/)!.slice(1).map(Number);
    expect(sy).toBeGreaterThan(sx * 2);
    const other = svg.match(/<use[^>]*href="#glyph-gClef"[^>]*>/)![0];
    expect(other).toMatch(/scale\([0-9.]+\)/);
  });
});
