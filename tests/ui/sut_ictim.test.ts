import { describe, expect, it } from 'vitest';
import { buildSutIctimScore } from '../../src/ui/sutIctimScore';
import { validateScore } from '../../src/core/validate';
import { layoutScore } from '../../src/layout/layoutScore';
import { expandRepeats } from '../../src/playback/repeats';
import { buildSchedule } from '../../src/playback/schedule';

describe('Milestone 6d True Reference Score: "Süt İçtim Dilim Yandı" (2/4, 8 measures, C major)', () => {
  it('builds a valid score with zero errors and clean validateScore output', () => {
    const score = buildSutIctimScore();
    const problems = validateScore(score);
    expect(problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(score.measures.length).toBe(8);
    expect(score.meta.title).toBe('Süt İçtim Dilim Yandı');
    expect(score.meta.composer).toBe('Müzik Notlarım');
  });

  it('has correct musical structures: no pickup, no voltas, repeatEnd on m4, repeatStart on m5, repeatEnd on m8', () => {
    const score = buildSutIctimScore();
    expect(score.measures[0].actualTicks).toBeUndefined(); // No pickup
    expect(score.measures[3].repeatEnd).toBe(true);        // Measure 4 end-repeat
    expect(score.measures[4].repeatStart).toBe(true);      // Measure 5 start-repeat
    expect(score.measures[7].repeatEnd).toBe(true);        // Measure 8 end-repeat
    // No voltas
    for (const m of score.measures) {
      expect(m.volta).toBeUndefined();
    }
  });

  it('linearizes playback correctly: 1-4 twice and 5-8 twice (16 measures, 56 notes, 16.0s)', () => {
    const score = buildSutIctimScore();
    const linear = expandRepeats(score);
    const indices = linear.map((e) => e.measureIndex);

    // Expected playback path: 1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 5, 6, 7, 8
    expect(indices).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 6, 7, 4, 5, 6, 7]);
    expect(linear.length).toBe(16);

    const schedule = buildSchedule(score);
    expect(schedule.notes.length).toBe(56);
    expect(schedule.totalSeconds).toBeCloseTo(16.0, 1);
  });

  it('layouts header, combined repeat barline, and Turkish solfege syllables cleanly', () => {
    const score = buildSutIctimScore();
    const layout = layoutScore(score, { width: 100 });

    // Header items
    const title = layout.items.find((it) => it.id === 'header-title');
    const composer = layout.items.find((it) => it.id === 'header-composer');
    expect(title?.text).toContain('Süt İçtim Dilim Yandı');
    expect(composer?.text).toContain('Müzik Notlarım');

    // Repeat barlines: on system 0 at width 100, measure 4 and 5 share combined repeatRightLeft
    const combinedRepeat = layout.items.find((it) => (it as any).glyph === 'repeatRightLeft');
    const endRepeat = layout.items.find((it) => (it as any).glyph === 'repeatRight');
    expect(combinedRepeat || endRepeat).toBeDefined();

    // Lyric syllables: 28 notes all have solfege syllables
    const lyrics = layout.items.filter((it) => it.id.startsWith('lyric-text-'));
    expect(lyrics.length).toBe(28);

    const firstFour = lyrics.slice(0, 4).map((l) => l.text);
    expect(firstFour).toEqual(['Re', 'Mi', 'Fa', 'Sol']);
  });
});
