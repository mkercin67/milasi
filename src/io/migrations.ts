// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Chained schema migrations for native ScoreForge (.sfscore) files.
 *
 * Each migration function upgrades a score from schemaVersion N to N+1.
 * Guarantees immutability, data safety, and zero loss of musical information.
 */

import { generateDeterministicId } from '../core/deterministicId';
import { isPercussionInstrument, resolvePartShortName } from '../core/instruments';
import { Id, MeasureDef, Score } from '../core/model';
import { fillMeasureWithRests, measureTicks } from '../core/time';
import { validateScore } from '../core/validate';

/** Migration function signature for schema version upgrades. */
export type ScoreMigration = (data: unknown) => Score;

interface RawPitch {
  tiedToNext?: boolean;
}
interface RawEvent {
  id?: string;
  kind?: string;
  pitches?: RawPitch[];
  tiedToNext?: boolean;
  lyrics?: unknown;
}
interface RawVoice {
  id?: string;
  voiceIndex?: unknown;
  events?: RawEvent[];
}
interface RawMeasureData {
  voices?: RawVoice[];
}
interface RawStaff {
  id?: string;
  measures?: Record<string, RawMeasureData>;
  slurs?: unknown[];
}
interface RawPart {
  id?: string;
  name?: string;
  instrument?: string;
  staves?: RawStaff[];
  midiChannel?: number;
  shortName?: string;
}
interface RawMeasureDef {
  id?: string;
  timeSig?: { num: number; den: number };
  actualTicks?: number;
  repeat?: string;
  repeatStart?: boolean;
  repeatEnd?: boolean;
  endBarline?: string;
}
interface RawScore {
  schemaVersion?: number;
  id?: string;
  meta?: { subtitle?: string; arranger?: string };
  parts?: RawPart[];
  measures?: RawMeasureDef[];
  groups?: unknown[];
  overrides?: Record<string, unknown>;
}

/** Migration from v1 to v2: upgrades schemaVersion to 2 and migrates tiedToNext to pitch level. */
export function migrateV1ToV2(data: unknown): Score {
  const score = JSON.parse(JSON.stringify(data)) as RawScore;
  score.schemaVersion = 2;
  if (Array.isArray(score.parts)) {
    for (const part of score.parts) {
      if (Array.isArray(part.staves)) {
        for (const staff of part.staves) {
          if (staff.measures) {
            for (const m of Object.values(staff.measures)) {
              if (Array.isArray(m?.voices)) {
                for (const v of m.voices) {
                  if (Array.isArray(v?.events)) {
                    for (const ev of v.events) {
                      if (ev.kind === 'note' && Array.isArray(ev.pitches)) {
                        if (ev.tiedToNext) {
                          for (const p of ev.pitches) {
                            p.tiedToNext = true;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return score as unknown as Score;
}

/** Migration from v2 to v3: upgrades schemaVersion to 3 and initializes slurs array on staves. */
export function migrateV2ToV3(data: unknown): Score {
  const score = JSON.parse(JSON.stringify(data)) as RawScore;
  score.schemaVersion = 3;
  if (Array.isArray(score.parts)) {
    for (const part of score.parts) {
      if (Array.isArray(part.staves)) {
        for (const staff of part.staves) {
          if (!Array.isArray(staff.slurs)) {
            staff.slurs = [];
          }
        }
      }
    }
  }
  return score as unknown as Score;
}

/** Migration from v3 to v4: upgrades schemaVersion to 4 and initializes metadata & barlines. */
export function migrateV3ToV4(data: unknown): Score {
  const score = JSON.parse(JSON.stringify(data)) as RawScore;
  score.schemaVersion = 4;
  if (score.meta) {
    score.meta.subtitle = score.meta.subtitle ?? '';
    score.meta.arranger = score.meta.arranger ?? '';
  }
  if (Array.isArray(score.measures)) {
    for (let i = 0; i < score.measures.length; i++) {
      const m = score.measures[i];
      if (m && !m.endBarline) {
        m.endBarline = i === score.measures.length - 1 ? 'final' : 'single';
      }
    }
  }
  return score as unknown as Score;
}

/** Migration from v4 to v5: upgrades schemaVersion to 5 for repeats, voltas, and lyrics. */
export function migrateV4ToV5(data: unknown): Score {
  const score = JSON.parse(JSON.stringify(data)) as RawScore;
  score.schemaVersion = 5;
  return score as unknown as Score;
}

/** Migration from v5 to v6: converts repeat string to repeatStart/repeatEnd and lyrics string to LyricSyllable[]. */
export function migrateV5ToV6(data: unknown): Score {
  const score = JSON.parse(JSON.stringify(data)) as RawScore;
  score.schemaVersion = 6;
  if (Array.isArray(score.measures)) {
    for (const m of score.measures) {
      if (m.repeat === 'start') {
        m.repeatStart = true;
        delete m.repeat;
      } else if (m.repeat === 'end') {
        m.repeatEnd = true;
        delete m.repeat;
      } else if (m.repeat === 'both') {
        m.repeatStart = true;
        m.repeatEnd = true;
        delete m.repeat;
      }
    }
  }
  if (Array.isArray(score.parts)) {
    for (const part of score.parts) {
      for (const staff of part.staves ?? []) {
        for (const mId of Object.keys(staff.measures ?? {})) {
          const sm = staff.measures?.[mId];
          for (const v of sm?.voices ?? []) {
            for (const ev of v?.events ?? []) {
              if (ev.kind === 'note' && typeof ev.lyrics === 'string') {
                ev.lyrics = [{ verse: 1, text: ev.lyrics }];
              }
            }
          }
        }
      }
    }
  }
  return score as unknown as Score;
}

/**
 * Migration from v6 to v7:
 * Introduces voiceIndex (1..4), Part.midiChannel, Part.shortName, Score.groups.
 * Recomputes voiceIndex as array position + 1, fills missing voice 1 with deterministic rests.
 */
export function migrateV6ToV7(data: unknown): Score {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Geçersiz nota verisi: Kök eleman bir nesne olmalıdır.');
  }

  const raw = data as RawScore;

  // Precondition P1: schemaVersion check
  if (raw.schemaVersion === 7) {
    return JSON.parse(JSON.stringify(raw)) as Score;
  }
  if (raw.schemaVersion !== 6) {
    if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > 7) {
      throw new Error(`Desteklenmeyen şema sürümü: ${raw.schemaVersion}. Bu sürüm daha yeni bir MiLaSi uygulaması gerektirir.`);
    }
    throw new Error(`v6'dan v7'ye geçiş için schemaVersion 6 bekleniyordu, ancak ${raw.schemaVersion} bulundu.`);
  }

  // Precondition P2: Check that no StaffMeasure has more than 4 voices
  if (Array.isArray(raw.parts)) {
    for (const part of raw.parts) {
      for (const staff of part.staves ?? []) {
        for (const [mId, sm] of Object.entries(staff.measures ?? {})) {
          if (Array.isArray(sm.voices) && sm.voices.length > 4) {
            throw new Error(`Ölçü '${mId}' 4'ten fazla sese (${sm.voices.length}) sahip. Yükleme iptal edildi.`);
          }
        }
      }
    }
  }

  // S1: Work on deep copy
  const score = JSON.parse(JSON.stringify(raw)) as Score;

  // Collect all existing IDs to verify no collisions with deterministic IDs (D5)
  const existingIds = new Set<string>();
  const collectId = (id?: string) => {
    if (id) existingIds.add(id);
  };

  collectId(score.id);
  for (const m of score.measures ?? []) collectId(m.id);
  for (const part of score.parts ?? []) {
    collectId(part.id);
    for (const staff of part.staves ?? []) {
      collectId(staff.id);
      for (const sm of Object.values(staff.measures ?? {})) {
        for (const v of sm.voices ?? []) {
          collectId(v.id);
          for (const ev of v.events ?? []) {
            collectId(ev.id);
          }
        }
      }
    }
  }
  for (const k of Object.keys(score.overrides ?? {})) collectId(k);

  // Measure map for duration lookup
  const measureDefMap = new Map<Id, MeasureDef>();
  for (const m of score.measures) {
    measureDefMap.set(m.id, m);
  }

  // Helper to ensure deterministic IDs don't collide with existing IDs
  const newlyCreatedIds = new Set<string>();
  const getSafeDeterministicId = (
    staffId: string,
    measureId: string,
    voiceIndex: number,
    counter: number,
    domain: string
  ): string => {
    const genId = generateDeterministicId(staffId, measureId, voiceIndex, counter, domain);
    if (existingIds.has(genId) || newlyCreatedIds.has(genId)) {
      throw new Error(`Kimlik çakışması tespit edildi: '${genId}'. Geçiş iptal edildi.`);
    }
    newlyCreatedIds.add(genId);
    return genId;
  };

  // S2 & S3: Process StaffMeasures and Voices
  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (!staff.measures) {
        staff.measures = {};
      }

      // Ensure every MeasureDef has a StaffMeasure (S3)
      for (const mDef of score.measures) {
        let sm = staff.measures[mDef.id];
        if (!sm) {
          sm = { voices: [] };
          staff.measures[mDef.id] = sm;
        }

        // S2: Set voiceIndex = array position + 1 (1..4), ignore any existing voiceIndex
        for (let i = 0; i < sm.voices.length; i++) {
          const v = sm.voices[i];
          v.voiceIndex = (i + 1) as 1 | 2 | 3 | 4;
        }

        // Sort voices ascending by voiceIndex
        sm.voices.sort((a, b) => a.voiceIndex - b.voiceIndex);

        // Check if voice 1 exists
        let v1 = sm.voices.find((v) => v.voiceIndex === 1);
        if (!v1) {
          // S3: Create voice 1 filled with rests
          const targetLength = mDef.actualTicks ?? measureTicks(mDef.timeSig);
          const voiceId = getSafeDeterministicId(staff.id, mDef.id, 1, 0, 'voice');
          const rests = fillMeasureWithRests(targetLength, (restIdx) =>
            getSafeDeterministicId(staff.id, mDef.id, 1, restIdx + 1, 'rest')
          );
          v1 = {
            id: voiceId,
            voiceIndex: 1,
            events: rests,
          };
          sm.voices.unshift(v1);
        }
      }
    }
  }

  // S5: Part.midiChannel and Part.shortName per invariant 4
  const NON_PERCUSSION_CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
  let nonPercCounter = 0;

  for (const part of score.parts) {
    const isPerc = isPercussionInstrument(part.instrument) || isPercussionInstrument(part.name);
    if (isPerc) {
      part.midiChannel = 9;
    } else {
      part.midiChannel = NON_PERCUSSION_CHANNELS[nonPercCounter % NON_PERCUSSION_CHANNELS.length];
      nonPercCounter++;
    }
    part.shortName = resolvePartShortName(part.instrument, part.name);
  }

  // S6: groups = []
  score.groups = [];

  // S7: schemaVersion = 7
  score.schemaVersion = 7;

  // S8: Postcondition - validateScore must have no errors
  const problems = validateScore(score);
  const errors = problems.filter((p) => p.severity === 'error');
  if (errors.length > 0) {
    const detail = errors.map((e) => `[${e.code}] ${e.message}`).join('; ');
    throw new Error(`v7 geçiş doğrulaması başarısız oldu: ${detail}`);
  }

  return score;
}

/** Registry of schema migrations keyed by source schemaVersion. */
export const migrations: Record<number, ScoreMigration> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
  5: migrateV5ToV6,
  6: migrateV6ToV7,
};
