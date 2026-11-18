// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';
import { Score } from '../../src/core/model';

describe('Milestone 6b: 64-Measure Performance Benchmark (Node Layout)', () => {
  function buildDense64MeasureScore(): Score {
    const score = createEmptyScore({
      clef: { sign: 'G', line: 2 },
      keySig: 1, // G major
      timeSig: { num: 4, den: 4 },
      measures: 64,
    });
    const staff = score.parts[0].staves[0];
    const dynamics = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp'];
    const articulationsList: Array<Array<'staccato' | 'tenuto' | 'accent' | 'marcato'>> = [
      ['staccato'],
      ['tenuto'],
      ['accent'],
      ['marcato'],
      ['staccato', 'tenuto'],
    ];

    staff.slurs = [];

    let noteCounter = 0;
    for (let mIdx = 0; mIdx < 64; mIdx++) {
      const mDef = score.measures[mIdx];
      const sm = staff.measures[mDef.id];
      const notes = [
        createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('B', 4)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('D', 5)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('G', 5)], baseType: 'quarter' }),
      ];

      // Add ties between note 2 and note 3 in alternate measures
      if (mIdx % 2 === 0) {
        notes[1].pitches[0].tiedToNext = true;
        notes[1].tiedToNext = true;
      }

      // Add dynamics to first note of each measure
      notes[0].dynamic = dynamics[mIdx % dynamics.length];

      // Add articulations
      notes[1].articulations = articulationsList[mIdx % articulationsList.length];
      notes[3].articulations = ['staccato'];

      sm.voices[0].events = notes;

      // Add slurs every 4 measures across measure barlines
      if (mIdx % 4 === 0 && mIdx + 1 < 64) {
        staff.slurs.push({
          id: `slur-${mIdx}`,
          startEventId: notes[0].id,
          endEventId: notes[3].id,
        });
      }

      noteCounter += 4;
    }

    return score;
  }

  it('measures layout time of 64-measure score containing ties, slurs, dynamics and articulations (100 runs)', () => {
    const score = buildDense64MeasureScore();
    const staff = score.parts[0].staves[0];
    expect(score.measures.length).toBe(64);
    expect(staff.slurs?.length).toBeGreaterThan(10);

    // Warm-up
    for (let i = 0; i < 5; i++) {
      layoutScore(score);
    }

    const runs = 100;
    const durations: number[] = [];

    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      const layout = layoutScore(score);
      const t1 = performance.now();
      durations.push(t1 - t0);
      expect(layout.systems.length).toBeGreaterThan(0);
    }

    durations.sort((a, b) => a - b);
    const mean = durations.reduce((a, b) => a + b, 0) / runs;
    const p50 = durations[Math.floor(runs * 0.5)];
    const p95 = durations[Math.floor(runs * 0.95)];
    const min = durations[0];
    const max = durations[durations.length - 1];

    console.log('\n--- 64-Measure Dense Score Node Layout Benchmark (100 runs) ---');
    console.log(`Score notes: 256 notes across 64 measures with ties, slurs, dynamics, articulations`);
    console.log(`Mean: ${mean.toFixed(2)} ms`);
    console.log(`p50:  ${p50.toFixed(2)} ms`);
    console.log(`p95:  ${p95.toFixed(2)} ms`);
    console.log(`Min:  ${min.toFixed(2)} ms`);
    console.log(`Max:  ${max.toFixed(2)} ms`);

    // Budget: Node layout for 64 dense measures must complete in < 60ms p95
    expect(p95).toBeLessThan(60);
  });
});
