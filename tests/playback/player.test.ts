import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { FakeEngine } from '../../src/playback/fakeEngine';
import { PlaybackPosition, Player } from '../../src/playback/player';

describe('Milestone 4 Section B & E: Player and Lookahead Scheduler', () => {
  it('manages state transitions cleanly: idle -> playing -> paused -> playing -> idle', async () => {
    const score = createEmptyScore({ measures: 2, timeSig: { num: 4, den: 4 } });
    const engine = new FakeEngine({ manualClock: true });
    const player = new Player(score, engine);

    expect(player.state).toBe('idle');

    await player.play();
    expect(player.state).toBe('playing');

    player.pause();
    expect(player.state).toBe('paused');
    expect(engine.stoppedCount).toBeGreaterThanOrEqual(1);

    player.resume();
    expect(player.state).toBe('playing');

    player.stop();
    expect(player.state).toBe('idle');
  });

  it('schedules notes within the lookahead window (~1.0s) and does not schedule notes beyond', async () => {
    let score = createEmptyScore({ measures: 2, timeSig: { num: 4, den: 4 } });
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;

    // Measure 0 (0..2.0s): 4 quarters at 0, 0.5, 1.0, 1.5
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [
      createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' }),
    ];

    // Measure 1 (2.0..4.0s): 4 quarters at 2.0, 2.5, 3.0, 3.5
    score.parts[0].staves[0].measures[m1Id].voices[0].events = [
      createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('A', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('B', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' }),
    ];

    const engine = new FakeEngine({ manualClock: true });
    const player = new Player(score, engine);

    await player.play();

    // At t = 0, lookahead window [0, 1.0s] should only schedule notes within 1.0s (C4 at 0, D4 at 0.5, E4 at 1.0)
    expect(engine.logs.length).toBeLessThanOrEqual(3);
    expect(engine.logs.map((l) => l.note.midi)).toContain(60); // C4
    expect(engine.logs.map((l) => l.note.midi)).not.toContain(67); // G4 is at 2.0s, must NOT be scheduled yet!

    // Advance engine clock to 1.5s and trigger scheduler tick
    engine.advanceTime(1.5);
    player.tick();

    // Now G4 (2.0s) and A4 (2.5s) fall into the [1.5, 2.5s] lookahead window
    expect(engine.logs.map((l) => l.note.midi)).toContain(67); // G4 scheduled
  });

  it('pauses and resumes without duplicating or skipping notes', async () => {
    let score = createEmptyScore({ measures: 1, timeSig: { num: 4, den: 4 } });
    const m0Id = score.measures[0].id;
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [
      createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' }),
    ];

    const engine = new FakeEngine({ manualClock: true });
    const player = new Player(score, engine);

    await player.play();
    engine.advanceTime(0.6); // played C4 (0.0) and D4 (0.5)
    player.tick();

    player.pause();
    expect(engine.stoppedCount).toBeGreaterThanOrEqual(1);

    const logCountBeforeResume = engine.logs.length;
    player.resume();
    engine.advanceTime(0.5); // time is now 1.1s
    player.tick();

    // Notes scheduled after resume should not duplicate C4 or D4
    const postResumeNotes = engine.logs.slice(logCountBeforeResume);
    for (const n of postResumeNotes) {
      expect(n.note.midi).toBeGreaterThanOrEqual(64); // E4 or F4
    }
  });

  it('pause/resume 20 times in a row preserves exact note count without duplicates', async () => {
    let score = createEmptyScore({ measures: 1 });
    const m0Id = score.measures[0].id;
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [
      createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' }),
    ];

    const engine = new FakeEngine({ manualClock: true });
    const player = new Player(score, engine);

    await player.play();
    for (let i = 0; i < 20; i++) {
      engine.advanceTime(0.05);
      player.tick();
      player.pause();
      player.resume();
    }
    // Finish playback
    engine.advanceTime(2.0);
    player.tick();

    // Check that each of the 4 notes was triggered exactly once
    const triggeredMidis = engine.logs.map((l) => l.note.midi);
    expect(triggeredMidis.filter((m) => m === 60)).toHaveLength(1);
    expect(triggeredMidis.filter((m) => m === 62)).toHaveLength(1);
    expect(triggeredMidis.filter((m) => m === 64)).toHaveLength(1);
    expect(triggeredMidis.filter((m) => m === 65)).toHaveLength(1);
  });

  it('any score edit (setScore) immediately stops playback', async () => {
    const score1 = createEmptyScore({ measures: 2 });
    const engine = new FakeEngine({ manualClock: true });
    const player = new Player(score1, engine);

    await player.play();
    expect(player.state).toBe('playing');

    const score2 = createEmptyScore({ measures: 4 });
    player.setScore(score2);

    expect(player.state).toBe('idle');
    expect(engine.stoppedCount).toBeGreaterThanOrEqual(1);
  });

  it('fromEventId starts playback from that event', async () => {
    let score = createEmptyScore({ measures: 1 });
    const mId = score.measures[0].id;
    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    score.parts[0].staves[0].measures[mId].voices[0].events = [n1, n2, n3];

    const engine = new FakeEngine({ manualClock: true });
    const player = new Player(score, engine);

    await player.play(n2.id);
    expect(engine.logs[0].note.midi).toBe(62); // D4, skipping C4
  });

  it('double play does not duplicate scheduled notes', async () => {
    let score = createEmptyScore({ measures: 1 });
    const mId = score.measures[0].id;
    score.parts[0].staves[0].measures[mId].voices[0].events = [
      createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
    ];

    const engine = new FakeEngine({ manualClock: true });
    const player = new Player(score, engine);

    await player.play();
    await player.play(); // Second call while playing

    expect(engine.logs.filter((l) => l.note.midi === 60)).toHaveLength(1);
  });

  it('no note is scheduled after stop is called', async () => {
    let score = createEmptyScore({ measures: 2 });
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [
      createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
    ];
    score.parts[0].staves[0].measures[m1Id].voices[0].events = [
      createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' }),
    ];

    const engine = new FakeEngine({ manualClock: true });
    const player = new Player(score, engine);

    await player.play();
    const countBeforeStop = engine.logs.length;

    player.stop();
    engine.advanceTime(5.0);
    player.tick();

    expect(player.state).toBe('idle');
    expect(engine.logs.length).toBe(countBeforeStop);
  });

  it('position callbacks are reported and monotonic', async () => {
    let score = createEmptyScore({ measures: 1 });
    const m0Id = score.measures[0].id;
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [
      createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }),
    ];

    const engine = new FakeEngine({ manualClock: true });
    const player = new Player(score, engine);

    const positions: number[] = [];
    player.onPosition((pos: PlaybackPosition) => {
      positions.push(pos.seconds);
    });

    await player.play();
    engine.advanceTime(0.2);
    player.tick();
    engine.advanceTime(0.3);
    player.tick();
    engine.advanceTime(0.5);
    player.tick();

    expect(positions.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
    }
  });

  it('end of score automatically transitions state to idle', async () => {
    let score = createEmptyScore({ measures: 1, timeSig: { num: 4, den: 4 } });
    const m0Id = score.measures[0].id;
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [
      createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' }),
    ];

    const engine = new FakeEngine({ manualClock: true });
    const player = new Player(score, engine);

    await player.play();
    expect(player.state).toBe('playing');

    // Total score duration for 1 measure of 4/4 at 120bpm is 2.0s
    engine.advanceTime(2.1);
    player.tick();

    expect(player.state).toBe('idle');
  });
});
