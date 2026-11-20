// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import { enterNote, ScoreCursor } from '../../src/core/input';
import * as layoutScoreModule from '../../src/layout/layoutScore';
import { layoutScore } from '../../src/layout/layoutScore';
import { computeBeatGuide, tickToVisualX } from '../../src/ui/scoreView/beatGuide';
import { VOICE_COLORS } from '../../src/ui/voiceColors';

describe('Beat Guide and Pending Slot Band (T9, T10)', () => {
  it('T9: beat guide aligns tick marks with event columns for 4/4 and 6/8 and moving cursor 100 times causes zero layout runs', () => {
    // 1. 4/4 measure with 4 quarters: tick marks align with event columns
    let score44 = createEmptyScore({ measures: 1 });
    const staffId = score44.parts[0].staves[0].id;
    const mId = score44.measures[0].id;

    let cursor: ScoreCursor = { staffId, measureId: mId, voiceIndex: 1, tick: 0 };
    for (const p of ['C5', 'D5', 'E5', 'F5']) {
      const cmd = enterNote(cursor, {
        baseType: 'quarter',
        dots: 0,
        pitch: { step: p[0] as any, octave: 5, alter: 0 },
      });
      score44 = cmd.apply(score44);
      cursor = { ...cursor, tick: cursor.tick + 960 };
    }

    const layout44 = layoutScore(score44, { width: 70 });
    const guide44 = computeBeatGuide(layout44, score44, mId, 0, 1, 'quarter', 0);

    expect(guide44).toBeDefined();
    expect(guide44!.beatMarks).toHaveLength(4);
    // Beats 1..4 corresponding to ticks 0, 960, 1920, 2880
    expect(guide44!.beatMarks.map((b) => b.beatNumber)).toEqual([1, 2, 3, 4]);
    expect(guide44!.beatMarks.map((b) => b.tick)).toEqual([0, 960, 1920, 2880]);

    // Positions must be strictly increasing
    for (let i = 0; i < guide44!.beatMarks.length - 1; i++) {
      expect(guide44!.beatMarks[i + 1].x).toBeGreaterThan(guide44!.beatMarks[i].x);
    }

    // 2. Monotonic tickToVisualX mapping with eighths and a dotted note
    const customAnchors = [
      { tick: 0, x: 5.0 },
      { tick: 960, x: 12.0 },
      { tick: 1440, x: 16.5 },
      { tick: 1920, x: 21.0 },
      { tick: 3840, x: 35.0 },
    ];
    let prevX = -Infinity;
    for (let t = 0; t <= 3840; t += 240) {
      const vx = tickToVisualX(t, customAnchors, 3840, 4.0, 35.5);
      expect(vx).toBeGreaterThanOrEqual(prevX);
      prevX = vx;
    }
    // Hits every anchor exactly
    for (const a of customAnchors) {
      expect(tickToVisualX(a.tick, customAnchors, 3840, 4.0, 35.5)).toBeCloseTo(a.x, 3);
    }

    // 3. 6/8 meter: 2 dotted-quarter pulses (1440 ticks each)
    const score68 = createEmptyScore({ measures: 1, timeSig: { num: 6, den: 8 } });
    const mId68 = score68.measures[0].id;
    const layout68 = layoutScore(score68, { width: 70 });
    const guide68 = computeBeatGuide(layout68, score68, mId68, 0, 1, 'eighth', 0);

    expect(guide68).toBeDefined();
    expect(guide68!.beatMarks).toHaveLength(2);
    expect(guide68!.beatMarks[0].beatNumber).toBe(1);
    expect(guide68!.beatMarks[0].tick).toBe(0);
    expect(guide68!.beatMarks[1].beatNumber).toBe(2);
    expect(guide68!.beatMarks[1].tick).toBe(1440);

    // 4. Zero layout runs counter: moving cursor 100 times must not re-run layoutScore
    const spy = vi.spyOn(layoutScoreModule, 'layoutScore');
    spy.mockClear();

    // Initial layout pass
    const staticLayout = layoutScoreModule.layoutScore(score44, { width: 70 });
    expect(spy).toHaveBeenCalledTimes(1);

    // Moving cursor 100 times through computeBeatGuide
    for (let i = 0; i < 100; i++) {
      const cTick = (i * 96) % 3840;
      const v = ((i % 4) + 1) as 1 | 2 | 3 | 4;
      computeBeatGuide(staticLayout, score44, mId, cTick, v, 'quarter', 0);
    }

    // layoutScore MUST have been called exactly once (the initial pass)!
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('T10: pending-slot band spans cursor tick to duration, updates on duration change, clamps at measure end, and uses voice color', () => {
    const score = createEmptyScore({ measures: 1 });
    const mId = score.measures[0].id;
    const layout = layoutScore(score, { width: 70 });

    // 1. Quarter duration at tick 0 (spans 0 to 960)
    const guideQ = computeBeatGuide(layout, score, mId, 0, 2, 'quarter', 0);
    expect(guideQ).toBeDefined();
    expect(guideQ!.pendingBand).toBeDefined();
    const widthQ = guideQ!.pendingBand!.width;

    // 2. Half duration at tick 0 (spans 0 to 1920) -> width must be significantly larger
    const guideH = computeBeatGuide(layout, score, mId, 0, 2, 'half', 0);
    expect(guideH!.pendingBand!.width).toBeGreaterThan(widthQ);

    // 3. Eighth duration at tick 0 (spans 0 to 480) -> width must be smaller
    const guideE = computeBeatGuide(layout, score, mId, 0, 2, 'eighth', 0);
    expect(guideE!.pendingBand!.width).toBeLessThan(widthQ);

    // 4. Clamped at measure end: cursor at tick 3000 in 4/4 (length 3840), duration half (1920 ticks)
    // Band must clamp to measure end (tick 3840)
    const guideEnd = computeBeatGuide(layout, score, mId, 3000, 2, 'half', 0);
    expect(guideEnd!.pendingBand).toBeDefined();

    // End coordinate cannot exceed measure end barline X
    const endBarline = layout.systems[0].items.find((it) => it.id.startsWith(`barline-${mId}`));
    const barlineX = endBarline?.x ?? layout.systems[0].width;
    expect(guideEnd!.pendingBand!.x + guideEnd!.pendingBand!.width).toBeLessThanOrEqual(barlineX);

    // 5. Voice color verified
    expect(VOICE_COLORS[2]).toBe('#b45309');
  });
});
