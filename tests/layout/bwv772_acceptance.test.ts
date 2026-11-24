// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * M7b-5 acceptance, Bach BWV 772 mm. 1-7: the hand-entered excerpt (see the fixture header for the
 * source and policy) must lay out, play and round-trip correctly. Literal numbers on purpose: they
 * come from the entered score, not from the code under test.
 */
import { describe, expect, it } from 'vitest';
import type { Score } from '../../src/core/model';
import { validateScore } from '../../src/core/validate';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { getItemRect } from '../../src/layout/mouse';
import { layoutScore } from '../../src/layout/layoutScore';
import type { LayoutItem, LayoutSystem } from '../../src/layout/types';
import { buildSchedule } from '../../src/playback/schedule';
import { buildBwv772Mm1to7 } from '../fixtures/bwv772Mm1to7';

const MEASURE_TICKS = 3840;
const WIDTHS = [100, 140, 200];

const ticksByEvent = (score: Score, staffIndex: number): Map<string, number> => {
  const out = new Map<string, number>();
  for (const m of score.measures) {
    let tick = 0;
    for (const ev of score.parts[0].staves[staffIndex].measures[m.id].voices[0].events) {
      out.set(ev.id, tick);
      tick += ev.duration;
    }
  }
  return out;
};

const noteheads = (sys: LayoutSystem, staffId: string): LayoutItem[] =>
  sys.items.filter((i) => i.staffId === staffId && i.eventId && i.id === i.eventId && i.glyph?.startsWith('notehead'));

describe('M7b-5 acceptance: Bach BWV 772 mm. 1-7', () => {
  it('A1: the fixture is a valid grand staff of 7 measures, each exactly 3840 ticks in both hands', () => {
    const score = buildBwv772Mm1to7();
    expect(validateScore(score)).toEqual([]);
    expect(score.measures).toHaveLength(7);
    expect(score.parts[0].staves).toHaveLength(2);
    for (const staff of score.parts[0].staves) {
      for (const m of score.measures) {
        const total = staff.measures[m.id].voices[0].events.reduce((t, e) => t + e.duration, 0);
        expect(total).toBe(MEASURE_TICKS);
      }
    }
  });

  for (const width of WIDTHS) {
    it(`A2 (width ${width}): no two noteheads of a staff overlap and the two staves never touch`, () => {
      const score = buildBwv772Mm1to7();
      const layout = layoutScore(score, { width });
      expect(layout.systems.length).toBeGreaterThan(0);
      for (const sys of layout.systems) {
        for (const staff of score.parts[0].staves) {
          const heads = noteheads(sys, staff.id).map(getItemRect);
          for (let i = 0; i < heads.length; i++) {
            for (let j = i + 1; j < heads.length; j++) {
              const a = heads[i];
              const b = heads[j];
              const overlap = a.x1 < b.x2 - 1e-6 && b.x1 < a.x2 - 1e-6 && a.y1 < b.y2 - 1e-6 && b.y1 < a.y2 - 1e-6;
              expect(overlap, `noteheads ${i}/${j} overlap in system ${sys.index}`).toBe(false);
            }
          }
        }
        const own = (k: number) =>
          sys.items.filter((it) => it.staffId === sys.staves[k].id && !it.hidden && it.glyph !== 'brace');
        for (const a of own(0)) {
          const ra = getItemRect(a);
          for (const b of own(1)) {
            const rb = getItemRect(b);
            if (ra.x1 < rb.x2 && rb.x1 < ra.x2) expect(ra.y2 + 1.5).toBeLessThanOrEqual(rb.y1 + 1e-9);
          }
        }
      }
    });
  }

  it('A3: events that start on the same tick in both hands share one x (aligned columns)', () => {
    const score = buildBwv772Mm1to7();
    const layout = layoutScore(score, { width: 100 });
    const upperTick = ticksByEvent(score, 0);
    const lowerTick = ticksByEvent(score, 1);
    const [treble, bass] = score.parts[0].staves;
    let shared = 0;
    for (const sys of layout.systems) {
      const upperX = new Map(noteheads(sys, treble.id).map((i) => [i.eventId!, i.x]));
      const lowerX = new Map(noteheads(sys, bass.id).map((i) => [i.eventId!, i.x]));
      for (const m of score.measures) {
        const lowerByTick = new Map<number, number>();
        for (const ev of bass.measures[m.id].voices[0].events) {
          if (lowerX.has(ev.id)) lowerByTick.set(lowerTick.get(ev.id)!, lowerX.get(ev.id)!);
        }
        for (const ev of treble.measures[m.id].voices[0].events) {
          const ux = upperX.get(ev.id);
          const lx = lowerByTick.get(upperTick.get(ev.id)!);
          if (ux !== undefined && lx !== undefined) {
            expect(ux).toBeCloseTo(lx, 9);
            shared++;
          }
        }
      }
    }
    expect(shared).toBeGreaterThan(40);
  });

  it('A4: every system has barlines drawn once, from the top of the treble staff to the bottom of the bass staff', () => {
    const score = buildBwv772Mm1to7();
    for (const width of WIDTHS) {
      for (const sys of layoutScore(score, { width }).systems) {
        const through = sys.items.filter((i) => i.kind === 'line' && !i.staffId && i.y === 0 && i.y2 !== undefined && i.y2 > 4);
        expect(through.length).toBeGreaterThanOrEqual(2);
        // Item y is relative to the system; the bass staff starts (staves[1].y - staves[0].y) lower.
        const bottom = sys.staves[1].y - sys.staves[0].y + 4;
        for (const bar of through) expect(bar.y2).toBeCloseTo(bottom, 9);
      }
    }
  });

  it('A5: half-bar beaming as in the edition: LH m.3 gives two groups of four, LH m.2 keeps its pair', () => {
    const score = buildBwv772Mm1to7();
    const layout = layoutScore(score, { width: 100 });
    const bass = score.parts[0].staves[1];
    const groupSizes = (measureIndex: number): number[] => {
      const ids = new Set(bass.measures[score.measures[measureIndex].id].voices[0].events.map((e) => e.id));
      const sizes: number[] = [];
      for (const sys of layout.systems) {
        for (const it of sys.items) {
          if (it.kind === 'beam' && it.level === 1 && it.eventIds?.every((id) => ids.has(id))) sizes.push(it.eventIds.length);
        }
      }
      return sizes;
    };
    expect(groupSizes(2)).toEqual([4, 4]); // m.3: C B C D | E G A B
    expect(groupSizes(1)).toEqual([2, 3, 4]); // m.2: G G pair, then 16th rest + 3 notes, then 4 notes
  });

  it('A6: playback lasts 14 s at 120 bpm, sounds 152 notes, and the tied C4 of mm. 4-5 is one note of 0.625 s', () => {
    const sched = buildSchedule(buildBwv772Mm1to7());
    expect(sched.totalSeconds).toBeCloseTo(14, 9);
    expect(sched.notes).toHaveLength(152);
    const first = [...sched.notes].sort((a, b) => a.startSeconds - b.startSeconds)[0];
    expect(first.midi).toBe(60); // C4 (middle C), after the 16th rest
    expect(first.startSeconds).toBeCloseTo(0.125, 9);
    const tied = sched.notes.filter((n) => n.midi === 60 && Math.abs(n.startSeconds - 7.5) < 1e-9);
    expect(tied).toHaveLength(1);
    expect(tied[0].durationSeconds).toBeCloseTo(0.625, 9);
  });

  it('A7: save and load keep every event and the beam setting, and the layout stays identical', () => {
    const score = buildBwv772Mm1to7();
    const loaded = deserializeScore(serializeScore(score));
    expect(loaded.layoutSettings?.beamGrouping).toBe('half-bar');
    const sig = (s: Score) =>
      s.parts[0].staves.map((st) =>
        s.measures.map((m) =>
          st.measures[m.id].voices[0].events.map((e) =>
            e.kind === 'note'
              ? `${e.pitches.map((p) => `${p.step}${p.alter}${p.octave}`).join(',')}/${e.duration}${e.tiedToNext ? '~' : ''}`
              : `r/${e.duration}`
          )
        )
      );
    expect(sig(loaded)).toEqual(sig(score));
    const a = layoutScore(score, { width: 100 });
    const b = layoutScore(loaded, { width: 100 });
    expect(b.systems.map((s) => s.items.length)).toEqual(a.systems.map((s) => s.items.length));
    expect(b.height).toBeCloseTo(a.height, 9);
  });

  it('A8: in every system (justified or not) each stem sits on the edge of its notehead', () => {
    const score = buildBwv772Mm1to7();
    let stems = 0;
    for (const width of WIDTHS) {
      for (const sys of layoutScore(score, { width }).systems) {
        const byId = new Map(sys.items.map((i) => [i.id, i]));
        for (const it of sys.items) {
          if (!it.id.endsWith('-stem') || !it.eventId) continue;
          const head = byId.get(it.eventId)!;
          const off = it.x - head.x;
          expect(Math.abs(off) < 1e-6 || Math.abs(off - 1.18) < 1e-6, `offset ${off}`).toBe(true);
          stems++;
        }
      }
    }
    expect(stems).toBeGreaterThan(300);
  });

  it('A9: the time signature is written as common time (C)', () => {
    const score = buildBwv772Mm1to7();
    expect(score.measures.every((m) => m.timeSig.num === 4 && m.timeSig.den === 4 && m.timeSigDisplay === 'common')).toBe(true);
  });

  it('A10: the four ornament signs sit on B4 (m. 1), F5 (m. 2), the dotted C5 (m. 5) and B4 (m. 6), nowhere else', () => {
    const score = buildBwv772Mm1to7();
    const found: string[] = [];
    score.parts[0].staves.forEach((staff, st) =>
      score.measures.forEach((m, mi) =>
        staff.measures[m.id].voices[0].events.forEach((e, i) => {
          if (e.kind === 'note' && e.ornament) found.push(`${st}:${mi + 1}.${i}:${e.ornament}:${e.pitches[0].step}${e.pitches[0].octave}`);
        })
      )
    );
    expect(found).toEqual(['0:1.10:trill:B4', '0:2.10:trill:F5', '0:5.2:trill:C5', '0:6.13:trill:B4']);
  });

  it('A11: the first right-hand run of m. 1 starts on middle C (C4 D4 E4 F4 D4 E4 C4), as in the edition', () => {
    const score = buildBwv772Mm1to7();
    const evs = score.parts[0].staves[0].measures[score.measures[0].id].voices[0].events;
    expect(evs.map((e) => (e.kind === 'note' ? `${e.pitches[0].step}${e.pitches[0].octave}` : 'r')).slice(0, 8)).toEqual([
      'r', 'C4', 'D4', 'E4', 'F4', 'D4', 'E4', 'C4',
    ]);
  });
});
