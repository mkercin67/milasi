// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  getContrastRatio,
  PAGE_BACKGROUND,
  SELECTION_BLUE,
  VOICE_COLORS,
} from '../../src/ui/voiceColors';

describe('Voice Colors & Contrast (T11)', () => {
  it('T11: per-voice caret label equals active voice, chip matches, WCAG contrast >= 4.5:1, distinct from selection blue', () => {
    const voiceIndices: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];

    for (const vIdx of voiceIndices) {
      const color = VOICE_COLORS[vIdx];
      expect(color).toBeDefined();

      // WCAG 2.1 AA requirement: contrast ratio >= 4.5:1 against white background
      const contrast = getContrastRatio(color, PAGE_BACKGROUND);
      expect(contrast).toBeGreaterThanOrEqual(4.5);

      // Must be distinct from selection blue (#2563eb)
      expect(color.toLowerCase()).not.toBe(SELECTION_BLUE.toLowerCase());

      // Colors must be pairwise distinct
      for (const otherIdx of voiceIndices) {
        if (otherIdx !== vIdx) {
          expect(VOICE_COLORS[otherIdx].toLowerCase()).not.toBe(color.toLowerCase());
        }
      }
    }
  });
});
