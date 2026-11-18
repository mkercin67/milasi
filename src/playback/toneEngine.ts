// SPDX-License-Identifier: GPL-3.0-or-later
import * as Tone from 'tone';
import { AudioEngine } from './types';

/**
 * Real WebAudio implementation of AudioEngine powered by Tone.js.
 * This is the ONLY file in the entire codebase that imports Tone.
 */
export class ToneEngine implements AudioEngine {
  private _synth: Tone.PolySynth | null = null;
  private _limiter: Tone.Limiter | null = null;
  private _volumeNode: Tone.Volume | null = null;
  private _volume: number = 0.8;
  private _initialized: boolean = false;

  async ready(): Promise<void> {
    if (!this._initialized) {
      await Tone.start();

      this._limiter = new Tone.Limiter(-1).toDestination();
      this._volumeNode = new Tone.Volume(this._gainToDb(this._volume));
      this._volumeNode.connect(this._limiter);

      this._synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.005,
          decay: 0.3,
          sustain: 0.2,
          release: 0.4,
        },
      });
      this._synth.maxPolyphony = 32;
      this._synth.connect(this._volumeNode);

      this._initialized = true;
    } else {
      if (Tone.getContext().state !== 'running') {
        await Tone.start();
      }
    }
  }

  trigger(
    note: { midi: number; detuneCents: number; velocity: number; durationSeconds: number },
    atSeconds: number
  ): void {
    if (!this._synth) return;

    // Convert MIDI pitch + cents into exact frequency
    const semitones = note.midi - 69 + (note.detuneCents ?? 0) / 100;
    const freq = 440 * Math.pow(2, semitones / 12);
    const duration = Math.max(0.02, note.durationSeconds);
    const velocity = Math.max(0.01, Math.min(1.0, note.velocity));

    try {
      this._synth.triggerAttackRelease(freq, duration, atSeconds, velocity);
    } catch {
      // Ignore scheduling errors if context state was interrupted
    }
  }

  stopAll(): void {
    if (this._synth) {
      try {
        this._synth.releaseAll();
      } catch {
        // Ignore errors
      }
    }
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._volumeNode) {
      this._volumeNode.volume.value = this._gainToDb(this._volume);
    }
  }

  now(): number {
    return Tone.now();
  }

  dispose(): void {
    if (this._synth) {
      try {
        this._synth.releaseAll();
        this._synth.dispose();
      } catch {
        // Ignore
      }
      this._synth = null;
    }
    if (this._volumeNode) {
      try {
        this._volumeNode.dispose();
      } catch {
        // Ignore
      }
      this._volumeNode = null;
    }
    if (this._limiter) {
      try {
        this._limiter.dispose();
      } catch {
        // Ignore
      }
      this._limiter = null;
    }
    this._initialized = false;
  }

  private _gainToDb(gain: number): number {
    if (gain <= 0.0001) return -100;
    return 20 * Math.log10(gain);
  }
}
