// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-7 step 4: verse helpers and the verse selector of the lyric entry box.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { setLyrics } from '../../src/core/commands';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import type { Score } from '../../src/core/model';
import { LyricsEditorOverlay } from '../../src/ui/app/LyricsEditorOverlay';
import { canAddVerse, highestVerse, nextNewVerse } from '../../src/ui/app/lyricVerses';
import { I18nProvider } from '../../src/ui/i18n';

function scoreWithNote(): { score: Score; id: string } {
  const score = createEmptyScore({ numMeasures: 1 });
  const note = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
  score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events = [note];
  return { score, id: note.id };
}

const overlay = (lang: 'tr' | 'en', verse: number, canAdd: boolean) =>
  renderToStaticMarkup(
    <I18nProvider initialLanguage={lang}>
      <LyricsEditorOverlay
        lyricsInputValue=""
        onLyricsChange={() => undefined}
        onLyricsKeyDown={() => undefined}
        onLyricsPaste={() => undefined}
        onClose={() => undefined}
        lyricsVerse={verse}
        onVerseChange={() => undefined}
        onNewVerse={() => undefined}
        canAddVerse={canAdd}
      />
    </I18nProvider>
  );

describe('M7c-7 lyric verse entry (step 4)', () => {
  it('LU1: highestVerse, nextNewVerse and canAddVerse follow the verses used in the score', () => {
    const { score, id } = scoreWithNote();
    expect(highestVerse(score)).toBe(0);
    expect(nextNewVerse(score)).toBe(1);
    let s = setLyrics(id, 'a', 1).apply(score);
    expect(nextNewVerse(s)).toBe(2);
    s = setLyrics(id, 'c', 3).apply(s);
    expect(highestVerse(s)).toBe(3);
    expect(nextNewVerse(s)).toBe(4);
    s = setLyrics(id, 'h', 8).apply(s);
    expect(nextNewVerse(s)).toBe(8);
    expect(canAddVerse(s)).toBe(false);
    expect(canAddVerse(score)).toBe(true);
  });

  it('LU2: the entry box offers verses 1 to 8 with the current verse selected', () => {
    const html = overlay('en', 3, true);
    expect(html).toContain('data-testid="select-lyrics-verse"');
    for (let v = 1; v <= 8; v++) expect(html).toContain(`<option value="${v}"`);
    expect(html).not.toContain('<option value="9"');
    expect(/<option value="3" selected/.test(html)).toBe(true);
  });

  it('LU3: "new verse" is disabled once eight verses exist', () => {
    expect(/data-testid="btn-new-verse"[^>]*disabled/.test(overlay('en', 1, false))).toBe(true);
    expect(/data-testid="btn-new-verse"[^>]*disabled/.test(overlay('en', 1, true))).toBe(false);
  });

  it('LU4: labels are translated', () => {
    expect(overlay('tr', 1, true)).toContain('Kıta');
    expect(overlay('tr', 1, true)).toContain('Yeni kıta');
    expect(overlay('en', 1, true)).toContain('New verse');
  });
});
