// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, newId } from '../../src/core/factory';
import { eventsInRange, findEventContext, RangeSelection } from '../../src/core/selection';
import { useScoreMarquee } from '../../src/ui/scoreView/useScoreMarquee';
import { LayoutResult } from '../../src/layout/types';

describe('D3d & 0.3: Marquee selection on voice 2', () => {
  it('resolves voiceIndex: 2 from findEventContext and eventsInRange selects voice 2 events', () => {
    const score = createEmptyScore({ measures: 2 });
    const staff = score.parts[0].staves[0];
    const m1Id = score.measures[0].id;
    const m2Id = score.measures[1].id;

    // Add voice 2 to measure 1 and measure 2
    const v2NotesM1 = [
      createNote({ baseType: 'quarter', pitches: [{ step: 'C', octave: 4, alter: 0 }] }),
      createNote({ baseType: 'quarter', pitches: [{ step: 'D', octave: 4, alter: 0 }] }),
    ];
    const v2NotesM2 = [
      createNote({ baseType: 'quarter', pitches: [{ step: 'E', octave: 4, alter: 0 }] }),
      createNote({ baseType: 'quarter', pitches: [{ step: 'F', octave: 4, alter: 0 }] }),
    ];

    staff.measures[m1Id].voices.push({
      id: newId(),
      voiceIndex: 2,
      events: v2NotesM1,
    });
    staff.measures[m2Id].voices.push({
      id: newId(),
      voiceIndex: 2,
      events: v2NotesM2,
    });

    // Simulate marquee selection enclosing voice 2 notes
    const firstEv = v2NotesM1[0];
    const lastEv = v2NotesM2[1];

    const ctx = findEventContext(score, firstEv.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.voiceIndex).toBe(2);

    const rangeSel: RangeSelection = {
      staffId: staff.id,
      voiceIndex: (ctx!.voiceIndex ?? 1) as 1 | 2 | 3 | 4,
      voiceId: ctx!.voiceId,
      anchorId: firstEv.id,
      focusId: lastEv.id,
    };

    expect(rangeSel.voiceIndex).toBe(2);

    const selectedEvents = eventsInRange(score, rangeSel);
    expect(selectedEvents).toHaveLength(4);
    expect(selectedEvents.map((e) => e.id)).toEqual([
      v2NotesM1[0].id,
      v2NotesM1[1].id,
      v2NotesM2[0].id,
      v2NotesM2[1].id,
    ]);
  });

  it('0.3 useScoreMarquee hook dispatches onSelectRange with voiceIndex: 2 when enclosing voice 2 notes', () => {
    const score = createEmptyScore({ measures: 2 });
    const staff = score.parts[0].staves[0];
    const m1Id = score.measures[0].id;

    const v2Note = createNote({ baseType: 'quarter', pitches: [{ step: 'C', octave: 4, alter: 0 }] });
    staff.measures[m1Id].voices.push({
      id: newId(),
      voiceIndex: 2,
      events: [v2Note],
    });

    const mockLayout: LayoutResult = {
      width: 800,
      height: 120,
      items: [],
      systems: [
        {
          index: 0,
          staves: [],
          x: 0,
          y: 0,
          width: 800,
          height: 120,
          items: [
            {
              id: 'note-v2',
              eventId: v2Note.id,
              measureIndex: 0,
              x: 5,
              y: 5,
              width: 2,
              height: 2,
            } as any,
          ],
        },
      ],
    };

    let dispatchedRange: RangeSelection | null = null;
    let hookApi: ReturnType<typeof useScoreMarquee> | null = null;

    function TestHost() {
      hookApi = useScoreMarquee(score, mockLayout, 10, (r) => {
        dispatchedRange = r;
      });
      return React.createElement('div', null, 'Marquee Host');
    }

    renderToStaticMarkup(React.createElement(TestHost));
    expect(hookApi).not.toBeNull();

    // Simulate drag across note
    hookApi!.marqueeRef.current = {
      startX: 0,
      startY: 0,
      currentX: 100,
      currentY: 100,
      isMarquee: true,
    };

    hookApi!.handleMarqueeUp(0, 0);

    expect(dispatchedRange).not.toBeNull();
    expect(dispatchedRange!.voiceIndex).toBe(2);
    expect(dispatchedRange!.anchorId).toBe(v2Note.id);
  });
});
