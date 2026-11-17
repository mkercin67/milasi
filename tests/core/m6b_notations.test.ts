import { describe, expect, it } from 'vitest';
import {
  clearSelectionNotations,
  setDynamic,
  toggleArticulation,
  toggleSlur,
} from '../../src/core/commands';
import {
  createEmptyScore,
  createNote,
  createPitch,
} from '../../src/core/factory';
import { Selection } from '../../src/core/selection';
import { validateScore } from '../../src/core/validate';

describe('Milestone 6b: Model, Validation and Commands (src/core)', () => {
  function makeScore() {
    const score = createEmptyScore({
      clef: { sign: 'G', line: 2 },
      keySig: 0,
      timeSig: { num: 4, den: 4 },
      measures: 2,
    });
    const staff = score.parts[0].staves[0];
    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const n4 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
    staff.measures[score.measures[0].id].voices[0].events = [n1, n2, n3, n4];
    return { score, staff, notes: [n1, n2, n3, n4] };
  }

  describe('1. validateScore for Dynamics, Articulations, and Slurs', () => {
    it('accepts valid dynamics and flags unknown dynamics', () => {
      const { score, notes } = makeScore();
      notes[0].dynamic = 'mf';
      expect(validateScore(score)).toEqual([]);

      notes[0].dynamic = 'invalid_dynamic';
      const res = validateScore(score);
      expect(res.length).toBeGreaterThan(0);
      expect(res.some((e) => e.message.includes('dynamic'))).toBe(true);
    });

    it('accepts valid articulations and disallows duplicates or accent+marcato conflict', () => {
      const { score, notes } = makeScore();
      notes[0].articulations = ['staccato', 'tenuto'];
      expect(validateScore(score)).toEqual([]);

      // Duplicate articulation
      notes[0].articulations = ['staccato', 'staccato'];
      expect(validateScore(score).length).toBeGreaterThan(0);

      // Accent + marcato conflict
      notes[0].articulations = ['accent', 'marcato'];
      const conflictRes = validateScore(score);
      expect(conflictRes.length).toBeGreaterThan(0);
      expect(conflictRes.some((e) => e.message.includes('articulation') || e.message.includes('marcato'))).toBe(true);
    });

    it('validates slurs in Staff.slurs: checks existence and chronological order', () => {
      const { score, staff, notes } = makeScore();
      staff.slurs = [
        {
          id: 'slur-1',
          startEventId: notes[0].id,
          endEventId: notes[2].id,
        },
      ];
      expect(validateScore(score)).toEqual([]);

      // Slur referencing non-existent event
      staff.slurs = [
        {
          id: 'slur-2',
          startEventId: notes[0].id,
          endEventId: 'non-existent-id',
        },
      ];
      expect(validateScore(score).length).toBeGreaterThan(0);

      // Slur in reverse chronological order
      staff.slurs = [
        {
          id: 'slur-3',
          startEventId: notes[3].id,
          endEventId: notes[1].id,
        },
      ];
      expect(validateScore(score).length).toBeGreaterThan(0);
    });
  });

  describe('2. Commands for Dynamics, Articulations, and Slurs', () => {
    it('setDynamic sets or clears dynamic on event or range', () => {
      const { score, notes } = makeScore();
      const updated = setDynamic(notes[0].id, 'ff').apply(score);
      const ev0 = updated.parts[0].staves[0].measures[score.measures[0].id].voices[0].events[0] as any;
      expect(ev0.dynamic).toBe('ff');

      const cleared = setDynamic(notes[0].id, null).apply(updated);
      const ev0Cleared = cleared.parts[0].staves[0].measures[score.measures[0].id].voices[0].events[0] as any;
      expect(ev0Cleared.dynamic).toBeUndefined();
    });

    it('toggleArticulation toggles articulation and resolves accent/marcato conflict', () => {
      const { score, notes } = makeScore();
      // Add accent
      let s1 = toggleArticulation(notes[0].id, 'accent').apply(score);
      let ev = s1.parts[0].staves[0].measures[score.measures[0].id].voices[0].events[0] as any;
      expect(ev.articulations).toEqual(['accent']);

      // Adding marcato should replace accent
      let s2 = toggleArticulation(notes[0].id, 'marcato').apply(s1);
      ev = s2.parts[0].staves[0].measures[score.measures[0].id].voices[0].events[0] as any;
      expect(ev.articulations).toEqual(['marcato']);

      // Adding staccato is allowed alongside marcato
      let s3 = toggleArticulation(notes[0].id, 'staccato').apply(s2);
      ev = s3.parts[0].staves[0].measures[score.measures[0].id].voices[0].events[0] as any;
      expect(ev.articulations).toContain('marcato');
      expect(ev.articulations).toContain('staccato');

      // Toggling staccato again removes it
      let s4 = toggleArticulation(notes[0].id, 'staccato').apply(s3);
      ev = s4.parts[0].staves[0].measures[score.measures[0].id].voices[0].events[0] as any;
      expect(ev.articulations).toEqual(['marcato']);
    });

    it('toggleSlur adds and removes slurs for range selections', () => {
      const { score, staff, notes } = makeScore();
      const range: Selection = {
        kind: 'range',
        staffId: staff.id,
        voiceId: staff.measures[score.measures[0].id].voices[0].id,
        anchorId: notes[0].id,
        focusId: notes[2].id,
      };

      // Add slur
      const s1 = toggleSlur(range).apply(score);
      const st1 = s1.parts[0].staves[0];
      expect(st1.slurs).toHaveLength(1);
      expect(st1.slurs?.[0].startEventId).toBe(notes[0].id);
      expect(st1.slurs?.[0].endEventId).toBe(notes[2].id);

      // Toggle again removes slur
      const s2 = toggleSlur(range).apply(s1);
      const st2 = s2.parts[0].staves[0];
      expect(st2.slurs).toHaveLength(0);
    });

    it('clearSelectionNotations clears dynamics, articulations and slurs on selection', () => {
      const { score, staff, notes } = makeScore();
      notes[0].dynamic = 'f';
      notes[0].articulations = ['staccato'];
      staff.slurs = [{ id: 'slur-1', startEventId: notes[0].id, endEventId: notes[2].id }];

      const sel: Selection = {
        kind: 'range',
        staffId: staff.id,
        voiceId: staff.measures[score.measures[0].id].voices[0].id,
        anchorId: notes[0].id,
        focusId: notes[1].id,
      };

      const cleared = clearSelectionNotations(sel).apply(score);
      const st = cleared.parts[0].staves[0];
      const ev0 = st.measures[score.measures[0].id].voices[0].events[0] as any;
      expect(ev0.dynamic).toBeUndefined();
      expect(ev0.articulations).toEqual([]);
      expect(st.slurs).toHaveLength(0);
    });
  });
});
