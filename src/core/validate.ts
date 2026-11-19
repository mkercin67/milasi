// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Validation rules and integrity checks for ScoreForge scores.
 *
 * Implements validation according to music notation rules and model constraints,
 * such as verifying voice durations against measure time signatures.
 */

import { ALLOWED_ARTICULATIONS, ALLOWED_DYNAMICS, Id, MeasureDef, Score } from './model';
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

/**
 * Validates a Score against structural, rhythmic, and model integrity rules.
 *
 * @param score - The score to validate.
 * @returns An array of detected validation problems. An empty array means valid.
 */
export function validateScore(score: Score): ValidationProblem[] {
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

      // Slur validation (Milestone 6b + 7 intra-voice)
      if (staff.slurs && staff.slurs.length > 0) {
        // Build chronological order map and voice index map of event IDs on this staff
        const eventIndexMap = new Map<Id, number>();
        const eventVoiceMap = new Map<Id, number>();
        let order = 0;
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (sm) {
            for (let vIdx = 0; vIdx < sm.voices.length; vIdx++) {
              const v = sm.voices[vIdx];
              const vIndex = v.voiceIndex ?? (vIdx + 1);
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

  return problems;
}
