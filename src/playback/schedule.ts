import { PPQ, measureTicks } from '../core/time';
import { Pitch, Score } from '../core/model';
import { pitchToMidi } from './pitch';
import {
  BuildScheduleOptions,
  MeasureStartTime,
  ScheduledNote,
  ScheduleResult,
} from './types';

const DYNAMICS_VELOCITY: Record<string, number> = {
  pp: 0.25,
  p: 0.4,
  mp: 0.55,
  mf: 0.7,
  f: 0.85,
  ff: 1.0,
  sfz: 0.95,
  fp: 0.85,
};

const DEFAULT_TEMPO = { bpm: 120, beatUnit: 1.0 };
const DEFAULT_VELOCITY = 0.7;

function pitchesMatch(p1: Pitch[], p2: Pitch[]): boolean {
  if (p1.length !== p2.length) return false;
  return p1.every((pitch, idx) => {
    const other = p2[idx];
    return (
      pitch.step === other.step &&
      pitch.octave === other.octave &&
      (pitch.alter ?? 0) === (other.alter ?? 0)
    );
  });
}

/**
 * Builds a deterministic, sorted schedule of notes from a score.
 * Pure function: no Tone.js or audio engine dependencies.
 */
export function buildSchedule(
  score: Score,
  options: BuildScheduleOptions = {}
): ScheduleResult {
  // 1. Calculate measure start times and per-measure tempo
  const measureStarts: MeasureStartTime[] = [];
  const measureDurations: number[] = [];
  const measureTempos: Array<{ bpm: number; beatUnit: number }> = [];

  let currentTempo = DEFAULT_TEMPO;
  let accumulatedSeconds = 0;

  for (const mDef of score.measures) {
    if (mDef.tempo) {
      currentTempo = {
        bpm: mDef.tempo.bpm,
        beatUnit: mDef.tempo.beatUnit ?? 1.0,
      };
    }
    measureTempos.push(currentTempo);
    measureStarts.push({
      measureId: mDef.id,
      startSeconds: accumulatedSeconds,
    });

    // Seconds per tick = 60 / (bpm * beatUnit * PPQ)
    const secondsPerTick = 60 / (currentTempo.bpm * currentTempo.beatUnit * PPQ);
    const mTicks = measureTicks(mDef.timeSig);
    const mDurationSeconds = mTicks * secondsPerTick;
    measureDurations.push(mDurationSeconds);
    accumulatedSeconds += mDurationSeconds;
  }

  const rawTotalSeconds = accumulatedSeconds;
  const eventTimes = new Map<string, { startSeconds: number; endSeconds: number }>();
  const scheduledNotes: ScheduledNote[] = [];

  // 2. Process each part, staff, and voice
  for (const part of score.parts) {
    for (const staff of part.staves) {
      // Collect event IDs under slurs on this staff for legato playback
      const slurredEventIds = new Set<string>();
      const slurredToNextEventIds = new Set<string>();
      if (staff.slurs && staff.slurs.length > 0) {
        const staffEvents: string[] = [];
        for (const mDef of score.measures) {
          const sm = staff.measures[mDef.id];
          if (sm) {
            for (const v of sm.voices) {
              for (const ev of v.events) {
                staffEvents.push(ev.id);
              }
            }
          }
        }
        for (const slur of staff.slurs) {
          const startIdx = staffEvents.indexOf(slur.startEventId);
          const endIdx = staffEvents.indexOf(slur.endEventId);
          if (startIdx >= 0 && endIdx >= startIdx) {
            for (let i = startIdx; i <= endIdx; i++) {
              slurredEventIds.add(staffEvents[i]);
              if (i < endIdx) {
                slurredToNextEventIds.add(staffEvents[i]);
              }
            }
          }
        }
      }

      // Find maximum number of voices across measures
      let maxVoices = 1;
      for (const mDef of score.measures) {
        const sm = staff.measures[mDef.id];
        if (sm && sm.voices.length > maxVoices) {
          maxVoices = sm.voices.length;
        }
      }

      for (let vIdx = 0; vIdx < maxVoices; vIdx++) {
        let currentVelocity = DEFAULT_VELOCITY;
        // Map to track active tied notes by pitch string key
        let activeTies: Array<{
          note: ScheduledNote;
          pitches: Pitch[];
        }> | null = null;

        for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
          const mDef = score.measures[mIdx];
          const sm = staff.measures[mDef.id];
          if (!sm) continue;
          const voice = sm.voices[vIdx];
          if (!voice) continue;

          const tempo = measureTempos[mIdx];
          const secondsPerTick = 60 / (tempo.bpm * tempo.beatUnit * PPQ);
          let currentTick = 0;
          const mStartSec = measureStarts[mIdx].startSeconds;

          for (const ev of voice.events) {
            const evStartSeconds = mStartSec + currentTick * secondsPerTick;
            const evDurationSeconds = ev.duration * secondsPerTick;
            const evEndSeconds = evStartSeconds + evDurationSeconds;

            eventTimes.set(ev.id, {
              startSeconds: evStartSeconds,
              endSeconds: evEndSeconds,
            });

            currentTick += ev.duration;

            if (ev.kind === 'rest') {
              // Rests clear any broken ties
              activeTies = null;
              continue;
            }

            if (ev.kind === 'note') {
              // Dynamic marking update and persistence
              if (ev.dynamic && DYNAMICS_VELOCITY[ev.dynamic] !== undefined) {
                currentVelocity = DYNAMICS_VELOCITY[ev.dynamic];
              }

              let noteVelocity = currentVelocity;
              const hasAccent = ev.articulations?.includes('accent');
              const hasMarcato = ev.articulations?.includes('marcato');
              const hasTenuto = ev.articulations?.includes('tenuto');
              const hasStaccato = ev.articulations?.includes('staccato');

              if (hasAccent) {
                noteVelocity = Math.min(1.0, noteVelocity + 0.15);
              } else if (hasMarcato) {
                noteVelocity = Math.min(1.0, noteVelocity + 0.25);
              }
              if (hasTenuto) {
                noteVelocity = Math.min(1.0, noteVelocity + 0.05);
              }

              let soundingDuration = evDurationSeconds;
              if (slurredEventIds.has(ev.id)) {
                // Legato slur: staccato does NOT shorten notes inside a slur;
                // non-terminal slurred notes overlap by 10ms into the next note.
                soundingDuration = slurredToNextEventIds.has(ev.id)
                  ? evDurationSeconds + 0.010
                  : evDurationSeconds;
              } else if (hasStaccato) {
                soundingDuration = Math.max(0.05, evDurationSeconds * 0.5);
              } else if (hasMarcato) {
                soundingDuration = Math.max(0.05, evDurationSeconds * 0.75);
              } else if (hasTenuto) {
                soundingDuration = evDurationSeconds;
              }

              // Check if this note continues a tie from previous note
              let tied = false;
              if (activeTies && activeTies.length > 0) {
                const tieMatch = activeTies.find((t) => pitchesMatch(t.pitches, ev.pitches));
                if (tieMatch) {
                  // Extend existing sounding note
                  tieMatch.note.durationSeconds += evDurationSeconds;
                  if (Array.isArray(tieMatch.note.eventId)) {
                    tieMatch.note.eventId.push(ev.id);
                  } else {
                    tieMatch.note.eventId = [tieMatch.note.eventId, ev.id];
                  }

                  if (ev.tiedToNext) {
                    // Continue tie forward
                    tied = true;
                  } else {
                    // Tie ends here
                    activeTies = activeTies.filter((t) => t !== tieMatch);
                    tied = true;
                  }
                }
              }

              if (!tied) {
                activeTies = null;
                const newTiedNotes: Array<{ note: ScheduledNote; pitches: Pitch[] }> = [];

                for (const pitch of ev.pitches) {
                  const { midi, detuneCents } = pitchToMidi(pitch);
                  const scheduled: ScheduledNote = {
                    eventId: ev.tiedToNext ? [ev.id] : ev.id,
                    partId: part.id,
                    midi,
                    detuneCents,
                    startSeconds: evStartSeconds,
                    durationSeconds: soundingDuration,
                    velocity: noteVelocity,
                  };
                  scheduledNotes.push(scheduled);

                  if (ev.tiedToNext) {
                    newTiedNotes.push({ note: scheduled, pitches: ev.pitches });
                  }
                }

                if (newTiedNotes.length > 0) {
                  activeTies = newTiedNotes;
                }
              }
            }
          }
        }
      }
    }
  }

  // 3. Sort all notes chronologically by startSeconds, then midi
  scheduledNotes.sort((a, b) => {
    if (Math.abs(a.startSeconds - b.startSeconds) > 1e-6) {
      return a.startSeconds - b.startSeconds;
    }
    return a.midi - b.midi;
  });

  // 4. Handle fromEventId (relative offset)
  if (options.fromEventId && eventTimes.has(options.fromEventId)) {
    const fromTime = eventTimes.get(options.fromEventId)!;
    const offset = fromTime.startSeconds;

    const filteredNotes = scheduledNotes
      .filter((n) => n.startSeconds >= offset - 1e-6)
      .map((n) => ({
        ...n,
        startSeconds: Math.max(0, n.startSeconds - offset),
      }));

    const adjustedMeasureStarts = measureStarts.map((m) => ({
      measureId: m.measureId,
      startSeconds: m.startSeconds - offset,
    }));

    const adjustedEventTimes = new Map<string, { startSeconds: number; endSeconds: number }>();
    for (const [id, range] of eventTimes.entries()) {
      adjustedEventTimes.set(id, {
        startSeconds: range.startSeconds - offset,
        endSeconds: range.endSeconds - offset,
      });
    }

    return {
      notes: filteredNotes,
      totalSeconds: Math.max(0, rawTotalSeconds - offset),
      measureStarts: adjustedMeasureStarts,
      eventTimes: adjustedEventTimes,
    };
  }

  return {
    notes: scheduledNotes,
    totalSeconds: rawTotalSeconds,
    measureStarts,
    eventTimes,
  };
}
