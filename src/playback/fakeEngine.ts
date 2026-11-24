// SPDX-License-Identifier: GPL-3.0-or-later
import { AudioEngine, TriggerNote } from './types';

export interface TriggeredNoteLog {
  note: TriggerNote;
  atSeconds: number;
}

export class FakeEngine implements AudioEngine {
  public logs: TriggeredNoteLog[] = [];
  public currentTime: number = 0;
  public volume: number = 1.0;
  public isReady: boolean = false;
  public stoppedCount: number = 0;
  public isDisposed: boolean = false;
  private manualClock: boolean = false;
  private startWallTime: number = Date.now();

  constructor(options: { manualClock?: boolean } = {}) {
    this.manualClock = options.manualClock ?? false;
  }

  async ready(): Promise<void> {
    this.isReady = true;
  }

  trigger(note: TriggerNote, atSeconds: number): void {
    this.logs.push({ note: { ...note }, atSeconds });
  }

  stopAll(): void {
    this.stoppedCount++;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  now(): number {
    if (this.manualClock) {
      return this.currentTime;
    }
    return (Date.now() - this.startWallTime) / 1000;
  }

  advanceTime(seconds: number): void {
    this.currentTime += seconds;
  }

  setTime(seconds: number): void {
    this.currentTime = seconds;
  }

  clearLogs(): void {
    this.logs = [];
  }

  dispose(): void {
    this.isDisposed = true;
  }
}
