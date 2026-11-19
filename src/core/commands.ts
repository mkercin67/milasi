// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Command pattern and undo/redo history for ScoreForge.
 *
 * Implements immutable state transitions using immer. Direct score mutations
 * are forbidden by architecture design principle 4.
 */

import { produce } from 'immer';
import {
  Id,
  NoteEvent,
  Override,
  Pitch,
  RestEvent,
  Score,
  ScoreEvent,
} from './model';
import { createRest, newId } from './factory';
import { getPitchMidi, transposeOctave, transposeSemitone } from './pitch';
import { eventsInRange, RangeSelection } from './selection';
import { Command, InsertNoteParams } from './commandTypes';
import { fillMeasureWithRests, measureTicks } from './time';

export * from './commandTypes';
export * from './structureCommands';
export * from './notationCommands';

/**
 * Creates a command that inserts a note or rest event into a voice.
 *
 * @param params - Insertion coordinates and event to insert.
 * @returns An executable Command.
 */
export function insertNote(params: InsertNoteParams): Command {
  return {
    name: 'insertNote',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        const part = draft.parts.find((p) => p.id === params.partId);
        if (!part) {
          throw new Error(`Part not found: ${params.partId}`);
        }

        const staff = params.staffId
          ? part.staves.find((s) => s.id === params.staffId)
          : part.staves[0];
        if (!staff) {
          throw new Error(`Staff not found: ${params.staffId ?? 'default'}`);
        }

        if (!staff.measures[params.measureId]) {
          staff.measures[params.measureId] = {
            voices: [{ id: newId(), voiceIndex: 1, events: [] }],
          };
        }

        const staffMeasure = staff.measures[params.measureId];
        let voice = params.voiceId
          ? staffMeasure.voices.find((v) => v.id === params.voiceId)
          : undefined;

        if (!voice && params.voiceIndex !== undefined) {
          voice = staffMeasure.voices.find(
            (v, idx) => (v.voiceIndex ?? (idx + 1)) === params.voiceIndex
          );
        }

        if (!voice) {
          if (params.voiceIndex !== undefined && params.voiceIndex >= 1 && params.voiceIndex <= 4) {
            voice = { id: newId(), voiceIndex: params.voiceIndex as 1 | 2 | 3 | 4, events: [] };
            staffMeasure.voices.push(voice);
            staffMeasure.voices.sort((a, b) => a.voiceIndex - b.voiceIndex);
          } else if (staffMeasure.voices.length === 0) {
            voice = { id: newId(), voiceIndex: 1, events: [] };
            staffMeasure.voices.push(voice);
          } else {
            voice = staffMeasure.voices[0];
          }
        }

        const targetIndex =
          params.index !== undefined && params.index >= 0 && params.index <= voice.events.length
            ? params.index
            : voice.events.length;

        voice.events.splice(targetIndex, 0, params.event);
      });
    },
  };
}

/**
 * Creates a command that deletes a score event by its unique ID.
 * If deletion empties the measure of events in that voice:
 * - Leaves a rest of the measure length in voice 1
 * - Removes the voice if voiceIndex > 1
 *
 * @param eventId - Identifier of the event to delete.
 * @returns An executable Command.
 */
export function deleteEvent(eventId: Id): Command {
  return {
    name: 'deleteEvent',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        let deleted = false;
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const measureId of Object.keys(staff.measures)) {
              const staffMeasure = staff.measures[measureId];
              for (const voice of staffMeasure.voices) {
                const idx = voice.events.findIndex((ev: ScoreEvent) => ev.id === eventId);
                if (idx !== -1) {
                  voice.events.splice(idx, 1);
                  deleted = true;

                  if (voice.events.length === 0) {
                    if (voice.voiceIndex === 1) {
                      const mDef = draft.measures.find((m) => m.id === measureId);
                      const targetTicks = mDef?.actualTicks ?? (mDef ? measureTicks(mDef.timeSig) : 3840);
                      voice.events = fillMeasureWithRests(targetTicks);
                    } else if (voice.voiceIndex !== undefined && voice.voiceIndex > 1) {
                      staffMeasure.voices = staffMeasure.voices.filter((v) => v !== voice);
                    }
                  }

                  if (staff.slurs) {
                    staff.slurs = staff.slurs.filter(
                      (s) => s.startEventId !== eventId && s.endEventId !== eventId
                    );
                  }
                  break;
                }
              }
              if (deleted) break;
            }
            if (deleted) break;
          }
          if (deleted) break;
        }

        if (draft.overrides[eventId]) {
          delete draft.overrides[eventId];
        }
      });
    },
  };
}

/**
 * Creates an empty voice with voiceIndex (2..4) filled with rests.
 */
export function addVoice(
  staffId: Id,
  measureId: Id,
  voiceIndex: 2 | 3 | 4
): Command {
  return {
    name: 'addVoice',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        for (const part of draft.parts) {
          const staff = part.staves.find((s) => s.id === staffId);
          if (!staff) continue;
          let sm = staff.measures[measureId];
          if (!sm) {
            sm = { voices: [] };
            staff.measures[measureId] = sm;
          }
          if (sm.voices.some((v) => v.voiceIndex === voiceIndex)) {
            return; // Voice already exists
          }
          const mDef = draft.measures.find((m) => m.id === measureId);
          const targetLength = mDef?.actualTicks ?? (mDef ? measureTicks(mDef.timeSig) : 3840);
          const rests = fillMeasureWithRests(targetLength);
          sm.voices.push({
            id: newId(),
            voiceIndex,
            events: rests,
          });
          sm.voices.sort((a, b) => a.voiceIndex - b.voiceIndex);
        }
      });
    },
  };
}

/**
 * Removes a voice with voiceIndex (2..4).
 * Voice 1 cannot be removed.
 * If the voice contains notes, requires force: true (confirmation).
 */
export function removeVoice(
  staffId: Id,
  measureId: Id,
  voiceIndex: 2 | 3 | 4,
  force: boolean = false
): Command {
  return {
    name: 'removeVoice',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        for (const part of draft.parts) {
          const staff = part.staves.find((s) => s.id === staffId);
          if (!staff) continue;
          const sm = staff.measures[measureId];
          if (!sm) continue;
          const vIdx = sm.voices.findIndex((v) => v.voiceIndex === voiceIndex);
          if (vIdx === -1) continue;
          const voice = sm.voices[vIdx];
          const hasNotes = voice.events.some((ev) => ev.kind === 'note');
          if (hasNotes && !force) {
            throw new Error('Ses nota içeriyor. Silmek istediğinizden emin misiniz?');
          }
          sm.voices.splice(vIdx, 1);
        }
      });
    },
  };
}

/**
 * Creates a command that changes the pitches of a note event.
 *
 * @param eventId - Target note event ID.
 * @param pitches - New array of pitches.
 * @returns An executable Command.
 */
export function changePitch(eventId: Id, pitches: Pitch[]): Command {
  return {
    name: 'changePitch',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        let updated = false;
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const measureId of Object.keys(staff.measures)) {
              const staffMeasure = staff.measures[measureId];
              for (const voice of staffMeasure.voices) {
                const event = voice.events.find((ev: ScoreEvent) => ev.id === eventId);
                if (event && event.kind === 'note') {
                  event.pitches = pitches.map((p) => ({ ...p }));
                  updated = true;
                  break;
                }
              }
              if (updated) break;
            }
            if (updated) break;
          }
          if (updated) break;
        }
      });
    },
  };
}

/**
 * Creates a command that sets or removes a manual visual layout override.
 *
 * @param elementId - ID of the target element.
 * @param override - Override values, or undefined to clear the override.
 * @param accumulate - When true, dx and dy are added to existing values.
 * @returns An executable Command.
 */
export function setOverride(elementId: Id, override?: Override, accumulate = false): Command {
  return {
    name: 'setOverride',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        if (override === undefined) {
          delete draft.overrides[elementId];
        } else {
          const existing = draft.overrides[elementId];
          if (accumulate && existing) {
            draft.overrides[elementId] = {
              ...existing,
              ...override,
              dx: (existing.dx ?? 0) + (override.dx ?? 0),
              dy: (existing.dy ?? 0) + (override.dy ?? 0),
            };
          } else {
            draft.overrides[elementId] = {
              ...existing,
              ...override,
            };
          }
        }
      });
    },
  };
}

/**
 * Clears visual layout overrides for an element.
 *
 * @param elementId - ID of the target element.
 * @returns An executable Command.
 */
export function clearOverride(elementId: Id): Command {
  return setOverride(elementId, undefined);
}

/**
 * Clears all manual visual layout overrides across the entire score in one undoable step.
 *
 * @returns An executable Command.
 */
export function clearAllOverrides(): Command {
  return {
    name: 'clearAllOverrides',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        draft.overrides = {};
      });
    },
  };
}

/**
 * Creates a command that replaces a note or chord with a rest of identical duration.
 * If the target event is already a rest, performs no changes.
 *
 * @param eventId - Target event ID.
 * @returns An executable Command.
 */
export function convertToRest(eventId: Id): Command {
  return {
    name: 'convertToRest',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const measureId of Object.keys(staff.measures)) {
              const staffMeasure = staff.measures[measureId];
              for (const voice of staffMeasure.voices) {
                const idx = voice.events.findIndex((ev: ScoreEvent) => ev.id === eventId);
                if (idx !== -1) {
                  const ev = voice.events[idx];
                  if (ev.kind === 'note') {
                    const rest: RestEvent = {
                      id: ev.id,
                      kind: 'rest',
                      duration: ev.duration,
                      baseType: ev.baseType,
                      dots: ev.dots,
                      tuplet: ev.tuplet ? { ...ev.tuplet } : undefined,
                    };
                    voice.events[idx] = rest;
                    delete draft.overrides[eventId];
                    if (staff.slurs) {
                      staff.slurs = staff.slurs.filter(
                        (s) => s.startEventId !== eventId && s.endEventId !== eventId
                      );
                    }
                  }
                  return;
                }
              }
            }
          }
        }
      });
    },
  };
}

/**
 * Creates a command that transposes the pitches of a note event by semitones.
 * Octave shifts (12 semitones) preserve accidentals and alter only the octave number.
 * Semitone shifts follow standard sharp-ascending and flat-descending spelling rules.
 * Rest events are untouched.
 *
 * @param eventId - Target event ID.
 * @param semitones - Number of semitones to shift (positive = up, negative = down).
 * @returns An executable Command.
 */
export function transposeEvent(eventId: Id, semitones: number): Command {
  return {
    name: 'transposeEvent',
    apply(score: Score): Score {
      if (semitones === 0) return score;

      // Locate event on unproxied score first to avoid proxying all measures
      let targetPartId = '';
      let targetStaffId = '';
      let targetMeasureId = '';
      let targetVoiceId = '';

      for (const part of score.parts) {
        for (const staff of part.staves) {
          for (const measureId of Object.keys(staff.measures)) {
            const staffMeasure = staff.measures[measureId];
            for (const v of staffMeasure.voices) {
              const ei = v.events.findIndex((ev: ScoreEvent) => ev.id === eventId);
              if (ei !== -1) {
                targetPartId = part.id;
                targetStaffId = staff.id;
                targetMeasureId = measureId;
                targetVoiceId = v.id;
                break;
              }
            }
            if (targetVoiceId) break;
          }
          if (targetVoiceId) break;
        }
        if (targetVoiceId) break;
      }

      if (!targetVoiceId) return score;

      return produce(score, (draft) => {
        const part = draft.parts.find((p) => p.id === targetPartId);
        const staff = part?.staves.find((s) => s.id === targetStaffId);
        const staffMeasure = staff?.measures[targetMeasureId];
        const voice = staffMeasure?.voices.find((v) => v.id === targetVoiceId);
        const event = voice?.events.find((e: ScoreEvent) => e.id === eventId);
        if (event && event.kind === 'note') {
          if (Math.abs(semitones) === 12) {
            const octaves = semitones > 0 ? 1 : -1;
            event.pitches = event.pitches.map((p) => transposeOctave(p, octaves));
          } else {
            const direction = semitones > 0 ? 'up' : 'down';
            const steps = Math.abs(semitones);
            event.pitches = event.pitches.map((p) => {
              let current = p;
              for (let i = 0; i < steps; i++) {
                current = transposeSemitone(current, direction);
              }
              return current;
            });
          }
        }
      });
    },
  };
}

/**
 * Converts all events in the specified range to rests of matching durations.
 */
export function deleteRange(range: RangeSelection): Command {
  return {
    name: 'Delete Range',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        const toDelete = eventsInRange(score, range);
        if (toDelete.length === 0) return;
        const targetIds = new Set(toDelete.map((e) => e.id));

        for (const part of draft.parts) {
          for (const staff of part.staves) {
            if (staff.id !== range.staffId) continue;
            if (staff.slurs) {
              staff.slurs = staff.slurs.filter(
                (s) => !targetIds.has(s.startEventId) && !targetIds.has(s.endEventId)
              );
            }
            for (const mDef of draft.measures) {
              const staffMeasure = staff.measures[mDef.id];
              if (!staffMeasure) continue;
              for (const voice of staffMeasure.voices) {
                for (let i = 0; i < voice.events.length; i++) {
                  const ev = voice.events[i];
                  if (targetIds.has(ev.id)) {
                    voice.events[i] = createRest({
                      baseType: ev.baseType,
                      duration: ev.duration,
                      dots: ev.dots,
                    });
                    delete draft.overrides[ev.id];
                  }
                }
              }
            }
          }
        }
      });
    },
  };
}

/**
 * Transposes all notes in range by semitones, asserting pitches stay within MIDI 21..108.
 */
export function transposeRange(range: RangeSelection, semitones: number): Command {
  return {
    name: 'Transpose Range',
    apply(score: Score): Score {
      const inRangeEvents = eventsInRange(score, range);
      const noteEvents = inRangeEvents.filter((e): e is NoteEvent => e.kind === 'note');

      // Verify bounds first: refuse if ANY pitch leaves MIDI 21..108
      for (const note of noteEvents) {
        for (const p of note.pitches) {
          const targetMidi = getPitchMidi(p) + semitones;
          if (targetMidi < 21 || targetMidi > 108) {
            throw new Error(`Transpose would exceed MIDI bounds (21..108): ${targetMidi}`);
          }
        }
      }

      return produce(score, (draft) => {
        const targetIds = new Set(noteEvents.map((e) => e.id));
        const direction = semitones > 0 ? 'up' : 'down';
        const steps = Math.abs(semitones);

        for (const part of draft.parts) {
          for (const staff of part.staves) {
            if (staff.id !== range.staffId) continue;
            if (staff.slurs) {
              staff.slurs = staff.slurs.filter(
                (s) => !targetIds.has(s.startEventId) && !targetIds.has(s.endEventId)
              );
            }
            for (const mDef of draft.measures) {
              const staffMeasure = staff.measures[mDef.id];
              if (!staffMeasure) continue;
              for (const voice of staffMeasure.voices) {
                for (const ev of voice.events) {
                  if (targetIds.has(ev.id) && ev.kind === 'note') {
                    ev.pitches = ev.pitches.map((p) => {
                      let current = p;
                      for (let s = 0; s < steps; s++) {
                        current = transposeSemitone(current, direction);
                      }
                      return current;
                    });
                  }
                }
              }
            }
          }
        }
      });
    },
  };
}
