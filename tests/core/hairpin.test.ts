// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-2c: crescendo / diminuendo hairpins (model, toggle command, validation, cleanup, layout).
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { toggleHairpin } from '../../src/core/notationCommands';
import { deleteEvent } from '../../src/core/commands';
import { deleteMeasure } from '../../src/core/structureCommands';
import { validateScore } from '../../src/core/validate';
import { layoutScore } from '../../src/layout/layoutScore';
import { layoutHairpins } from '../../src/layout/notations';
import type { Score } from '../../src/core/model';
import type { Selection } from '../../src/core/selection';

function setup(numMeasures = 1): { score: Score; ids: string[]; sel: Selection } {
  const score = createEmptyScore({ numMeasures });
  const m0 = score.measures[0].id;
  const evs = [0, 1, 2, 3].map((i) =>
    createNote({ pitches: [createPitch(['C', 'D', 'E', 'F'][i] as 'C', 4, 0)], baseType: 'quarter' })
  );
  const staff = score.parts[0].staves[0];
  staff.measures[m0].voices[0].events = evs;
  const sel: Selection = {
    kind: 'range',
    staffId: staff.id,
    voiceIndex: 1,
    anchorId: evs[0].id,
    focusId: evs[2].id,
  };
  return { score, ids: evs.map((e) => e.id), sel };
}

describe('hairpins (M7c-2c)', () => {
  it('H1: toggling adds, the same type removes, the other type switches', () => {
    const { score, sel } = setup();
    const a = toggleHairpin(sel, 'crescendo').apply(score);
    expect(a.parts[0].staves[0].hairpins).toHaveLength(1);
    expect(a.parts[0].staves[0].hairpins![0].type).toBe('crescendo');
    const b = toggleHairpin(sel, 'diminuendo').apply(a);
    expect(b.parts[0].staves[0].hairpins![0].type).toBe('diminuendo');
    const c = toggleHairpin(sel, 'diminuendo').apply(b);
    expect(c.parts[0].staves[0].hairpins).toBeUndefined();
  });

  it('H2: a hairpin needs a range of at least two events', () => {
    const { score, ids } = setup();
    const staff = score.parts[0].staves[0];
    const one: Selection = { kind: 'range', staffId: staff.id, voiceIndex: 1, anchorId: ids[0], focusId: ids[0] };
    expect(toggleHairpin(one, 'crescendo').apply(score)).toBe(score);
    expect(toggleHairpin({ kind: 'event', id: ids[0] }, 'crescendo').apply(score)).toBe(score);
  });

  it('H3: a valid hairpin passes validation', () => {
    const { score, sel } = setup();
    const s = toggleHairpin(sel, 'crescendo').apply(score);
    expect(validateScore(s).filter((p) => p.code.includes('hairpin'))).toHaveLength(0);
  });

  it('H4: deleting the end event removes the hairpin, no validation error remains', () => {
    const { score, ids, sel } = setup();
    const s = toggleHairpin(sel, 'crescendo').apply(score);
    const after = deleteEvent(ids[2]).apply(s);
    expect(after.parts[0].staves[0].hairpins ?? []).toHaveLength(0);
    expect(validateScore(after).filter((p) => p.code.includes('hairpin'))).toHaveLength(0);
  });

  it('H5: deleting a measure removes hairpins that point into it', () => {
    const { score } = setup(2);
    const staff = score.parts[0].staves[0];
    const m1 = score.measures[1].id;
    const first = staff.measures[score.measures[0].id].voices[0].events[0];
    const last = staff.measures[m1].voices[0].events[0];
    staff.hairpins = [{ id: 'h1', type: 'crescendo', startEventId: first.id, endEventId: last.id }];
    const after = deleteMeasure(1).apply(score);
    expect(after.parts[0].staves[0].hairpins ?? []).toHaveLength(0);
  });

  it('H6: a missing end event is a validation error', () => {
    const { score, ids } = setup();
    score.parts[0].staves[0].hairpins = [
      { id: 'h1', type: 'crescendo', startEventId: ids[0], endEventId: 'nope' },
    ];
    expect(validateScore(score).some((p) => p.code === 'hairpin-missing-event')).toBe(true);
  });

  it('H7: layout draws a crescendo under the staff, narrow at the start and wider at the end', () => {
    const { score, sel } = setup();
    const s = toggleHairpin(sel, 'crescendo').apply(score);
    const layout = layoutScore(s, { width: 70 });
    const items = layoutHairpins(s, layout);
    expect(items).toHaveLength(1);
    const nums = items[0].d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    // first strip: M x1 y1 L x2 y2 ... ; the top line moves up (smaller y) from start to end
    const [x1, y1, x2, y2] = [nums[0], nums[1], nums[2], nums[3]];
    expect(x2).toBeGreaterThan(x1);
    expect(y2).toBeLessThan(y1);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThan(4); // below the staff bottom line (y = 4)
  });

  it('H8: a diminuendo is the mirror image (wide at the start)', () => {
    const { score, sel } = setup();
    const s = toggleHairpin(sel, 'diminuendo').apply(score);
    const layout = layoutScore(s, { width: 70 });
    const [item] = layoutHairpins(s, layout);
    const nums = item.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(nums[3]).toBeGreaterThan(nums[1]); // top line moves down toward the end
  });

  it('H9: with note names shown the hairpin lies below the names, not through them', () => {
    const { score, sel } = setup();
    const s = toggleHairpin(sel, 'crescendo').apply(score);
    const plain = layoutHairpins(s, layoutScore(s, { width: 70 }))[0].d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const named_s: Score = { ...s, layoutSettings: { ...s.layoutSettings, showNoteNames: true } };
    const withNames = layoutScore(named_s, { width: 70, noteNameStyle: 'solfege' });
    const labels = withNames.systems[0].items.filter((it) => it.kind === 'text' && it.y > 4.5);
    expect(labels.length).toBeGreaterThan(0);
    const lowestLabel = Math.max(...labels.map((l) => l.y));
    const named = layoutHairpins(named_s, withNames)[0].d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const topOfHairpin = Math.min(...named.filter((_, i) => i % 2 === 1));
    expect(topOfHairpin).toBeGreaterThan(lowestLabel);
    expect(Math.min(...named.filter((_, i) => i % 2 === 1))).toBeGreaterThan(Math.min(...plain.filter((_, i) => i % 2 === 1)));
  });
});
