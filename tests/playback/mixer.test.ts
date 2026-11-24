// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-8: per-part playback (mute, solo, volume, timbre family).
import { describe, expect, it } from 'vitest';
import { applyTemplate } from '../../src/core/ensembleCommands';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import type { Score } from '../../src/core/model';
import { FakeEngine } from '../../src/playback/fakeEngine';
import {
  EMPTY_MIXER,
  TIMBRE_FAMILIES,
  isAudible,
  pruneMixer,
  setMuted,
  setPartVolume,
  setSolo,
  timbreFamily,
} from '../../src/playback/mixer';
import { Player } from '../../src/playback/player';
import { buildSchedule } from '../../src/playback/schedule';

/** Voice (C4 quarters) plus piano right hand (G4 quarters), one measure of 4/4. */
function twoPartScore(): Score {
  const score = structuredClone(applyTemplate('voicePiano').apply(createEmptyScore({ measures: 1 })));
  const m = score.measures[0].id;
  const fill = (partIdx: number, step: 'C' | 'G', octave: number) => {
    score.parts[partIdx].staves[0].measures[m].voices[0].events = [0, 1, 2, 3].map(() =>
      createNote({ pitches: [createPitch(step, octave)], baseType: 'quarter' })
    );
  };
  fill(0, 'C', 4);
  fill(1, 'G', 4);
  return score;
}

async function played(score: Score, mixer = EMPTY_MIXER) {
  const engine = new FakeEngine({ manualClock: true });
  const player = new Player(score, engine);
  player.setMixer(mixer);
  await player.play();
  engine.advanceTime(0.1);
  player.tick();
  return engine.logs.map((l) => l.note);
}

describe('M7c-8 per-part playback', () => {
  it('MX1: a muted part is not triggered and the schedule stays identical', async () => {
    const score = twoPartScore();
    const [voice, piano] = score.parts.map((p) => p.id);
    const before = buildSchedule(score);
    const notes = await played(score, setMuted(EMPTY_MIXER, voice, true));
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.midi === 67)).toBe(true);
    expect(isAudible(setMuted(EMPTY_MIXER, voice, true), piano)).toBe(true);
    expect(buildSchedule(score)).toBe(before);
    expect(before.notes.some((n) => n.partId === voice)).toBe(true);
  });

  it('MX2: solo overrides mute and two solos sound together', async () => {
    const score = twoPartScore();
    const [voice, piano] = score.parts.map((p) => p.id);
    const soloVoiceMutedToo = setMuted(setSolo(EMPTY_MIXER, voice, true), voice, true);
    expect(isAudible(soloVoiceMutedToo, voice)).toBe(true);
    expect(isAudible(soloVoiceMutedToo, piano)).toBe(false);
    const both = setSolo(setSolo(EMPTY_MIXER, voice, true), piano, true);
    const notes = await played(score, both);
    expect(new Set(notes.map((n) => n.midi))).toEqual(new Set([60, 67]));
  });

  it('MX3: part volume reaches the engine as gain and zero silences the part', async () => {
    const score = twoPartScore();
    const [voice, piano] = score.parts.map((p) => p.id);
    const notes = await played(score, setPartVolume(setPartVolume(EMPTY_MIXER, voice, 0.5), piano, 0));
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.midi === 60 && n.gain === 0.5)).toBe(true);
  });

  it('MX4: changing the mixer while playing affects only notes not yet triggered', async () => {
    const score = twoPartScore();
    const voice = score.parts[0].id;
    const engine = new FakeEngine({ manualClock: true });
    const player = new Player(score, engine);
    await player.play();
    const first = engine.logs.length;
    expect(first).toBeGreaterThan(0);
    player.setMixer(setMuted(EMPTY_MIXER, voice, true));
    engine.advanceTime(5);
    player.tick();
    const later = engine.logs.slice(first).map((l) => l.note.midi);
    expect(engine.logs.slice(0, first).some((l) => l.note.midi === 60)).toBe(true);
    expect(later.includes(60)).toBe(false);
  });

  it('MX5: every instrument string maps to exactly one timbre family and pruning drops unknown parts', () => {
    for (const name of ['voice', 'soprano', 'bass', 'violin', 'cello', 'flute', 'piano', 'default', '', 'Kaval']) {
      expect(TIMBRE_FAMILIES).toContain(timbreFamily(name));
    }
    expect(timbreFamily('Flute')).toBe('winds');
    expect(timbreFamily('piano')).toBe('keyboard');
    const m = setSolo(setMuted(setPartVolume(EMPTY_MIXER, 'a', 0.2), 'b', true), 'a', true);
    const pruned = pruneMixer(m, ['b']);
    expect(pruned.solo.size).toBe(0);
    expect(pruned.volume.size).toBe(0);
    expect(pruned.muted.has('b')).toBe(true);
  });

  it('MX6: the engine gets the channel and timbre of the part', async () => {
    const notes = await played(twoPartScore());
    const channels = new Set(notes.map((n) => n.midiChannel));
    expect(channels.size).toBe(2);
    expect(new Set(notes.map((n) => n.timbre))).toEqual(new Set(['voice', 'keyboard']));
  });
});
