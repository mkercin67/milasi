// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { mapKeyEvent } from '../../src/ui/keymap';
import { createEmptyScore, createNote, createPitch, createRest } from '../../src/core/factory';
import { pasteLyrics, setLyrics } from '../../src/core/commands';

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

  it('lyric key behaviour: hyphen + Space commits syllable with hyphen and prepares connection to next note', () => {
    const score = createEmptyScore({ numMeasures: 1, timeSig: { num: 2, den: 4 } });
    const m0Id = score.measures[0].id;
    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [n1, n2];

    // User types "Ge-" then Space commits "Ge-"
    const updated = setLyrics(n1.id, 'Ge-').apply(score);
    const ev1 = updated.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    expect(ev1.kind === 'note' ? ev1.lyrics : undefined).toEqual([{ verse: 1, text: 'Ge-' }]);
  });

  it('lyric key behaviour: "_" extender commits melisma line on current note', () => {
    const score = createEmptyScore({ numMeasures: 1, timeSig: { num: 2, den: 4 } });
    const m0Id = score.measures[0].id;
    const n1 = createNote({ pitches: [createPitch('E', 4)], baseType: 'half' });
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [n1];

    const updated = setLyrics(n1.id, 'ah_').apply(score);
    const ev1 = updated.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    expect(ev1.kind === 'note' ? ev1.lyrics : undefined).toEqual([{ verse: 1, text: 'ah_' }]);
  });

  it('lyric key behaviour: Space/Tab/Enter next commits syllable and targets next note', () => {
    const score = createEmptyScore({ numMeasures: 1, timeSig: { num: 2, den: 4 } });
    const m0Id = score.measures[0].id;
    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [n1, n2];

    let current = setLyrics(n1.id, 'La').apply(score);
    current = setLyrics(n2.id, 'Sol').apply(current);

    const evs = current.parts[0].staves[0].measures[m0Id].voices[0].events;
    expect(evs[0].kind === 'note' ? evs[0].lyrics : undefined).toEqual([{ verse: 1, text: 'La' }]);
    expect(evs[1].kind === 'note' ? evs[1].lyrics : undefined).toEqual([{ verse: 1, text: 'Sol' }]);
  });

  it('lyric key behaviour: Shift+Tab previous navigates backwards without modifying previous syllable', () => {
    const score = createEmptyScore({ numMeasures: 1, timeSig: { num: 2, den: 4 } });
    const m0Id = score.measures[0].id;
    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [n1, n2];

    const withN1 = setLyrics(n1.id, 'İlk').apply(score);
    // Navigating back preserves N1 lyrics intact
    const ev1 = withN1.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    expect(ev1.kind === 'note' ? ev1.lyrics : undefined).toEqual([{ verse: 1, text: 'İlk' }]);
  });

  it('lyric key behaviour: Backspace on empty goes back to previous note', () => {
    const score = createEmptyScore({ numMeasures: 1, timeSig: { num: 2, den: 4 } });
    const m0Id = score.measures[0].id;
    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [n1, n2];

    // Clearing note 2 lyrics with empty text leaves note 1 lyrics untouched
    let current = setLyrics(n1.id, 'Önceki').apply(score);
    current = setLyrics(n2.id, '').apply(current);

    const ev1 = current.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    const ev2 = current.parts[0].staves[0].measures[m0Id].voices[0].events[1];
    expect(ev1.kind === 'note' ? ev1.lyrics : undefined).toEqual([{ verse: 1, text: 'Önceki' }]);
    expect(ev2.kind === 'note' ? ev2.lyrics : undefined).toBeUndefined();
  });

  it('lyric key behaviour: rests and tied notes skipped when collecting eligible notes', () => {
    const score = createEmptyScore({ numMeasures: 2, timeSig: { num: 2, den: 4 } });
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;

    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'eighth' });
    n1.tiedToNext = true; // Note 1 is tied to Note 2
    const n2 = createNote({ pitches: [createPitch('C', 4)], baseType: 'eighth' });
    const rest = createRest({ baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('D', 4)], baseType: 'half' });

    score.parts[0].staves[0].measures[m0Id].voices[0].events = [n1, n2, rest];
    score.parts[0].staves[0].measures[m1Id].voices[0].events = [n3];

    // Helper to extract eligible note IDs matching App.tsx logic
    const eligibleIds: string[] = [];
    let prevTied = false;
    for (const mDef of score.measures) {
      for (const ev of score.parts[0].staves[0].measures[mDef.id].voices[0].events) {
        const isSecondTied = prevTied;
        if (ev.kind === 'note') {
          prevTied = Boolean(ev.tiedToNext || ev.pitches.some((p) => p.tiedToNext));
          if (!isSecondTied) eligibleIds.push(ev.id);
        } else {
          prevTied = false;
        }
      }
    }

    // n2 (second tied note) and rest must be skipped!
    expect(eligibleIds).toEqual([n1.id, n3.id]);
  });

  it('lyric key behaviour: paste of a line splits whitespace-separated words across consecutive eligible notes', () => {
    const score = createEmptyScore({ numMeasures: 2, timeSig: { num: 2, den: 4 } });
    const m0Id = score.measures[0].id;
    const m1Id = score.measures[1].id;

    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const n4 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });

    score.parts[0].staves[0].measures[m0Id].voices[0].events = [n1, n2];
    score.parts[0].staves[0].measures[m1Id].voices[0].events = [n3, n4];

    const pasted = pasteLyrics(n1.id, 'Süt iç- tim di-', score).apply(score);
    const evsM0 = pasted.parts[0].staves[0].measures[m0Id].voices[0].events;
    const evsM1 = pasted.parts[0].staves[0].measures[m1Id].voices[0].events;

    expect(evsM0[0].kind === 'note' ? evsM0[0].lyrics : undefined).toEqual([{ verse: 1, text: 'Süt' }]);
    expect(evsM0[1].kind === 'note' ? evsM0[1].lyrics : undefined).toEqual([{ verse: 1, text: 'iç-' }]);
    expect(evsM1[0].kind === 'note' ? evsM1[0].lyrics : undefined).toEqual([{ verse: 1, text: 'tim' }]);
    expect(evsM1[1].kind === 'note' ? evsM1[1].lyrics : undefined).toEqual([{ verse: 1, text: 'di-' }]);
  });

  it('lyric key behaviour: supports full Turkish characters without encoding artifacts', () => {
    const score = createEmptyScore({ numMeasures: 2 });
    const m0Id = score.measures[0].id;
    const note = createNote({ pitches: [createPitch('A', 4, 0)], baseType: 'quarter' });
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [note];

    // Turkish letters: ç, ğ, ı, ö, ş, ü, Ç, Ğ, İ, Ö, Ş, Ü
    const turkishLyric = 'çğışöü-ÇĞİŞÖÜ';
    const updated = setLyrics(note.id, turkishLyric).apply(score);
    const ev = updated.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    expect(ev.kind === 'note' ? ev.lyrics : []).toEqual([{ verse: 1, text: turkishLyric }]);
  });
});
