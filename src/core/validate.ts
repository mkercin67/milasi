// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Validation rules and integrity checks for ScoreForge scores.
 *
 * Implements validation according to music notation rules and model constraints,
 * such as verifying voice durations against measure time signatures.
 */

import { ALLOWED_ARTICULATIONS, ALLOWED_DYNAMICS, Id, MeasureDef, NoteEvent, Pitch, Score } from './model';
import { isPercussionInstrument } from './instruments';
import { measureTicks } from './time';

/** Severity level of a validation problem. */
export type ProblemSeverity = 'error' | 'warning';

/** Validation problem descriptor. */
export interface ValidationProblem {
  code: string;
  message: string;
  severity: ProblemSeverity;
  partId?: Id;
  staffId?: Id;
  measureId?: Id;
  voiceId?: Id;
  eventId?: Id;
}

export let validateRunCounter = 0;

export function resetValidateRunCounter(): void {
  validateRunCounter = 0;
}

/**
 * Validates a Score against structural, rhythmic, and model integrity rules.
 *
 * @param score - The score to validate.
 * @returns An array of detected validation problems. An empty array means valid.
 */
export function validateScore(score: Score): ValidationProblem[] {
  validateRunCounter++;
  const problems: ValidationProblem[] = [];

  // Schema version check (1, 2, 3, 4, 5, 6, or 7)
  if (
    score.schemaVersion !== 1 &&
    score.schemaVersion !== 2 &&
    score.schemaVersion !== 3 &&
    score.schemaVersion !== 4 &&
    score.schemaVersion !== 5 &&
    score.schemaVersion !== 6 &&
    score.schemaVersion !== 7
  ) {
    problems.push({
      code: 'invalid-schema-version',
      message: `Unsupported schema version: ${score.schemaVersion} (expected 1, 2, 3, 4, 5, 6, or 7)`,
      severity: 'error',
    });
  }

  // Score-wide layout settings (M7b-7): only known beam grouping modes are accepted.
  const beamGrouping = score.layoutSettings?.beamGrouping;
  if (beamGrouping !== undefined && beamGrouping !== 'beat' && beamGrouping !== 'half-bar') {
    problems.push({
      code: 'invalid-beam-grouping',
      message: `Unsupported beamGrouping: ${String(beamGrouping)} (expected 'beat' or 'half-bar')`,
      severity: 'error',
    });
  }

  const showNoteNames = score.layoutSettings?.showNoteNames;
  if (showNoteNames !== undefined && typeof showNoteNames !== 'boolean') {
    problems.push({
      code: 'invalid-show-note-names',
      message: `Unsupported showNoteNames: ${String(showNoteNames)} (expected a boolean)`,
      severity: 'error',
    });
  }

  // Schema v7: Check MIDI channel reuse when more than 15 non-percussion parts exist
  if (score.schemaVersion === 7 && Array.isArray(score.parts)) {
    const nonPercParts = score.parts.filter(
      (p) => !isPercussionInstrument(p.instrument) && !isPercussionInstrument(p.name)
    );
    if (nonPercParts.length > 15) {
      problems.push({
        code: 'midi-channel-reuse',
        message: `More than 15 non-percussion parts (${nonPercParts.length}) share MIDI channels`,
        severity: 'warning',
      });
    }
  }

  // Measure map for quick lookup
  const measureMap = new Map<Id, MeasureDef>();

  // Validate measure definitions
  for (const mDef of score.measures) {
    if (mDef.timeSig.num <= 0 || mDef.timeSig.den <= 0) {
      problems.push({
        code: 'invalid-time-sig',
        message: `Measure ${mDef.id} has invalid time signature ${mDef.timeSig.num}/${mDef.timeSig.den}`,
        severity: 'error',
        measureId: mDef.id,
      });
    }
    if (mDef.timeSigDisplay !== undefined) {
      if (!['numeric', 'common', 'cut'].includes(mDef.timeSigDisplay)) {
        problems.push({
          code: 'invalid-time-sig-display',
          message: `Measure ${mDef.id} has unsupported timeSigDisplay: ${String(mDef.timeSigDisplay)}`,
          severity: 'error',
          measureId: mDef.id,
        });
      } else if (
        (mDef.timeSigDisplay === 'common' && !(mDef.timeSig.num === 4 && mDef.timeSig.den === 4)) ||
        (mDef.timeSigDisplay === 'cut' && !(mDef.timeSig.num === 2 && mDef.timeSig.den === 2))
      ) {
        problems.push({
          code: 'time-sig-display-mismatch',
          message: `Measure ${mDef.id}: timeSigDisplay '${mDef.timeSigDisplay}' does not fit ${mDef.timeSig.num}/${mDef.timeSig.den}; digits are drawn`,
          severity: 'warning',
          measureId: mDef.id,
        });
      }
    }
    if (mDef.endBarline && !['single', 'double', 'final'].includes(mDef.endBarline)) {
      problems.push({
        code: 'invalid-barline',
        message: `Measure ${mDef.id} has invalid endBarline: ${mDef.endBarline}`,
        severity: 'error',
        measureId: mDef.id,
      });
    }
    if (mDef.volta && mDef.volta.number !== 1 && mDef.volta.number !== 2) {
      problems.push({
        code: 'invalid-volta',
        message: `Measure ${mDef.id} has invalid volta number: ${mDef.volta.number}`,
        severity: 'error',
        measureId: mDef.id,
      });
    }
    measureMap.set(mDef.id, mDef);
  }

  // Cross-measure repeat and volta validation
  let inRepeatBlock = false;
  let seenVolta1 = false;
  for (const m of score.measures) {
    if (m.repeatStart) {
      if (inRepeatBlock) {
        problems.push({
          code: 'nested-repeat',
          message: `Measure ${m.id} has nested repeat start without closing preceding repeat`,
          severity: 'error',
          measureId: m.id,
        });
      }
      inRepeatBlock = true;
    }
    if (m.repeatEnd) {
      inRepeatBlock = false;
    }
    if (m.volta?.number === 1) {
      seenVolta1 = true;
    } else if (m.volta?.number === 2 && !seenVolta1) {
      problems.push({
        code: 'volta-2-without-1',
        message: `Measure ${m.id} has volta 2 without preceding volta 1`,
        severity: 'warning',
        measureId: m.id,
      });
    }
  }

  // Validate parts, staves, measures, and voices
  for (const part of score.parts) {
    for (const staff of part.staves) {
      // Schema v7: Every MeasureDef must exist on every staff
      if (score.schemaVersion === 7) {
        for (const mDef of score.measures) {
          if (!staff.measures[mDef.id]) {
            problems.push({
              code: 'missing-staff-measure',
              message: `Staff ${staff.id} is missing measure definition: ${mDef.id}`,
              severity: 'error',
              partId: part.id,
              staffId: staff.id,
              measureId: mDef.id,
            });
          }
        }
      }

      for (const [measureId, staffMeasure] of Object.entries(staff.measures)) {
        const mDef = measureMap.get(measureId);
        if (!mDef) {
          problems.push({
            code: 'orphaned-measure',
            message: `Staff measure references non-existent measure definition: ${measureId}`,
            severity: 'error',
            partId: part.id,
            staffId: staff.id,
            measureId,
          });
          continue;
        }

        // Schema v7 voiceIndex checks
        if (score.schemaVersion === 7) {
          if (!staffMeasure.voices || staffMeasure.voices.length === 0) {
            problems.push({
              code: 'empty-staff-measure',
              message: `StaffMeasure ${measureId} on staff ${staff.id} has no voices`,
              severity: 'error',
              partId: part.id,
              staffId: staff.id,
              measureId,
            });
          } else if (staffMeasure.voices.length > 4) {
            problems.push({
              code: 'too-many-voices',
              message: `StaffMeasure ${measureId} on staff ${staff.id} has ${staffMeasure.voices.length} voices (maximum 4)`,
              severity: 'error',
              partId: part.id,
              staffId: staff.id,
              measureId,
            });
          }

          const seenVoiceIndices = new Set<number>();
          let hasVoice1 = false;
          for (const voice of staffMeasure.voices) {
            if (typeof voice.voiceIndex !== 'number' || voice.voiceIndex < 1 || voice.voiceIndex > 4) {
              problems.push({
                code: 'invalid-voice-index',
                message: `Voice ${voice.id} in measure ${measureId} has invalid voiceIndex: ${voice.voiceIndex}`,
                severity: 'error',
                partId: part.id,
                staffId: staff.id,
                measureId,
                voiceId: voice.id,
              });
            } else if (seenVoiceIndices.has(voice.voiceIndex)) {
              problems.push({
                code: 'duplicate-voice-index',
                message: `Measure ${measureId} on staff ${staff.id} has duplicate voiceIndex: ${voice.voiceIndex}`,
                severity: 'error',
                partId: part.id,
                staffId: staff.id,
                measureId,
                voiceId: voice.id,
              });
            } else {
              seenVoiceIndices.add(voice.voiceIndex);
            }
            if (voice.voiceIndex === 1) {
              hasVoice1 = true;
            }
          }

          if (!hasVoice1) {
            problems.push({
              code: 'missing-voice-1',
              message: `Measure ${measureId} on staff ${staff.id} is missing mandatory voice 1`,
              severity: 'error',
              partId: part.id,
              staffId: staff.id,
              measureId,
            });
          }
        }

        const expectedTicks = mDef.actualTicks ?? measureTicks(mDef.timeSig);

        for (const voice of staffMeasure.voices) {
          let voiceTicks = 0;

          for (const ev of voice.events) {
            voiceTicks += ev.duration;

            // Fermata and breath mark / caesura (M7c-2): known values only, on notes and rests
            if (ev.fermata !== undefined && ev.fermata !== 'above' && ev.fermata !== 'below') {
              problems.push({
                code: 'invalid-fermata',
                message: `Event ${ev.id} has unsupported fermata: ${String(ev.fermata)}`,
                severity: 'error',
                partId: part.id,
                staffId: staff.id,
                measureId,
                voiceId: voice.id,
                eventId: ev.id,
              });
            }
            if (ev.phraseMark !== undefined && ev.phraseMark !== 'breath' && ev.phraseMark !== 'caesura') {
              problems.push({
                code: 'invalid-phrase-mark',
                message: `Event ${ev.id} has unsupported phraseMark: ${String(ev.phraseMark)}`,
                severity: 'error',
                partId: part.id,
                staffId: staff.id,
                measureId,
                voiceId: voice.id,
                eventId: ev.id,
              });
            }

            // Note event pitch validation
            if (ev.kind === 'note') {
              // Dynamic validation (Milestone 6b)
              if (ev.dynamic && !ALLOWED_DYNAMICS.has(ev.dynamic)) {
                problems.push({
                  code: 'invalid-dynamic',
                  message: `Note ${ev.id} has invalid dynamic marking: ${ev.dynamic}`,
                  severity: 'error',
                  partId: part.id,
                  staffId: staff.id,
                  measureId,
                  voiceId: voice.id,
                  eventId: ev.id,
                });
              }

              // Articulation validation (Milestone 6b)
              if (ev.articulations && ev.articulations.length > 0) {
                const seenArticulations = new Set<string>();
                let hasAccent = false;
                let hasMarcato = false;

                for (const art of ev.articulations) {
                  if (!ALLOWED_ARTICULATIONS.has(art)) {
                    problems.push({
                      code: 'invalid-articulation',
                      message: `Note ${ev.id} has invalid articulation marking: ${art}`,
                      severity: 'error',
                      partId: part.id,
                      staffId: staff.id,
                      measureId,
                      voiceId: voice.id,
                      eventId: ev.id,
                    });
                  }
                  if (seenArticulations.has(art)) {
                    problems.push({
                      code: 'duplicate-articulation',
                      message: `Note ${ev.id} has duplicate articulation: ${art}`,
                      severity: 'error',
                      partId: part.id,
                      staffId: staff.id,
                      measureId,
                      voiceId: voice.id,
                      eventId: ev.id,
                    });
                  }
                  seenArticulations.add(art);
                  if (art === 'accent') hasAccent = true;
                  if (art === 'marcato') hasMarcato = true;
                }

                if (hasAccent && hasMarcato) {
                  problems.push({
                    code: 'conflict-articulation',
                    message: `Note ${ev.id} cannot carry both accent and marcato`,
                    severity: 'error',
                    partId: part.id,
                    staffId: staff.id,
                    measureId,
                    voiceId: voice.id,
                    eventId: ev.id,
                  });
                }
              }

              if (!ev.pitches || ev.pitches.length === 0) {
                problems.push({
                  code: 'empty-note-pitches',
                  message: `Note ${ev.id} in voice ${voice.id} has no pitches`,
                  severity: 'error',
                  partId: part.id,
                  staffId: staff.id,
                  measureId,
                  voiceId: voice.id,
                  eventId: ev.id,
                });
              } else {
                for (const p of ev.pitches) {
                  if (typeof p.alter !== 'number' || !Number.isFinite(p.alter)) {
                    problems.push({
                      code: 'invalid-pitch-alter',
                      message: `Note ${ev.id} has invalid pitch alteration: ${p.alter}`,
                      severity: 'error',
                      partId: part.id,
                      staffId: staff.id,
                      measureId,
                      voiceId: voice.id,
                      eventId: ev.id,
                    });
                  }
                }
              }
            }
          }

          // Voice duration check against measure duration
          if (voiceTicks < expectedTicks) {
            problems.push({
              code: 'measure-underfull',
              message: `Voice ${voice.id} in measure ${measureId} is short: ${voiceTicks} ticks (expected ${expectedTicks})`,
              severity: 'error',
              partId: part.id,
              staffId: staff.id,
              measureId,
              voiceId: voice.id,
            });
          } else if (voiceTicks > expectedTicks) {
            problems.push({
              code: 'measure-overfull',
              message: `Voice ${voice.id} in measure ${measureId} is overfull: ${voiceTicks} ticks (expected ${expectedTicks})`,
              severity: 'error',
              partId: part.id,
              staffId: staff.id,
              measureId,
              voiceId: voice.id,
            });
          }
        }
      }

      // Tie validation (Schema v7 intra-voice)
      if (score.schemaVersion === 7) {
        const voiceNotesMap = new Map<number, Array<{ note: NoteEvent; measureId: Id; voiceId: Id; tickStart: number }>>();
        const allStaffNotes: Array<{ note: NoteEvent; voiceIndex: number; measureId: Id; tickStart: number }> = [];
        let runningStaffTick = 0;
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (sm) {
            for (const v of sm.voices) {
              const vIndex = v.voiceIndex;
              let list = voiceNotesMap.get(vIndex);
              if (!list) {
                list = [];
                voiceNotesMap.set(vIndex, list);
              }
              let vTick = runningStaffTick;
              for (const ev of v.events) {
                if (ev.kind === 'note') {
                  const entry = { note: ev, measureId: mDef.id, voiceId: v.id, tickStart: vTick };
                  list.push(entry);
                  allStaffNotes.push({ note: ev, voiceIndex: vIndex, measureId: mDef.id, tickStart: vTick });
                }
                vTick += ev.duration;
              }
            }
          }
          runningStaffTick += (mDef.actualTicks ?? measureTicks(mDef.timeSig));
        }

        for (const [vIndex, vNotes] of voiceNotesMap.entries()) {
          for (let i = 0; i < vNotes.length; i++) {
            const current = vNotes[i];
            const hasTiedPitch = current.note.tiedToNext || current.note.pitches.some((p: Pitch) => p.tiedToNext);
            if (!hasTiedPitch) continue;

            for (const sp of current.note.pitches) {
              if (current.note.tiedToNext || sp.tiedToNext) {
                const nextInVoice = vNotes[i + 1];
                const matchesSameVoice = nextInVoice && nextInVoice.note.pitches.some(
                  (tp: Pitch) => tp.step === sp.step && tp.octave === sp.octave && tp.alter === sp.alter
                );

                if (!matchesSameVoice) {
                  const expectedNextTick = current.tickStart + current.note.duration;
                  const crossVoiceMatch = allStaffNotes.find(
                    (other) =>
                      other.voiceIndex !== vIndex &&
                      other.tickStart === expectedNextTick &&
                      other.note.pitches.some(
                        (tp: Pitch) => tp.step === sp.step && tp.octave === sp.octave && tp.alter === sp.alter
                      )
                  );

                  if (crossVoiceMatch) {
                    problems.push({
                      code: 'tie-cross-voice',
                      message: `Note ${current.note.id} in voice ${vIndex} attempts to tie to note ${crossVoiceMatch.note.id} in voice ${crossVoiceMatch.voiceIndex}`,
                      severity: 'error',
                      partId: part.id,
                      staffId: staff.id,
                      measureId: current.measureId,
                      voiceId: current.voiceId,
                      eventId: current.note.id,
                    });
                  }
                }
              }
            }
          }
        }
      }

      // Slur validation (Milestone 6b + 7 intra-voice)
      if (staff.slurs && staff.slurs.length > 0) {
        // Build chronological order map and voice index map of event IDs on this staff
        const eventIndexMap = new Map<Id, number>();
        const eventVoiceMap = new Map<Id, number>();
        let order = 0;
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (sm) {
            for (const v of sm.voices) {
              const vIndex = v.voiceIndex;
              for (const ev of v.events) {
                eventIndexMap.set(ev.id, order++);
                eventVoiceMap.set(ev.id, vIndex);
              }
            }
          }
        }

        for (const slur of staff.slurs) {
          const startIdx = eventIndexMap.get(slur.startEventId);
          const endIdx = eventIndexMap.get(slur.endEventId);

          if (startIdx === undefined) {
            problems.push({
              code: 'slur-missing-start',
              message: `Slur ${slur.id} references missing start event ${slur.startEventId}`,
              severity: 'error',
              staffId: staff.id,
            });
          }
          if (endIdx === undefined) {
            problems.push({
              code: 'slur-missing-end',
              message: `Slur ${slur.id} references missing end event ${slur.endEventId}`,
              severity: 'error',
              staffId: staff.id,
            });
          }
          if (startIdx !== undefined && endIdx !== undefined) {
            if (startIdx >= endIdx) {
              problems.push({
                code: 'slur-invalid-order',
                message: `Slur ${slur.id} start event must strictly precede end event chronologically`,
                severity: 'error',
                staffId: staff.id,
              });
            }

            const startVoice = eventVoiceMap.get(slur.startEventId);
            const endVoice = eventVoiceMap.get(slur.endEventId);
            if (startVoice !== undefined && endVoice !== undefined && startVoice !== endVoice) {
              problems.push({
                code: 'slur-cross-voice',
                message: `Slur ${slur.id} connects events across different voices (voice ${startVoice} to voice ${endVoice})`,
                severity: 'error',
                staffId: staff.id,
              });
            }
          }
        }
      }
    }
  }

  // StaffGroup validation (Milestone 7)
  if (score.groups && score.groups.length > 0) {
    const partIdSet = new Set(score.parts.map((p) => p.id));
    for (const group of score.groups) {
      for (const partId of group.partIds) {
        if (!partIdSet.has(partId)) {
          problems.push({
            code: 'group-unknown-part',
            message: `StaffGroup "${group.id}" references unknown partId "${partId}"`,
            severity: 'error',
          });
        }
      }
    }
  }

  return problems;
}
