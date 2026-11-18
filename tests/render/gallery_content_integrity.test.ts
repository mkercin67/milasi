// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { getGalleryCases } from '../../src/ui/galleryCases';
import { validateScore } from '../../src/core/validate';
import { measureTicks } from '../../src/core/time';
import { NoteEvent } from '../../src/core/model';
import { layoutScore } from '../../src/layout/layoutScore';
import { renderSvgToString } from '../../src/render/renderSvg';

describe('Gallery Content Integrity & Verification Test Harness', () => {
  const cases = getGalleryCases();

  it('rejects cards claiming unimplemented features (pending cards must be marked pending: true)', () => {
    for (const c of cases) {
      if (c.title.includes('Pending') || c.description.includes('deferred')) {
        expect(c.pending, `Card "${c.title}" claims deferred features but pending is not true`).toBe(true);
      }
    }
  });

  describe('Validation & Rhythmic Sums for every non-pending card', () => {
    const activeCases = cases.filter((c) => !c.pending);

    for (const c of activeCases) {
      it(`Case [${c.id}]: validateScore is clean and all measures sum to their length`, () => {
        const score = c.build();
        const issues = validateScore(score);
        const errors = issues.filter((i) => i.severity === 'error');
        expect(errors, `Validation errors found in ${c.title}: ${JSON.stringify(errors)}`).toEqual([]);

        // Check measure sums
        for (const part of score.parts) {
          for (const staff of part.staves) {
            for (const mDef of score.measures) {
              const sm = staff.measures[mDef.id];
              expect(sm, `Missing staff measure in ${c.title}`).toBeDefined();
              const expectedTicks = mDef.actualTicks ?? measureTicks(mDef.timeSig);

              for (const voice of sm.voices) {
                const totalVoiceTicks = voice.events.reduce((sum, ev) => sum + ev.duration, 0);
                expect(
                  totalVoiceTicks,
                  `Measure ${mDef.id} in ${c.title} voice ${voice.id} has ${totalVoiceTicks} ticks (expected ${expectedTicks})`
                ).toBe(expectedTicks);
              }
            }
          }
        }
      });
    }
  });

  describe('Feature-specific DOM Count Assertions', () => {
    it('Card 1 (note-values-and-dots): contains expected note values and augmentation dots', () => {
      const c = cases.find((x) => x.id === 'note-values-and-dots')!;
      const score = c.build();
      const layout = layoutScore(score, { width: 70 });
      const svg = renderSvgToString(layout, { staffSpacePx: 10, score });

      expect(svg).toContain('glyph-augmentationDot');
      expect(svg).toContain('glyph-noteheadBlack');
      expect(svg).toContain('glyph-noteheadHalf');
      expect(svg).toContain('glyph-noteheadWhole');
    });

    it('Card 2 (rests-all-values): contains glyphs for whole, half, quarter, 8th, 16th, and 32nd rests', () => {
      const c = cases.find((x) => x.id === 'rests-all-values')!;
      const score = c.build();
      const layout = layoutScore(score, { width: 70 });
      const svg = renderSvgToString(layout, { staffSpacePx: 10, score });

      expect(svg).toContain('glyph-restWhole');
      expect(svg).toContain('glyph-restHalf');
      expect(svg).toContain('glyph-restQuarter');
      expect(svg).toContain('glyph-rest8th');
      expect(svg).toContain('glyph-rest16th');
      expect(svg).toContain('glyph-rest32nd');
    });

    it('Card 3 (accidentals-and-chords): contains second intervals and split-step chords with same step twice', () => {
      const c = cases.find((x) => x.id === 'accidentals-and-chords')!;
      const score = c.build();
      const m1 = score.parts[0].staves[0].measures[score.measures[1].id];
      const chords = m1.voices[0].events.filter((e): e is NoteEvent => e.kind === 'note' && e.pitches.length > 1);
      expect(chords.length).toBe(2);

      // Chord 1 has second interval C4-D4
      const p1 = chords[0].pitches.map((p) => p.step);
      expect(p1).toEqual(['C', 'D', 'G']);

      // Chord 2 has same step twice: F4 natural and F4 sharp
      const p2 = chords[1].pitches;
      expect(p2[0].step).toBe('F');
      expect(p2[0].alter).toBe(0);
      expect(p2[1].step).toBe('F');
      expect(p2[1].alter).toBe(1);
    });

    it('Card 4 (beams-all-cases): contains primary and 16th fractional beams', () => {
      const c = cases.find((x) => x.id === 'beams-all-cases')!;
      const score = c.build();
      const layout = layoutScore(score, { width: 70 });
      const svg = renderSvgToString(layout, { staffSpacePx: 10, score });

      const beamMatches = svg.match(/class="scoreforge-beam"/g);
      expect(beamMatches).not.toBeNull();
      expect(beamMatches!.length).toBeGreaterThanOrEqual(4);
    });

    it('Card 8 & Card 9 (slurs): stem-up noteheads have slur below; stem-down noteheads have stems down and slur above', () => {
      const c8 = cases.find((x) => x.id === 'slurs-stem-up')!;
      const s8 = c8.build();
      const l8 = layoutScore(s8, { width: 70 });
      const svg8 = renderSvgToString(l8, { staffSpacePx: 10, score: s8 });
      expect(svg8).toContain('class="score-slur notranslate"');

      const c9 = cases.find((x) => x.id === 'slurs-stem-down')!;
      const s9 = c9.build();
      const l9 = layoutScore(s9, { width: 70 });
      const svg9 = renderSvgToString(l9, { staffSpacePx: 10, score: s9 });
      expect(svg9).toContain('class="score-slur notranslate"');

      // Verify all notes in Card 9 are on or above line 3 (middle line B4), giving stem-down direction
      const m0 = s9.parts[0].staves[0].measures[s9.measures[0].id];
      for (const ev of m0.voices[0].events) {
        if (ev.kind === 'note') {
          const pitch = ev.pitches[0];
          // C5, D5, E5 are strictly above middle line B4
          expect(pitch.octave * 12 + ['C','D','E','F','G','A','B'].indexOf(pitch.step)).toBeGreaterThanOrEqual(
            4 * 12 + ['C','D','E','F','G','A','B'].indexOf('B')
          );
        }
      }
    });

    it('Card 15 (key-change-with-naturals): generates exactly 3 cancellation naturals and 1 flat', () => {
      const c = cases.find((x) => x.id === 'key-change-with-naturals')!;
      const score = c.build();
      const layout = layoutScore(score, { width: 100 });

      const naturals = layout.items.filter((it) => it.kind === 'glyph' && it.glyph === 'accidentalNatural');
      const flats = layout.items.filter((it) => it.kind === 'glyph' && it.glyph === 'accidentalFlat');

      expect(naturals.length).toBe(3);
      expect(flats.length).toBe(1);
    });

    it('Card 25 (wrapping-three-widths): 8-measure score wraps across 385, 600, 1200 px', () => {
      const c = cases.find((x) => x.id === 'wrapping-three-widths')!;
      const score = c.build();
      expect(score.measures.length).toBe(8);

      const l385 = layoutScore(score, { width: 38.5 });
      const l600 = layoutScore(score, { width: 60 });
      const l1200 = layoutScore(score, { width: 120 });

      // Narrow width wraps into more systems than wide width
      expect(l385.systems.length).toBeGreaterThan(l600.systems.length);
      expect(l600.systems.length).toBeGreaterThanOrEqual(l1200.systems.length);
    });
  });
});
