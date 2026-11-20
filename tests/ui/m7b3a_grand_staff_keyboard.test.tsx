// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGrandStaffScore, createNote, createPitch, createEmptyScore } from '../../src/core/factory';
import { getLastNotePitchBeforeCursor, moveCursorToStaff } from '../../src/core/input';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { computeCursorPosition } from '../../src/layout/cursor';
import { layoutScore } from '../../src/layout/layoutScore';
import { buildSchedule } from '../../src/playback/schedule';
import { computeBeatGuide } from '../../src/ui/scoreView/beatGuide';
import { I18nProvider } from '../../src/ui/i18n';
import { getCompleteKeyTable, mapKeyEvent } from '../../src/ui/keymap';
import { NewScoreModal } from '../../src/ui/NewScoreModal';
import { StatusBar } from '../../src/ui/StatusBar';

function piano() {
  const score = createGrandStaffScore({ measures: 2 });
  const [upper, lower] = score.parts[0].staves;
  const m1 = score.measures[0].id;
  upper.measures[m1].voices[0].events = [0, 1, 2, 3].map((i) =>
    createNote({ pitches: [createPitch('CDEF'[i] as 'C', 5)], baseType: 'quarter' })
  );
  lower.measures[m1].voices[0].events = [
    createNote({ pitches: [createPitch('C', 3)], baseType: 'half' }),
    createNote({ pitches: [createPitch('G', 2)], baseType: 'half' }),
  ];
  return { score, upper, lower, m1 };
}

describe('M7b-3a grand staff: keyboard, status bar, playback, save/load', () => {
  it('K1: BracketLeft / BracketRight map to staff-up / staff-down in input mode only, without modifiers', () => {
    expect(mapKeyEvent({ code: 'BracketLeft' }, 'input')).toBe('staff-up');
    expect(mapKeyEvent({ code: 'BracketRight' }, 'input')).toBe('staff-down');
    expect(mapKeyEvent({ code: 'BracketLeft' }, 'select')).toBeNull();
    expect(mapKeyEvent({ code: 'BracketRight' }, 'position')).toBeNull();
    for (const mod of [{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      expect(mapKeyEvent({ code: 'BracketLeft', ...mod }, 'input')).not.toBe('staff-up');
      expect(mapKeyEvent({ code: 'BracketRight', ...mod }, 'input')).not.toBe('staff-down');
    }
  });

  it('K2: the key table documents both staff keys for input mode', () => {
    const table = getCompleteKeyTable();
    expect(table.some((e) => e.code === 'BracketLeft' && e.mode === 'input' && e.action === 'staff-up')).toBe(true);
    expect(table.some((e) => e.code === 'BracketRight' && e.mode === 'input' && e.action === 'staff-down')).toBe(true);
  });

  it('K3: the piano template is a valid score: two staves, brace group, a rest in every staff-measure', () => {
    const score = createGrandStaffScore({ measures: 3 });
    expect(validateScore(score).filter((p) => p.severity === 'error')).toEqual([]);
    expect(score.parts[0].staves.map((s) => s.clef.sign)).toEqual(['G', 'F']);
    expect(score.groups).toHaveLength(1);
    expect(score.groups[0].bracket).toBe('brace');
    for (const st of score.parts[0].staves) {
      for (const m of score.measures) expect(st.measures[m.id].voices[0].events).toHaveLength(1);
    }
  });

  it('K4: after switching to the bass staff the pitch context comes from the bass staff, not the treble staff', () => {
    const { score, upper, lower, m1 } = piano();
    const onUpper = { staffId: upper.id, voiceIndex: 1 as const, measureId: m1, tick: 1920 };
    expect(getLastNotePitchBeforeCursor(score, onUpper)?.octave).toBe(5);
    const onLower = moveCursorToStaff(score, onUpper, 'down');
    expect(onLower.staffId).toBe(lower.id);
    expect(getLastNotePitchBeforeCursor(score, onLower)).toMatchObject({ step: 'C', octave: 3 });
  });

  it('K5: the caret and the beat guide of the bass staff sit 11 sp (4 + 7) below those of the treble staff', () => {
    const { score, upper, lower, m1 } = piano();
    const layout = layoutScore(score, { width: 100 });
    const top = computeCursorPosition(layout, score, { staffId: upper.id, voiceIndex: 1, measureId: m1, tick: 0 })!;
    const bottom = computeCursorPosition(layout, score, { staffId: lower.id, voiceIndex: 1, measureId: m1, tick: 0 })!;
    expect(bottom.y1 - top.y1).toBeCloseTo(11, 9);
    expect(bottom.y2 - bottom.y1).toBeCloseTo(4, 9);
    expect(bottom.x).toBeCloseTo(top.x, 9); // same tick, same column
    const gTop = computeBeatGuide(layout, score, m1, 0, 1, 'quarter', 0, upper.id)!;
    const gBottom = computeBeatGuide(layout, score, m1, 0, 1, 'quarter', 0, lower.id)!;
    expect(gBottom.sysY - gTop.sysY).toBeCloseTo(11, 9);
    expect(gBottom.pendingBand!.y - gTop.pendingBand!.y).toBeCloseTo(11, 9);
  });

  it('K6: the status bar shows "Porte 2/2" (tr) / "Staff 2/2" (en) in input mode on a grand staff, and nothing on one staff', () => {
    const render = (lang: 'tr' | 'en', staffInfo: { index: number; total: number } | null) =>
      renderToStaticMarkup(
        <I18nProvider initialLanguage={lang}>
          <StatusBar
            selection={null}
            mode="input"
            activeDuration="quarter"
            currentMeasureNumber={1}
            currentTick={0}
            timeSig={{ num: 4, den: 4 }}
            voiceIndex={1}
            staffInfo={staffInfo}
          />
        </I18nProvider>
      );
    expect(render('tr', { index: 2, total: 2 })).toContain('Porte 2/2');
    expect(render('en', { index: 2, total: 2 })).toContain('Staff 2/2');
    expect(render('tr', { index: 1, total: 1 })).not.toContain('status-staff-indicator');
    expect(render('tr', null)).not.toContain('status-staff-indicator');
  });

  it('K7: the New Score dialog offers the single-staff and piano templates', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLanguage="tr">
        <NewScoreModal isOpen canUndo={false} onClose={() => undefined} onCreate={() => undefined} />
      </I18nProvider>
    );
    expect(html).toContain('data-testid="template-single"');
    expect(html).toContain('data-testid="template-piano"');
    expect(html).toContain('Piyano (büyük porte)');
    expect(html).toContain('Tek porte');
  });

  it('K8: playback schedules the notes of both staves in time order and lasts as long as the score', () => {
    const { score } = piano();
    const schedule = buildSchedule(score);
    const times = schedule.notes.map((n) => n.startSeconds);
    expect(schedule.notes).toHaveLength(6); // 4 treble quarters + 2 bass halves
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // bass C3 (MIDI 48) and treble C5 (MIDI 72) both start at 0
    const atZero = schedule.notes.filter((n) => n.startSeconds === 0).map((n) => n.midi).sort((a, b) => a - b);
    expect(atZero).toEqual([48, 72]);
    expect(schedule.totalSeconds).toBeCloseTo(4.0, 6); // 2 measures of 4/4 at 120 bpm
  });

  it('K9: a two-staff score round-trips through save and load (staves, clefs, group, notes)', () => {
    const { score } = piano();
    const loaded = deserializeScore(serializeScore(score));
    expect(loaded.parts[0].staves.map((s) => s.clef.sign)).toEqual(['G', 'F']);
    expect(loaded.groups[0].bracket).toBe('brace');
    expect(JSON.stringify(loaded.parts[0].staves)).toBe(JSON.stringify(score.parts[0].staves));
    expect(validateScore(loaded).filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('K10: a single-staff score is not affected: staff switching keeps the cursor, no status indicator data', () => {
    const single = createEmptyScore({ measures: 1 });
    const st = single.parts[0].staves[0].id;
    const c = { staffId: st, voiceIndex: 1 as const, measureId: single.measures[0].id, tick: 0 };
    expect(moveCursorToStaff(single, c, 'down')).toEqual(c);
    expect(moveCursorToStaff(single, c, 'up')).toEqual(c);
  });
});
