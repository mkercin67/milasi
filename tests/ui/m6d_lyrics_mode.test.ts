import { describe, expect, it } from 'vitest';
import { mapKeyEvent } from '../../src/ui/keymap';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { setLyrics } from '../../src/core/commands';

describe('Milestone 6d: Lyrics Mode & Input Keymap (src/ui/keymap.ts)', () => {
  it('maps KeyU to toggle-lyrics-mode across modes', () => {
    expect(mapKeyEvent({ code: 'KeyU' }, 'select')).toBe('toggle-lyrics-mode');
    expect(mapKeyEvent({ code: 'KeyU' }, 'input')).toBe('toggle-lyrics-mode');
    expect(mapKeyEvent({ code: 'KeyU' }, 'position')).toBe('toggle-lyrics-mode');
    expect(mapKeyEvent({ code: 'KeyU' }, 'lyrics')).toBe('toggle-lyrics-mode');
  });

  it('maps Escape in lyrics mode to set-mode-select', () => {
    expect(mapKeyEvent({ code: 'Escape' }, 'lyrics')).toBe('set-mode-select');
  });

  it('maps Tab and Shift+Tab in lyrics mode to lyrics-next-note and lyrics-prev-note', () => {
    expect(mapKeyEvent({ code: 'Tab' }, 'lyrics')).toBe('lyrics-next-note');
    expect(mapKeyEvent({ code: 'Tab', shiftKey: true }, 'lyrics')).toBe('lyrics-prev-note');
  });

  it('supports full Turkish characters in note lyrics without encoding artifacts', () => {
    const score = createEmptyScore({ numMeasures: 2 });
    const m0Id = score.measures[0].id;
    const note = createNote({ pitches: [createPitch('A', 4, 0)], baseType: 'quarter' });
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [note];

    // Turkish letters: ç, ğ, ı, ö, ş, ü, Ç, Ğ, İ, Ö, Ş, Ü
    const turkishLyric = 'çğışöü-ÇĞİŞÖÜ';
    const updated = setLyrics(note.id, turkishLyric).apply(score);
    const ev = updated.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    expect(ev.kind === 'note' ? ev.lyrics : '').toBe(turkishLyric);
  });
});
