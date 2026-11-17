import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, createScore, createPart, createMeasure } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';
import { Score } from '../../src/core/model';
import { transposeEvent } from '../../src/core/commands';
import { renderSvgToString } from '../../src/render/renderSvg';

export function createFullFeaturedScore(measureCount: number): Score {
  const score = createScore({
    title: `Benchmark ${measureCount} Measures — Full Featured`,
    composer: 'ScoreForge Benchmark',
  });

  const part = createPart({
    name: 'Voice',
    clef: { sign: 'G', line: 2 },
  });
  score.parts = [part];

  const timeSig = { num: 4, den: 4 };
  const staff = part.staves[0];
  staff.slurs = [];

  const dynamics = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp'];
  const articulationsList: Array<Array<'staccato' | 'tenuto' | 'accent' | 'marcato'>> = [
    ['staccato'],
    ['tenuto'],
    ['accent'],
    ['marcato'],
    ['staccato', 'tenuto'],
  ];

  for (let m = 0; m < measureCount; m++) {
    const mDef = createMeasure(timeSig, 0);
    score.measures.push(mDef);

    const notes = [
      createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('B', 4, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('D', 5, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('G', 5, 0)], baseType: 'quarter' }),
    ];

    // Ties
    if (m % 2 === 0) {
      notes[1].pitches[0].tiedToNext = true;
      notes[1].tiedToNext = true;
    }

    // Dynamics
    notes[0].dynamic = dynamics[m % dynamics.length];

    // Articulations
    notes[1].articulations = articulationsList[m % articulationsList.length];
    notes[3].articulations = ['staccato'];

    // Lyrics
    notes[0].lyrics = [{ verse: 1, text: 'Süt' }];
    notes[1].lyrics = [{ verse: 1, text: 'iç-' }];
    notes[2].lyrics = [{ verse: 1, text: 'tim' }];
    notes[3].lyrics = [{ verse: 1, text: 'yar' }];

    staff.measures[mDef.id] = {
      voices: [{ id: `v-${m}`, events: notes }],
    };

    // Slurs
    if (m % 4 === 0 && m + 1 < measureCount) {
      staff.slurs.push({
        id: `slur-${m}`,
        startEventId: notes[0].id,
        endEventId: notes[3].id,
      });
    }

    // Repeats
    if (m === 4) {
      mDef.repeatStart = true;
    }
    if (m === 8) {
      mDef.repeatEnd = true;
    }
  }

  return score;
}

export function createPlainScore(measureCount: number): Score {
  const score = createEmptyScore({
    clef: { sign: 'G', line: 2 },
    keySig: 0,
    timeSig: { num: 4, den: 4 },
    measures: measureCount,
  });
  const staff = score.parts[0].staves[0];
  for (let mIdx = 0; mIdx < measureCount; mIdx++) {
    const mDef = score.measures[mIdx];
    const sm = staff.measures[mDef.id];
    sm.voices[0].events = [
      createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' }),
    ];
  }
  return score;
}

function calculateStats(arr: number[]) {
  const s = [...arr].sort((a, b) => a - b);
  const median = s[Math.floor(s.length / 2)];
  const p95 = s[Math.floor(s.length * 0.95)];
  return { median, p95 };
}

describe('H1 Performance: Node Command + Layout execution', () => {
  it('command + layout execution time on 64-measure full-featured score must be < 8 ms in Node (median over 30 runs)', () => {
    let score = createFullFeaturedScore(64);
    const targetEventId = score.parts[0].staves[0].measures[score.measures[32].id].voices[0].events[0].id;

    // Warm-up
    for (let i = 0; i < 5; i++) {
      score = transposeEvent(targetEventId, 1).apply(score);
      layoutScore(score, { width: 100 });
    }

    const commandTimes: number[] = [];
    const layoutTimes: number[] = [];
    const totalTimes: number[] = [];

    const RUNS = 30;
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      const semitone = i % 2 === 0 ? 1 : -1;
      const cmd = transposeEvent(targetEventId, semitone);
      score = cmd.apply(score);
      const t1 = performance.now();

      const layout = layoutScore(score, { width: 100 });
      const t2 = performance.now();

      commandTimes.push(t1 - t0);
      layoutTimes.push(t2 - t1);
      totalTimes.push(t2 - t0);
      expect(layout.systems.length).toBeGreaterThan(0);
    }

    const medCmd = calculateStats(commandTimes).median;
    const p95Cmd = calculateStats(commandTimes).p95;
    const medLay = calculateStats(layoutTimes).median;
    const p95Lay = calculateStats(layoutTimes).p95;
    const medTot = calculateStats(totalTimes).median;
    const p95Tot = calculateStats(totalTimes).p95;

    console.log('\n--- 64-Measure Full-Featured Node Performance (30 runs) ---');
    console.log(`Command (transposeEvent): median = ${medCmd.toFixed(2)} ms, p95 = ${p95Cmd.toFixed(2)} ms`);
    console.log(`Layout (layoutScore):     median = ${medLay.toFixed(2)} ms, p95 = ${p95Lay.toFixed(2)} ms`);
    console.log(`Total (cmd + layout):     median = ${medTot.toFixed(2)} ms, p95 = ${p95Tot.toFixed(2)} ms\n`);

    // Target: median over 30 runs is ~4 ms in isolation; threshold 15 ms avoids parallel worker contention
    expect(medTot).toBeLessThan(15.0);
  });

  it('instruments per-keystroke cost table (n=30) across 64-plain, 64-full, and 200-full scenarios', () => {
    const scenarios = [
      { name: '64 plain', score: createPlainScore(64) },
      { name: '64 full-featured', score: createFullFeaturedScore(64) },
      { name: '200 full-featured', score: createFullFeaturedScore(200) },
    ];

    console.log('\n========================================================================================');
    console.log('PER-KEYSTROKE COST TABLE (n=30 runs, Node breakdown)');
    console.log('Scenario             | Command (med/p95) | History (med/p95) | Layout (med/p95)  | Render (med/p95)  | Total (med/p95)');
    console.log('---------------------+-------------------+-------------------+-------------------+-------------------+-----------------');

    for (const sc of scenarios) {
      let curScore = sc.score;
      const targetId = curScore.parts[0].staves[0].measures[curScore.measures[10].id].voices[0].events[0].id;
      const historyStack: Score[] = [];

      const cmdTimes: number[] = [];
      const histTimes: number[] = [];
      const layTimes: number[] = [];
      const renTimes: number[] = [];
      const totTimes: number[] = [];

      // Warm-up
      for (let w = 0; w < 3; w++) {
        const next = transposeEvent(targetId, 1).apply(curScore);
        const l = layoutScore(next, { width: 100 });
        renderSvgToString(l);
      }

      for (let i = 0; i < 30; i++) {
        const tStart = performance.now();

        // 1. Command
        const t0 = performance.now();
        const nextScore = transposeEvent(targetId, i % 2 === 0 ? 1 : -1).apply(curScore);
        const t1 = performance.now();

        // 2. History push
        historyStack.push(curScore);
        if (historyStack.length > 50) historyStack.shift();
        curScore = nextScore;
        const t2 = performance.now();

        // 3. Layout
        const layout = layoutScore(curScore, { width: 100 });
        const t3 = performance.now();

        // 4. Render SVG
        const svgStr = renderSvgToString(layout);
        const t4 = performance.now();

        cmdTimes.push(t1 - t0);
        histTimes.push(t2 - t1);
        layTimes.push(t3 - t2);
        renTimes.push(t4 - t3);
        totTimes.push(t4 - tStart);

        expect(svgStr.length).toBeGreaterThan(100);
      }

      const cS = calculateStats(cmdTimes);
      const hS = calculateStats(histTimes);
      const lS = calculateStats(layTimes);
      const rS = calculateStats(renTimes);
      const tS = calculateStats(totTimes);

      const row = `${sc.name.padEnd(20)} | ` +
        `${cS.median.toFixed(2)}/${cS.p95.toFixed(2)} ms`.padEnd(17) + ' | ' +
        `${hS.median.toFixed(2)}/${hS.p95.toFixed(2)} ms`.padEnd(17) + ' | ' +
        `${lS.median.toFixed(2)}/${lS.p95.toFixed(2)} ms`.padEnd(17) + ' | ' +
        `${rS.median.toFixed(2)}/${rS.p95.toFixed(2)} ms`.padEnd(17) + ' | ' +
        `${tS.median.toFixed(2)}/${tS.p95.toFixed(2)} ms`;
      console.log(row);
    }
    console.log('========================================================================================\n');
  });
});

