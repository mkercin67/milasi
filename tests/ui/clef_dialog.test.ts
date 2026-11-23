// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-5 part 3: the clef dialog decisions and the entry paths that read the clef in force.
import { describe, expect, it } from 'vitest';
import { clefAtPosition, clefOfEvent } from '../../src/core/clef';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { pitchFromLetter } from '../../src/core/input';
import { findEventContext } from '../../src/core/selection';
import { setClefChange } from '../../src/core/structureCommands';
import { buildClefCommand, clefDialogTarget, clefInForce } from '../../src/ui/app/clefDialog';
import type { Clef, Score } from '../../src/core/model';

const BASS: Clef = { sign: 'F', line: 4 };
const TENOR: Clef = { sign: 'C', line: 4 };
const name = (c: Clef) => `${c.sign}${c.line}${c.octaveShift ?? ''}`;

function setup(): { score: Score; ids: string[]; staffId: string; m0: string } {
  const score = createEmptyScore({ numMeasures: 2 });
  const staff = score.parts[0].staves[0];
  const evs = [0, 1, 2, 3].map(() => createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' }));
  staff.measures[score.measures[0].id].voices[0].events = evs;
  return { score, ids: evs.map((e) => e.id), staffId: staff.id, m0: score.measures[0].id };
}

describe('M7c-5 clef dialog and entry paths (part 3)', () => {
  it('CD1: findEventContext reports the start tick of the event', () => {
    const { score, ids } = setup();
    expect(findEventContext(score, ids[0])?.tick).toBe(0);
    expect(findEventContext(score, ids[2])?.tick).toBe(1920);
  });

  it('CD2: clefOfEvent and clefAtPosition follow a change inside the staff', () => {
    const { score, ids, staffId, m0 } = setup();
    const changed = setClefChange(staffId, m0, 1920, BASS).apply(score);
    expect(name(clefOfEvent(changed, ids[1]) as Clef)).toBe('G2');
    expect(name(clefOfEvent(changed, ids[2]) as Clef)).toBe('F4');
    expect(clefOfEvent(changed, 'nope')).toBe(null);
    expect(name(clefAtPosition(changed, staffId, m0, 960))).toBe('G2');
    expect(name(clefAtPosition(changed, staffId, m0, 2000))).toBe('F4');
    expect(name(clefAtPosition(changed, 'unknown-staff', m0, 2000))).toBe('F4'); // falls back to the first staff
  });

  it('CD3: the first typed note after a change starts from the middle line of the clef in force', () => {
    const { score, staffId, m0 } = setup();
    const changed = setClefChange(staffId, m0, 1920, BASS).apply(score);
    const early = pitchFromLetter('c', null, clefAtPosition(changed, staffId, m0, 0), 0);
    const late = pitchFromLetter('c', null, clefAtPosition(changed, staffId, m0, 1920), 0);
    expect(`${early.step}${early.octave}`).toBe('C5'); // nearest C to B4 (treble middle line)
    expect(`${late.step}${late.octave}`).toBe('C3'); // nearest C to D3 (bass middle line)
  });

  it('CD4: the dialog targets the staff and place of the selected note, or the first staff', () => {
    const { score, ids } = setup();
    const none = clefDialogTarget(score, undefined);
    expect(none?.place).toBeUndefined();
    const sel = clefDialogTarget(score, ids[2]);
    expect(sel?.place?.tick).toBe(1920);
    expect(sel?.place?.measureIndex).toBe(0);
  });

  it('CD5: clefInForce shows the opening clef for the staff scope and the clef at the note for from-note', () => {
    const { score, ids, staffId, m0 } = setup();
    const changed = setClefChange(staffId, m0, 1920, BASS).apply(score);
    const target = clefDialogTarget(changed, ids[3])!;
    expect(name(clefInForce(changed, target, 'staff'))).toBe('G2');
    expect(name(clefInForce(changed, target, 'from-note'))).toBe('F4');
  });

  it('CD6: buildClefCommand picks setStaffClef or setClefChange and applies it', () => {
    const { score, ids } = setup();
    const staffCmd = buildClefCommand(clefDialogTarget(score, ids[2])!, 'staff', TENOR);
    expect(staffCmd.name).toBe('setStaffClef');
    expect(name(staffCmd.apply(score).parts[0].staves[0].clef)).toBe('C4');

    const noteCmd = buildClefCommand(clefDialogTarget(score, ids[2])!, 'from-note', BASS);
    expect(noteCmd.name).toBe('setClefChange');
    const after = noteCmd.apply(score).parts[0].staves[0];
    expect(name(after.clef)).toBe('G2');
    expect(after.clefChanges?.length).toBe(1);
    expect(after.clefChanges?.[0].tick).toBe(1920);

    // from-note at the very first note is the opening clef
    const first = buildClefCommand(clefDialogTarget(score, ids[0])!, 'from-note', BASS);
    expect(first.name).toBe('setStaffClef');

    // choosing the clef already in force removes the change
    const withChange = noteCmd.apply(score);
    const back = buildClefCommand(clefDialogTarget(withChange, ids[2])!, 'from-note', { sign: 'G', line: 2 });
    expect(back.apply(withChange).parts[0].staves[0].clefChanges).toBeUndefined();
  });
});
