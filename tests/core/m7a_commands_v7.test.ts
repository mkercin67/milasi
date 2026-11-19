// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Command tests for multi-voice operations (Item 5):
 * - addVoice, removeVoice (empty vs non-empty, confirmation refusal)
 * - insertNote, deleteEvent, changePitch addressed by voiceIndex
 * - undo/redo restoration across voice additions and operations
 */

import { describe, expect, it } from 'vitest';
import {
  addVoice,
  changePitch,
  deleteEvent,
  History,
  insertNote,
  removeVoice,
} from '../../src/core/commands';
import {
  createMeasure,
  createNote,
  createPart,
  createPitch,
  createRest,
  createScore,
  newId,
} from '../../src/core/factory';
import { Score } from '../../src/core/model';

describe('Multi-Voice Commands (Item 5)', () => {
  function setupScore(): { score: Score; staffId: string; measureId: string; partId: string } {
    const score = createScore();
    const m = createMeasure({ num: 4, den: 4 });
    const part = createPart({ name: 'Piano', instrument: 'piano' });
    score.measures.push(m);
    score.parts.push(part);

    const staffId = part.staves[0].id;
    part.staves[0].measures[m.id] = {
      voices: [
        {
          id: newId(),
          voiceIndex: 1,
          events: [
            createNote({
              id: 'note-v1-1',
              pitches: [createPitch('C', 4)],
              baseType: 'half',
            }),
            createRest({ id: 'rest-v1-1', baseType: 'half', duration: 1920 }),
          ],
        },
      ],
    };

    return { score, staffId, measureId: m.id, partId: part.id };
  }

  it('adds voice 2 to a measure filled with measure-length rests', () => {
    const { score, staffId, measureId } = setupScore();
    const cmd = addVoice(staffId, measureId, 2);
    const updated = cmd.apply(score);

    const sm = updated.parts[0].staves[0].measures[measureId];
    expect(sm.voices).toHaveLength(2);
    expect(sm.voices[0].voiceIndex).toBe(1);
    expect(sm.voices[1].voiceIndex).toBe(2);

    const v2 = sm.voices[1];
    const totalTicks = v2.events.reduce((s, e) => s + e.duration, 0);
    expect(totalTicks).toBe(3840);
    expect(v2.events.every((e) => e.kind === 'rest')).toBe(true);
  });

  it('inserts notes in voice 2 addressed by voiceIndex and leaves voice 1 untouched', () => {
    const { score, staffId, measureId, partId } = setupScore();
    const withV2 = JSON.parse(JSON.stringify(addVoice(staffId, measureId, 2).apply(score)));

    const noteV2 = createNote({
      id: 'note-v2-1',
      pitches: [createPitch('E', 5)],
      baseType: 'quarter',
    });

    const cmd = insertNote({
      partId,
      staffId,
      measureId,
      voiceIndex: 2,
      index: 0,
      event: noteV2,
    });
    const updated = cmd.apply(withV2);

    const sm = updated.parts[0].staves[0].measures[measureId];
    // Voice 1 events must be completely identical and untouched
    const v1 = sm.voices.find((v) => v.voiceIndex === 1)!;
    expect(v1.events).toHaveLength(2);
    expect(v1.events[0].id).toBe('note-v1-1');
    expect(v1.events[1].id).toBe('rest-v1-1');

    // Voice 2 contains inserted note
    const v2 = sm.voices.find((v) => v.voiceIndex === 2)!;
    expect(v2.events[0].id).toBe('note-v2-1');
  });

  it('undo/redo restores exactly across voice additions and edits', () => {
    const { score, staffId, measureId, partId } = setupScore();
    const history = new History(score);

    // Step 1: add voice 2
    history.do(addVoice(staffId, measureId, 2));
    expect(history.score.parts[0].staves[0].measures[measureId].voices).toHaveLength(2);

    // Step 2: insert note in voice 2
    const noteV2 = createNote({
      id: 'note-v2-test',
      pitches: [createPitch('G', 4)],
      baseType: 'quarter',
    });
    history.do(
      insertNote({
        partId,
        staffId,
        measureId,
        voiceIndex: 2,
        index: 0,
        event: noteV2,
      })
    );

    const withNote = history.score;
    const v2Notes = withNote.parts[0].staves[0].measures[measureId].voices[1].events;
    expect(v2Notes[0].id).toBe('note-v2-test');

    // Undo step 2: back to voice 2 without inserted note
    history.undo();
    expect(history.score.parts[0].staves[0].measures[measureId].voices[1].events.every((e) => e.kind === 'rest')).toBe(true);

    // Undo step 1: back to single-voice score
    history.undo();
    expect(history.score.parts[0].staves[0].measures[measureId].voices).toHaveLength(1);

    // Redo step 1: voice 2 restored
    history.redo();
    expect(history.score.parts[0].staves[0].measures[measureId].voices).toHaveLength(2);

    // Redo step 2: inserted note restored
    history.redo();
    expect(history.score.parts[0].staves[0].measures[measureId].voices[1].events[0].id).toBe('note-v2-test');
  });

  it('removes an empty voice (rests only) without error', () => {
    const { score, staffId, measureId } = setupScore();
    const withV2 = JSON.parse(JSON.stringify(addVoice(staffId, measureId, 2).apply(score)));
    expect(withV2.parts[0].staves[0].measures[measureId].voices).toHaveLength(2);

    const cmd = removeVoice(staffId, measureId, 2);
    const updated = cmd.apply(withV2);

    const sm = updated.parts[0].staves[0].measures[measureId];
    expect(sm.voices).toHaveLength(1);
    expect(sm.voices[0].voiceIndex).toBe(1);
  });

  it('refuses removeVoice on a non-empty voice without force confirmation (Turkish message)', () => {
    const { score, staffId, measureId, partId } = setupScore();
    const withV2 = JSON.parse(JSON.stringify(addVoice(staffId, measureId, 2).apply(score)));

    // Insert a note into voice 2 so it is non-empty
    const note = createNote({
      id: 'active-note',
      pitches: [createPitch('A', 4)],
      baseType: 'half',
    });
    const withNote = insertNote({
      partId,
      staffId,
      measureId,
      voiceIndex: 2,
      index: 0,
      event: note,
    }).apply(withV2);

    // removeVoice without force must throw Turkish confirmation message
    const cmd = removeVoice(staffId, measureId, 2, false);
    expect(() => cmd.apply(withNote)).toThrow('Ses nota içeriyor. Silmek istediğinizden emin misiniz?');

    // With force: true, it successfully removes voice 2
    const forcedCmd = removeVoice(staffId, measureId, 2, true);
    const removed = forcedCmd.apply(withNote);
    expect(removed.parts[0].staves[0].measures[measureId].voices).toHaveLength(1);
  });

  it('changes pitch of a note in voice 2 without affecting voice 1', () => {
    const { score, staffId, measureId, partId } = setupScore();
    const withV2 = JSON.parse(JSON.stringify(addVoice(staffId, measureId, 2).apply(score)));
    const noteV2 = createNote({
      id: 'note-v2-pitch-test',
      pitches: [createPitch('C', 5)],
      baseType: 'half',
    });
    const withNote = insertNote({
      partId,
      staffId,
      measureId,
      voiceIndex: 2,
      index: 0,
      event: noteV2,
    }).apply(withV2);

    const newPitches = [createPitch('D', 5, 1)]; // D#5
    const updated = changePitch('note-v2-pitch-test', newPitches).apply(withNote);

    const sm = updated.parts[0].staves[0].measures[measureId];
    const v1Note = sm.voices[0].events[0];
    expect(v1Note.kind === 'note' && v1Note.pitches[0].step).toBe('C');
    expect(v1Note.kind === 'note' && v1Note.pitches[0].octave).toBe(4);

    const v2Note = sm.voices[1].events[0];
    expect(v2Note.kind === 'note' && v2Note.pitches[0].step).toBe('D');
    expect(v2Note.kind === 'note' && v2Note.pitches[0].alter).toBe(1);
  });

  it('deletes event in voice 2 leaving voice 1 intact, and cleans up empty voice 2', () => {
    const { score, staffId, measureId } = setupScore();
    const withV2 = JSON.parse(JSON.stringify(addVoice(staffId, measureId, 2).apply(score)));
    // Replace all rests in voice 2 with one single note
    withV2.parts[0].staves[0].measures[measureId].voices[1].events = [
      createNote({
        id: 'sole-note-v2',
        pitches: [createPitch('F', 4)],
        baseType: 'whole',
      }),
    ];

    const updated = deleteEvent('sole-note-v2').apply(withV2);
    const sm = updated.parts[0].staves[0].measures[measureId];

    // Voice 2 was emptied, so deleteEvent removed voice 2
    expect(sm.voices).toHaveLength(1);
    expect(sm.voices[0].voiceIndex).toBe(1);
    // Voice 1 is completely intact
    expect(sm.voices[0].events).toHaveLength(2);
  });

  it('rejects voiceIndex outside 1..4 (0, 5) leaving score completely unchanged', () => {
    const { score, staffId, measureId, partId } = setupScore();
    const initialSnapshot = JSON.parse(JSON.stringify(score));

    const note = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });

    // Try inserting at voiceIndex 5
    const result5 = insertNote({
      partId,
      staffId,
      measureId,
      voiceIndex: 5 as any,
      event: note,
    }).apply(score);
    expect(result5).toEqual(initialSnapshot);

    // Try inserting at voiceIndex 0
    const result0 = insertNote({
      partId,
      staffId,
      measureId,
      voiceIndex: 0 as any,
      event: note,
    }).apply(score);
    expect(result0).toEqual(initialSnapshot);
  });
});
