import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { eventsInRange, extendSelection, getRangeMeasureSpan, Selection } from '../../src/core/selection';

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
    staff.measures[m1Id].voices[0] = { id: voiceId, events: [n4, n5, n6, n7] };
    staff.measures[m2Id].voices[0] = { id: voiceId, events: [r8] };

    return { score, staffId: staff.id, voiceId, notes: [n0, n1, n2, n3, n4, n5, n6, n7, r8] };
  }

  it('eventsInRange returns all events contiguously in reading order forward and backward', () => {
    const { score, staffId, voiceId, notes } = makeTestScore();

    // Range forward from n1 to n5 (5 events: D4, E4, F4 in m1, G4, A4 in m2)
    const rangeForward = {
      staffId,
      voiceId,
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
      voiceId,
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
    const { score, staffId, voiceId, notes } = makeTestScore();

    // From none -> range with anchor=focus
    const sel0: Selection = { kind: 'none' };
    const sel1 = extendSelection(score, sel0, notes[2].id);
    expect(sel1).toEqual({
      kind: 'range',
      staffId,
      voiceId,
      anchorId: notes[2].id,
      focusId: notes[2].id,
    });

    // From single event -> anchor is original event, focus is new target
    const selSingle: Selection = { kind: 'event', id: notes[1].id };
    const sel2 = extendSelection(score, selSingle, notes[4].id);
    expect(sel2).toEqual({
      kind: 'range',
      staffId,
      voiceId,
      anchorId: notes[1].id,
      focusId: notes[4].id,
    });

    // From existing range -> keeps anchor, updates focus
    const sel3 = extendSelection(score, sel2, notes[6].id);
    expect(sel3).toEqual({
      kind: 'range',
      staffId,
      voiceId,
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
    });
  });
});
