// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import trLocale from '../../src/ui/i18n/locales/tr.json';
import enLocale from '../../src/ui/i18n/locales/en.json';

describe('Milestone 6b: Terminology Verification (Tie = Bağ, Slur = Legato bağı)', () => {
  it('ensures every Turkish string using "Bağ" or "bağ" refers to ties, and slur strings use "Legato"', () => {
    for (const [key, val] of Object.entries(trLocale)) {
      const lower = val.toLowerCase();
      // If the value mentions 'bağ'
      if (lower.includes('bağ')) {
        if (key.includes('slur') || lower.includes('legato')) {
          // If it is a slur string, it MUST contain 'legato'
          expect(lower).toContain('legato');
        } else {
          // If it is a tie string, it must NOT be a slur key
          expect(key).not.toContain('slur');
          expect(key.toLowerCase()).toMatch(/tie|bağ/i);
        }
      }

      // If the key is about slurs, it must contain 'legato' in Turkish
      if (key.includes('slur')) {
        expect(lower).toContain('legato');
      }

      // If the key is about ties, it must contain 'bağ' in Turkish
      if (key.includes('tie') || key.includes('Tie')) {
        expect(lower).toContain('bağ');
      }
    }
  });

  it('ensures every English slur string uses "Legato" or "Slur" and tie strings use "Tie"', () => {
    for (const [key, val] of Object.entries(enLocale)) {
      const lower = val.toLowerCase();
      if (key.includes('slur')) {
        expect(lower).toMatch(/legato|slur/);
      }
      if (key.includes('tie') || key.includes('Tie')) {
        expect(lower).toContain('tie');
      }
    }
  });
});
