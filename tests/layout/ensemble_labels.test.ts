// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-6 step 3b: part labels and the system indent they need.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createGrandStaffScore } from '../../src/core/factory';
import { applyTemplate } from '../../src/core/ensembleCommands';
import { layoutScore } from '../../src/layout/layoutScore';
import type { Score } from '../../src/core/model';
import type { LayoutItem } from '../../src/layout/types';

const make = (t: Parameters<typeof applyTemplate>[0], measures = 2): Score =>
  applyTemplate(t).apply(createEmptyScore({ numMeasures: measures }));
const labels = (items: LayoutItem[]): LayoutItem[] => items.filter((it) => it.id.includes('part-label-'));
const staffLine = (items: LayoutItem[], sIdx: number, k: number, line: number): LayoutItem | undefined =>
  items.find((it) => it.id === (k === 0 ? `sys-${sIdx}-staffline-${line}` : `sys-${sIdx}-s${k}-staffline-${line}`));

describe('M7c-6 part labels (step 3b)', () => {
  it('EP1: the first system shows the full part names, right-aligned in one column', () => {
    const r = layoutScore(make('stringQuartet'));
    const l = labels(r.systems[0].items);
    expect(l.map((x) => x.text).join(',')).toBe('Violin I,Violin II,Viola,Cello');
    expect(l.every((x) => x.textAnchor === 'end')).toBe(true);
    expect(new Set(l.map((x) => x.x)).size).toBe(1);
  });

  it('EP2: later systems show the short names and a smaller indent', () => {
    const r = layoutScore(make('stringQuartet', 12), { width: 45 });
    expect(r.systems.length > 1).toBe(true);
    expect(labels(r.systems[1].items).map((x) => x.text).join(',')).toBe('Vln. I,Vln. II,Vla.,Vc.');
    const first = staffLine(r.systems[0].items, 0, 0, 0)!.x;
    const later = staffLine(r.systems[1].items, 1, 0, 0)!.x;
    expect(first > later).toBe(true);
    expect(later > 0).toBe(true);
  });

  it('EP3: the staff lines start at the indent and the clef comes after it', () => {
    const r = layoutScore(make('satb'));
    const indent = staffLine(r.systems[0].items, 0, 0, 0)!.x;
    expect(indent > 0).toBe(true);
    const clef = r.systems[0].items.find((it) => it.id.includes('clef-'))!;
    expect(clef.x > indent).toBe(true);
    for (let k = 1; k < 4; k++) expect(staffLine(r.systems[0].items, 0, k, 0)!.x).toBe(indent);
  });

  it('EP4: the labels clear the bracket on their right', () => {
    const r = layoutScore(make('satb'));
    const bracket = r.systems[0].items.find((it) => it.id.includes('sys-bracket-0') && !it.id.includes('-top') && !it.id.includes('-bottom'))!;
    const l = labels(r.systems[0].items);
    expect(l.every((x) => x.x < bracket.x)).toBe(true);
  });

  it('EP5: a one-part score has no labels and no indent', () => {
    const r = layoutScore(createGrandStaffScore({ numMeasures: 2 }));
    expect(labels(r.systems[0].items).length).toBe(0);
    expect(staffLine(r.systems[0].items, 0, 0, 0)!.x).toBe(0);
    const solo = layoutScore(createEmptyScore({ numMeasures: 2 }));
    expect(labels(solo.systems[0].items).length).toBe(0);
  });

  it('EP6: a label is centred on the staves of its part', () => {
    const r = layoutScore(make('voicePiano'));
    const items = r.systems[0].items;
    const l = labels(items);
    expect(l.map((x) => x.text).join(',')).toBe('Voice,Piano');
    const voice = l[0];
    expect(voice.y > staffLine(items, 0, 0, 0)!.y && voice.y < staffLine(items, 0, 0, 4)!.y + 1).toBe(true);
    const piano = l[1];
    expect(piano.y > staffLine(items, 0, 1, 4)!.y && piano.y < staffLine(items, 0, 2, 0)!.y + 1).toBe(true);
  });

  it('EP7: parts without names get no labels and no indent', () => {
    const score = structuredClone(make('stringQuartet'));
    for (const p of score.parts) {
      p.name = '';
      p.shortName = '';
    }
    const r = layoutScore(score);
    expect(labels(r.systems[0].items).length).toBe(0);
    expect(staffLine(r.systems[0].items, 0, 0, 0)!.x).toBe(0);
  });
});
