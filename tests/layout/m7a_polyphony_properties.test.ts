// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { Score } from '../../src/core/model';
import { clearSystemLayoutCache, layoutScore } from '../../src/layout/layoutScore';
import { layoutSingleMeasure, measureLayoutCacheStats } from '../../src/layout/measureLayout';
import {
  buildNoteheadIndex,
  layoutArticulations,
  layoutDynamics,
  layoutSlurs,
  notationOpCounter,
} from '../../src/layout/notations';
import { layoutTies } from '../../src/layout/ties';

/**
 * Builds a multi-measure two-voice polyphonic score.
 */
function buildPolyphonicScore(numMeasures: number): Score {
  const score = createEmptyScore({ measures: numMeasures });
  const staff = score.parts[0].staves[0];

  for (let m = 0; m < numMeasures; m++) {
    const mDef = score.measures[m];
    // Voice 1: two half notes
    const v1_n1 = createNote({ pitches: [createPitch('E', 5)], baseType: 'half' });
    const v1_n2 = createNote({ pitches: [createPitch('F', 5)], baseType: 'half' });
    // Voice 2: four quarter notes
    const v2_n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const v2_n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const v2_n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const v2_n4 = createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' });

    staff.measures[mDef.id].voices = [
      { id: `m${m}-v1`, voiceIndex: 1, events: [v1_n1, v1_n2] },
      { id: `m${m}-v2`, voiceIndex: 2, events: [v2_n1, v2_n2, v2_n3, v2_n4] },
    ];
  }
  return score;
}

describe('M7a-2a Advanced Polyphonic Verification (Properties, Cache, Complexity, Isolation)', () => {
  describe('1. Property Test: Determinism and Glyph Bounding Box Non-Overlap', () => {
    it('produces strictly deterministic layouts and non-overlapping glyph bounding boxes across 30 randomized two-voice measures', () => {
      // Pitches for Voice 1 (higher range: C5 to C6)
      const v1Pitches = [
        createPitch('C', 5),
        createPitch('D', 5),
        createPitch('E', 5),
        createPitch('F', 5),
        createPitch('G', 5),
        createPitch('A', 5),
        createPitch('B', 5),
        createPitch('C', 6),
      ];
      // Pitches for Voice 2 (lower range: C4 to G4, plus potential unisons/seconds with v1)
      const v2Pitches = [
        createPitch('C', 4),
        createPitch('D', 4),
        createPitch('E', 4),
        createPitch('F', 4),
        createPitch('G', 4),
        createPitch('A', 4),
        createPitch('B', 4),
        createPitch('C', 5),
      ];

      for (let trial = 0; trial < 30; trial++) {
        const p1 = v1Pitches[trial % v1Pitches.length];
        const p2 = v2Pitches[(trial * 3) % v2Pitches.length];

        const score = createEmptyScore({ measures: 1 });
        const staff = score.parts[0].staves[0];
        const mDef = score.measures[0];

        // Alternating same vs different durations
        const sameDuration = trial % 2 === 0;
        const v1_note = createNote({ pitches: [p1], baseType: 'half' });
        const v2_note = createNote({ pitches: [p2], baseType: sameDuration ? 'half' : 'quarter' });
        const v2_rest = sameDuration
          ? null
          : { id: `r-${trial}`, kind: 'rest' as const, baseType: 'quarter' as const, duration: 960, dots: 0 };

        staff.measures[mDef.id].voices = [
          { id: 'v1', voiceIndex: 1, events: [v1_note, createNote({ pitches: [p1], baseType: 'half' })] },
          { id: 'v2', voiceIndex: 2, events: v2_rest ? [v2_note, v2_rest, createNote({ pitches: [p2], baseType: 'half' })] : [v2_note, createNote({ pitches: [p2], baseType: 'half' })] },
        ];

        // 1. Determinism: run layout twice and assert bit-exact items
        const layout1 = layoutScore(score, { width: 70 });
        const layout2 = layoutScore(score, { width: 70 });

        expect(layout1.systems[0].items.length).toBe(layout2.systems[0].items.length);
        for (let i = 0; i < layout1.systems[0].items.length; i++) {
          const it1 = layout1.systems[0].items[i];
          const it2 = layout2.systems[0].items[i];
          expect(it1.id).toBe(it2.id);
          expect(it1.x).toBe(it2.x);
          expect(it1.y).toBe(it2.y);
          expect(it1.glyph).toBe(it2.glyph);
        }

        // 2. Non-overlap analysis between voice 1 and voice 2 noteheads at tick 0
        const sys = layout1.systems[0];
        const h1 = sys.items.find((it) => it.id === v1_note.id && it.glyph?.startsWith('notehead'));
        const h2 = sys.items.find((it) => it.id === v2_note.id && it.glyph?.startsWith('notehead'));

        const isUnison = p1.step === p2.step && p1.octave === p2.octave && (p1.alter ?? 0) === (p2.alter ?? 0);

        if (isUnison && sameDuration) {
          // Rule RD: shared head unison case -> single notehead glyph with two stems
          expect(h1).toBeDefined();
          // h2 is not separately rendered as a duplicate notehead
          expect(h2).toBeUndefined();
        } else if (isUnison && !sameDuration) {
          // Rule RD: unison clash -> displaced notehead, no 2D overlap
          expect(h1).toBeDefined();
          expect(h2).toBeDefined();
          const dx = Math.abs(h1!.x - h2!.x);
          expect(dx).toBeGreaterThanOrEqual(1.0);
        } else {
          // Distinct pitches
          expect(h1).toBeDefined();
          expect(h2).toBeDefined();
          const stepDiff = Math.abs(
            p1.octave * 7 + 'CDEFGAB'.indexOf(p1.step) - (p2.octave * 7 + 'CDEFGAB'.indexOf(p2.step)),
          );
          if (stepDiff === 1) {
            // Rule RC: seconds share stem line -> horizontally displaced (v1 left, v2 right)
            const dx = Math.abs(h1!.x - h2!.x);
            expect(dx).toBeGreaterThanOrEqual(1.0);
          } else {
            // Thirds or larger: vertically separated by at least 1 staff space
            const dy = Math.abs(h1!.y - h2!.y);
            expect(dy).toBeGreaterThanOrEqual(1.0);
          }
        }
      }
    });
  });

  describe('2. Cache Invalidation Test: Multi-Measure Voice 2 Editing', () => {
    it('invalidates ONLY the edited measure chunk when Voice 2 is edited in an 8-measure score', () => {
      const score = buildPolyphonicScore(8);
      const staff = score.parts[0].staves[0];

      // Initial layout pass
      measureLayoutCacheStats.reset();
      const chunksInitial = score.measures.map((mDef, idx) =>
        layoutSingleMeasure(staff.measures[mDef.id], mDef, staff.clef, idx === 0, idx === 7),
      );
      expect(measureLayoutCacheStats.calls).toBe(8);
      expect(measureLayoutCacheStats.misses).toBe(8);
      expect(measureLayoutCacheStats.hits).toBe(0);

      // Now edit ONLY Voice 2 in Measure 3
      const targetMDef = score.measures[3];
      const targetSM = staff.measures[targetMDef.id];
      const editedVoice2Event = createNote({ pitches: [createPitch('A', 4)], baseType: 'quarter' });
      targetSM.voices[1] = {
        ...targetSM.voices[1],
        events: [editedVoice2Event, ...targetSM.voices[1].events.slice(1)],
      };

      // Second layout pass
      measureLayoutCacheStats.reset();
      const chunksAfter = score.measures.map((mDef, idx) =>
        layoutSingleMeasure(staff.measures[mDef.id], mDef, staff.clef, idx === 0, idx === 7),
      );

      // Total calls = 8; exactly 1 miss (Measure 3), 7 hits (Measures 0, 1, 2, 4, 5, 6, 7)!
      expect(measureLayoutCacheStats.calls).toBe(8);
      expect(measureLayoutCacheStats.misses).toBe(1);
      expect(measureLayoutCacheStats.hits).toBe(7);

      // Measure 3 chunk was invalidated and re-computed
      expect(chunksAfter[3]).not.toBe(chunksInitial[3]);

      // Unchanged measures kept identical chunk references
      for (let i = 0; i < 8; i++) {
        if (i !== 3) {
          expect(chunksAfter[i]).toBe(chunksInitial[i]);
        }
      }
    });
  });

  describe('3. R6 Complexity Counters: Two-Voice 100m vs 200m Scaling', () => {
    it('guarantees deterministic operation count stays linear (<= 2.2x) when scaling from 100 to 200 measures', () => {
      const score100 = buildPolyphonicScore(100);
      const score200 = buildPolyphonicScore(200);

      // Add ties across measures to exercise notations
      for (let i = 0; i < 99; i++) {
        const mDef = score100.measures[i];
        const sm = score100.parts[0].staves[0].measures[mDef.id];
        (sm.voices[0].events[0] as any).tiedToNext = true;
      }
      for (let i = 0; i < 199; i++) {
        const mDef = score200.measures[i];
        const sm = score200.parts[0].staves[0].measures[mDef.id];
        (sm.voices[0].events[0] as any).tiedToNext = true;
      }

      // Count operations on 100-measure two-voice score
      notationOpCounter.reset();
      notationOpCounter.enabled = true;
      const layout100 = layoutScore(score100, { width: 70 });
      const idx100 = buildNoteheadIndex(layout100);
      layoutTies(score100, layout100, idx100);
      layoutSlurs(score100, layout100, idx100);
      layoutDynamics(score100, layout100, idx100);
      layoutArticulations(score100, layout100, idx100);
      const ops100 = notationOpCounter.total;

      // Count operations on 200-measure two-voice score
      notationOpCounter.reset();
      const layout200 = layoutScore(score200, { width: 70 });
      const idx200 = buildNoteheadIndex(layout200);
      layoutTies(score200, layout200, idx200);
      layoutSlurs(score200, layout200, idx200);
      layoutDynamics(score200, layout200, idx200);
      layoutArticulations(score200, layout200, idx200);
      const ops200 = notationOpCounter.total;
      notationOpCounter.enabled = false;

      expect(ops100).toBeGreaterThan(0);
      expect(ops200).toBeGreaterThan(0);

      const ratio = ops200 / ops100;
      // 200 measures is exactly 2x of 100 measures -> ratio must stay within [1.8, 2.2]
      expect(ratio).toBeGreaterThanOrEqual(1.8);
      expect(ratio).toBeLessThanOrEqual(2.2);
    });
  });

  describe('4. DOM / Layout Mutation Isolation: Voice 2 Edit', () => {
    it('guarantees an edit to Voice 2 in System 0 leaves all subsequent system items strictly identical', () => {
      clearSystemLayoutCache();
      const score = buildPolyphonicScore(16);
      const staff = score.parts[0].staves[0];

      // Initial layout (width 60 produces multiple systems)
      const layoutBefore = layoutScore(score, { width: 60 });
      expect(layoutBefore.systems.length).toBeGreaterThan(1);

      // Deep snapshot of System 1 items before edit
      const sys1ItemsBefore = layoutBefore.systems[1].items.map((it) => ({ ...it }));

      // Edit a note in Voice 2 of Measure 0 (located strictly in System 0)
      const m0 = score.measures[0];
      const m0SM = staff.measures[m0.id];
      const alteredNote = createNote({ pitches: [createPitch('B', 3)], baseType: 'half' });
      m0SM.voices[1] = {
        ...m0SM.voices[1],
        events: [alteredNote, m0SM.voices[1].events[1]],
      };

      // Re-layout score
      const layoutAfter = layoutScore(score, { width: 60 });

      // System 0 was updated
      expect(layoutAfter.systems[0].items).not.toEqual(layoutBefore.systems[0].items);

      // System 1 items remain 100% strictly identical
      const sys1ItemsAfter = layoutAfter.systems[1].items;
      expect(sys1ItemsAfter.length).toBe(sys1ItemsBefore.length);
      for (let i = 0; i < sys1ItemsBefore.length; i++) {
        expect(sys1ItemsAfter[i].id).toBe(sys1ItemsBefore[i].id);
        expect(sys1ItemsAfter[i].kind).toBe(sys1ItemsBefore[i].kind);
        expect(sys1ItemsAfter[i].x).toBeCloseTo(sys1ItemsBefore[i].x, 4);
        expect(sys1ItemsAfter[i].y).toBeCloseTo(sys1ItemsBefore[i].y, 4);
        expect(sys1ItemsAfter[i].glyph).toBe(sys1ItemsBefore[i].glyph);
      }
    });
  });
});
