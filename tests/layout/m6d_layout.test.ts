import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';

describe('Milestone 6d: Repeats, Voltas & Lyrics Layout (src/layout/layoutScore.ts)', () => {
  it('FAILING-FIRST: renders repeat barlines (repeatLeft, repeatRight) in layout items', () => {
    const score = createEmptyScore({ numMeasures: 3 });
    score.measures[1].repeat = 'start';
    score.measures[2].repeat = 'end';

    const layout = layoutScore(score, { width: 70 });
    const repeatGlyphs = layout.items.filter(
      (it) => it.kind === 'glyph' && (it.glyph === 'repeatLeft' || it.glyph === 'repeatRight')
    );
    expect(repeatGlyphs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders volta brackets with "1." and "2." labels above measures', () => {
    const score = createEmptyScore({ numMeasures: 4 });
    score.measures[1].volta = { number: 1 };
    score.measures[2].volta = { number: 2, openRight: true };

    const layout = layoutScore(score, { width: 70 });
    const voltaTexts = layout.items.filter(
      (it) => it.kind === 'text' && (it.text === '1.' || it.text === '2.')
    );
    expect(voltaTexts.length).toBe(2);

    const voltaLines = layout.items.filter((it) => it.id.startsWith('volta-line-'));
    expect(voltaLines.length).toBeGreaterThanOrEqual(2);
  });

  it('renders lyrics text centered below the staff for notes with lyrics', () => {
    const score = createEmptyScore({ numMeasures: 2 });
    const m0Id = score.measures[0].id;
    const v = score.parts[0].staves[0].measures[m0Id].voices[0];
    v.events = [
      createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'quarter' }),
    ];
    (v.events[0] as any).lyrics = 'Süt';
    (v.events[1] as any).lyrics = 'iç-';

    const layout = layoutScore(score, { width: 70 });
    const lyricItems = layout.items.filter((it) => it.id.startsWith('lyric-text-'));
    expect(lyricItems.length).toBe(2);
    expect(lyricItems[0].text).toBe('Süt');
    expect(lyricItems[1].text).toBe('iç-');

    // Placed below staff (line 4 is at y = 4; lyrics at y >= 6.0)
    expect(lyricItems[0].y).toBeGreaterThanOrEqual(6.0);
  });

  it('expands measure width horizontally when lyric syllables would otherwise collide', () => {
    const score = createEmptyScore({ numMeasures: 2 });
    const m0Id = score.measures[0].id;
    const v = score.parts[0].staves[0].measures[m0Id].voices[0];
    // Two 16th notes with very long words
    v.events = [
      createNote({ pitches: [createPitch('C', 4, 0)], baseType: '16th' }),
      createNote({ pitches: [createPitch('D', 4, 0)], baseType: '16th' }),
    ];
    (v.events[0] as any).lyrics = 'Kahramanmaraş-';
    (v.events[1] as any).lyrics = 'lılaştıramadıklarımızdan';

    const layout = layoutScore(score, { width: 70 });
    const lyric1 = layout.items.find((it) => it.text === 'Kahramanmaraş-');
    const lyric2 = layout.items.find((it) => it.text === 'lılaştıramadıklarımızdan');

    expect(lyric1).toBeDefined();
    expect(lyric2).toBeDefined();
    // Separation between text centers must be large enough to prevent visual collision
    if (lyric1 && lyric2) {
      expect(lyric2.x - lyric1.x).toBeGreaterThanOrEqual(10.0);
    }
  });
});
