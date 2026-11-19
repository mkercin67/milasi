// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch, newId } from '../../src/core/factory';
import { NoteEvent, Score, ScoreEvent } from '../../src/core/model';
import { advanceCursor, enterNote, ScoreCursor } from '../../src/core/input';
import { eventsInRange, extendSelection, getRangeMeasureSpan, RangeSelection, Selection } from '../../src/core/selection';
import { deleteRange, transposeRange } from '../../src/core/commands';
import { Command, History } from '../../src/core/commandTypes';
import { setDynamic, toggleArticulation, toggleSlur, toggleTie } from '../../src/core/notationCommands';
import { pasteEvents } from '../../src/core/clipboard';
import { validateScore } from '../../src/core/validate';

/**
 * Builds BWV 140/7 mm. 1-2 in two voices via the real app path
 * (createEmptyScore, keyboard input commands as the user types them).
 */
function buildBwv140TwoMeasuresViaAppPath(): {
  score: Score;
  staffId: string;
  m0Id: string;
  m1Id: string;
} {
  let score = createEmptyScore({
    measures: 2,
    keySig: -3,
    timeSig: { num: 4, den: 4 },
    title: 'BWV 140/7 mm. 1-2 App Path',
  });
  const staffId = score.parts[0].staves[0].id;
  const m0Id = score.measures[0].id;
  const m1Id = score.measures[1].id;

  // 1. Enter Soprano (Voice 1) via enterNote and advanceCursor
  let cursor: ScoreCursor = { staffId, measureId: m0Id, voiceIndex: 1, tick: 0 };

  // Measure 1 Voice 1: Eb4 (quarter, 960), G4 (quarter, 960), Bb4 (dotted quarter, 1440), Bb4 (eighth, 480)
  const v1M1Notes = [
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'E' as const, octave: 4, alter: -1 } },
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'G' as const, octave: 4, alter: 0 } },
    { baseType: 'quarter' as const, dots: 1, dur: 1440, pitch: { step: 'B' as const, octave: 4, alter: -1 } },
    { baseType: 'eighth' as const, dots: 0, dur: 480, pitch: { step: 'B' as const, octave: 4, alter: -1 } },
  ];
  for (const n of v1M1Notes) {
    score = enterNote(cursor, { baseType: n.baseType, dots: n.dots, pitch: n.pitch }).apply(score);
    cursor = advanceCursor(score, cursor, n.dur);
  }

  // Measure 2 Voice 1: Bb4 (quarter, 960), Bb4 (quarter, 960), C5 (half, 1920)
  const v1M2Notes = [
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'B' as const, octave: 4, alter: -1 } },
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'B' as const, octave: 4, alter: -1 } },
    { baseType: 'half' as const, dots: 0, dur: 1920, pitch: { step: 'C' as const, octave: 5, alter: 0 } },
  ];
  for (const n of v1M2Notes) {
    score = enterNote(cursor, { baseType: n.baseType, dots: n.dots, pitch: n.pitch }).apply(score);
    cursor = advanceCursor(score, cursor, n.dur);
  }

  // 2. Switch cursor to Alto (Voice 2) at m0Id
  cursor = { staffId, measureId: m0Id, voiceIndex: 2, tick: 0 };

  // Measure 1 Voice 2: Bb3 (quarter, 960), Eb4 (quarter, 960), G4 (quarter, 960), F4 (quarter, 960)
  const v2M1Notes = [
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'B' as const, octave: 3, alter: -1 } },
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'E' as const, octave: 4, alter: -1 } },
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'G' as const, octave: 4, alter: 0 } },
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'F' as const, octave: 4, alter: 0 } },
  ];
  for (const n of v2M1Notes) {
    score = enterNote(cursor, { baseType: n.baseType, dots: n.dots, pitch: n.pitch }).apply(score);
    cursor = advanceCursor(score, cursor, n.dur);
  }

  // Measure 2 Voice 2: G4 (quarter, 960), F4 (quarter, 960), G4 (quarter, 960), F4 (quarter, 960)
  const v2M2Notes = [
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'G' as const, octave: 4, alter: 0 } },
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'F' as const, octave: 4, alter: 0 } },
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'G' as const, octave: 4, alter: 0 } },
    { baseType: 'quarter' as const, dots: 0, dur: 960, pitch: { step: 'F' as const, octave: 4, alter: 0 } },
  ];
  for (const n of v2M2Notes) {
    score = enterNote(cursor, { baseType: n.baseType, dots: n.dots, pitch: n.pitch }).apply(score);
    cursor = advanceCursor(score, cursor, n.dur);
  }

  expect(validateScore(score)).toHaveLength(0);
  return { score, staffId, m0Id, m1Id };
}

function pasteCommand(
  target: { staffId: string; voiceIndex: 1 | 2 | 3 | 4; startMeasureId: string; startOffsetTicks: number },
  eventsToPaste: ScoreEvent[]
): Command {
  return {
    name: 'Paste Events',
    apply: (s) => pasteEvents(s, target, eventsToPaste),
  };
}

describe('M7a-3: Voice 2 Selection, Isolation, Operations and Clipboard (T1, T2, T3)', () => {
  describe('T1: Range selection in voice 2 across a barline', () => {
    it('range-selects across m.1 and m.2 strictly in voice 2, excluding voice 1 notes', () => {
      const { score, staffId, m0Id, m1Id } = buildBwv140TwoMeasuresViaAppPath();
      const staff = score.parts[0].staves[0];
      const v1M1 = staff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events;
      const v1M2 = staff.measures[m1Id].voices.find((v) => v.voiceIndex === 1)!.events;
      const v1Ids = new Set([...v1M1.map((e) => e.id), ...v1M2.map((e) => e.id)]);

      const v2M1 = staff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!.events;
      const v2M2 = staff.measures[m1Id].voices.find((v) => v.voiceIndex === 2)!.events;

      // Select from note 1 of voice 2 in m.1 to note 2 of voice 2 in m.2
      const range: RangeSelection = {
        staffId,
        voiceIndex: 2,
        anchorId: v2M1[1].id,
        focusId: v2M2[2].id,
      };

      const selected = eventsInRange(score, range);

      // Must contain exactly: v2M1[1], v2M1[2], v2M1[3], v2M2[0], v2M2[1], v2M2[2] (6 notes)
      expect(selected).toHaveLength(6);
      expect(selected.map((e) => e.id)).toEqual([
        v2M1[1].id,
        v2M1[2].id,
        v2M1[3].id,
        v2M2[0].id,
        v2M2[1].id,
        v2M2[2].id,
      ]);

      // Assert NO voice 1 note is included
      for (const ev of selected) {
        expect(v1Ids.has(ev.id)).toBe(false);
      }

      // getRangeMeasureSpan returns span across measures 1 and 2
      const span = getRangeMeasureSpan(score, selected);
      expect(span).toEqual({
        startMeasureNumber: 1,
        endMeasureNumber: 2,
        count: 6,
        measureCount: 2,
      });

      // extendSelection with Shift+click on voice 2 stays in voice 2
      const extended = extendSelection(score, { kind: 'event', id: v2M1[0].id }, v2M2[3].id);
      expect(extended).toEqual({
        kind: 'range',
        staffId,
        voiceIndex: 2,
        anchorId: v2M1[0].id,
        focusId: v2M2[3].id,
      });
      const extendedEvs = eventsInRange(score, extended as RangeSelection);
      expect(extendedEvs).toHaveLength(8);
      for (const ev of extendedEvs) {
        expect(v1Ids.has(ev.id)).toBe(false);
      }
    });
  });

  describe('T2: Operations on voice 2 selection (isolated tests per operation)', () => {
    function setupT2Test() {
      const data = buildBwv140TwoMeasuresViaAppPath();
      const staff = data.score.parts[0].staves[0];
      const v2M1 = staff.measures[data.m0Id].voices.find((v) => v.voiceIndex === 2)!.events;
      const v2M2 = staff.measures[data.m1Id].voices.find((v) => v.voiceIndex === 2)!.events;

      const range: RangeSelection = {
        staffId: data.staffId,
        voiceIndex: 2,
        anchorId: v2M1[1].id,
        focusId: v2M1[3].id,
      };
      const rangeSel: Selection = {
        kind: 'range',
        ...range,
      };

      const initialSnapshot = JSON.parse(JSON.stringify(data.score));
      const v1BeforeM0 = JSON.parse(
        JSON.stringify(staff.measures[data.m0Id].voices.find((v) => v.voiceIndex === 1)!.events)
      );
      const v1BeforeM1 = JSON.parse(
        JSON.stringify(staff.measures[data.m1Id].voices.find((v) => v.voiceIndex === 1)!.events)
      );

      const history = new History(data.score);
      return { ...data, range, rangeSel, initialSnapshot, v1BeforeM0, v1BeforeM1, history, v2M1, v2M2 };
    }

    it('transpose semitone up (+1)', () => {
      const { history, range, m0Id, m1Id, v1BeforeM0, v1BeforeM1, initialSnapshot } = setupT2Test();
      history.do(transposeRange(range, 1));

      expect(validateScore(history.score)).toHaveLength(0);
      const staff = history.score.parts[0].staves[0];

      // Voice 1 MUST be completely untouched
      expect(staff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM0);
      expect(staff.measures[m1Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM1);

      // Voice 2 reflects transposition (+1 semitone on Eb4 -> E4)
      const v2Events = staff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!.events;
      const note1 = v2Events[1] as NoteEvent;
      expect(note1.pitches[0].step).toBe('E');
      expect(note1.pitches[0].alter).toBe(0);

      // Undo restores exact initial score
      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(validateScore(history.score)).toHaveLength(0);
    });

    it('transpose semitone down (-1)', () => {
      const { history, range, m0Id, m1Id, v1BeforeM0, v1BeforeM1, initialSnapshot } = setupT2Test();
      history.do(transposeRange(range, -1));

      expect(validateScore(history.score)).toHaveLength(0);
      const staff = history.score.parts[0].staves[0];

      // Voice 1 untouched
      expect(staff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM0);
      expect(staff.measures[m1Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM1);

      // Voice 2 reflects transposition
      const v2Events = staff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!.events;
      const note1 = v2Events[1] as NoteEvent;
      expect(note1.pitches[0].step).toBe('D');

      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(validateScore(history.score)).toHaveLength(0);
    });

    it('transpose octave up (+12)', () => {
      const { history, range, m0Id, m1Id, v1BeforeM0, v1BeforeM1, initialSnapshot } = setupT2Test();
      history.do(transposeRange(range, 12));

      expect(validateScore(history.score)).toHaveLength(0);
      const staff = history.score.parts[0].staves[0];
      expect(staff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM0);
      expect(staff.measures[m1Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM1);

      const v2Events = staff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!.events;
      const note1 = v2Events[1] as NoteEvent;
      expect(note1.pitches[0].octave).toBe(5);

      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(validateScore(history.score)).toHaveLength(0);
    });

    it('transpose octave down (-12)', () => {
      const { history, range, m0Id, m1Id, v1BeforeM0, v1BeforeM1, initialSnapshot } = setupT2Test();
      history.do(transposeRange(range, -12));

      expect(validateScore(history.score)).toHaveLength(0);
      const staff = history.score.parts[0].staves[0];
      expect(staff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM0);
      expect(staff.measures[m1Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM1);

      const v2Events = staff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!.events;
      const note1 = v2Events[1] as NoteEvent;
      expect(note1.pitches[0].octave).toBe(3);

      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(validateScore(history.score)).toHaveLength(0);
    });

    it('delete (notes become rests)', () => {
      const { history, range, m0Id, m1Id, v1BeforeM0, v1BeforeM1, initialSnapshot } = setupT2Test();
      history.do(deleteRange(range));

      expect(validateScore(history.score)).toHaveLength(0);
      const staff = history.score.parts[0].staves[0];
      expect(staff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM0);
      expect(staff.measures[m1Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM1);

      const v2Events = staff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!.events;
      // Deleted notes must be rests
      expect(v2Events[0].kind).toBe('note'); // note 0 untouched
      expect(v2Events[1].kind).toBe('rest'); // note 1 deleted
      expect(v2Events[2].kind).toBe('rest'); // note 2 deleted
      expect(v2Events[3].kind).toBe('rest'); // note 3 deleted

      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(validateScore(history.score)).toHaveLength(0);
    });

    it('tie (toggleTie on two adjacent same-pitch notes in voice 2)', () => {
      let score = createEmptyScore({ measures: 2, timeSig: { num: 4, den: 4 } });
      const staffId = score.parts[0].staves[0].id;
      const m0Id = score.measures[0].id;
      const m1Id = score.measures[1].id;

      // Voice 1: whole note in m0 and m1
      score = enterNote(
        { staffId, measureId: m0Id, voiceIndex: 1, tick: 0 },
        { baseType: 'whole', dots: 0, pitch: { step: 'C', octave: 4, alter: 0 } }
      ).apply(score);
      score = enterNote(
        { staffId, measureId: m1Id, voiceIndex: 1, tick: 0 },
        { baseType: 'whole', dots: 0, pitch: { step: 'C', octave: 4, alter: 0 } }
      ).apply(score);

      // Voice 2 in m.1: two adjacent G4 quarter notes followed by a half note
      let cursor: ScoreCursor = { staffId, measureId: m0Id, voiceIndex: 2, tick: 0 };
      score = enterNote(cursor, { baseType: 'quarter', dots: 0, pitch: { step: 'G', octave: 4, alter: 0 } }).apply(score);
      cursor = advanceCursor(score, cursor, 960);
      score = enterNote(cursor, { baseType: 'quarter', dots: 0, pitch: { step: 'G', octave: 4, alter: 0 } }).apply(score);
      cursor = advanceCursor(score, cursor, 960);
      score = enterNote(cursor, { baseType: 'half', dots: 0, pitch: { step: 'E', octave: 4, alter: 0 } }).apply(score);

      const staff = score.parts[0].staves[0];
      const initialSnapshot = JSON.parse(JSON.stringify(score));
      const v1BeforeM0 = JSON.parse(
        JSON.stringify(staff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events)
      );
      const v1BeforeM1 = JSON.parse(
        JSON.stringify(staff.measures[m1Id].voices.find((v) => v.voiceIndex === 1)!.events)
      );

      const v2 = staff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!;
      const firstNoteId = v2.events[0].id;

      const history = new History(score);
      history.do(toggleTie(firstNoteId, 0));

      expect(validateScore(history.score)).toHaveLength(0);
      const updatedStaff = history.score.parts[0].staves[0];
      expect(updatedStaff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM0);
      expect(updatedStaff.measures[m1Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM1);

      const updatedV2 = updatedStaff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!;
      const n0 = updatedV2.events[0] as NoteEvent;
      expect(n0.pitches[0].tiedToNext).toBe(true);
      expect(n0.tiedToNext).toBe(true);

      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(validateScore(history.score)).toHaveLength(0);
    });

    it('slur (toggleSlur across voice 2 notes)', () => {
      const { history, range, rangeSel, m0Id, m1Id, v1BeforeM0, v1BeforeM1, initialSnapshot } = setupT2Test();
      history.do(toggleSlur(rangeSel));

      expect(validateScore(history.score)).toHaveLength(0);
      const staff = history.score.parts[0].staves[0];
      expect(staff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM0);
      expect(staff.measures[m1Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM1);

      expect(staff.slurs).toHaveLength(1);
      expect(staff.slurs![0].startEventId).toBe(range.anchorId);
      expect(staff.slurs![0].endEventId).toBe(range.focusId);

      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(validateScore(history.score)).toHaveLength(0);
    });

    it('articulation (toggleArticulation staccato on voice 2)', () => {
      const { history, rangeSel, m0Id, m1Id, v1BeforeM0, v1BeforeM1, initialSnapshot } = setupT2Test();
      history.do(toggleArticulation(rangeSel, 'staccato'));

      expect(validateScore(history.score)).toHaveLength(0);
      const staff = history.score.parts[0].staves[0];
      expect(staff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM0);
      expect(staff.measures[m1Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM1);

      const v2Events = staff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!.events;
      expect((v2Events[1] as NoteEvent).articulations).toContain('staccato');
      expect((v2Events[2] as NoteEvent).articulations).toContain('staccato');
      expect((v2Events[3] as NoteEvent).articulations).toContain('staccato');

      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(validateScore(history.score)).toHaveLength(0);
    });

    it('dynamic (setDynamic mf on voice 2)', () => {
      const { history, rangeSel, m0Id, m1Id, v1BeforeM0, v1BeforeM1, initialSnapshot } = setupT2Test();
      history.do(setDynamic(rangeSel, 'mf'));

      expect(validateScore(history.score)).toHaveLength(0);
      const staff = history.score.parts[0].staves[0];
      expect(staff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM0);
      expect(staff.measures[m1Id].voices.find((v) => v.voiceIndex === 1)!.events).toEqual(v1BeforeM1);

      const v2Events = staff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!.events;
      expect((v2Events[1] as NoteEvent).dynamic).toBe('mf');

      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(validateScore(history.score)).toHaveLength(0);
    });
  });

  describe('T3: Cross-voice copy and paste', () => {
    it('a) copy 2 notes from voice 2, paste into voice 1 of measure 1 -> pasted notes in voice 1, voice 2 unchanged', () => {
      const { score, staffId, m0Id } = buildBwv140TwoMeasuresViaAppPath();
      const staff = score.parts[0].staves[0];
      const v2Events = staff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!.events;
      const notesToCopy = [v2Events[0], v2Events[1]]; // Bb3, Eb4

      const initialSnapshot = JSON.parse(JSON.stringify(score));
      const v2Before = JSON.parse(JSON.stringify(v2Events));

      const history = new History(score);
      history.do(
        pasteCommand(
          {
            staffId,
            voiceIndex: 1,
            startMeasureId: m0Id,
            startOffsetTicks: 0,
          },
          notesToCopy
        )
      );

      expect(validateScore(history.score)).toHaveLength(0);
      const curStaff = history.score.parts[0].staves[0];
      const v1After = curStaff.measures[m0Id].voices.find((v) => v.voiceIndex === 1)!.events;
      const v2After = curStaff.measures[m0Id].voices.find((v) => v.voiceIndex === 2)!.events;

      // Voice 1 has pasted notes at offset 0
      const n0 = v1After[0] as NoteEvent;
      const n1 = v1After[1] as NoteEvent;
      expect(n0.pitches[0].step).toBe('B');
      expect(n0.pitches[0].octave).toBe(3);
      expect(n1.pitches[0].step).toBe('E');
      expect(n1.pitches[0].octave).toBe(4);

      // Voice 2 is completely unchanged
      expect(v2After).toEqual(v2Before);

      // Undo restores exact initial score
      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(validateScore(history.score)).toHaveLength(0);
    });

    it('b) copy 2 notes from voice 2, paste into voice 2 of a measure with ONLY voice 1 -> voice 2 created in 1 undo step, surrounded by rests', () => {
      // Create a 2-measure score where measure 2 has only voice 1
      let score = createEmptyScore({ measures: 2, timeSig: { num: 4, den: 4 } });
      const staffId = score.parts[0].staves[0].id;
      const m0Id = score.measures[0].id;
      const m1Id = score.measures[1].id;

      // Populate voice 2 in measure 1 with 4 quarter notes
      const v2Notes = [
        createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' }),
      ];
      score.parts[0].staves[0].measures[m0Id].voices.push({
        id: newId(),
        voiceIndex: 2,
        events: v2Notes,
      });

      // Verify measure 2 has ONLY voice 1
      expect(score.parts[0].staves[0].measures[m1Id].voices).toHaveLength(1);
      expect(score.parts[0].staves[0].measures[m1Id].voices[0].voiceIndex).toBe(1);

      const initialSnapshot = JSON.parse(JSON.stringify(score));
      const history = new History(score);

      // Paste 2 quarter notes into voice 2 of measure 2 at offset 960 (beat 2)
      const toPaste = [v2Notes[0], v2Notes[1]];
      history.do(
        pasteCommand(
          {
            staffId,
            voiceIndex: 2,
            startMeasureId: m1Id,
            startOffsetTicks: 960,
          },
          toPaste
        )
      );

      expect(validateScore(history.score)).toHaveLength(0);
      const m1Voices = history.score.parts[0].staves[0].measures[m1Id].voices;
      expect(m1Voices).toHaveLength(2);
      expect(m1Voices[0].voiceIndex).toBe(1);
      expect(m1Voices[1].voiceIndex).toBe(2);

      const v2 = m1Voices[1];
      // Must have leading rest [0, 960), the 2 notes [960, 2880), trailing rest [2880, 3840)
      expect(v2.events[0].kind).toBe('rest');
      expect(v2.events[0].duration).toBe(960);
      expect(v2.events[1].kind).toBe('note');
      expect(v2.events[1].duration).toBe(960);
      expect(v2.events[2].kind).toBe('note');
      expect(v2.events[2].duration).toBe(960);
      expect(v2.events[3].kind).toBe('rest');
      expect(v2.events[3].duration).toBe(960);

      // Exactly 1 undo step restores measure 2 to having only voice 1
      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(history.score.parts[0].staves[0].measures[m1Id].voices).toHaveLength(1);
      expect(validateScore(history.score)).toHaveLength(0);
    });

    it('c) copy 2 notes from voice 2, paste into voice 2 that already has content -> replaces content, validateScore 0 errors', () => {
      const { score, staffId, m0Id } = buildBwv140TwoMeasuresViaAppPath();

      // Copy 2 quarter notes
      const toPaste = [
        createNote({ pitches: [createPitch('A', 4)], baseType: 'quarter' }),
        createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' }),
      ];

      const initialSnapshot = JSON.parse(JSON.stringify(score));
      const history = new History(score);

      // Paste at offset 960 in voice 2 of m.1
      history.do(
        pasteCommand(
          {
            staffId,
            voiceIndex: 2,
            startMeasureId: m0Id,
            startOffsetTicks: 960,
          },
          toPaste
        )
      );

      expect(validateScore(history.score)).toHaveLength(0);
      const updatedV2 = history.score.parts[0].staves[0].measures[m0Id].voices.find((v) => v.voiceIndex === 2)!;
      const n1 = updatedV2.events[1] as NoteEvent;
      const n2 = updatedV2.events[2] as NoteEvent;
      expect(n1.pitches[0].step).toBe('A');
      expect(n2.pitches[0].step).toBe('C');

      // Undo restores exact previous content
      history.undo();
      expect(history.score).toEqual(initialSnapshot);
      expect(validateScore(history.score)).toHaveLength(0);
    });
  });
});
