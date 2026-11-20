// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Helper utilities for generating ScoreForge regression gallery cases via commands.
 */

import { createNote, createPitch, createRest } from '../core/factory';
import { BaseDurationType, NoteEvent, PitchStep, RestEvent, Score } from '../core/model';
import { insertNote, deleteEvent } from '../core/commands';
import { findStaff } from '../core/staffLookup';

/**
 * Replaces the events in a measure voice using insertNote and deleteEvent commands.
 */
export function setMeasureEventsViaCommands(
  score: Score,
  measureIndex: number,
  events: (NoteEvent | RestEvent)[],
  voiceIndex: 1 | 2 | 3 | 4 = 1,
  targetStaffId?: string
): Score {
  const partId = score.parts[0].id;
  const staff = (targetStaffId ? findStaff(score, targetStaffId) : undefined) ?? score.parts[0].staves[0];
  const staffId = staff.id;
  const measureId = score.measures[measureIndex].id;
  const sm = staff.measures[measureId];
  const targetVoice = sm?.voices.find((v) => v.voiceIndex === voiceIndex) ?? sm?.voices.find((v) => v.voiceIndex === 1);
  const existingEvents = targetVoice?.events ?? [];
  const existingIds = existingEvents.map((e) => e.id);

  let currentScore = score;
  for (let i = 0; i < events.length; i++) {
    currentScore = insertNote({
      partId,
      staffId,
      measureId,
      voiceIndex,
      index: i,
      event: events[i],
    }).apply(currentScore);
  }

  for (const id of existingIds) {
    currentScore = deleteEvent(id).apply(currentScore);
  }

  return currentScore;
}

export function qNote(step: PitchStep, octave: number, alter: number = 0): NoteEvent {
  return createNote({ pitches: [createPitch(step, octave, alter)], baseType: 'quarter' });
}

export function hNote(step: PitchStep, octave: number, dots: number = 0): NoteEvent {
  return createNote({ pitches: [createPitch(step, octave)], baseType: 'half', dots });
}

export function wNote(step: PitchStep, octave: number): NoteEvent {
  return createNote({ pitches: [createPitch(step, octave)], baseType: 'whole' });
}

export function note(step: PitchStep, octave: number, baseType: BaseDurationType, dots: number = 0): NoteEvent {
  return createNote({ pitches: [createPitch(step, octave)], baseType, dots });
}

export function rest(baseType: BaseDurationType, dots: number = 0): RestEvent {
  return createRest({ baseType, dots });
}
