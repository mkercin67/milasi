// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { cycleVoice, ScoreCursor } from '../../src/core/input';
import { createMeasure, createNote, createPart, createPitch, createRest, createScore, newId } from '../../src/core/factory';
import { Score } from '../../src/core/model';

describe('T1: Pure Cursor Voice Switching (Decision D2)', () => {
  function createTestScore(): { score: Score; staffId: string; measureId: string } {
    const score = createScore();
    const m = createMeasure({ num: 4, den: 4 });
    const part = createPart({ name: 'Piano', instrument: 'piano' });
    score.measures.push(m);
    score.parts.push(part);

    const staffId = part.staves[0].id;
    // Voice 1 has 4 quarter notes
    const v1Events = [
      createNote({ id: 'v1-n1', baseType: 'quarter', pitches: [createPitch('C', 4)] }),
      createNote({ id: 'v1-n2', baseType: 'quarter', pitches: [createPitch('D', 4)] }),
      createNote({ id: 'v1-n3', baseType: 'quarter', pitches: [createPitch('E', 4)] }),
      createNote({ id: 'v1-n4', baseType: 'quarter', pitches: [createPitch('F', 4)] }),
    ];

    // Voice 2 has 1 whole note (duration 3840)
    const v2Events = [
      createNote({ id: 'v2-whole', baseType: 'whole', pitches: [createPitch('G', 3)] }),
    ];

    part.staves[0].measures[m.id] = {
      voices: [
        { id: newId(), voiceIndex: 1, events: v1Events },
        { id: newId(), voiceIndex: 2, events: v2Events },
      ],
    };

    return { score, staffId, measureId: m.id };
  }

  it('FAILING-FIRST: cycles forward (Tab) 1 -> 2 -> 3 -> 4 -> 1 and backward (Shift+Tab) 1 -> 4 -> 3 -> 2 -> 1', () => {
    const { score, staffId, measureId } = createTestScore();
    const cursorV1: ScoreCursor = { staffId, measureId, voiceIndex: 1, tick: 0 };

    // Forward Tab
    const cursorV2 = cycleVoice(score, cursorV1, 'next');
    expect(cursorV2.voiceIndex).toBe(2);

    const cursorV3 = cycleVoice(score, cursorV2, 'next');
    expect(cursorV3.voiceIndex).toBe(3);

    const cursorV4 = cycleVoice(score, cursorV3, 'next');
    expect(cursorV4.voiceIndex).toBe(4);

    const cursorV1Wrap = cycleVoice(score, cursorV4, 'next');
    expect(cursorV1Wrap.voiceIndex).toBe(1);

    // Backward Shift+Tab
    const backV4 = cycleVoice(score, cursorV1, 'prev');
    expect(backV4.voiceIndex).toBe(4);

    const backV3 = cycleVoice(score, backV4, 'prev');
    expect(backV3.voiceIndex).toBe(3);

    const backV2 = cycleVoice(score, backV3, 'prev');
    expect(backV2.voiceIndex).toBe(2);

    const backV1 = cycleVoice(score, backV2, 'prev');
    expect(backV1.voiceIndex).toBe(1);
  });

  it('FAILING-FIRST: snaps cursor in the middle of a longer event to event start (never forward)', () => {
    const { score, staffId, measureId } = createTestScore();

    // Voice 1 cursor is at tick 1920 (third quarter note)
    const cursorV1: ScoreCursor = { staffId, measureId, voiceIndex: 1, tick: 1920 };

    // Voice 2 has a single whole note spanning [0, 3840).
    // Switching to voice 2 must snap to start of the sounding event: tick 0!
    const cursorV2 = cycleVoice(score, cursorV1, 'next');
    expect(cursorV2.voiceIndex).toBe(2);
    expect(cursorV2.tick).toBe(0);

    // Now test with a half note starting at 960
    const sm = score.parts[0].staves[0].measures[measureId];
    sm.voices[1].events = [
      createRest({ id: 'v2-q1', baseType: 'quarter', duration: 960 }),
      createNote({ id: 'v2-h1', baseType: 'half', pitches: [createPitch('G', 3)] }), // [960, 2880)
      createRest({ id: 'v2-q2', baseType: 'quarter', duration: 960 }),
    ];

    // Cursor at tick 1920 is in the middle of [960, 2880). Switching to voice 2 snaps to 960!
    const snapped = cycleVoice(score, cursorV1, 'next');
    expect(snapped.voiceIndex).toBe(2);
    expect(snapped.tick).toBe(960);
  });

  it('FAILING-FIRST: maintains virtual cursor at exact same tick when target voice is missing in measure', () => {
    const { score, staffId, measureId } = createTestScore();

    // Voice 3 does not exist in measure
    const cursorV2: ScoreCursor = { staffId, measureId, voiceIndex: 2, tick: 1920 };
    const cursorV3 = cycleVoice(score, cursorV2, 'next');

    expect(cursorV3.voiceIndex).toBe(3);
    expect(cursorV3.tick).toBe(1920); // Virtual cursor unchanged at tick 1920!

    // Voice 4 does not exist either
    const cursorV4 = cycleVoice(score, cursorV3, 'next');
    expect(cursorV4.voiceIndex).toBe(4);
    expect(cursorV4.tick).toBe(1920);
  });
});
