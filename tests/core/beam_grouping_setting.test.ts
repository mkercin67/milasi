// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { History, setBeamGrouping } from '../../src/core/commands';
import { createEmptyScore } from '../../src/core/factory';
import type { Score } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';

describe('M7b-7: beamGrouping score setting', () => {
  it('G7: setBeamGrouping is one undo step, redoable, and round-trips through save/load', () => {
    const history = new History(createEmptyScore({ measures: 2 }));
    expect(history.score.layoutSettings).toBeUndefined();

    history.do(setBeamGrouping('half-bar'));
    expect(history.score.layoutSettings?.beamGrouping).toBe('half-bar');

    const loaded = deserializeScore(serializeScore(history.score));
    expect(loaded.layoutSettings?.beamGrouping).toBe('half-bar');

    const undone = history.undo();
    expect(undone?.layoutSettings).toBeUndefined();
    const redone = history.redo();
    expect(redone?.layoutSettings?.beamGrouping).toBe('half-bar');
  });

  it('G7b: the default mode is stored as an absent field, so old files stay byte-identical', () => {
    const score = createEmptyScore({ measures: 1 });
    const withMode = setBeamGrouping('half-bar').apply(score);
    const back = setBeamGrouping('beat').apply(withMode);
    expect(back.layoutSettings).toBeUndefined();
    expect(serializeScore(back, undefined, false)).toBe(serializeScore(score, undefined, false));
  });

  it('G7c: validateScore rejects an unknown beam grouping mode', () => {
    const score = createEmptyScore({ measures: 1 });
    expect(validateScore(score).filter((p) => p.severity === 'error')).toHaveLength(0);
    const bad = { ...score, layoutSettings: { beamGrouping: 'quarter-bar' } } as unknown as Score;
    const codes = validateScore(bad).map((p) => p.code);
    expect(codes).toContain('invalid-beam-grouping');
  });
});
