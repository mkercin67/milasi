// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Type definitions for ScoreForge playback engine and schedule representation.
 */


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

export interface AudioEngine {
  ready(): Promise<void>;
  trigger(
    note: { midi: number; detuneCents: number; velocity: number; durationSeconds: number },
    atSeconds: number
  ): void;
  stopAll(): void;
  setVolume(v: number): void;
  now(): number;
  dispose(): void;
}
