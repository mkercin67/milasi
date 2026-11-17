/**
 * Score serialization and deserialization in native ScoreForge format (.sfscore).
 *
 * Implements envelope packaging, migrations registry, schema version verification,
 * and comprehensive validation checks on load to guarantee score consistency.
 */

import { Score } from '../core/model';
import { validateScore } from '../core/validate';

/** Envelope format for native .sfscore files. */
export interface ScoreForgeEnvelope {
  app: 'scoreforge';
  savedAt: string; // ISO 8601 string
  score: Score;
}

export const CURRENT_SCHEMA_VERSION = 6;

/** Migration function signature for schema version upgrades. */
export type ScoreMigration = (data: unknown) => Score;

/** Migration from v1 to v2: upgrades schemaVersion to 2 and migrates tiedToNext to pitch level. */
export function migrateV1ToV2(data: unknown): Score {
  const score = JSON.parse(JSON.stringify(data)) as any;
  score.schemaVersion = 2;
  if (Array.isArray(score.parts)) {
    for (const part of score.parts) {
      if (Array.isArray(part.staves)) {
        for (const staff of part.staves) {
          if (staff.measures) {
            for (const m of Object.values(staff.measures) as any[]) {
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
  return score as Score;
}

/** Migration from v2 to v3: upgrades schemaVersion to 3 and initializes slurs array on staves. */
export function migrateV2ToV3(data: unknown): Score {
  const score = JSON.parse(JSON.stringify(data)) as any;
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
  return score as Score;
}

/** Migration from v3 to v4: upgrades schemaVersion to 4 and initializes metadata & barlines. */
export function migrateV3ToV4(data: unknown): Score {
  const score = JSON.parse(JSON.stringify(data)) as any;
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
  return score as Score;
}

/** Migration from v4 to v5: upgrades schemaVersion to 5 for repeats, voltas, and lyrics. */
export function migrateV4ToV5(data: unknown): Score {
  const score = JSON.parse(JSON.stringify(data)) as any;
  score.schemaVersion = 5;
  return score as Score;
}

/** Migration from v5 to v6: converts repeat string to repeatStart/repeatEnd and lyrics string to LyricSyllable[]. */
export function migrateV5ToV6(data: unknown): Score {
  const score = JSON.parse(JSON.stringify(data)) as any;
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
          const sm = staff.measures[mId];
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
  return score as Score;
}

/** Registry of schema migrations keyed by source schemaVersion. */
export const migrations: Record<number, ScoreMigration> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
  5: migrateV5ToV6,
};

/**
 * Serializes a Score instance to a JSON string.
 *
 * @param score - Score data to serialize.
 * @param space - Optional indentation spaces for formatting.
 * @param envelope - When true (default), packages inside `{ app: 'scoreforge', savedAt, score }`.
 * @returns Serialized JSON string.
 */
export function serializeScore(score: Score, space?: number, envelope: boolean = true): string {
  const scorePayload: Score = {
    ...score,
    schemaVersion: score.schemaVersion ?? 2,
  };
  if (envelope) {
    const env: ScoreForgeEnvelope = {
      app: 'scoreforge',
      savedAt: new Date().toISOString(),
      score: scorePayload,
    };
    return JSON.stringify(env, null, space);
  }
  return JSON.stringify(scorePayload, null, space);
}

/**
 * Deserializes a JSON string into a Score instance.
 * Accepts both native ScoreForge envelopes ({ app: 'scoreforge', savedAt, score })
 * and raw Score JSON objects.
 *
 * Performs schemaVersion verification, runs migrations if necessary,
 * and executes validateScore to reject corrupted/invalid files with descriptive errors.
 *
 * @param json - Serialized score JSON string.
 * @returns Validated Score object.
 * @throws Error if the JSON is malformed, schemaVersion is unsupported, or validation fails.
 */
export function deserializeScore(json: string): Score {
  if (!json || typeof json !== 'string' || json.trim().length === 0) {
    throw new Error('Invalid score JSON: input string is empty');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`Malformed JSON file: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid score JSON: root element must be an object');
  }

  let candidate: unknown = parsed;
  const asRecord = parsed as Record<string, unknown>;

  // Detect and unwrap envelope
  if (asRecord.app === 'scoreforge' && asRecord.score && typeof asRecord.score === 'object') {
    candidate = asRecord.score;
  }

  if (typeof candidate !== 'object' || candidate === null) {
    throw new Error('Invalid score data: score payload must be an object');
  }

  const scoreObj = candidate as Record<string, unknown>;
  const version = scoreObj.schemaVersion;

  if (typeof version !== 'number') {
    throw new Error('Unsupported or missing schemaVersion: missing schemaVersion property');
  }

  let loadedScore = scoreObj as unknown as Score;

  // Run migrations forward until current schema version
  while ((loadedScore.schemaVersion as number) < CURRENT_SCHEMA_VERSION) {
    const migrator = migrations[loadedScore.schemaVersion];
    if (!migrator) {
      throw new Error(
        `Unsupported schemaVersion: ${loadedScore.schemaVersion}. Expected version 1, 2 or a registered migration.`
      );
    }
    loadedScore = migrator(loadedScore);
  }

  if (loadedScore.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion: ${loadedScore.schemaVersion}. Expected version up to ${CURRENT_SCHEMA_VERSION}.`
    );
  }

  // Validate loaded score structure and durations
  const problems = validateScore(loadedScore);
  if (problems.length > 0) {
    const details = problems.map((p) => `[${p.code}] ${p.message}`).join('; ');
    throw new Error(`Validation failed on score load: ${details}`);
  }

  return loadedScore;
}
