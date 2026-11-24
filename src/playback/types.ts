// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Type definitions for ScoreForge playback engine and schedule representation.
 */

import type { TimbreFamily } from './mixer';

export interface MidiPitch {
  midi: number;
  detuneCents: number;
}

export interface ScheduledNote {
  eventId: string | string[];
  partId: string;
  midi: number;
  detuneCents: number;
  startSeconds: number;
  durationSeconds: number;
  velocity: number;
  midiChannel: number;
}

export interface MeasureStartTime {
  measureId: string;
  startSeconds: number;
}

export interface ScheduleResult {
  notes: ScheduledNote[];
  totalSeconds: number;
  measureStarts: MeasureStartTime[];
  eventTimes: Map<string, { startSeconds: number; endSeconds: number }>;
  eventRanges?: Map<string, Array<{ startSeconds: number; endSeconds: number }>>;
}

export interface BuildScheduleOptions {
  fromEventId?: string;
}

/** What an engine receives per note; the extra fields are optional so simple engines may ignore them. */
export interface TriggerNote {
  midi: number;
  detuneCents: number;
  velocity: number;
  durationSeconds: number;
  midiChannel?: number;
  /** Part gain 0..1 from the mixer. */
  gain?: number;
  timbre?: TimbreFamily;
}

export interface AudioEngine {
  ready(): Promise<void>;
  trigger(note: TriggerNote, atSeconds: number): void;
  stopAll(): void;
  setVolume(v: number): void;
  now(): number;
  dispose(): void;
}
