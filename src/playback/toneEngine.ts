// SPDX-License-Identifier: GPL-3.0-or-later
import * as Tone from 'tone';
import { AudioEngine, TriggerNote } from './types';
import { TIMBRE_FAMILIES, TimbreFamily } from './mixer';

interface TimbreSpec {
  oscillator: 'triangle' | 'sine' | 'sawtooth' | 'square';
  envelope: { attack: number; decay: number; sustain: number; release: number };
  /** Static level offset in dB so the families sit at a similar loudness. */
  levelDb: number;
}

/** Built-in synth palette (no samples). Families map from Part.instrument in mixer.ts. */
const TIMBRES: Record<TimbreFamily, TimbreSpec> = {
  other: { oscillator: 'triangle', envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.4 }, levelDb: 0 },
  keyboard: { oscillator: 'triangle', envelope: { attack: 0.005, decay: 0.4, sustain: 0.15, release: 0.5 }, levelDb: 0 },
  voice: { oscillator: 'sine', envelope: { attack: 0.04, decay: 0.1, sustain: 0.7, release: 0.3 }, levelDb: 0 },
  strings: { oscillator: 'sawtooth', envelope: { attack: 0.06, decay: 0.1, sustain: 0.6, release: 0.35 }, levelDb: -12 },
  winds: { oscillator: 'square', envelope: { attack: 0.03, decay: 0.1, sustain: 0.6, release: 0.2 }, levelDb: -14 },
};

/**
 * Real WebAudio implementation of AudioEngine powered by Tone.js.
 * This is the ONLY file in the entire codebase that imports Tone.
 */
export class ToneEngine implements AudioEngine {
  private _synths: Map<TimbreFamily, Tone.PolySynth> = new Map();
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

      for (const family of TIMBRE_FAMILIES) {
        const spec = TIMBRES[family];
        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: spec.oscillator },
          envelope: spec.envelope,
        });
        synth.maxPolyphony = 32;
        synth.volume.value = spec.levelDb;
        synth.connect(this._volumeNode);
        this._synths.set(family, synth);
      }

      this._initialized = true;
    } else {
      if (Tone.getContext().state !== 'running') {
        await Tone.start();
      }
    }
  }

  trigger(note: TriggerNote, atSeconds: number): void {
    const synth = this._synths.get(note.timbre ?? 'other');
    if (!synth) return;

    // Convert MIDI pitch + cents into exact frequency
    const semitones = note.midi - 69 + (note.detuneCents ?? 0) / 100;
    const freq = 440 * Math.pow(2, semitones / 12);
    const duration = Math.max(0.02, note.durationSeconds);
    const velocity = Math.max(0.01, Math.min(1.0, note.velocity * (note.gain ?? 1)));

    try {
      synth.triggerAttackRelease(freq, duration, atSeconds, velocity);
    } catch {
      // Ignore scheduling errors if context state was interrupted
    }
  }

  stopAll(): void {
    for (const synth of this._synths.values()) {
      try {
        synth.releaseAll();
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
    for (const synth of this._synths.values()) {
      try {
        synth.releaseAll();
        synth.dispose();
      } catch {
        // Ignore
      }
    }
    this._synths.clear();
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
