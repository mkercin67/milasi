// SPDX-License-Identifier: GPL-3.0-or-later
import { Pitch } from '../core/model';
import { pitchToMidi } from './pitch';
import { AudioEngine } from './types';

/**
 * Manages low-latency audition / pitch preview when entering notes or changing pitch.
 */
export class PreviewPlayer {
  private _lastTriggerTime: number = 0;
  private _throttleMs: number = 60;
  private _enabled: boolean = true;

  constructor(private _engine: AudioEngine) {
    try {
      const stored = localStorage.getItem('scoreforge.previewSound');
      if (stored !== null) {
        this._enabled = stored === 'true';
      }
    } catch {
      // Storage unavailable in tests or sandbox
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(val: boolean) {
    this._enabled = val;
    try {
      localStorage.setItem('scoreforge.previewSound', String(val));
    } catch {
      // Ignore
    }
  }

  /**
   * Triggers a short (0.4s) preview of the given pitches, throttled to 1 call per 60 ms.
   * Completely asynchronous to never block keyboard handlers.
   */
  previewPitches(pitches: Pitch[]): void {
    if (!this._enabled || pitches.length === 0) return;

    const now = performance.now();
    if (now - this._lastTriggerTime < this._throttleMs) {
      return;
    }
    this._lastTriggerTime = now;

    this._engine
      .ready()
      .then(() => {
        const engineNow = this._engine.now();
        for (const pitch of pitches) {
          const { midi, detuneCents } = pitchToMidi(pitch);
          this._engine.trigger(
            {
              midi,
              detuneCents,
              velocity: 0.7,
              durationSeconds: 0.4,
            },
            engineNow
          );
        }
      })
      .catch(() => {});
  }
}
