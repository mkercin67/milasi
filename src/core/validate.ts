/**
 * Validation rules and integrity checks for ScoreForge scores.
 *
 * Implements validation according to music notation rules and model constraints,
 * such as verifying voice durations against measure time signatures.
 */

import { ALLOWED_ARTICULATIONS, ALLOWED_DYNAMICS, Id, MeasureDef, Score } from './model';
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

  // Schema version check (1, 2, 3, or 4)
  if (
    score.schemaVersion !== 1 &&
    score.schemaVersion !== 2 &&
    score.schemaVersion !== 3 &&
    score.schemaVersion !== 4
  ) {
    problems.push({
      code: 'invalid-schema-version',
      message: `Unsupported schema version: ${score.schemaVersion} (expected 1, 2, 3, or 4)`,
      severity: 'error',
    });
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
    measureMap.set(mDef.id, mDef);
  }

  // Validate parts, staves, measures, and voices
  for (const part of score.parts) {
    for (const staff of part.staves) {
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

      // Slur validation (Milestone 6b)
      if (staff.slurs && staff.slurs.length > 0) {
        // Build chronological order map of event IDs on this staff
        const eventIndexMap = new Map<Id, number>();
        let order = 0;
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (sm) {
            for (const v of sm.voices) {
              for (const ev of v.events) {
                eventIndexMap.set(ev.id, order++);
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
          }
        }
      }
    }
  }

  return problems;
}
