import { describe, expect, it } from 'vitest';
import {
  deserializeClipboard,
  pasteEvents,
  serializeClipboard,
  splitDuration,
} from '../../src/core/clipboard';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { ScoreEvent } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';

describe('Milestone 6a: Clipboard & Paste (src/core/clipboard.ts)', () => {
  it('serializes and deserializes clipboard payload with envelope', () => {
    const notes: ScoreEvent[] = [
      createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }),
    ];
    const json = serializeClipboard(notes);
    expect(json).toContain('"app":"scoreforge-clip"');
    expect(json).toContain('"version":1');

    const deserialized = deserializeClipboard(json);
    expect(deserialized).toHaveLength(2);
    expect(deserialized![0].kind).toBe('note');
  });

  it('splitDuration splits durations across barlines into standard non-dotted units', () => {
    // In 4/4 meter: measureTicks = 3840.
    // Starting at beat 3 (offset = 2880 ticks, 960 remaining in measure).
    // Note of 1920 ticks (half note) crosses the barline:
    // Fits 960 ticks (quarter) in measure 1, and 960 ticks (quarter) in measure 2 with tie!
    const splits = splitDuration(1920, 2880, 3840);
    expect(splits).toEqual([
      { ticks: 960, tieToNext: true },
      { ticks: 960, tieToNext: false },
    ]);

    // Note of 2880 ticks starting at offset 2880:
    // Remaining in measure 1 = 960 (quarter)
    // In measure 2 = 1920 (half)
    const splits2 = splitDuration(2880, 2880, 3840);
    expect(splits2).toEqual([
      { ticks: 960, tieToNext: true },
      { ticks: 1920, tieToNext: false },
    ]);
  });

  it('pasteEvents splits notes across barlines with ties and keeps measure durations intact', () => {
    // 3/4 score (measureTicks = 2880)
    const score = createEmptyScore({
      timeSig: { num: 3, den: 4 },
      measures: 2,
    });
    const staff = score.parts[0].staves[0];
    const m0Id = score.measures[0].id;
    const v0Id = staff.measures[m0Id].voices[0].id;

    // Paste 3 quarter notes starting at beat 3 (offset 1920 ticks in 3/4)
    // Measure 1 has 960 ticks left -> gets 1 quarter note tied to measure 2
    // Measure 2 gets 2 quarter notes (or half note) -> 1920 ticks + remaining 960 rest = 2880 ticks
    const toPaste: ScoreEvent[] = [
      createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }),
    ];

    const result = pasteEvents(
      score,
      {
        staffId: staff.id,
        voiceId: v0Id,
        startMeasureId: m0Id,
        startOffsetTicks: 1920,
      },
      toPaste
    );

    const problems = validateScore(result);
    expect(problems).toHaveLength(0);

    // Measure 1 must have first 2 beats rest (1920) + 1 quarter note (960) = 2880
    const m0Events = result.parts[0].staves[0].measures[m0Id].voices[0].events;
    const m0Ticks = m0Events.reduce((acc, ev) => acc + ev.duration, 0);
    expect(m0Ticks).toBe(2880);

    // Measure 2 must have 2880 total ticks
    const m1Id = result.measures[1].id;
    const m1Events = result.parts[0].staves[0].measures[m1Id].voices[0].events;
    const m1Ticks = m1Events.reduce((acc, ev) => acc + ev.duration, 0);
    expect(m1Ticks).toBe(2880);
  });

  it('pasteEvents appends measures when paste exceeds score length', () => {
    const score = createEmptyScore({ measures: 1 });
    const staff = score.parts[0].staves[0];
    const m0Id = score.measures[0].id;
    const v0Id = staff.measures[m0Id].voices[0].id;

    // Paste 8 quarter notes (needs 2 measures in 4/4)
    const toPaste: ScoreEvent[] = Array.from({ length: 8 }, () =>
      createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' })
    );

    const result = pasteEvents(
      score,
      {
        staffId: staff.id,
        voiceId: v0Id,
        startMeasureId: m0Id,
        startOffsetTicks: 0,
      },
      toPaste
    );

    expect(result.measures.length).toBeGreaterThanOrEqual(2);
    expect(validateScore(result)).toHaveLength(0);
  });

  it('property test: 100 random paste operations always maintain valid score and exact measure durations', () => {
    const baseTypes = ['whole', 'half', 'quarter', 'eighth', '16th'] as const;
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

    for (let run = 0; run < 100; run++) {
      // Create random 2 to 4 measure score
      const numMeasures = 2 + (run % 3);
      const score = createEmptyScore({ measures: numMeasures });
      const staff = score.parts[0].staves[0];
      const m0Id = score.measures[0].id;
      const v0Id = staff.measures[m0Id].voices[0].id;

      // Generate 1 to 5 random events
      const eventCount = 1 + (run % 5);
      const randomEvents: ScoreEvent[] = [];
      for (let i = 0; i < eventCount; i++) {
        const bType = baseTypes[(run + i) % baseTypes.length];
        if (i % 2 === 0) {
          // Chord or note
          const pitchCount = 1 + (i % 3);
          const pitches = Array.from({ length: pitchCount }, (_, pi) =>
            createPitch(steps[(run + pi) % steps.length], 4)
          );
          randomEvents.push(createNote({ pitches, baseType: bType }));
        } else {
          randomEvents.push(createRest({ baseType: bType }));
        }
      }

      // Random start offset (0, 480, 960, 1920)
      const offsets = [0, 240, 480, 960, 1440, 1920];
      const startOffsetTicks = offsets[run % offsets.length];

      const pasted = pasteEvents(
        score,
        {
          staffId: staff.id,
          voiceId: v0Id,
          startMeasureId: m0Id,
          startOffsetTicks,
        },
        randomEvents
      );

      const problems = validateScore(pasted);
      expect(problems).toHaveLength(0);

      // Verify every measure's duration matches timeSig
      for (let mIdx = 0; mIdx < pasted.measures.length; mIdx++) {
        const mDef = pasted.measures[mIdx];
        const sm = pasted.parts[0].staves[0].measures[mDef.id];
        if (sm) {
          for (const v of sm.voices) {
            const sumTicks = v.events.reduce((acc, ev) => acc + ev.duration, 0);
            expect(sumTicks).toBe(3840);
          }
        }
      }
    }
  });
});
