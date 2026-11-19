// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { NoteEvent } from '../../src/core/model';
import { layoutScore } from '../../src/layout/layoutScore';
import { layoutSingleMeasure, measureLayoutCacheStats } from '../../src/layout/measureLayout';
import { layoutTies } from '../../src/layout/ties';
import { getPolyphonyGalleryCards } from '../../src/ui/polyphonyBuilders';

describe('Milestone 7a-2a: Polyphonic Layout Rules (RA - RH)', () => {
  describe('Rule RB: Shared Columns and All-Voice Cache Keys', () => {
    it('FAILING-FIRST: events of all voices starting at the same tick share the same x coordinate', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      // Voice 1: four quarter notes C5, D5, E5, F5
      const v1_n1 = createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' });
      const v1_n2 = createNote({ pitches: [createPitch('D', 5)], baseType: 'quarter' });
      const v1_n3 = createNote({ pitches: [createPitch('E', 5)], baseType: 'quarter' });
      const v1_n4 = createNote({ pitches: [createPitch('F', 5)], baseType: 'quarter' });

      // Voice 2: two half notes C4, G4
      const v2_n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'half' });
      const v2_n2 = createNote({ pitches: [createPitch('G', 4)], baseType: 'half' });

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_n1, v1_n2, v1_n3, v1_n4] },
        { id: 'v2', voiceIndex: 2, events: [v2_n1, v2_n2] },
      ];

      const layout = layoutScore(score, { width: 70 });
      const sys = layout.systems[0];

      const item_v1_n1 = sys.items.find((it) => it.id === v1_n1.id);
      const item_v2_n1 = sys.items.find((it) => it.id === v2_n1.id);
      const item_v1_n3 = sys.items.find((it) => it.id === v1_n3.id);
      const item_v2_n2 = sys.items.find((it) => it.id === v2_n2.id);

      // Both voice 1 and voice 2 noteheads must be rendered
      expect(item_v1_n1).toBeDefined();
      expect(item_v2_n1).toBeDefined();
      expect(item_v1_n3).toBeDefined();
      expect(item_v2_n2).toBeDefined();

      // Tick 0: v1_n1 and v2_n1 must share the exact same X
      expect(item_v1_n1!.x).toBeCloseTo(item_v2_n1!.x, 2);

      // Tick 1920: v1_n3 and v2_n2 must share the exact same X
      expect(item_v1_n3!.x).toBeCloseTo(item_v2_n2!.x, 2);
    });

    it('FAILING-FIRST: cache key incorporates all voices so editing voice 2 invalidates cache', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      const v1_n1 = createNote({ pitches: [createPitch('C', 5)], baseType: 'whole' });
      const v2_n1 = createNote({ pitches: [createPitch('E', 4)], baseType: 'whole' });

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_n1] },
        { id: 'v2', voiceIndex: 2, events: [v2_n1] },
      ];

      measureLayoutCacheStats.reset();
      const chunk1 = layoutSingleMeasure(staff.measures[mDef.id], mDef, staff.clef, true, true);
      expect(measureLayoutCacheStats.misses).toBe(1);

      // Mutate pitch in voice 2
      const v2_n1_altered = createNote({ pitches: [createPitch('G', 4)], baseType: 'whole' });
      staff.measures[mDef.id].voices[1].events = [v2_n1_altered];

      const chunk2 = layoutSingleMeasure(staff.measures[mDef.id], mDef, staff.clef, true, true);
      // Must be a cache miss because voice 2 changed
      expect(measureLayoutCacheStats.misses).toBe(2);
      expect(chunk1).not.toBe(chunk2);
    });

    it('Card 7 staggered onsets: shared ticks (0, 960, 1920) share column X; non-shared onsets have independent X', () => {
      const card7 = getPolyphonyGalleryCards().find((c) => c.id === 'poly-7-beams-in-both-voices')!;
      const score = card7.build();
      const layout = layoutScore(score, { width: 70 });
      const sys = layout.systems[0];

      const staff = score.parts[0].staves[0];
      const m0 = staff.measures[score.measures[0].id];

      const rows: Array<{ voiceIndex: number; tick: number; x: number; id: string; baseType: string; pitch: string }> = [];

      for (const v of m0.voices) {
        let curTick = 0;
        for (const ev of v.events) {
          if (ev.kind === 'note') {
            const nh = sys.items.find((it) => it.id === ev.id && it.glyph?.startsWith('notehead'));
            rows.push({
              voiceIndex: v.voiceIndex,
              tick: curTick,
              x: nh?.x ?? -1,
              id: ev.id,
              baseType: ev.baseType,
              pitch: `${(ev as NoteEvent).pitches[0].step}${(ev as NoteEvent).pitches[0].octave}`,
            });
          }
          curTick += ev.duration;
        }
      }

      // Voice 1: E5 (0), F5 (480), G5 (960), C5 (1920)
      // Voice 2: G4 (0), C4 (960), E4 (1920), F4 (2400), G4 (2880)
      const v1At0 = rows.find((r) => r.voiceIndex === 1 && r.tick === 0)!;
      const v2At0 = rows.find((r) => r.voiceIndex === 2 && r.tick === 0)!;
      expect(v1At0.x).toBeCloseTo(v2At0.x, 2);

      const v1At960 = rows.find((r) => r.voiceIndex === 1 && r.tick === 960)!;
      const v2At960 = rows.find((r) => r.voiceIndex === 2 && r.tick === 960)!;
      expect(v1At960.x).toBeCloseTo(v2At960.x, 2);

      const v1At1920 = rows.find((r) => r.voiceIndex === 1 && r.tick === 1920)!;
      const v2At1920 = rows.find((r) => r.voiceIndex === 2 && r.tick === 1920)!;
      expect(v1At1920.x).toBeCloseTo(v2At1920.x, 2);

      // Non-shared onset at tick 480 (Voice 1 only)
      const v1At480 = rows.find((r) => r.voiceIndex === 1 && r.tick === 480)!;
      expect(v1At480).toBeDefined();
      expect(v1At480.x).toBeGreaterThan(v1At0.x);
      expect(v1At480.x).toBeLessThan(v1At960.x);

      // Non-shared onsets at ticks 2400, 2880 (Voice 2 only)
      const v2At2400 = rows.find((r) => r.voiceIndex === 2 && r.tick === 2400)!;
      const v2At2880 = rows.find((r) => r.voiceIndex === 2 && r.tick === 2880)!;
      expect(v2At2400.x).toBeGreaterThan(v1At1920.x);
      expect(v2At2880.x).toBeGreaterThan(v2At2400.x);
    });
  });

  describe('Rule RA: Stems, Offsets for Voices 3/4, and Intra-Voice Beams', () => {
    it('voice 1 and 3 stems point up; voice 2 and 4 stems point down; voices 3/4 offset by +/-1.25 sp', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      const n1 = createNote({ pitches: [createPitch('E', 5)], baseType: 'quarter' });
      const n2 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
      const n3 = createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' });
      const n4 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [n1, createNote({ pitches: [createPitch('E', 5)], baseType: 'half', dots: 1 })] },
        { id: 'v2', voiceIndex: 2, events: [n2, createNote({ pitches: [createPitch('C', 4)], baseType: 'half', dots: 1 })] },
        { id: 'v3', voiceIndex: 3, events: [n3, createNote({ pitches: [createPitch('G', 4)], baseType: 'half', dots: 1 })] },
        { id: 'v4', voiceIndex: 4, events: [n4, createNote({ pitches: [createPitch('E', 4)], baseType: 'half', dots: 1 })] },
      ];

      const layout = layoutScore(score, { width: 70 });
      const sys = layout.systems[0];

      const stem1 = sys.items.find((it) => it.id === `${n1.id}-stem`);
      const stem2 = sys.items.find((it) => it.id === `${n2.id}-stem`);
      const stem3 = sys.items.find((it) => it.id === `${n3.id}-stem`);
      const stem4 = sys.items.find((it) => it.id === `${n4.id}-stem`);

      expect(stem1).toBeDefined();
      expect(stem2).toBeDefined();
      expect(stem3).toBeDefined();
      expect(stem4).toBeDefined();

      // Stem up: stem line goes upward (y2 < y)
      expect(stem1!.y2).toBeLessThan(stem1!.y);
      expect(stem3!.y2).toBeLessThan(stem3!.y);

      // Stem down: stem line goes downward (y2 > y)
      expect(stem2!.y2).toBeGreaterThan(stem2!.y);
      expect(stem4!.y2).toBeGreaterThan(stem4!.y);

      // Offset: Voice 3 offset +1.25 sp, Voice 4 offset -1.25 sp relative to column center
      const head1 = sys.items.find((it) => it.id === n1.id);
      const head3 = sys.items.find((it) => it.id === n3.id);
      const head4 = sys.items.find((it) => it.id === n4.id);

      expect(head3!.x - head1!.x).toBeCloseTo(1.25, 2);
      expect(head1!.x - head4!.x).toBeCloseTo(1.25, 2);
    });

    it('beams follow voice stem direction and never join notes of different voices', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      // Voice 1: two eighth notes (beamed up)
      const v1_e1 = createNote({ pitches: [createPitch('E', 5)], baseType: 'eighth' });
      const v1_e2 = createNote({ pitches: [createPitch('F', 5)], baseType: 'eighth' });

      // Voice 2: two eighth notes (beamed down)
      const v2_e1 = createNote({ pitches: [createPitch('G', 4)], baseType: 'eighth' });
      const v2_e2 = createNote({ pitches: [createPitch('A', 4)], baseType: 'eighth' });

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_e1, v1_e2, createNote({ pitches: [createPitch('C', 5)], baseType: 'half', dots: 1 })] },
        { id: 'v2', voiceIndex: 2, events: [v2_e1, v2_e2, createNote({ pitches: [createPitch('C', 4)], baseType: 'half', dots: 1 })] },
      ];

      const chunk = layoutSingleMeasure(staff.measures[mDef.id], mDef, staff.clef, true, true);
      // There must be 2 separate beam groups, each with 2 events
      expect(chunk.beamGroups.length).toBe(2);
      const bg1 = chunk.beamGroups.find((bg) => bg.stemDir === 'up');
      const bg2 = chunk.beamGroups.find((bg) => bg.stemDir === 'down');

      expect(bg1).toBeDefined();
      expect(bg2).toBeDefined();
      expect(bg1!.events.map((e) => e.eventId)).toEqual([v1_e1.id, v1_e2.id]);
      expect(bg2!.events.map((e) => e.eventId)).toEqual([v2_e1.id, v2_e2.id]);
    });
  });

  describe('Rule RC: Intervals Between Voice 1 and Voice 2 at Same Tick', () => {
    it('third or larger: both noteheads sit at the same X coordinate', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      // Voice 1 has C5, Voice 2 has G4 (interval of a fourth, step difference 3)
      const v1_n = createNote({ pitches: [createPitch('C', 5)], baseType: 'whole' });
      const v2_n = createNote({ pitches: [createPitch('G', 4)], baseType: 'whole' });

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_n] },
        { id: 'v2', voiceIndex: 2, events: [v2_n] },
      ];

      const layout = layoutScore(score, { width: 70 });
      const head1 = layout.systems[0].items.find((it) => it.id === v1_n.id)!;
      const head2 = layout.systems[0].items.find((it) => it.id === v2_n.id)!;

      expect(head1.x).toBeCloseTo(head2.x, 2);
    });

    it('second interval: stems share one vertical line; voice 1 head to LEFT, voice 2 head to RIGHT', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      // Voice 1 has D5, Voice 2 has C5 (second interval, step difference 1)
      const v1_n = createNote({ pitches: [createPitch('D', 5)], baseType: 'quarter' });
      const v2_n = createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' });

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_n, createNote({ pitches: [createPitch('D', 5)], baseType: 'half', dots: 1 })] },
        { id: 'v2', voiceIndex: 2, events: [v2_n, createNote({ pitches: [createPitch('C', 5)], baseType: 'half', dots: 1 })] },
      ];

      const layout = layoutScore(score, { width: 70 });
      const sys = layout.systems[0];
      const head1 = sys.items.find((it) => it.id === v1_n.id)!;
      const head2 = sys.items.find((it) => it.id === v2_n.id)!;
      const stem1 = sys.items.find((it) => it.id === `${v1_n.id}-stem`)!;
      const stem2 = sys.items.find((it) => it.id === `${v2_n.id}-stem`)!;

      // Stems share the exact same vertical X coordinate
      expect(stem1.x).toBeCloseTo(stem2.x, 2);

      // Voice 1 (stem up) notehead is to the LEFT of the shared stem line
      expect(head1.x).toBeLessThan(stem1.x);

      // Voice 2 (stem down) notehead is to the RIGHT of the shared stem line
      expect(head2.x).toBeGreaterThanOrEqual(stem1.x - 0.01);
      expect(head1.x).toBeLessThan(head2.x);
    });
  });

  describe('Rule RD: Unison at the Same Tick', () => {
    it('unison with same duration produces one shared head with two stems (up & down)', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      // Both voices play C5 quarter note
      const v1_n = createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' });
      const v2_n = createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' });

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_n, createNote({ pitches: [createPitch('C', 5)], baseType: 'half', dots: 1 })] },
        { id: 'v2', voiceIndex: 2, events: [v2_n, createNote({ pitches: [createPitch('C', 5)], baseType: 'half', dots: 1 })] },
      ];

      const layout = layoutScore(score, { width: 70 });
      const sys = layout.systems[0];

      // Only one notehead rendered at that tick (voice 1's head serves as shared head)
      const heads = sys.items.filter((it) => it.kind === 'glyph' && it.glyph?.startsWith('notehead') && (it.id === v1_n.id || it.id === v2_n.id));
      expect(heads.length).toBe(1);

      // But both stems are rendered: one up, one down
      const stem1 = sys.items.find((it) => it.id === `${v1_n.id}-stem`)!;
      const stem2 = sys.items.find((it) => it.id === `${v2_n.id}-stem`)!;
      expect(stem1).toBeDefined();
      expect(stem2).toBeDefined();
      expect(stem1.y2).toBeLessThan(stem1.y); // stem up
      expect(stem2.y2).toBeGreaterThan(stem2.y); // stem down
    });

    it('unison with different durations produces displaced voice 2 notehead to the right', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      // Voice 1 has C5 half note, Voice 2 has C5 quarter note
      const v1_n = createNote({ pitches: [createPitch('C', 5)], baseType: 'half' });
      const v2_n = createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' });

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_n, createNote({ pitches: [createPitch('D', 5)], baseType: 'half' })] },
        { id: 'v2', voiceIndex: 2, events: [v2_n, createNote({ pitches: [createPitch('C', 5)], baseType: 'half', dots: 1 })] },
      ];

      const layout = layoutScore(score, { width: 70 });
      const sys = layout.systems[0];
      const head1 = sys.items.find((it) => it.id === v1_n.id)!;
      const head2 = sys.items.find((it) => it.id === v2_n.id)!;

      // Both noteheads are rendered
      expect(head1).toBeDefined();
      expect(head2).toBeDefined();

      // Voice 2 head is displaced to the right of voice 1 head
      expect(head2.x).toBeGreaterThan(head1.x);
    });
  });

  describe('Rule RE: Rests in Polyphonic Measures', () => {
    it('identical rests at same tick merge visually at staff center (y = 2.0)', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      // Both voices start with a note, then have quarter rest on beat 2
      const v1_n = createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' });
      const v1_r = { id: 'v1-r', kind: 'rest' as const, baseType: 'quarter' as const, duration: 960, dots: 0 };
      const v2_n = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
      const v2_r = { id: 'v2-r', kind: 'rest' as const, baseType: 'quarter' as const, duration: 960, dots: 0 };

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_n, v1_r, createNote({ pitches: [createPitch('C', 5)], baseType: 'half' })] },
        { id: 'v2', voiceIndex: 2, events: [v2_n, v2_r, createNote({ pitches: [createPitch('C', 4)], baseType: 'half' })] },
      ];

      const layout = layoutScore(score, { width: 70 });
      const sys = layout.systems[0];

      // Only ONE rest glyph is rendered for the quarter rest on beat 2
      const restGlyphs = sys.items.filter((it) => it.kind === 'glyph' && it.glyph === 'restQuarter');
      expect(restGlyphs.length).toBe(1);
      // Centered at staff line 2 / space 2 (y = 2.0)
      expect(restGlyphs[0].y).toBe(2.0);
    });

    it('single-voice rest in polyphonic measure: voice 1 moves up, voice 2 moves down', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      // Voice 1 has note on beat 1, rest on beat 2
      const v1_n = createNote({ pitches: [createPitch('E', 5)], baseType: 'half' });
      const v1_r = { id: 'v1-r2', kind: 'rest' as const, baseType: 'half' as const, duration: 1920, dots: 0 };

      // Voice 2 has notes on both beats
      const v2_n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'half' });
      const v2_n2 = createNote({ pitches: [createPitch('G', 4)], baseType: 'half' });

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_n, v1_r] },
        { id: 'v2', voiceIndex: 2, events: [v2_n1, v2_n2] },
      ];

      const layout = layoutScore(score, { width: 70 });
      const sys = layout.systems[0];
      const v1RestItem = sys.items.find((it) => it.id === v1_r.id)!;

      // Voice 1 rest is elevated (y <= 1.0)
      expect(v1RestItem).toBeDefined();
      expect(v1RestItem.y).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Rule RF: Ties and Slurs Follow Voice Direction', () => {
    it('voice 1 tie curves above, voice 2 tie curves below in polyphonic measures', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      const v1_n1 = createNote({ pitches: [{ step: 'C', octave: 5, alter: 0, tiedToNext: true }], baseType: 'half', tiedToNext: true });
      const v1_n2 = createNote({ pitches: [createPitch('C', 5)], baseType: 'half' });

      const v2_n1 = createNote({ pitches: [{ step: 'E', octave: 4, alter: 0, tiedToNext: true }], baseType: 'half', tiedToNext: true });
      const v2_n2 = createNote({ pitches: [createPitch('E', 4)], baseType: 'half' });

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_n1, v1_n2] },
        { id: 'v2', voiceIndex: 2, events: [v2_n1, v2_n2] },
      ];

      const layout = layoutScore(score, { width: 70 });
      const ties = layoutTies(score, layout);
      expect(ties).toBeDefined();
      expect(ties.length).toBe(2);

      const tieV1 = ties.find((t) => t.id.includes(v1_n1.id))!;
      const tieV2 = ties.find((t) => t.id.includes(v2_n1.id))!;

      expect(tieV1).toBeDefined();
      expect(tieV2).toBeDefined();

      // In tieV1 (Voice 1, curves above), control point Y must be LESS than notehead Y (higher on screen)
      const matchV1 = tieV1.d.match(/Q\s+[\d.]+\s+([\d.-]+)/);
      const matchV2 = tieV2.d.match(/Q\s+[\d.]+\s+([\d.-]+)/);
      expect(matchV1).not.toBeNull();
      expect(matchV2).not.toBeNull();

      const ctrlY_V1 = parseFloat(matchV1![1]);
      const ctrlY_V2 = parseFloat(matchV2![1]);

      // Voice 1 tie peak is higher (smaller Y) than Voice 2 tie peak (larger Y)
      expect(ctrlY_V1).toBeLessThan(ctrlY_V2);
    });
  });

  describe('Rule RG: Augmentation Dots', () => {
    it('voice 1 dot on line goes in space above; voice 2 dot on line goes in space below', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      // Bb4 is on line 3 in treble clef (stepPos = 4, even = line)
      const v1_n = createNote({ pitches: [createPitch('B', 4, -1)], baseType: 'half', dots: 1 });
      const v1_r = { id: 'v1-r', kind: 'rest' as const, baseType: 'quarter' as const, duration: 960, dots: 0 };

      // G4 is on line 2 in treble clef (stepPos = 2, even = line)
      const v2_n = createNote({ pitches: [createPitch('G', 4)], baseType: 'half', dots: 1 });
      const v2_r = { id: 'v2-r', kind: 'rest' as const, baseType: 'quarter' as const, duration: 960, dots: 0 };

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_n, v1_r] },
        { id: 'v2', voiceIndex: 2, events: [v2_n, v2_r] },
      ];

      const layout = layoutScore(score, { width: 70 });
      const sys = layout.systems[0];

      const head1 = sys.items.find((it) => it.id === v1_n.id)!;
      const dot1 = sys.items.find((it) => it.id === `${v1_n.id}-dot-0-0`)!;
      const head2 = sys.items.find((it) => it.id === v2_n.id)!;
      const dot2 = sys.items.find((it) => it.id === `${v2_n.id}-dot-0-0`)!;

      expect(dot1).toBeDefined();
      expect(dot2).toBeDefined();

      // Voice 1 dot goes in space ABOVE line (dot1.y < head1.y)
      expect(dot1.y).toBeLessThan(head1.y);

      // Voice 2 dot goes in space BELOW line (dot2.y > head2.y)
      expect(dot2.y).toBeGreaterThan(head2.y);
    });
  });

  describe('Rule RH: Accidental Placement Without Notehead Overlap', () => {
    it('accidental sits to the left of the leftmost notehead and does not collide with opposing voice', () => {
      const score = createEmptyScore({ measures: 1 });
      const staff = score.parts[0].staves[0];
      const mDef = score.measures[0];

      // Voice 1 has C#5 (accidental needed), Voice 2 has C4
      const v1_n = createNote({ pitches: [createPitch('C', 5, 1)], baseType: 'whole' });
      const v2_n = createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' });

      staff.measures[mDef.id].voices = [
        { id: 'v1', voiceIndex: 1, events: [v1_n] },
        { id: 'v2', voiceIndex: 2, events: [v2_n] },
      ];

      const layout = layoutScore(score, { width: 70 });
      const sys = layout.systems[0];

      const accItem = sys.items.find((it) => it.id === `${v1_n.id}-acc-0`)!;
      const head1 = sys.items.find((it) => it.id === v1_n.id)!;
      const head2 = sys.items.find((it) => it.id === v2_n.id)!;

      expect(accItem).toBeDefined();
      // Accidental X must be strictly to the left of both noteheads
      expect(accItem.x).toBeLessThan(head1.x);
      expect(accItem.x).toBeLessThan(head2.x);
    });
  });
});
