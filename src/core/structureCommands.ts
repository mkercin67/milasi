// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Score structure commands: metadata, key signatures, time signatures, barlines, tempo, measures, repeats, voltas.
 */

import { produce } from 'immer';
import { BarlineType, BeamGroupingMode, Id, MeasureDef, Score, TimeSigDisplay, VoltaDef } from './model';
import { Command } from './commandTypes';
import { createMeasure, createRest, inheritTimeSigDisplay, newId } from './factory';
import { fillMeasureWithRests, measureTicks } from './time';

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
 * Sets how eighth-note runs are beamed for the whole score (M7b-7).
 * 'beat' is the default and is stored as an absent field so old files stay byte-identical.
 */
export function setBeamGrouping(mode: BeamGroupingMode): Command {
  return {
    name: 'setBeamGrouping',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        if (mode === 'beat') {
          if (draft.layoutSettings) {
            delete draft.layoutSettings.beamGrouping;
            if (Object.keys(draft.layoutSettings).length === 0) delete draft.layoutSettings;
          }
        } else {
          draft.layoutSettings = { ...(draft.layoutSettings ?? {}), beamGrouping: mode };
        }
      });
    },
  };
}

/**
 * Turns the derived note-name line (Do Re Mi / C D E under each note) on or off for the score.
 * Off is stored as an absent field so old files stay byte-identical. Lyrics are never touched.
 */
export function setShowNoteNames(show: boolean): Command {
  return {
    name: 'setShowNoteNames',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        if (!show) {
          if (draft.layoutSettings) {
            delete draft.layoutSettings.showNoteNames;
            if (Object.keys(draft.layoutSettings).length === 0) delete draft.layoutSettings;
          }
        } else {
          draft.layoutSettings = { ...(draft.layoutSettings ?? {}), showNoteNames: true };
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
  scope: 'score' | 'from-here' = 'from-here',
  display: TimeSigDisplay = 'numeric'
): Command {
  return {
    name: 'setTimeSignature',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        if (timeSig.num <= 0 || timeSig.den <= 0) return;
        const targetIdx = draft.measures.findIndex((m) => m.id === fromMeasureId);
        if (targetIdx === -1) return;
        const newSig = { num: Math.round(timeSig.num), den: Math.round(timeSig.den) };
        // The symbols only exist for 4/4 (C) and 2/2 (cut); anything else is stored as numeric (= absent).
        const valid =
          (display === 'common' && newSig.num === 4 && newSig.den === 4) ||
          (display === 'cut' && newSig.num === 2 && newSig.den === 2);
        const apply = (m: MeasureDef) => {
          m.timeSig = { ...newSig };
          if (valid) m.timeSigDisplay = display;
          else delete m.timeSigDisplay;
        };
        if (scope === 'score') {
          for (const m of draft.measures) apply(m);
        } else {
          for (let i = targetIdx; i < draft.measures.length; i++) apply(draft.measures[i]);
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
          delete measure.timeSigDisplay; // the symbol belongs to the old signature
        }
      });
    },
  };
}

/**
 * After a measure changes length (pickup on or off), makes every voice fit again: the rests after the last
 * note are replaced by rests that fill exactly the new length. Voices whose notes already run past the new
 * length are left alone, so no note is ever deleted by this.
 */
function refitTrailingRests(draft: Score, measureId: Id, newLength: number): void {
  for (const part of draft.parts) {
    for (const staff of part.staves) {
      const sm = staff.measures[measureId];
      if (!sm) continue;
      for (const voice of sm.voices) {
        let contentEnd = 0;
        let keep = 0;
        let t = 0;
        voice.events.forEach((ev, i) => {
          t += ev.duration;
          if (ev.kind !== 'rest') {
            contentEnd = t;
            keep = i + 1;
          }
        });
        if (contentEnd > newLength) continue;
        voice.events = [
          ...voice.events.slice(0, keep),
          ...fillMeasureWithRests(newLength - contentEnd, () => newId()),
        ];
      }
    }
  }
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
          refitTrailingRests(draft, m.id, m.actualTicks ?? measureTicks(m.timeSig));
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

        const isAtEnd = targetIdx >= draft.measures.length;
        const lastMDef = draft.measures[draft.measures.length - 1];
        const hadFinal = isAtEnd && lastMDef?.endBarline === 'final';
        if (hadFinal && lastMDef) {
          lastMDef.endBarline = 'single';
        }

        const newEndBarline: BarlineType = hadFinal ? 'final' : 'single';
        const newMDef = inheritTimeSigDisplay(
          refMeasure,
          createMeasure(timeSig, keySig, undefined, undefined, newEndBarline)
        );
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
        const isLast = index === draft.measures.length - 1;
        const hadFinal = deletedDef.endBarline === 'final';
        draft.measures.splice(index, 1);
        if (isLast && hadFinal && draft.measures.length > 0) {
          draft.measures[draft.measures.length - 1].endBarline = 'final';
        }

        for (const part of draft.parts) {
          for (const staff of part.staves) {
            // Events of the deleted measure: slurs tied to them and per-event overrides go too,
            // otherwise validation reports slurs that reference a missing end event.
            const gone = new Set<string>();
            for (const v of staff.measures[deletedDef.id]?.voices ?? []) {
              for (const ev of v.events) gone.add(ev.id);
            }
            if (gone.size > 0) {
              if (staff.slurs) {
                staff.slurs = staff.slurs.filter((sl) => !gone.has(sl.startEventId) && !gone.has(sl.endEventId));
              }
              if (staff.hairpins) {
                staff.hairpins = staff.hairpins.filter((h) => !gone.has(h.startEventId) && !gone.has(h.endEventId));
              }
              for (const id of gone) delete draft.overrides[id];
            }
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
