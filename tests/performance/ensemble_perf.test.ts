// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-6 benchmark card: a 50-measure string quartet (200 measure-staves) stays fast when one note changes.
import { describe, expect, it } from 'vitest';
import { applyTemplate } from '../../src/core/ensembleCommands';
import { deleteEvent, insertNote } from '../../src/core/commands';
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
  it('EP-PERF: relayout after one note change in a 50-measure quartet has p95 <= 30 ms', () => {
    const score = filledQuartet();
    const opts = { width: 100 };
    layoutScore(score, opts); // warm the measure and system caches, as the editor has them
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
    const p95 = times[Math.floor(times.length * 0.95) - 1];
    console.log(`[PERF] 50-measure quartet relayout p95: ${p95.toFixed(2)} ms`);
    expect(p95).toBeLessThanOrEqual(30);
  });
});
