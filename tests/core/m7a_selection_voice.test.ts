// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Voice-aware selection and editing tests (Item 6):
 * 1. different array order across measures respects voiceIndex
 * 2. selection across measures strictly follows voiceIndex
 * 3. paste into another voice targets that voice without mutating source voice
 * 4. delete in one voice leaves other voices completely intact
 */

import { describe, expect, it } from 'vitest';
import { pasteEvents } from '../../src/core/clipboard';
import { deleteEvent } from '../../src/core/commands';
import {
  createMeasure,
  createNote,
  createPart,
  createPitch,
  createRest,
  createScore,
  newId,
} from '../../src/core/factory';
import { eventsInRange, extendSelection, Selection } from '../../src/core/selection';

describe('Voice-Aware Selection and Multi-Voice Isolation (Item 6)', () => {
  // Test 1: Different array order across measures
  it('strictly follows voiceIndex even when voices are stored in swapped array orders across measures', () => {
    const score = createScore();
    const m1 = createMeasure({ num: 4, den: 4 });
    const m2 = createMeasure({ num: 4, den: 4 });
    const part = createPart({ name: 'Flute', instrument: 'flute' });
    score.measures.push(m1, m2);
    score.parts.push(part);

    const m1V1Note = createNote({ id: 'm1-v1-note', pitches: [createPitch('C', 4)], baseType: 'whole' });
    const m1V2Note = createNote({ id: 'm1-v2-note', pitches: [createPitch('E', 5)], baseType: 'whole' });

    const m2V1Note = createNote({ id: 'm2-v1-note', pitches: [createPitch('D', 4)], baseType: 'whole' });
    const m2V2Note = createNote({ id: 'm2-v2-note', pitches: [createPitch('G', 5)], baseType: 'whole' });

    // In measure 1: array order is [v1, v2]
    part.staves[0].measures[m1.id] = {
      voices: [
        { id: newId(), voiceIndex: 1, events: [m1V1Note] },
        { id: newId(), voiceIndex: 2, events: [m1V2Note] },
      ],
    };

    // In measure 2: swapped array order [v2, v1]!
    part.staves[0].measures[m2.id] = {
      voices: [
        { id: newId(), voiceIndex: 2, events: [m2V2Note] },
        { id: newId(), voiceIndex: 1, events: [m2V1Note] },
      ],
    };

    // Range selection anchored on m1-v2-note and focused on m2-v2-note
    const selectedEvents = eventsInRange(score, {
      staffId: part.staves[0].id,
      voiceIndex: 2,
      anchorId: m1V2Note.id,
      focusId: m2V2Note.id,
    });

    // Must select ONLY the voice 2 notes (m1V2Note and m2V2Note)
    expect(selectedEvents.map((e) => e.id)).toEqual([m1V2Note.id, m2V2Note.id]);
    // Must NOT select any voice 1 notes
    expect(selectedEvents.some((e) => e.id === m1V1Note.id || e.id === m2V1Note.id)).toBe(false);
  });

  // Test 2: Selection across measures follows voiceIndex strictly
  it('extends selection across multiple measures strictly within the same voiceIndex', () => {
    const score = createScore();
    const m1 = createMeasure({ num: 4, den: 4 });
    const m2 = createMeasure({ num: 4, den: 4 });
    const part = createPart({ name: 'Oboe', instrument: 'oboe' });
    score.measures.push(m1, m2);
    score.parts.push(part);

    const m1V1 = createNote({ id: 'm1-v1', pitches: [createPitch('C', 4)], baseType: 'whole' });
    const m1V2A = createNote({ id: 'm1-v2-a', pitches: [createPitch('E', 5)], baseType: 'half' });
    const m1V2B = createNote({ id: 'm1-v2-b', pitches: [createPitch('F', 5)], baseType: 'half' });

    const m2V1 = createNote({ id: 'm2-v1', pitches: [createPitch('D', 4)], baseType: 'whole' });
    const m2V2A = createNote({ id: 'm2-v2-a', pitches: [createPitch('G', 5)], baseType: 'half' });
    const m2V2B = createNote({ id: 'm2-v2-b', pitches: [createPitch('A', 5)], baseType: 'half' });

    part.staves[0].measures[m1.id] = {
      voices: [
        { id: newId(), voiceIndex: 1, events: [m1V1] },
        { id: newId(), voiceIndex: 2, events: [m1V2A, m1V2B] },
      ],
    };
    part.staves[0].measures[m2.id] = {
      voices: [
        { id: newId(), voiceIndex: 1, events: [m2V1] },
        { id: newId(), voiceIndex: 2, events: [m2V2A, m2V2B] },
      ],
    };

    // Start with event selection on m1-v2-a, extend to m2-v2-b
    const initialSel: Selection = { kind: 'event', id: m1V2A.id };
    const extended = extendSelection(score, initialSel, m2V2B.id);

    expect(extended.kind).toBe('range');
    if (extended.kind === 'range') {
      expect(extended.voiceIndex).toBe(2);
      const inRange = eventsInRange(score, extended);
      expect(inRange.map((e) => e.id)).toEqual([m1V2A.id, m1V2B.id, m2V2A.id, m2V2B.id]);
    }
  });

  // Test 3: Paste into another voice
  it('copies notes from voice 1 and pastes into voice 2 leaving voice 1 intact', () => {
    const score = createScore();
    const m1 = createMeasure({ num: 4, den: 4 });
    const part = createPart({ name: 'Clarinet', instrument: 'clarinet' });
    score.measures.push(m1);
    score.parts.push(part);

    const v1Note1 = createNote({ id: 'v1-n1', pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const v1Note2 = createNote({ id: 'v1-n2', pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const v1Rest = createRest({ id: 'v1-r1', baseType: 'half', duration: 1920 });

    const v2Rest = createRest({ id: 'v2-r1', baseType: 'whole', duration: 3840 });

    part.staves[0].measures[m1.id] = {
      voices: [
        { id: 'v1-id', voiceIndex: 1, events: [v1Note1, v1Note2, v1Rest] },
        { id: 'v2-id', voiceIndex: 2, events: [v2Rest] },
      ],
    };

    // Copy notes from voice 1
    const clipEvents = [v1Note1, v1Note2];
    expect(clipEvents).toHaveLength(2);

    // Paste into voice 2 at offset 0
    const updated = pasteEvents(
      score,
      {
        staffId: part.staves[0].id,
        voiceIndex: 2,
        startMeasureId: m1.id,
        startOffsetTicks: 0,
      },
      clipEvents
    );

    const sm = updated.parts[0].staves[0].measures[m1.id];
    // Voice 1 must be completely untouched
    expect(sm.voices[0].events.map((e) => e.id)).toEqual(['v1-n1', 'v1-n2', 'v1-r1']);

    // Voice 2 now contains the pasted notes (2 quarters + 1 half rest = 3840 ticks)
    const v2Events = sm.voices[1].events;
    expect(v2Events[0].kind).toBe('note');
    expect(v2Events[1].kind).toBe('note');
    const totalV2Ticks = v2Events.reduce((s, e) => s + e.duration, 0);
    expect(totalV2Ticks).toBe(3840);
  });

  // Test 4: Delete in one voice leaves the others
  it('deletes an event in voice 2 and leaves voice 1 completely untouched', () => {
    const score = createScore();
    const m1 = createMeasure({ num: 4, den: 4 });
    const part = createPart({ name: 'Bassoon', instrument: 'bassoon' });
    score.measures.push(m1);
    score.parts.push(part);

    const v1Note = createNote({ id: 'v1-keeper', pitches: [createPitch('C', 3)], baseType: 'whole' });
    const v2Note1 = createNote({ id: 'v2-delete-me', pitches: [createPitch('G', 3)], baseType: 'half' });
    const v2Note2 = createNote({ id: 'v2-keeper', pitches: [createPitch('E', 3)], baseType: 'half' });

    part.staves[0].measures[m1.id] = {
      voices: [
        { id: newId(), voiceIndex: 1, events: [v1Note] },
        { id: newId(), voiceIndex: 2, events: [v2Note1, v2Note2] },
      ],
    };

    const updated = deleteEvent('v2-delete-me').apply(score);
    const sm = updated.parts[0].staves[0].measures[m1.id];

    // Voice 1 is completely intact
    expect(sm.voices[0].events).toHaveLength(1);
    expect(sm.voices[0].events[0].id).toBe('v1-keeper');

    // Voice 2 only has v2Note2 remaining
    expect(sm.voices[1].events.find((e) => e.id === 'v2-delete-me')).toBeUndefined();
    expect(sm.voices[1].events.find((e) => e.id === 'v2-keeper')).toBeDefined();
  });
});
