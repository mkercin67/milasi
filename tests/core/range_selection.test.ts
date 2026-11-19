// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { eventsInRange, extendSelection, getRangeMeasureSpan, nextEventId, RangeSelection, Selection } from '../../src/core/selection';

describe('Milestone 6a: Range Selection (src/core/selection.ts)', () => {
  function makeTestScore() {
    const score = createEmptyScore({ measures: 3 });
    const part = score.parts[0];
    const staff = part.staves[0];
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;
    const m2Id = score.measures[2].id;

    const n0 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n1 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });

    const n4 = createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' });
    const n5 = createNote({ pitches: [createPitch('A', 4)], baseType: 'quarter' });
    const n6 = createNote({ pitches: [createPitch('B', 4)], baseType: 'quarter' });
    const n7 = createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' });

    const r8 = createRest({ baseType: 'whole', duration: 3840 });

    const voiceId = staff.measures[m0Id].voices[0].id;
    staff.measures[m0Id].voices[0].events = [n0, n1, n2, n3];
    staff.measures[m1Id].voices[0] = { id: voiceId, voiceIndex: 1, events: [n4, n5, n6, n7] };
    staff.measures[m2Id].voices[0] = { id: voiceId, voiceIndex: 1, events: [r8] };

    return { score, staffId: staff.id, notes: [n0, n1, n2, n3, n4, n5, n6, n7, r8] };
  }

  it('eventsInRange returns all events contiguously in reading order forward and backward', () => {
    const { score, staffId, notes } = makeTestScore();

    // Range forward from n1 to n5 (5 events: D4, E4, F4 in m1, G4, A4 in m2)
    const rangeForward = {
      staffId,
      voiceIndex: 1 as const,
      anchorId: notes[1].id,
      focusId: notes[5].id,
    };
    const eventsFwd = eventsInRange(score, rangeForward);
    expect(eventsFwd.map((e) => e.id)).toEqual([
      notes[1].id,
      notes[2].id,
      notes[3].id,
      notes[4].id,
      notes[5].id,
    ]);

    // Range backward (focus before anchor: n5 to n1) must return same events in reading order
    const rangeBackward = {
      staffId,
      voiceIndex: 1 as const,
      anchorId: notes[5].id,
      focusId: notes[1].id,
    };
    const eventsBwd = eventsInRange(score, rangeBackward);
    expect(eventsBwd.map((e) => e.id)).toEqual([
      notes[1].id,
      notes[2].id,
      notes[3].id,
      notes[4].id,
      notes[5].id,
    ]);
  });

  it('extendSelection handles none, single event, and existing range', () => {
    const { score, staffId, notes } = makeTestScore();

    // From none -> range with anchor=focus
    const sel0: Selection = { kind: 'none' };
    const sel1 = extendSelection(score, sel0, notes[2].id);
    expect(sel1).toEqual({
      kind: 'range',
      staffId,
      voiceIndex: 1,
      anchorId: notes[2].id,
      focusId: notes[2].id,
    });

    // From single event -> anchor is original event, focus is new target
    const selSingle: Selection = { kind: 'event', id: notes[1].id };
    const sel2 = extendSelection(score, selSingle, notes[4].id);
    expect(sel2).toEqual({
      kind: 'range',
      staffId,
      voiceIndex: 1,
      anchorId: notes[1].id,
      focusId: notes[4].id,
    });

    // From existing range -> keeps anchor, updates focus
    const sel3 = extendSelection(score, sel2, notes[6].id);
    expect(sel3).toEqual({
      kind: 'range',
      staffId,
      voiceIndex: 1,
      anchorId: notes[1].id,
      focusId: notes[6].id,
    });
  });

  it('getRangeMeasureSpan computes correct measure range numbers and count', () => {
    const { score, notes } = makeTestScore();
    const span = getRangeMeasureSpan(score, [notes[2], notes[3], notes[4], notes[5]]);
    expect(span).toEqual({
      startMeasureNumber: 1,
      endMeasureNumber: 2,
      count: 4,
      measureCount: 2,
    });
  });

  it('extends selection across measures even when measures have different voice IDs', () => {
    const score = createEmptyScore({ measures: 3 });
    const staff = score.parts[0].staves[0];
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;

    const n0 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n1 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
    staff.measures[m0Id].voices[0] = { id: 'voice-m0', voiceIndex: 1, events: [n0, n1, n2, n3] };

    const n4 = createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' });
    const n5 = createNote({ pitches: [createPitch('A', 4)], baseType: 'quarter' });
    staff.measures[m1Id].voices[0] = { id: 'voice-m1', voiceIndex: 1, events: [n4, n5] };

    // Select n0 in measure 0
    let sel: Selection = { kind: 'event', id: n0.id };
    // Extend to n5 in measure 1
    sel = extendSelection(score, sel, n5.id);
    expect(sel.kind).toBe('range');
    if (sel.kind === 'range') {
      expect(sel.anchorId).toBe(n0.id);
      expect(sel.focusId).toBe(n5.id);
      const evs = eventsInRange(score, sel);
      expect(evs.map((e) => e.id)).toEqual([n0.id, n1.id, n2.id, n3.id, n4.id, n5.id]);
    }
  });

  it('FAILING-FIRST: asserts selection follows voiceIndex (1..4) regardless of array storage order across measures', () => {
    const score = createEmptyScore({ measures: 2 });
    const staff = score.parts[0].staves[0];
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;

    // Measure 0: Voice 1 at index 0, Voice 2 at index 1
    const m0_v1_n0 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const m0_v1_n1 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const m0_v2_n0 = createNote({ pitches: [createPitch('E', 3)], baseType: 'quarter' });
    const m0_v2_n1 = createNote({ pitches: [createPitch('F', 3)], baseType: 'quarter' });

    staff.measures[m0Id].voices = [
      { id: 'm0-v1', voiceIndex: 1, events: [m0_v1_n0, m0_v1_n1] },
      { id: 'm0-v2', voiceIndex: 2, events: [m0_v2_n0, m0_v2_n1] },
    ];

    // Measure 1: Voice 2 at index 0, Voice 1 at index 1 (REVERSED array storage order)
    const m1_v2_n0 = createNote({ pitches: [createPitch('G', 3)], baseType: 'quarter' });
    const m1_v2_n1 = createNote({ pitches: [createPitch('A', 3)], baseType: 'quarter' });
    const m1_v1_n0 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const m1_v1_n1 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });

    staff.measures[m1Id].voices = [
      { id: 'm1-v2', voiceIndex: 2, events: [m1_v2_n0, m1_v2_n1] },
      { id: 'm1-v1', voiceIndex: 1, events: [m1_v1_n0, m1_v1_n1] },
    ];

    // Range selection on Voice 1: from m0_v1_n0 to m1_v1_n0
    const rangeV1 = {
      staffId: staff.id,
      voiceIndex: 1 as const,
      anchorId: m0_v1_n0.id,
      focusId: m1_v1_n0.id,
    };

    const evsV1 = eventsInRange(score, rangeV1);
    expect(evsV1.map((e) => e.id)).toEqual([m0_v1_n0.id, m0_v1_n1.id, m1_v1_n0.id]);
  });

  it('range selection across measures works strictly with voiceIndex when each measure has distinct voice ids without any voiceId property', () => {
    const score = createEmptyScore({ measures: 3 });
    const part = score.parts[0];
    const staff = part.staves[0];
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;

    const n0 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n1 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
    const n4 = createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' });
    const n5 = createNote({ pitches: [createPitch('A', 4)], baseType: 'quarter' });

    // Distinct voice IDs per measure, same voiceIndex 1
    staff.measures[m0Id].voices[0] = { id: 'voice-m0-uuid-1111', voiceIndex: 1, events: [n0, n1, n2, n3] };
    staff.measures[m1Id].voices[0] = { id: 'voice-m1-diff-uuid-2222', voiceIndex: 1, events: [n4, n5] };

    // Range selection without voiceId, purely using voiceIndex: 1
    const range: RangeSelection = {
      staffId: staff.id,
      voiceIndex: 1,
      anchorId: n2.id,
      focusId: n5.id,
    };

    const events = eventsInRange(score, range);
    expect(events.map((e) => e.id)).toEqual([n2.id, n3.id, n4.id, n5.id]);
  });

  it('S6: Shift+Right in voice 2 extends within voice 2 and across measures to next measure in same voice', () => {
    const score = createEmptyScore({ measures: 2 });
    const staff = score.parts[0].staves[0];
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;

    // In m0, Voice 2 has two quarter notes v2_m0_0, v2_m0_1
    const v2_m0_0 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const v2_m0_1 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
    staff.measures[m0Id].voices.push({ id: 'v2-m0', voiceIndex: 2, events: [v2_m0_0, v2_m0_1] });

    // In m1, Voice 2 has two quarter notes v2_m1_0, v2_m1_1
    const v2_m1_0 = createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' });
    const v2_m1_1 = createNote({ pitches: [createPitch('A', 4)], baseType: 'quarter' });
    staff.measures[m1Id].voices.push({ id: 'v2-m1', voiceIndex: 2, events: [v2_m1_0, v2_m1_1] });

    // Start with selection on first event of voice 2
    let sel: Selection = { kind: 'event', id: v2_m0_0.id };

    // Shift+Right step 1: within same measure
    const next1 = nextEventId(score, staff.id, v2_m0_0.id, 'next', 2);
    expect(next1).toBe(v2_m0_1.id);
    sel = extendSelection(score, sel, next1!);
    expect(sel).toEqual({
      kind: 'range',
      staffId: staff.id,
      voiceIndex: 2,
      anchorId: v2_m0_0.id,
      focusId: v2_m0_1.id,
    });
    expect(eventsInRange(score, sel as RangeSelection).map((e) => e.id)).toEqual([v2_m0_0.id, v2_m0_1.id]);

    // Shift+Right step 2: across measure boundary into measure 1
    const next2 = nextEventId(score, staff.id, v2_m0_1.id, 'next', 2);
    expect(next2).toBe(v2_m1_0.id);
    sel = extendSelection(score, sel, next2!);
    expect(sel).toEqual({
      kind: 'range',
      staffId: staff.id,
      voiceIndex: 2,
      anchorId: v2_m0_0.id,
      focusId: v2_m1_0.id,
    });
    expect(eventsInRange(score, sel as RangeSelection).map((e) => e.id)).toEqual([
      v2_m0_0.id,
      v2_m0_1.id,
      v2_m1_0.id,
    ]);
  });
});
