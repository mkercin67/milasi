// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { getCompleteKeyTable } from '../../src/ui/keymap';

declare const require: (module: string) => any;

describe('ARCHITECTURE.md & Code Synchronization Verification', () => {
  const fs = require('fs');
  const path = require('path');
  const archPath = path.resolve('ARCHITECTURE.md');
  const archContent = fs.readFileSync(archPath, 'utf-8');
  const keyTable = getCompleteKeyTable();

  it('verifies duration keys are mapped to Digit2 through Digit7 in keymap', () => {
    const durationDefs = keyTable.filter(
      (d: any) => typeof d.action === 'string' && d.action.startsWith('set-duration:')
    );
    expect(durationDefs.length).toBeGreaterThanOrEqual(6);
    const codes = durationDefs.map((d: any) => d.code);
    expect(codes).toContain('Digit2'); // 32nd
    expect(codes).toContain('Digit3'); // 16th
    expect(codes).toContain('Digit4'); // 8th
    expect(codes).toContain('Digit5'); // quarter
    expect(codes).toContain('Digit6'); // half
    expect(codes).toContain('Digit7'); // whole
    // Should NOT have Digit1 as duration (Shift+Digit1 is dynamic ppp)
    expect(codes).not.toContain('Digit1');
  });

  it('verifies all 4 interaction modes are mapped to distinct master keys', () => {
    // Mode toggles
    const selectMode = keyTable.find((d: any) => d.action === 'set-mode-select' && d.modifiers === 'none');
    const inputMode = keyTable.find((d: any) => d.action === 'toggle-note-input' && d.modifiers === 'none');
    const positionMode = keyTable.find((d: any) => d.action === 'toggle-position-mode' && d.modifiers === 'none');
    const lyricsMode = keyTable.find((d: any) => d.action === 'toggle-lyrics-mode' && d.modifiers === 'none');

    expect(selectMode?.code).toBe('KeyV');
    expect(inputMode?.code).toBe('KeyN');
    expect(positionMode?.code).toBe('KeyP');
    expect(lyricsMode?.code).toBe('KeyU');
  });

  it('verifies ARCHITECTURE.md documents real Double rAF and Event Timing performance numbers', () => {
    expect(archContent).toContain('Double requestAnimationFrame');
    expect(archContent).toContain('PerformanceEventTiming API');
    expect(archContent).toContain('64-measure full-featured score: Double rAF (median = 12.10 ms, p95 = 17.60 ms)');
    expect(archContent).toContain('200-measure full-featured score: Double rAF (median = 26.30 ms, p95 = 32.20 ms)');
    // Flawed single-rAF numbers must be absent
    expect(archContent).not.toContain('p50 = 3.9 ms, p95 = 5.2 ms');
    expect(archContent).not.toContain('p50 = 4.1 ms, p95 = 5.4 ms');
  });

  it('verifies ARCHITECTURE.md documents all 4 interaction modes and correct limits', () => {
    expect(archContent).toContain('Four Explicit Modes');
    expect(archContent).toContain("4. **Lyrics Mode (`mode: 'lyrics'`):**");
    expect(archContent).toContain('Digit2`–`Digit7` set duration');
    expect(archContent).not.toContain('Digit1`–`5` set duration');
    expect(archContent).toContain('-1.0 to +5.0 staff spaces');
    expect(archContent).not.toContain('-4.0 to +4.0 staff spaces');
    expect(archContent).toContain('Debounced at 1000 ms');
  });

  it('verifies ARCHITECTURE.md documents voiceIndex array-storage and multi-voice risk', () => {
    expect(archContent).toContain('src/core/selection.ts:findEventContext');
    expect(archContent).toContain('src/core/commands.ts:352');
    expect(archContent).toContain('src/playback/schedule.ts:134');
    expect(archContent).toContain('array index position in `StaffMeasure.voices[vIdx]`');
    expect(archContent).toContain('Voice.voiceIndex: 1 | 2 | 3 | 4');
  });
});
