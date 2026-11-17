import { describe, expect, it } from 'vitest';
import { buildSutIctimScore } from '../../src/ui/sutIctimScore';
import { validateScore } from '../../src/core/validate';
import { layoutScore } from '../../src/layout/layoutScore';
import { expandRepeats } from '../../src/playback/repeats';

describe('Milestone 6d Reference Score: "Süt İçtim Dilim Yandı" (2/4, 9 measures)', () => {
  it('builds a valid score with zero errors and clean validateScore output', () => {
    const score = buildSutIctimScore();
    const problems = validateScore(score);
    expect(problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(score.measures.length).toBe(9);
  });

  it('has correct musical structures: pickup, repeats, voltas, and final barline', () => {
    const score = buildSutIctimScore();
    expect(score.measures[0].actualTicks).toBe(960);
    expect(score.measures[1].repeat).toBe('start');
    expect(score.measures[4].volta?.number).toBe(1);
    expect(score.measures[4].repeat).toBe('end');
    expect(score.measures[5].volta?.number).toBe(2);
    expect(score.measures[8].endBarline).toBe('final');
  });

  it('linearizes playback correctly skipping volta 1 on the second pass', () => {
    const score = buildSutIctimScore();
    const linear = expandRepeats(score);
    const indices = linear.map((e) => e.measureIndex);
    // Expected playback path:
    // Pass 1: 0 (pickup), 1, 2, 3, 4 (volta 1, repeatEnd)
    // Pass 2: jumps back to 1, 2, 3, skips 4, plays 5 (volta 2), 6, 7, 8
    expect(indices).toEqual([0, 1, 2, 3, 4, 1, 2, 3, 5, 6, 7, 8]);
  });

  it('layouts header, repeats, voltas, and lyrics cleanly without errors', () => {
    const score = buildSutIctimScore();
    const layout = layoutScore(score, { width: 70 });

    // Header items
    const title = layout.items.find((it) => it.id === 'header-title');
    const composer = layout.items.find((it) => it.id === 'header-composer');
    expect(title?.text).toContain('Süt İçtim Dilim Yandı');
    expect(composer?.text).toContain('Anonim');

    // Repeat barlines
    const repeatStart = layout.items.find((it) => it.glyph === 'repeatLeft');
    const repeatEnd = layout.items.find((it) => it.glyph === 'repeatRight');
    expect(repeatStart).toBeDefined();
    expect(repeatEnd).toBeDefined();

    // Volta brackets
    const volta1 = layout.items.find((it) => it.text === '1.');
    const volta2 = layout.items.find((it) => it.text === '2.');
    expect(volta1).toBeDefined();
    expect(volta2).toBeDefined();

    // Lyric syllables
    const lyrics = layout.items.filter((it) => it.id.startsWith('lyric-text-'));
    expect(lyrics.length).toBeGreaterThanOrEqual(14);
    const syllables = lyrics.map((l) => l.text);
    expect(syllables).toContain('Süt');
    expect(syllables).toContain('iç-');
    expect(syllables).toContain('tim');
    expect(syllables).toContain('ver');
  });
});
