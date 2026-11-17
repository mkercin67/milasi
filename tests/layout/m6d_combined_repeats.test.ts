import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';

describe('Milestone 6d: Combined Repeat Barlines and Lyrics Extenders/Hyphens Layout', () => {
  it('FAILING-FIRST: renders a single combined repeat barline (repeatRightLeft) between measure n and n+1 on the same system', () => {
    const score = createEmptyScore({ numMeasures: 8, timeSig: { num: 2, den: 4 } });
    (score.measures[3] as any).repeatEnd = true;
    (score.measures[4] as any).repeatStart = true;

    const layout = layoutScore(score, { contentWidth: 100 });
    const sys0 = layout.systems[0];

    // Find repeat glyph items
    const repeatGlyphs = sys0.items.filter((it) => it.kind === 'glyph' && (it as any).glyph?.startsWith('repeat'));
    const combined = repeatGlyphs.find((it) => (it as any).glyph === 'repeatRightLeft');

    expect(combined).toBeDefined();
    // There should NOT be separate repeatRight AND repeatLeft side-by-side
    const separateRight = repeatGlyphs.find((it) => (it as any).glyph === 'repeatRight');
    expect(separateRight).toBeUndefined();
  });

  it('FAILING-FIRST: renders repeatRight at system end and repeatLeft at system start when split across system break', () => {
    const score = createEmptyScore({ numMeasures: 8, timeSig: { num: 2, den: 4 } });
    (score.measures[3] as any).repeatEnd = true;
    (score.measures[4] as any).repeatStart = true;

    // Force system break between measure 4 and 5 (index 3 and 4)
    const layout = layoutScore(score, { contentWidth: 43 });
    expect(layout.systems.length).toBeGreaterThanOrEqual(2);

    const sys0 = layout.systems[0];
    const sys1 = layout.systems[1];

    const sys0EndRepeat = sys0.items.find((it) => (it as any).glyph === 'repeatRight');
    expect(sys0EndRepeat).toBeDefined();

    const sys1StartRepeat = sys1.items.find((it) => (it as any).glyph === 'repeatLeft');
    expect(sys1StartRepeat).toBeDefined();
  });

  it('FAILING-FIRST: renders lyrics with hyphens and melisma extender line (_)', () => {
    const score = createEmptyScore({ numMeasures: 2, timeSig: { num: 2, den: 4 } });
    const m0Id = score.measures[0].id;
    const n1 = createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('E', 4, 0)], baseType: 'quarter' });
    (n1 as any).lyrics = [{ verse: 1, text: 'Süt-' }];
    (n2 as any).lyrics = [{ verse: 1, text: 'iç_' }];
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [n1, n2];

    const layout = layoutScore(score, { contentWidth: 60 });
    const sys0 = layout.systems[0];

    // Check lyric text items
    const lyricTexts = sys0.items.filter((it) => it.kind === 'text' && it.id.startsWith('lyric-text-'));
    expect(lyricTexts.length).toBe(2);

    // Check hyphen line or text item between note 1 and 2 (must be centered between syllables)
    const hyphenItem = sys0.items.find((it) => it.id.includes('lyric-hyphen-'));
    expect(hyphenItem).toBeDefined();
    if (hyphenItem) {
      expect(hyphenItem.x).toBeGreaterThan(lyricTexts[0].x);
      expect(hyphenItem.x).toBeLessThan(lyricTexts[1].x);
      // Midpoint check (within 0.5 staff spaces tolerance)
      const expectedMid = (lyricTexts[0].x + lyricTexts[1].x) / 2;
      expect(Math.abs(hyphenItem.x - expectedMid)).toBeLessThan(0.5);
    }

    // Check melisma extender line for note 2 (must extend to end of last melisma note)
    const extenderLine = sys0.items.find((it) => it.kind === 'line' && it.id.includes('lyric-extender-'));
    expect(extenderLine).toBeDefined();
    if (extenderLine) {
      expect(extenderLine.x).toBeGreaterThan(lyricTexts[1].x);
      expect(extenderLine.x2).toBeGreaterThan(extenderLine.x);
    }
  });
});
