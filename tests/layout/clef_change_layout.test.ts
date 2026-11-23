// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-5 part 2: clef changes inside a staff in the layout: per-event staff position, small clef, trailing clef, header.
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { setClefChange } from '../../src/core/structureCommands';
import { layoutScore } from '../../src/layout/layoutScore';
import type { Clef, Score, Voice } from '../../src/core/model';
import type { LayoutItem, LayoutResult } from '../../src/layout/types';

const BASS: Clef = { sign: 'F', line: 4 };
const TENOR: Clef = { sign: 'C', line: 4 };

function allItems(r: LayoutResult): LayoutItem[] {
  const out = new Set<LayoutItem>(r.items);
  for (const s of r.systems) for (const it of s.items) out.add(it);
  return [...out];
}

function quarterScore(measures = 2): Score {
  const score = createEmptyScore({ numMeasures: measures });
  const staff = score.parts[0].staves[0];
  for (const m of score.measures) {
    staff.measures[m.id].voices[0].events = [0, 1, 2, 3].map(() =>
      createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' })
    );
  }
  return score;
}

const heads = (r: LayoutResult) =>
  allItems(r)
    .filter((it) => it.kind === 'glyph' && String(it.glyph).startsWith('notehead'))
    .sort((a, b) => a.x - b.x);
const smallClefs = (r: LayoutResult) => allItems(r).filter((it) => it.id.includes('clefchange-'));

describe('M7c-5 clef changes in the layout (part 2)', () => {
  it('LC1: notes after an in-measure change are drawn for the new clef', () => {
    const score = quarterScore(1);
    const staffId = score.parts[0].staves[0].id;
    const changed = setClefChange(staffId, score.measures[0].id, 1920, BASS).apply(score);
    const hs = heads(layoutScore(changed));
    expect(hs.length).toBe(4);
    expect(hs[0].y).toBe(5); // C4 in the treble clef: first ledger line below the staff
    expect(hs[1].y).toBe(5);
    expect(hs[2].y).toBe(-1); // C4 in the bass clef: second ledger line above the staff
    expect(hs[3].y).toBe(-1);
  });

  it('LC2: a small clef stands before the first affected note', () => {
    const score = quarterScore(1);
    const staffId = score.parts[0].staves[0].id;
    const changed = setClefChange(staffId, score.measures[0].id, 1920, BASS).apply(score);
    const r = layoutScore(changed);
    const small = smallClefs(r);
    expect(small.length).toBe(1);
    expect(small[0].glyph).toBe('fClef');
    expect(small[0].glyphScale).toBe(0.75);
    expect(small[0].y).toBe(1); // on the fourth line
    const hs = heads(r);
    expect(small[0].x > hs[1].x).toBe(true);
    expect(small[0].x < hs[2].x).toBe(true);
  });

  it('LC3: a change at the start of a measure is drawn small before the previous barline; the measure itself draws none', () => {
    const score = quarterScore(2);
    const staffId = score.parts[0].staves[0].id;
    const changed = setClefChange(staffId, score.measures[1].id, 0, TENOR).apply(score);
    const r = layoutScore(changed);
    const small = smallClefs(r);
    expect(small.length).toBe(1);
    expect(small[0].id.endsWith('-end')).toBe(true);
    expect(small[0].glyph).toBe('cClef');
    const hs = heads(r);
    expect(small[0].x > hs[3].x).toBe(true);
    // measure 2: C4 in the tenor clef is on the fourth line (y = 1)
    expect(hs[4].y).toBe(1);
  });

  it('LC4: a system that starts with a changed clef shows it full size in the header, with the key signature for that clef', () => {
    const score = quarterScore(2);
    const staffId = score.parts[0].staves[0].id;
    let changed = setClefChange(staffId, score.measures[1].id, 0, BASS).apply(score);
    changed = { ...changed, measures: changed.measures.map((m) => ({ ...m, keySig: 1 })) };
    const r = layoutScore(changed, { width: 8 });
    expect(r.systems.length).toBe(2);
    const header = r.systems[1].items.filter((it) => it.id.includes('-clef-'));
    expect(header.length).toBe(1);
    expect(header[0].glyph).toBe('fClef');
    expect(header[0].glyphScale).toBeUndefined();
    // the first system ends with the small warning clef
    expect(r.systems[0].items.some((it) => it.id.includes('clefchange-') && it.glyph === 'fClef')).toBe(true);
    // F sharp of the bass clef sits on the first space from the top; treble F5 sits on the top line
    const sharps1 = r.systems[1].items.filter((it) => it.id.includes('keysig-'));
    expect(sharps1[0].y).toBe(1);
  });

  it('LC5: the measure cache sees a new change although the staff measure object is shared', () => {
    const score = quarterScore(1);
    const staffId = score.parts[0].staves[0].id;
    const before = heads(layoutScore(score));
    const changed = setClefChange(staffId, score.measures[0].id, 960, BASS).apply(score);
    expect(changed.parts[0].staves[0].measures).toBe(score.parts[0].staves[0].measures); // unchanged object: the cache must still notice
    const after = heads(layoutScore(changed));
    expect(before[1].y).toBe(5);
    expect(after[1].y).toBe(-1);
  });

  it('LC6: a polyphonic measure follows the change in both voices', () => {
    const score = createEmptyScore({ numMeasures: 1 });
    const staff = score.parts[0].staves[0];
    const mId = score.measures[0].id;
    const v1: Voice = {
      id: 'v1-test',
      voiceIndex: 1,
      events: [0, 1].map(() => createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'half' })),
    };
    const v2: Voice = {
      id: 'v2-test',
      voiceIndex: 2,
      events: [createNote({ pitches: [createPitch('E', 3, 0)], baseType: 'half' }), createRest({ baseType: 'half' })],
    };
    staff.measures[mId].voices = [v1, v2];
    const changed = setClefChange(staff.id, mId, 1920, BASS).apply(score);
    const r = layoutScore(changed);
    const hs = heads(r).filter((it) => it.eventId === v1.events[0].id || it.eventId === v1.events[1].id);
    expect(hs[0].y).toBe(5);
    expect(hs[1].y).toBe(-1);
    expect(smallClefs(r).length).toBe(1);
  });

  it('LC7: a score without clef changes has no small clefs', () => {
    expect(smallClefs(layoutScore(quarterScore(3))).length).toBe(0);
  });
});
