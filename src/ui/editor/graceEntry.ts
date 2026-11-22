// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Pure decision logic of grace note entry (M7c-3b part 3): what a key press does while grace entry is on.
 * Kept free of React so it can be tested directly; `useEditorGrace` wires it to the editor.
 */
import { addGraceNote, removeGraceNote, setGracePitch } from '../../core/notationCommands';
import { Command } from '../../core/commands';
import { pitchFromLetter } from '../../core/input';
import { findEventContext } from '../../core/selection';
import { GraceKeyIntent, KeyEventLike, mapGraceKey } from '../keymap';
import {
  BaseDurationType,
  GraceBaseType,
  GraceKind,
  MAX_GRACE_NOTES,
  NoteEvent,
  Score,
} from '../../core/model';

/** The input duration if it is a legal grace duration, otherwise a sixteenth. */
export function graceDuration(active: BaseDurationType): GraceBaseType {
  return active === 'eighth' || active === '16th' || active === '32nd' ? active : '16th';
}

/** The note with this id, or null (rests and unknown ids give null). */
export function findNoteEvent(score: Score, eventId: string): NoteEvent | null {
  const ctx = findEventContext(score, eventId);
  if (!ctx) return null;
  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (staff.id !== ctx.staffId) continue;
      for (const v of staff.measures[ctx.measureId]?.voices ?? []) {
        const ev = v.events.find((e) => e.id === eventId);
        if (ev && ev.kind === 'note') return ev;
      }
    }
  }
  return null;
}

type GraceKeyResult =
  | { kind: 'ignore' }
  | { kind: 'exit' }
  | { kind: 'limit' }
  | { kind: 'command'; command: Command };

/** What a key press does while grace entry is on for the selected note. */
export function graceKeyResult(
  score: Score,
  selectedEventId: string | null,
  graceEntry: GraceKind | null,
  activeDuration: BaseDurationType,
  e: KeyEventLike
): GraceKeyResult {
  if (!graceEntry || !selectedEventId) return { kind: 'ignore' };
  const note = findNoteEvent(score, selectedEventId);
  if (!note) return { kind: 'ignore' };
  const intent: GraceKeyIntent | null = mapGraceKey(e);
  if (!intent) return { kind: 'ignore' };

  if (intent.type === 'exit') return { kind: 'exit' };
  if (intent.type === 'remove') return { kind: 'command', command: removeGraceNote(note.id) };
  if (intent.type === 'raise' || intent.type === 'lower') {
    const last = (note.graces?.length ?? 0) - 1;
    if (last < 0) return { kind: 'ignore' };
    const p = note.graces![last].pitch;
    const alter = Math.max(-2, Math.min(2, p.alter + (intent.type === 'raise' ? 1 : -1)));
    return { kind: 'command', command: setGracePitch(note.id, last, { ...p, alter }) };
  }
  if ((note.graces?.length ?? 0) >= MAX_GRACE_NOTES) return { kind: 'limit' };

  const ctx = findEventContext(score, note.id);
  if (!ctx) return { kind: 'ignore' };
  const staff = score.parts.flatMap((p) => p.staves).find((s) => s.id === ctx.staffId);
  const keySig = score.measures[ctx.measureIndex]?.keySig ?? 0;
  const pitch = pitchFromLetter(intent.step, note.pitches[0], staff?.clef ?? { sign: 'G', line: 2 }, keySig);
  return {
    kind: 'command',
    command: addGraceNote(note.id, { kind: graceEntry, pitch, baseType: graceDuration(activeDuration) }),
  };
}
