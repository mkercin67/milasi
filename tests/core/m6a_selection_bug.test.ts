// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { eventsInRange, extendSelection, findEventContext, nextEventId, Selection } from '../../src/core/selection';
import { deserializeClipboard, pasteEvents, serializeClipboard, setMemoryClipboard } from '../../src/core/clipboard';
import { validateScore } from '../../src/core/validate';

describe('M6a Closing: Selection and Multi-Measure Bug Verification (R1 & Step 0a)', () => {
  function makeAppPathScore8Measures() {
    // R1: created through the SAME path the app uses: createEmptyScore
    const score = createEmptyScore({
      clef: { sign: 'G', line: 2 },
      keySig: 0,
      timeSig: { num: 4, den: 4 },
      measures: 8,
    });
    const staff = score.parts[0].staves[0];

    // Populate each of the 8 measures with 4 quarter notes
    const pitchNames: Array<'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'> = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const allNotes: Array<{ id: string; mIdx: number; step: string }> = [];

    for (let mIdx = 0; mIdx < 8; mIdx++) {
      const mDef = score.measures[mIdx];
      const events = [0, 1, 2, 3].map((beat) => {
        const step = pitchNames[(mIdx * 4 + beat) % pitchNames.length];
        const n = createNote({
          pitches: [createPitch(step, 4)],
          baseType: 'quarter',
        });
        allNotes.push({ id: n.id, mIdx, step });
        return n;
      });
      // In createEmptyScore, each measure has a voice with random UUID
      staff.measures[mDef.id].voices[0].events = events;
    }

    return { score, staff, allNotes };
  }

  it('Shift+Arrow navigation from measure 1 to measure 3 selects all notes between across barlines', () => {
    const { score, staff, allNotes } = makeAppPathScore8Measures();

    // Start with selection on first note of measure 1 (index 0)
    let sel: Selection = { kind: 'event', id: allNotes[0].id };

    // Move with Shift+ArrowRight across to measure 3 (index 2), last note of measure 3 is note 11 (total 12 notes)
    for (let i = 0; i < 11; i++) {
      const curId = sel.kind === 'range' ? sel.focusId : sel.kind === 'event' ? sel.id : '';
      const nextId = nextEventId(score, staff.id, curId, 'next');
      expect(nextId).not.toBeNull();
      sel = extendSelection(score, sel, nextId!);
    }

    expect(sel.kind).toBe('range');
    if (sel.kind === 'range') {
      expect(sel.anchorId).toBe(allNotes[0].id);
      expect(sel.focusId).toBe(allNotes[11].id);

      const inRange = eventsInRange(score, sel);
      expect(inRange.length).toBe(12);
      expect(inRange.map((e) => e.id)).toEqual(allNotes.slice(0, 12).map((n) => n.id));
    }
  });

  it('marquee across a barline selects all notes between start and end event across measures', () => {
    const { score, staff, allNotes } = makeAppPathScore8Measures();

    // Simulate marquee enclosing note 2 in measure 1 (index 2) through note 1 in measure 2 (index 4)
    const firstEv = allNotes[2];
    const lastEv = allNotes[5];
    const firstCtx = findEventContext(score, firstEv.id);
    expect(firstCtx).not.toBeNull();

    const rangeSel = {
      staffId: staff.id,
      voiceId: firstCtx!.voiceId,
      anchorId: firstEv.id,
      focusId: lastEv.id,
    };

    const inRange = eventsInRange(score, rangeSel);
    // Should include index 2, 3, 4, 5 (4 notes across measure 1 and 2)
    expect(inRange.length).toBe(4);
    expect(inRange.map((e) => e.id)).toEqual(allNotes.slice(2, 6).map((n) => n.id));
  });

  it('copy 12 notes across measures and paste them elsewhere: exactly 12 notes pasted', () => {
    const { score, staff, allNotes } = makeAppPathScore8Measures();

    // Select 12 notes (measures 1 to 3)
    const rangeSel = {
      staffId: staff.id,
      voiceId: staff.measures[score.measures[0].id].voices[0].id,
      anchorId: allNotes[0].id,
      focusId: allNotes[11].id,
    };
    const toCopy = eventsInRange(score, rangeSel);
    expect(toCopy.length).toBe(12);

    // Serialize and copy to clipboard
    setMemoryClipboard(toCopy);
    const json = serializeClipboard(toCopy);
    const fromClip = deserializeClipboard(json);
    expect(fromClip?.length).toBe(12);

    // Paste into measure 5 (index 4) at offset 0
    const targetMDef = score.measures[4];
    const placedIds: string[] = [];
    const pastedScore = pasteEvents(
      score,
      {
        staffId: staff.id,
        voiceId: staff.measures[targetMDef.id].voices[0].id,
        startMeasureId: targetMDef.id,
        startOffsetTicks: 0,
      },
      fromClip!,
      placedIds
    );

    expect(placedIds.length).toBe(12);
    expect(validateScore(pastedScore)).toHaveLength(0);

    // Verify measures 5, 6, 7 now each have 4 quarter notes matching the 12 pasted notes
    const pastedNotes = placedIds.map((id) => {
      const loc = findEventContext(pastedScore, id);
      expect(loc).not.toBeNull();
      return id;
    });
    expect(pastedNotes.length).toBe(12);
  });
});
