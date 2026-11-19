// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { enterNote, ScoreCursor } from '../../src/core/input';
import { createMeasure, createPart, createRest, createScore, newId } from '../../src/core/factory';
import { Score } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';

describe('T2 & T3: Voice Creation on Entry (Decisions D3, D4)', () => {
  function createEmpty44Score(): { score: Score; staffId: string; measureId: string } {
    const score = createScore();
    const m = createMeasure({ num: 4, den: 4 });
    const part = createPart({ name: 'Piano', instrument: 'piano' });
    score.measures.push(m);
    score.parts.push(part);

    const staffId = part.staves[0].id;
    // Voice 1 has 1 whole rest
    part.staves[0].measures[m.id] = {
      voices: [
        {
          id: newId(),
          voiceIndex: 1,
          events: [createRest({ baseType: 'whole', duration: 3840, wholeMeasure: true })],
        },
      ],
    };

    return { score, staffId, measureId: m.id };
  }

  it('T2: entry in missing voice 2 at tick 1920 of an empty 4/4 measure gives rests for [0, 1920) + the note + rests to the barline, total 3840; validateScore zero errors; voices sorted', () => {
    const { score, staffId, measureId } = createEmpty44Score();

    // Virtual cursor in voice 2 at tick 1920 (half-measure offset)
    const cursor: ScoreCursor = { staffId, measureId, voiceIndex: 2, tick: 1920 };

    // Enter a quarter note (duration 960) at tick 1920 in voice 2
    const cmd = enterNote(cursor, {
      baseType: 'quarter',
      pitch: { step: 'E', octave: 4, alter: 0 },
    });

    const newScore = cmd.apply(score);
    const sm = newScore.parts[0].staves[0].measures[measureId];

    // Voices must be sorted
    expect(sm.voices).toHaveLength(2);
    expect(sm.voices[0].voiceIndex).toBe(1);
    expect(sm.voices[1].voiceIndex).toBe(2);

    const v2 = sm.voices[1];
    // Leading rests [0, 1920) must be present
    expect(v2.events[0].kind).toBe('rest');
    let t = 0;
    let noteIdx = -1;
    for (let i = 0; i < v2.events.length; i++) {
      if (v2.events[i].kind === 'note') {
        noteIdx = i;
        expect(t).toBe(1920); // Note starts exactly at tick 1920
        break;
      }
      t += v2.events[i].duration;
    }
    expect(noteIdx).toBeGreaterThan(0); // Leading rest exists!

    // Total duration of voice 2 must equal 3840
    const totalDuration = v2.events.reduce((sum, ev) => sum + ev.duration, 0);
    expect(totalDuration).toBe(3840);

    // validateScore must have ZERO errors
    const problems = validateScore(newScore);
    const errors = problems.filter((p) => p.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('T3: gap case: voice 3 created while voice 2 is missing, sorted voices with gap allowed', () => {
    const { score, staffId, measureId } = createEmpty44Score();

    // Virtual cursor in voice 3 at tick 960 (voice 2 does not exist!)
    const cursor: ScoreCursor = { staffId, measureId, voiceIndex: 3, tick: 960 };

    const cmd = enterNote(cursor, {
      baseType: 'quarter',
      pitch: { step: 'G', octave: 4, alter: 0 },
    });

    const newScore = cmd.apply(score);
    const sm = newScore.parts[0].staves[0].measures[measureId];

    // Measures have voice 1 and voice 3 (gap without voice 2 is valid per D3)
    expect(sm.voices).toHaveLength(2);
    expect(sm.voices[0].voiceIndex).toBe(1);
    expect(sm.voices[1].voiceIndex).toBe(3);

    const v3 = sm.voices[1];
    const totalDuration = v3.events.reduce((sum, ev) => sum + ev.duration, 0);
    expect(totalDuration).toBe(3840);

    // Verify leading rest for [0, 960)
    expect(v3.events[0].kind).toBe('rest');
    expect(v3.events[0].duration).toBe(960);
    expect(v3.events[1].kind).toBe('note');

    // validateScore has zero errors
    const problems = validateScore(newScore);
    const errors = problems.filter((p) => p.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});
