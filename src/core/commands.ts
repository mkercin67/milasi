/**
 * Command pattern and undo/redo history for ScoreForge.
 *
 * Implements immutable state transitions using immer. Direct score mutations
 * are forbidden by architecture design principle 4.
 */

import { produce } from 'immer';
import {
  BarlineType,
  Id,
  MeasureDef,
  NoteEvent,
  Override,
  Pitch,
  RestEvent,
  Score,
  ScoreEvent,
  VoltaDef,
} from './model';
import { createMeasure, createRest, newId } from './factory';
import { getPitchMidi, transposeOctave, transposeSemitone } from './pitch';
import { measureTicks } from './time';
import { eventsInRange, RangeSelection, Selection } from './selection';

/** Interface for all operations that transform a Score. */
export interface Command {
  /** Descriptive name of the command. */
  name: string;
  /**
   * Applies the command to the given score, returning a new Score instance.
   *
   * @param score - Current score state.
   * @returns Updated score state.
   */
  apply(score: Score): Score;
}

/**
 * Manages an undo/redo stack of Score states.
 */
export class History {
  private past: Score[] = [];
  private current: Score;
  private future: Score[] = [];
  private cleanScore: Score;

  constructor(initialScore: Score) {
    this.current = initialScore;
    this.cleanScore = initialScore;
  }

  /** Gets the current score state. */
  get score(): Score {
    return this.current;
  }

  /** Marks the current state as saved/clean. */
  markClean(): void {
    this.cleanScore = this.current;
  }

  /** Checks whether the score has unsaved changes compared to the clean state. */
  isDirty(): boolean {
    return this.current !== this.cleanScore;
  }

  /** Clears history and resets to a new clean score state. */
  clear(newScore: Score): void {
    this.past = [];
    this.future = [];
    this.current = newScore;
    this.cleanScore = newScore;
  }

  /**
   * Executes a command, recording history and clearing the redo stack.
   *
   * @param command - Command to apply.
   * @returns The updated current score.
   */
  do(command: Command): Score {
    this.past.push(this.current);
    this.current = command.apply(this.current);
    this.future = [];
    return this.current;
  }

  /**
   * Undoes the last executed command.
   *
   * @returns The restored score, or undefined if undo is not possible.
   */
  undo(): Score | undefined {
    if (!this.canUndo()) {
      return undefined;
    }
    const previous = this.past.pop()!;
    this.future.push(this.current);
    this.current = previous;
    return this.current;
  }

  /**
   * Redoes the last undone command.
   *
   * @returns The restored score, or undefined if redo is not possible.
   */
  redo(): Score | undefined {
    if (!this.canRedo()) {
      return undefined;
    }
    const next = this.future.pop()!;
    this.past.push(this.current);
    this.current = next;
    return this.current;
  }

  /**
   * Checks whether an undo operation can be performed.
   *
   * @returns True if there are previous states in the stack.
   */
  canUndo(): boolean {
    return this.past.length > 0;
  }

  /**
   * Checks whether a redo operation can be performed.
   *
   * @returns True if there are future states in the stack.
   */
  canRedo(): boolean {
    return this.future.length > 0;
  }
}

/** Parameters for the insertNote command. */
export interface InsertNoteParams {
  partId: Id;
  staffId?: Id;
  measureId: Id;
  voiceIndex?: number;
  voiceId?: Id;
  index?: number;
  event: NoteEvent | RestEvent;
}

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
            voices: [{ id: newId(), events: [] }],
          };
        }

        const staffMeasure = staff.measures[params.measureId];
        let voice = params.voiceId
          ? staffMeasure.voices.find((v) => v.id === params.voiceId)
          : undefined;

        if (!voice && params.voiceIndex !== undefined) {
          voice = staffMeasure.voices[params.voiceIndex];
        }

        if (!voice) {
          if (staffMeasure.voices.length === 0) {
            voice = { id: newId(), events: [] };
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
 * Creates a command that updates the time signature of a measure definition.
 *
 * @param measureId - Target global measure ID.
 * @param timeSig - New time signature.
 * @returns An executable Command.
 */
export function setTimeSig(
  measureId: Id,
  timeSig: { num: number; den: number }
): Command {
  return {
    name: 'setTimeSig',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        const measure = draft.measures.find((m) => m.id === measureId);
        if (measure) {
          measure.timeSig = { ...timeSig };
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
 * Creates a command to update score metadata (title, subtitle, composer, arranger).
 *
 * @param titleOrMeta - Score title string or metadata object.
 * @param composerParam - Optional composer name if titleOrMeta is a string.
 * @returns An executable Command.
 */
export function setScoreMetadata(
  titleOrMeta: string | { title: string; subtitle?: string; composer?: string; arranger?: string },
  composerParam: string = ''
): Command {
  return {
    name: 'setScoreMetadata',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        if (typeof titleOrMeta === 'object' && titleOrMeta !== null) {
          draft.meta.title = titleOrMeta.title;
          draft.meta.composer = titleOrMeta.composer ?? '';
          draft.meta.subtitle = titleOrMeta.subtitle ?? '';
          draft.meta.arranger = titleOrMeta.arranger ?? '';
        } else {
          draft.meta.title = titleOrMeta;
          draft.meta.composer = composerParam;
        }
      });
    },
  };
}

/**
 * Changes key signature on a specific measure onwards ('from-here') or across the entire score ('score').
 */
export function setKeySignature(
  fromMeasureId: Id,
  keySig: number,
  scope: 'score' | 'from-here' = 'from-here'
): Command {
  return {
    name: 'setKeySignature',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        const clamped = Math.max(-7, Math.min(7, Math.round(keySig)));
        const targetIdx = draft.measures.findIndex((m) => m.id === fromMeasureId);
        if (targetIdx === -1) return;
        if (scope === 'score') {
          for (const m of draft.measures) {
            m.keySig = clamped;
          }
        } else {
          for (let i = targetIdx; i < draft.measures.length; i++) {
            draft.measures[i].keySig = clamped;
          }
        }
      });
    },
  };
}

/**
 * Changes time signature on a specific measure onwards ('from-here') or across the entire score ('score').
 */
export function setTimeSignature(
  fromMeasureId: Id,
  timeSig: { num: number; den: number },
  scope: 'score' | 'from-here' = 'from-here'
): Command {
  return {
    name: 'setTimeSignature',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        if (timeSig.num <= 0 || timeSig.den <= 0) return;
        const targetIdx = draft.measures.findIndex((m) => m.id === fromMeasureId);
        if (targetIdx === -1) return;
        const newSig = { num: Math.round(timeSig.num), den: Math.round(timeSig.den) };
        if (scope === 'score') {
          for (const m of draft.measures) {
            m.timeSig = { ...newSig };
          }
        } else {
          for (let i = targetIdx; i < draft.measures.length; i++) {
            draft.measures[i].timeSig = { ...newSig };
          }
        }
      });
    },
  };
}

/**
 * Marks or unmarks a measure as a pickup / anacrusis measure with custom duration in ticks.
 */
export function setPickup(measureId: Id, actualTicks: number | null): Command {
  return {
    name: 'setPickup',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        const m = draft.measures.find((meas) => meas.id === measureId);
        if (m) {
          if (actualTicks !== null && actualTicks > 0) {
            m.actualTicks = Math.round(actualTicks);
          } else {
            delete m.actualTicks;
          }
        }
      });
    },
  };
}

/**
 * Sets the ending barline type ('single' | 'double' | 'final') for a measure.
 */
export function setEndBarline(measureId: Id, barline: BarlineType): Command {
  return {
    name: 'setEndBarline',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        const m = draft.measures.find((meas) => meas.id === measureId);
        if (m) {
          m.endBarline = barline;
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

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const measureId of Object.keys(staff.measures)) {
              const staffMeasure = staff.measures[measureId];
              for (const voice of staffMeasure.voices) {
                const event = voice.events.find((ev: ScoreEvent) => ev.id === eventId);
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
 * Sets the tempo on a measure by index or ID.
 */
export function setTempo(
  measureIndexOrId: number | Id,
  tempo: { bpm: number; beatUnit?: number; tempoText?: string }
): Command {
  return {
    name: 'Set Tempo',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        let m: MeasureDef | undefined;
        if (typeof measureIndexOrId === 'number') {
          m = draft.measures[measureIndexOrId];
        } else {
          m = draft.measures.find((meas) => meas.id === measureIndexOrId);
        }
        if (m) {
          m.tempo = {
            bpm: Math.max(20, Math.min(300, Math.round(tempo.bpm))),
            beatUnit: tempo.beatUnit ?? m.tempo?.beatUnit ?? 1.0,
            tempoText: tempo.tempoText?.trim() || undefined,
          };
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

/**
 * Inserts a new measure after index (or at end).
 */
export function insertMeasure(index?: number): Command {
  return {
    name: 'Insert Measure',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        const targetIdx = index !== undefined ? index + 1 : draft.measures.length;
        const refMeasure = draft.measures[Math.max(0, targetIdx - 1)] ?? draft.measures[0];
        const timeSig = refMeasure ? { ...refMeasure.timeSig } : { num: 4, den: 4 };
        const keySig = refMeasure ? refMeasure.keySig : 0;

        const newMDef = createMeasure(timeSig, keySig);
        draft.measures.splice(targetIdx, 0, newMDef);

        const mDuration = measureTicks(timeSig);

        for (const part of draft.parts) {
          for (const staff of part.staves) {
            const wholeRest = createRest({
              baseType: 'whole',
              duration: mDuration,
              wholeMeasure: true,
            });
            staff.measures[newMDef.id] = {
              voices: [{ id: newId(), events: [wholeRest] }],
            };
          }
        }
      });
    },
  };
}

/**
 * Deletes a measure at index.
 */
export function deleteMeasure(index: number): Command {
  return {
    name: 'Delete Measure',
    apply(score: Score): Score {
      if (score.measures.length <= 1) {
        throw new Error('Score must have at least 1 measure');
      }
      return produce(score, (draft) => {
        const deletedDef = draft.measures[index];
        if (!deletedDef) return;
        draft.measures.splice(index, 1);

        for (const part of draft.parts) {
          for (const staff of part.staves) {
            delete staff.measures[deletedDef.id];
          }
        }
      });
    },
  };
}

/**
 * Toggles tie from note to next matching note in voice.
 */
export function toggleTie(eventId: string, pitchIndex: number = 0): Command {
  return {
    name: 'Toggle Tie',
    apply(score: Score): Score {
      let foundStaffId = null;
      let foundVoiceId = null;
      let startMIdx = -1;
      let startEvIdx = -1;
      let sourceNote = null;

      for (const part of score.parts) {
        for (const staff of part.staves) {
          for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
            const mDef = score.measures[mIdx];
            const sm = staff.measures[mDef.id];
            if (!sm) continue;
            for (const v of sm.voices) {
              const idx = v.events.findIndex((e) => e.id === eventId);
              if (idx !== -1) {
                foundStaffId = staff.id;
                foundVoiceId = v.id;
                startMIdx = mIdx;
                startEvIdx = idx;
                const ev = v.events[idx];
                if (ev.kind === 'note') sourceNote = ev;
                break;
              }
            }
          }
        }
      }

      if (!sourceNote || !sourceNote.pitches[pitchIndex]) {
        throw new Error('No matching next note to tie to');
      }

      const pitchToMatch = sourceNote.pitches[pitchIndex];

      let nextNote = null;
      let searchDone = false;

      for (const part of score.parts) {
        for (const staff of part.staves) {
          if (staff.id !== foundStaffId) continue;
          for (let mIdx = startMIdx; mIdx < score.measures.length; mIdx++) {
            const mDef = score.measures[mIdx];
            const sm = staff.measures[mDef.id];
            if (!sm) continue;
            for (const v of sm.voices) {
              if (v.id !== foundVoiceId) continue;
              const startI = mIdx === startMIdx ? startEvIdx + 1 : 0;
              for (let i = startI; i < v.events.length; i++) {
                const ev = v.events[i];
                if (ev.kind === 'note') {
                  nextNote = ev;
                  searchDone = true;
                  break;
                }
              }
              if (searchDone) break;
            }
            if (searchDone) break;
          }
        }
      }

      if (!nextNote) {
        throw new Error('No matching next note to tie to');
      }

      const hasMatchingPitch = nextNote.pitches.some(
        (p) =>
          p.step === pitchToMatch.step &&
          p.octave === pitchToMatch.octave &&
          p.alter === pitchToMatch.alter
      );

      if (!hasMatchingPitch) {
        throw new Error('No matching next note to tie to');
      }

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (ev.id === eventId && ev.kind === 'note') {
                    const p = ev.pitches[pitchIndex];
                    if (p) {
                      p.tiedToNext = !p.tiedToNext;
                      ev.tiedToNext = ev.pitches.some((pi) => pi.tiedToNext);
                    }
                    return;
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
 * Modifies accidental alter by delta (-2..+2).
 */
export function setExplicitAccidental(eventId: string, delta: number, pitchIndex: number = 0): Command {
  return {
    name: 'Set Explicit Accidental',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (ev.id === eventId && ev.kind === 'note') {
                    const p = ev.pitches[pitchIndex];
                    if (p) {
                      p.alter = Math.max(-2, Math.min(2, Math.round(p.alter + delta)));
                    }
                    return;
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

const SHARPS_ORDER: Pitch['step'][] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLATS_ORDER: Pitch['step'][] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/**
 * Resets accidental to key signature default.
 */
export function resetAccidentalToKeySig(eventId: string, pitchIndex: number = 0): Command {
  return {
    name: 'Reset Accidental',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (ev.id === eventId && ev.kind === 'note') {
                    const p = ev.pitches[pitchIndex];
                    if (p) {
                      const keySig = mDef.keySig;
                      let defaultAlter = 0;
                      if (keySig > 0 && SHARPS_ORDER.slice(0, keySig).includes(p.step)) {
                        defaultAlter = 1;
                      } else if (keySig < 0 && FLATS_ORDER.slice(0, Math.abs(keySig)).includes(p.step)) {
                        defaultAlter = -1;
                      }
                      p.alter = defaultAlter;
                    }
                    return;
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

function getTargetEventIds(score: Score, target: string | Selection): string[] {
  if (typeof target === 'string') return [target];
  if (target.kind === 'event') return [target.id];
  if (target.kind === 'range') return eventsInRange(score, target).map((e) => e.id);
  return [];
}

/** Sets or removes dynamic marking on a note or selection. */
export function setDynamic(target: string | Selection, dynamic: string | null): Command {
  return {
    name: dynamic ? `Set Dynamic ${dynamic}` : 'Clear Dynamic',
    apply(score: Score): Score {
      const targetIds = new Set(getTargetEventIds(score, target));
      if (targetIds.size === 0) return score;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (targetIds.has(ev.id) && ev.kind === 'note') {
                    if (dynamic) {
                      ev.dynamic = dynamic;
                    } else {
                      delete ev.dynamic;
                    }
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

/** Toggles an articulation marking with conflict resolution (accent and marcato exclude each other). */
export function toggleArticulation(target: string | Selection, articulation: string): Command {
  return {
    name: `Toggle Articulation ${articulation}`,
    apply(score: Score): Score {
      const targetIds = new Set(getTargetEventIds(score, target));
      if (targetIds.size === 0) return score;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (targetIds.has(ev.id) && ev.kind === 'note') {
                    if (!ev.articulations) ev.articulations = [];
                    const idx = ev.articulations.indexOf(articulation);
                    if (idx >= 0) {
                      ev.articulations.splice(idx, 1);
                    } else {
                      // Conflict resolution: accent and marcato exclude each other
                      if (articulation === 'accent') {
                        ev.articulations = ev.articulations.filter((a) => a !== 'marcato');
                      } else if (articulation === 'marcato') {
                        ev.articulations = ev.articulations.filter((a) => a !== 'accent');
                      }
                      ev.articulations.push(articulation);
                    }
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

/** Toggles a slur over the range selection on a staff. */
export function toggleSlur(selection: Selection): Command {
  return {
    name: 'Toggle Slur',
    apply(score: Score): Score {
      if (selection.kind !== 'range') return score;
      const staffId = selection.staffId;
      const targetEvents = eventsInRange(score, selection);
      if (targetEvents.length < 2) return score;

      const firstId = targetEvents[0].id;
      const lastId = targetEvents[targetEvents.length - 1].id;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            if (staff.id === staffId) {
              if (!staff.slurs) staff.slurs = [];
              const existingIdx = staff.slurs.findIndex(
                (s) =>
                  (s.startEventId === firstId && s.endEventId === lastId) ||
                  (s.startEventId === lastId && s.endEventId === firstId)
              );
              if (existingIdx >= 0) {
                staff.slurs.splice(existingIdx, 1);
              } else {
                staff.slurs.push({
                  id: newId(),
                  startEventId: firstId,
                  endEventId: lastId,
                });
              }
              return;
            }
          }
        }
      });
    },
  };
}

/** Clears all dynamics, articulations, and slurs originating on the selection. */
export function clearSelectionNotations(selection: Selection): Command {
  return {
    name: 'Clear Selection Notations',
    apply(score: Score): Score {
      const targetIds = new Set(getTargetEventIds(score, selection));
      if (targetIds.size === 0) return score;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            if (staff.slurs) {
              staff.slurs = staff.slurs.filter(
                (s) => !targetIds.has(s.startEventId) && !targetIds.has(s.endEventId)
              );
            }
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (targetIds.has(ev.id) && ev.kind === 'note') {
                    delete ev.dynamic;
                    ev.articulations = [];
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

/** Sets or clears the start repeat marking on a measure. */
export function setRepeatStart(measureId: Id, repeatStart: boolean): Command {
  return {
    name: 'Set Repeat Start',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        const m = draft.measures.find((meas) => meas.id === measureId);
        if (m) {
          if (repeatStart) {
            m.repeatStart = true;
          } else {
            delete m.repeatStart;
          }
        }
      });
    },
  };
}

/** Sets or clears the end repeat marking on a measure. */
export function setRepeatEnd(measureId: Id, repeatEnd: boolean): Command {
  return {
    name: 'Set Repeat End',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        const m = draft.measures.find((meas) => meas.id === measureId);
        if (m) {
          if (repeatEnd) {
            m.repeatEnd = true;
          } else {
            delete m.repeatEnd;
          }
        }
      });
    },
  };
}

/** Sets or clears the volta (1st / 2nd ending) on a measure. */
export function setVolta(measureId: Id, volta: VoltaDef | undefined): Command {
  return {
    name: 'Set Volta',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        const m = draft.measures.find((meas) => meas.id === measureId);
        if (m) {
          if (volta) {
            m.volta = { ...volta };
          } else {
            delete m.volta;
          }
        }
      });
    },
  };
}

/** Sets or clears a lyric syllable on a note event for a given verse. */
export function setLyrics(eventId: Id, text: string | undefined, verse: number = 1): Command {
  return {
    name: 'Set Lyrics',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (ev.id === eventId && ev.kind === 'note') {
                    if (text !== undefined && text.trim().length > 0) {
                      const trimmed = text.trim();
                      if (!ev.lyrics) {
                        ev.lyrics = [{ verse, text: trimmed }];
                      } else {
                        const existingIdx = ev.lyrics.findIndex((l) => l.verse === verse);
                        if (existingIdx >= 0) {
                          ev.lyrics[existingIdx].text = trimmed;
                        } else {
                          ev.lyrics.push({ verse, text: trimmed });
                        }
                      }
                    } else if (ev.lyrics) {
                      ev.lyrics = ev.lyrics.filter((l) => l.verse !== verse);
                      if (ev.lyrics.length === 0) {
                        delete ev.lyrics;
                      }
                    }
                    return;
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

/** Pastes whitespace-delimited syllables across consecutive non-tied notes starting at startEventId. */
export function pasteLyrics(startEventId: Id, text: string, _score?: Score, verse: number = 1): Command {
  const syllables = text.trim().split(/\s+/).filter(Boolean);
  return {
    name: 'Paste Lyrics',
    apply(currentScore: Score): Score {
      return produce(currentScore, (draft) => {
        if (syllables.length === 0) return;

        // Collect all eligible notes in sequential order
        const eligibleNotes: NoteEvent[] = [];
        let startCollecting = false;

        for (const part of draft.parts) {
          for (const staff of part.staves) {
            let prevTied = false;
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  const isSecondTied = prevTied;
                  if (ev.kind === 'note') {
                    prevTied = Boolean(ev.tiedToNext || ev.pitches.some((p) => p.tiedToNext));
                    if (!startCollecting) {
                      if (ev.id === startEventId) {
                        startCollecting = true;
                      }
                    }
                    if (startCollecting && !isSecondTied) {
                      eligibleNotes.push(ev);
                    }
                  } else {
                    prevTied = false;
                  }
                }
              }
            }
          }
        }

        for (let i = 0; i < syllables.length && i < eligibleNotes.length; i++) {
          const note = eligibleNotes[i];
          const syllText = syllables[i];
          if (!note.lyrics) {
            note.lyrics = [{ verse, text: syllText }];
          } else {
            const existingIdx = note.lyrics.findIndex((l) => l.verse === verse);
            if (existingIdx >= 0) {
              note.lyrics[existingIdx].text = syllText;
            } else {
              note.lyrics.push({ verse, text: syllText });
            }
          }
        }
      });
    },
  };
}

const SOLFEGE_MAP: Record<string, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

/** Automatically assigns Turkish solfege syllables (Do, Re, Mi, Fa, Sol, La, Si) to notes based on pitch step. */
export function autoSolfege(targetMeasureIdOrScoreId?: Id): Command {
  return {
    name: 'Auto Solfege',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              if (
                targetMeasureIdOrScoreId &&
                targetMeasureIdOrScoreId !== score.id &&
                mDef.id !== targetMeasureIdOrScoreId
              ) {
                continue;
              }
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (ev.kind === 'note' && ev.pitches.length > 0) {
                    const step = ev.pitches[0].step;
                    const syllable = SOLFEGE_MAP[step] ?? step;
                    ev.lyrics = [{ verse: 1, text: syllable }];
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
