// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-6 benchmark card: a 50-measure string quartet (200 measure-staves) stays fast when one note changes.
// In isolation the p95 is about 9 ms (design gate: p95 <= 30 ms). The full suite runs test files in parallel,
// so, like h1_perf and m6b_perf_benchmark, this test gates on the median and a loose p95 that tolerate load.
import { describe, expect, it } from 'vitest';
import { applyTemplate } from '../../src/core/ensembleCommands';
import { deleteEvent, insertNote } from '../../src/core/commands';
import { pasteLyrics } from '../../src/core/notationCommands';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import type { Score } from '../../src/core/model';
import { layoutScore } from '../../src/layout/layoutScore';

const quarter = (octave = 4) => createNote({ pitches: [createPitch('C', octave)], baseType: 'quarter' });

function filledQuartet(): Score {
  let score = applyTemplate('stringQuartet').apply(createEmptyScore({ measures: 50 }));
  for (const p of score.parts) {
    for (const st of p.staves) {
      for (const m of score.measures) {
        const rest = st.measures[m.id].voices[0].events[0].id;
        for (let i = 0; i < 4; i++) {
          score = insertNote({ partId: p.id, staffId: st.id, measureId: m.id, voiceIndex: 1, index: i, event: quarter() }).apply(score);
        }
        score = deleteEvent(rest).apply(score);
      }
    }
  }
  return score;
}

describe('M7c-6 ensemble performance', () => {
  it('EP-PERF: relayout after one note change in a 50-measure quartet stays within budget (median <= 15 ms, p95 <= 60 ms under load)', () => {
    const score = filledQuartet();
    const opts = { width: 100 };
    for (let i = 0; i < 3; i++) layoutScore(score, opts); // warm caches and the JIT, as in a running editor
    const part = score.parts[2];
    const staff = part.staves[0];
    const measureId = score.measures[20].id;
    const lastId = staff.measures[measureId].voices[0].events[3].id;
    const times: number[] = [];
    for (let i = 0; i < 30; i++) {
      const ev = createNote({ pitches: [createPitch('D', 4 + (i % 2))], baseType: 'quarter' });
      let next = insertNote({ partId: part.id, staffId: staff.id, measureId, voiceIndex: 1, index: 0, event: ev }).apply(score);
      next = deleteEvent(lastId).apply(next);
      const t0 = performance.now();
      layoutScore(next, opts);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95) - 1];
    console.log(`[PERF] 50-measure quartet relayout: median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`);
    expect(median).toBeLessThanOrEqual(15);
    expect(p95).toBeLessThanOrEqual(60);
  });
  it('EP-PERF2: the same relayout with three lyric verses under every note of every staff (M7c-9f gate)', () => {
    let score = filledQuartet();
    const text = Array.from({ length: 200 }, (_, i) => `w${i}`).join(' ');
    for (const p of score.parts) {
      for (const st of p.staves) {
        const first = st.measures[score.measures[0].id].voices[0].events[0].id;
        for (const verse of [1, 2, 3]) score = pasteLyrics(first, text, undefined, verse).apply(score);
      }
    }
    const opts = { width: 100 };
    for (let i = 0; i < 3; i++) layoutScore(score, opts);
    const part = score.parts[2];
    const staff = part.staves[0];
    const measureId = score.measures[20].id;
    const lastId = staff.measures[measureId].voices[0].events[3].id;
    const times: number[] = [];
    for (let i = 0; i < 30; i++) {
      const ev = createNote({ pitches: [createPitch('D', 4 + (i % 2))], baseType: 'quarter' });
      let next = insertNote({ partId: part.id, staffId: staff.id, measureId, voiceIndex: 1, index: 0, event: ev }).apply(score);
      next = deleteEvent(lastId).apply(next);
      const t0 = performance.now();
      layoutScore(next, opts);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95) - 1];
    console.log(`[PERF] 50-measure quartet with 3 verses relayout: median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`);
    // Under the parallel suite the median was 21.5 ms on the owner's machine (10.7 ms in isolation on the review VM), so the
    // gates here are looser than EP-PERF; the design gate (p95 <= 30 ms) is checked in isolation, see m7c-9-acceptance.md.
    expect(median).toBeLessThanOrEqual(35);
    expect(p95).toBeLessThanOrEqual(90);
  });
});
