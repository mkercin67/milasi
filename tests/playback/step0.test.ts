import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { FakeEngine } from '../../src/playback/fakeEngine';
import { Player } from '../../src/playback/player';
import { buildSchedule } from '../../src/playback/schedule';

describe('Step 0 Closing Checks: Playback & Scheduler Precision', () => {
  it('0a: compares relative trigger times of all 8 notes with buildSchedule within 1 ms', async () => {
    // 2 measures in 4/4 at 120 bpm = 8 quarter notes
    const score = createEmptyScore({ measures: 2, timeSig: { num: 4, den: 4 } });
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;

    const pitches = [
      createPitch('C', 4),
      createPitch('D', 4),
      createPitch('E', 4),
      createPitch('F', 4),
      createPitch('G', 4),
      createPitch('A', 4),
      createPitch('B', 4),
      createPitch('C', 5),
    ];

    score.parts[0].staves[0].measures[m0Id].voices[0].events = pitches.slice(0, 4).map((p) =>
      createNote({ pitches: [p], baseType: 'quarter' })
    );
    score.parts[0].staves[0].measures[m1Id].voices[0].events = pitches.slice(4, 8).map((p) =>
      createNote({ pitches: [p], baseType: 'quarter' })
    );

    // Theoretical schedule
    const schedule = buildSchedule(score);
    expect(schedule.notes).toHaveLength(8);

    // Live playback with engine clock starting at an arbitrary offset (e.g. 5.5s)
    const engine = new FakeEngine({ manualClock: true });
    engine.setTime(5.5); // Simulate engine clock elapsed time before play was clicked
    const playStartTime = engine.now();

    const player = new Player(score, engine);
    await player.play();

    // Advance time through the entire score: 8 quarters at 120bpm = 4.0s total
    // Advance in steps of 0.25s calling tick to simulate regular interval refills
    for (let t = 0; t <= 4.2; t += 0.25) {
      engine.advanceTime(0.25);
      player.tick();
    }

    // Assert ALL 8 notes have been scheduled
    expect(engine.logs).toHaveLength(8);

    console.log('\n--- STEP 0a: 8 Notes Comparison with buildSchedule ---');
    console.log('Play start engine time:', playStartTime.toFixed(3), 's');
    console.table(
      engine.logs.map((log, idx) => {
        const expected = schedule.notes[idx].startSeconds;
        const relativeActual = log.atSeconds - playStartTime;
        const diffMs = Math.abs(relativeActual - expected) * 1000;
        return {
          Note: idx + 1,
          MIDI: log.note.midi,
          'Absolute atSeconds (s)': Number(log.atSeconds.toFixed(4)),
          'Relative Start (s)': Number(relativeActual.toFixed(4)),
          'buildSchedule (s)': Number(expected.toFixed(4)),
          'Diff (ms)': Number(diffMs.toFixed(3)),
          Match: diffMs <= 1.0 ? 'PASS (<= 1ms)' : 'FAIL',
        };
      })
    );

    // Verify tolerance <= 1 ms for all 8 notes
    for (let idx = 0; idx < 8; idx++) {
      const expected = schedule.notes[idx].startSeconds;
      const relativeActual = engine.logs[idx].atSeconds - playStartTime;
      expect(Math.abs(relativeActual - expected)).toBeLessThanOrEqual(0.001);
    }
  });

  it('0b: 20 consecutive pause/resume cycles in the middle of a 16-note score', async () => {
    // 4 measures of 4/4 at 120 bpm = 16 quarter notes
    const score = createEmptyScore({ measures: 4, timeSig: { num: 4, den: 4 } });
    const notePitches = [
      60, 62, 64, 65, // m0
      67, 69, 71, 72, // m1
      74, 76, 77, 79, // m2
      81, 83, 84, 86, // m3
    ];

    for (let m = 0; m < 4; m++) {
      const mId = score.measures[m].id;
      score.parts[0].staves[0].measures[mId].voices[0].events = notePitches
        .slice(m * 4, m * 4 + 4)
        .map((midi) => {
          // create a note
          const n = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
          // assign custom midi via pitch or store
          n.pitches[0].step = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][(midi % 12) % 7] as any;
          n.pitches[0].octave = Math.floor(midi / 12) - 1;
          return n;
        });
    }

    const engine = new FakeEngine({ manualClock: true });
    engine.setTime(10.0); // Arbitrary engine clock
    const player = new Player(score, engine);

    await player.play();

    // 1. Play first 2 seconds (measure 0 has played, entering measure 1)
    for (let t = 0; t < 2.0; t += 0.2) {
      engine.advanceTime(0.2);
      player.tick();
    }

    // 2. Perform 20 consecutive pause/resume cycles in the middle of the score
    for (let i = 0; i < 20; i++) {
      player.pause();
      engine.advanceTime(0.05); // time passes while paused
      player.resume();
      player.tick();
    }

    // 3. Play through to the end of the score (8.0s total score duration)
    for (let t = 0; t < 7.0; t += 0.25) {
      engine.advanceTime(0.25);
      player.tick();
    }

    // Output raw final trigger log
    console.log('\n--- STEP 0b: 16-Note Score 20x Pause/Resume Trigger Log ---');
    console.log(`Total notes logged: ${engine.logs.length} (Expected: 16)`);
    console.table(
      engine.logs.map((log, idx) => ({
        Index: idx + 1,
        MIDI: log.note.midi,
        atSeconds: Number(log.atSeconds.toFixed(4)),
        durationSeconds: Number(log.note.durationSeconds.toFixed(4)),
        velocity: log.note.velocity,
      }))
    );

    // Assertions
    expect(engine.logs).toHaveLength(16);

    // Verify no duplicates
    const uniqueAtSeconds = new Set(engine.logs.map((l) => l.atSeconds.toFixed(4)));
    expect(uniqueAtSeconds.size).toBe(16);

    // Verify chronological ordering
    for (let i = 1; i < engine.logs.length; i++) {
      expect(engine.logs[i].atSeconds).toBeGreaterThan(engine.logs[i - 1].atSeconds);
    }
  });
});
