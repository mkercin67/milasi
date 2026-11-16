import { Score } from '../core/model';
import { buildSchedule } from './schedule';
import { AudioEngine, ScheduleResult } from './types';

export type PlayerState = 'idle' | 'playing' | 'paused';

export interface PlaybackPosition {
  seconds: number;
  measureId: string;
  activeEventIds: string[];
}

export type PositionCallback = (pos: PlaybackPosition) => void;

const LOOKAHEAD_WINDOW_SECONDS = 1.0;
const SCHEDULER_INTERVAL_MS = 25;

/**
 * High-precision Score playback scheduler using lookahead scheduling window.
 */
export class Player {
  private _state: PlayerState = 'idle';
  private _schedule: ScheduleResult;
  private _playbackPosition: number = 0;
  private _nextNoteIndex: number = 0;
  private _lastEngineTime: number = 0;
  private _timerId: ReturnType<typeof setInterval> | null = null;
  private _positionListeners: Set<PositionCallback> = new Set();
  private _stopAtSeconds: number | null = null;

  constructor(
    private _score: Score,
    private _engine: AudioEngine
  ) {
    this._schedule = buildSchedule(this._score);
  }

  get state(): PlayerState {
    return this._state;
  }

  get position(): PlaybackPosition {
    return this._calculatePosition();
  }

  get schedule(): ScheduleResult {
    return this._schedule;
  }

  setScore(score: Score): void {
    this._score = score;
    this.stop();
    this._schedule = buildSchedule(this._score);
  }

  onPosition(cb: PositionCallback): () => void {
    this._positionListeners.add(cb);
    return () => {
      this._positionListeners.delete(cb);
    };
  }

  async play(fromEventId?: string, stopAtSeconds?: number): Promise<void> {
    if (this._state === 'playing') {
      return;
    }
    if (this._state === 'paused') {
      this.resume();
      return;
    }

    await this._engine.ready();
    this._schedule = buildSchedule(this._score, { fromEventId });
    this._stopAtSeconds = stopAtSeconds !== undefined ? stopAtSeconds : null;
    this._playbackPosition = 0;
    this._nextNoteIndex = 0;
    this._lastEngineTime = this._engine.now();
    this._state = 'playing';

    this._startTimer();
    this.tick();
  }

  async playRange(fromEventId: string, toEventId: string): Promise<void> {
    await this._engine.ready();
    const tempSched = buildSchedule(this._score, { fromEventId });
    const toTime = tempSched.eventTimes.get(toEventId);
    const stopAt = toTime ? toTime.endSeconds : undefined;
    await this.play(fromEventId, stopAt);
  }

  pause(): void {
    if (this._state !== 'playing') {
      return;
    }
    const now = this._engine.now();
    this._playbackPosition += Math.max(0, now - this._lastEngineTime);
    this._lastEngineTime = now;
    this._state = 'paused';
    this._stopTimer();
    this._engine.stopAll();
    this._notifyPosition();
  }

  resume(): void {
    if (this._state !== 'paused') {
      return;
    }
    this._lastEngineTime = this._engine.now();
    this._state = 'playing';
    this._startTimer();
    this.tick();
  }

  stop(): void {
    this._state = 'idle';
    this._stopTimer();
    this._engine.stopAll();
    this._playbackPosition = 0;
    this._nextNoteIndex = 0;
    this._notifyPosition();
  }

  tick(): void {
    if (this._state !== 'playing') {
      return;
    }

    const now = this._engine.now();
    const dt = Math.max(0, now - this._lastEngineTime);
    this._lastEngineTime = now;
    this._playbackPosition += dt;

    const windowEnd = this._playbackPosition + LOOKAHEAD_WINDOW_SECONDS;

    while (this._nextNoteIndex < this._schedule.notes.length) {
      const note = this._schedule.notes[this._nextNoteIndex];
      if (note.startSeconds <= windowEnd + 1e-6) {
        const atSeconds = Math.max(
          now,
          now + (note.startSeconds - this._playbackPosition)
        );
        this._engine.trigger(note, atSeconds);
        this._nextNoteIndex++;
      } else {
        break;
      }
    }

    this._notifyPosition();

    // Check if range playback has reached stop limit
    if (this._stopAtSeconds !== null && this._playbackPosition >= this._stopAtSeconds - 1e-4) {
      this.stop();
      return;
    }

    // Check if score playback has finished
    if (
      this._nextNoteIndex >= this._schedule.notes.length &&
      this._playbackPosition >= this._schedule.totalSeconds
    ) {
      this.stop();
    }
  }

  dispose(): void {
    this.stop();
    this._positionListeners.clear();
    this._engine.dispose();
  }

  private _startTimer(): void {
    if (this._timerId === null) {
      this._timerId = setInterval(() => {
        this.tick();
      }, SCHEDULER_INTERVAL_MS);
    }
  }

  private _stopTimer(): void {
    if (this._timerId !== null) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
  }

  private _calculatePosition(): PlaybackPosition {
    let measureId = this._score.measures[0]?.id ?? '';
    for (const ms of this._schedule.measureStarts) {
      if (ms.startSeconds <= this._playbackPosition + 1e-6) {
        measureId = ms.measureId;
      } else {
        break;
      }
    }

    const activeEventIds: string[] = [];
    for (const [eventId, time] of this._schedule.eventTimes.entries()) {
      if (
        this._playbackPosition >= time.startSeconds - 1e-6 &&
        this._playbackPosition < time.endSeconds - 1e-6
      ) {
        activeEventIds.push(eventId);
      }
    }

    return {
      seconds: this._playbackPosition,
      measureId,
      activeEventIds,
    };
  }

  private _notifyPosition(customPos?: PlaybackPosition): void {
    const pos = customPos ?? this._calculatePosition();
    for (const listener of this._positionListeners) {
      try {
        listener(pos);
      } catch {
        // Ignore listener errors
      }
    }
  }
}
