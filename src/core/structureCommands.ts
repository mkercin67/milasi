// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Score structure commands: metadata, key signatures, time signatures, barlines, tempo, measures, repeats, voltas.
 */

import { produce } from 'immer';
import { BarlineType, Id, MeasureDef, Score, VoltaDef } from './model';
import { Command } from './commandTypes';
import { createMeasure, createRest, newId } from './factory';
import { measureTicks } from './time';

/**
 * Creates a command that updates the score title, subtitle, composer, and arranger metadata.
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

/** Legacy alias for setTimeSignature on a single measure */
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
              voices: [{ id: newId(), voiceIndex: 1, events: [wholeRest] }],
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
