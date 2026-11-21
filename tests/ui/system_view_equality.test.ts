// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { systemViewPropsEqual } from '../../src/ui/scoreView/systemEquality';
import type { LayoutItem, LayoutSystem } from '../../src/layout/types';

function system(items: LayoutItem[]): LayoutSystem {
  return { index: 0, x: 0, y: 0, width: 70, height: 10, staves: [], items };
}
const label = (text: string): LayoutItem => ({
  id: 'note-name-e1',
  eventId: 'e1',
  kind: 'text',
  text,
  x: 5,
  y: 6,
});
const props = (s: LayoutSystem) => ({ system: s, staffSpacePx: 10 });

describe('SystemView memo comparator', () => {
  it('E1: same id and position but different text is NOT equal (note-name style switch repaints)', () => {
    expect(systemViewPropsEqual(props(system([label('Do')])), props(system([label('C')])))).toBe(false);
  });

  it('E2: identical content in new objects is equal (no needless repaint)', () => {
    expect(systemViewPropsEqual(props(system([label('Do')])), props(system([label('Do')])))).toBe(true);
  });

  it('E3: a changed line end is not equal', () => {
    const a: LayoutItem = { id: 's', kind: 'line', x: 1, y: 1, x2: 1, y2: 4 };
    const b: LayoutItem = { ...a, y2: 5 };
    expect(systemViewPropsEqual(props(system([a])), props(system([b])))).toBe(false);
  });
});
