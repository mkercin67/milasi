// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7c-8: pure mixer state for per-part playback (mute, solo, volume) and the timbre
 * family of an instrument. A playback setting only: never saved in the score.
 */

export type TimbreFamily = 'voice' | 'strings' | 'winds' | 'keyboard' | 'other';

export const TIMBRE_FAMILIES: readonly TimbreFamily[] = ['voice', 'strings', 'winds', 'keyboard', 'other'];

export interface MixerState {
  readonly muted: ReadonlySet<string>;
  readonly solo: ReadonlySet<string>;
  /** Linear gain 0..1 per part id; a missing entry means 1. */
  readonly volume: ReadonlyMap<string, number>;
}

export const EMPTY_MIXER: MixerState = { muted: new Set(), solo: new Set(), volume: new Map() };

const VOICE = new Set(['voice', 'soprano', 'alto', 'tenor', 'bass', 'baritone', 'mezzo', 'choir', 'vocals']);
const STRINGS = new Set(['violin', 'viola', 'cello', 'contrabass', 'double bass', 'harp', 'guitar']);
const WINDS = new Set([
  'flute', 'piccolo', 'oboe', 'clarinet', 'bassoon', 'recorder', 'saxophone', 'horn', 'trumpet', 'trombone', 'tuba',
]);
const KEYBOARD = new Set(['piano', 'organ', 'harpsichord', 'keyboard', 'celesta']);

/** Total mapping: every instrument string belongs to exactly one family. */
export function timbreFamily(instrument: string): TimbreFamily {
  const key = instrument.trim().toLowerCase();
  if (VOICE.has(key)) return 'voice';
  if (STRINGS.has(key)) return 'strings';
  if (WINDS.has(key)) return 'winds';
  if (KEYBOARD.has(key)) return 'keyboard';
  return 'other';
}

/** If any part is soloed only soloed parts sound; otherwise every part that is not muted sounds. */
export function isAudible(state: MixerState, partId: string): boolean {
  if (state.solo.size > 0) return state.solo.has(partId);
  return !state.muted.has(partId);
}

export function gainFor(state: MixerState, partId: string): number {
  const v = state.volume.get(partId);
  return v === undefined ? 1 : Math.max(0, Math.min(1, v));
}

function toggled(set: ReadonlySet<string>, id: string, on: boolean): Set<string> {
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

export function setMuted(state: MixerState, partId: string, on: boolean): MixerState {
  return { ...state, muted: toggled(state.muted, partId, on) };
}

export function setSolo(state: MixerState, partId: string, on: boolean): MixerState {
  return { ...state, solo: toggled(state.solo, partId, on) };
}

export function setPartVolume(state: MixerState, partId: string, gain: number): MixerState {
  const next = new Map(state.volume);
  next.set(partId, Math.max(0, Math.min(1, gain)));
  return { ...state, volume: next };
}

/** Drops entries of parts that no longer exist (after a part was removed). */
export function pruneMixer(state: MixerState, partIds: readonly string[]): MixerState {
  const keep = new Set(partIds);
  const f = (s: ReadonlySet<string>) => new Set([...s].filter((id) => keep.has(id)));
  return {
    muted: f(state.muted),
    solo: f(state.solo),
    volume: new Map([...state.volume].filter(([id]) => keep.has(id))),
  };
}
