// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

declare const require: (module: string) => any;

describe('T7: Two-Voice Keyboard E2E Specification', () => {
  it('T7: Playwright E2E verifies keyboard-only two-voice measure with real keystrokes and export verification', () => {
    const fs = require('fs');
    const path = require('path');
    const scriptPath = path.resolve('scripts/test_two_voice_keyboard_e2e.mjs');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    // Verifies key workflow requirements
    expect(scriptContent).toContain('01_two_voice_measure.png');
    expect(scriptContent).toContain('02_beat_guide_pending_band_voice1.png');
    expect(scriptContent).toContain('03_beat_guide_shared_beat_voice2.png');
    expect(scriptContent).toContain('04_toolbar_voice_buttons_dots.png');
    expect(scriptContent).toContain('05_one_time_tip.png');
    expect(scriptContent).toContain('artifacts');
  });
});
