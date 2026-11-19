// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Score serialization and deserialization in native ScoreForge format (.sfscore).
 *
 * Implements envelope packaging, migrations registry, schema version verification,
 * and comprehensive validation checks on load to guarantee score consistency.
 */

import { newId } from '../core/factory';
import { isPercussionInstrument, resolvePartShortName } from '../core/instruments';
import { Score } from '../core/model';
import { fillMeasureWithRests, measureTicks } from '../core/time';
import { validateScore } from '../core/validate';
import { migrations } from './migrations';

export { migrations };

/** Envelope format for native .sfscore files. */
export interface ScoreForgeEnvelope {
  app: 'scoreforge';
  savedAt: string; // ISO 8601 string
  score: Score;
}

export const CURRENT_SCHEMA_VERSION = 7;

/**
 * Serializes a Score instance to a JSON string.
 * Normalizes Schema v7 invariants on serialization to guarantee consistency.
 *
 * @param score - Score data to serialize.
 * @param space - Optional indentation spaces for formatting.
 * @param envelope - When true (default), packages inside `{ app: 'scoreforge', savedAt, score }`.
 * @returns Serialized JSON string.
 */
export function serializeScore(score: Score, space?: number, envelope: boolean = true): string {
  const cloned = JSON.parse(JSON.stringify(score)) as Score;
  cloned.schemaVersion = cloned.schemaVersion ?? CURRENT_SCHEMA_VERSION;
  if (!cloned.groups) cloned.groups = [];

  const NON_PERCUSSION_CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
  let nonPercCounter = 0;

  for (const part of cloned.parts ?? []) {
    const isPerc = isPercussionInstrument(part.instrument) || isPercussionInstrument(part.name);
    if (part.midiChannel === undefined) {
      part.midiChannel = isPerc ? 9 : NON_PERCUSSION_CHANNELS[nonPercCounter % NON_PERCUSSION_CHANNELS.length];
      if (!isPerc) nonPercCounter++;
    }
    if (!part.shortName) {
      part.shortName = resolvePartShortName(part.instrument, part.name);
    }

    for (const staff of part.staves ?? []) {
      if (!staff.measures) staff.measures = {};
      for (const mDef of cloned.measures ?? []) {
        let sm = staff.measures[mDef.id];
        if (!sm) {
          sm = { voices: [] };
          staff.measures[mDef.id] = sm;
        }
        for (let i = 0; i < sm.voices.length; i++) {
          const v = sm.voices[i];
          if (v.voiceIndex === undefined) {
            v.voiceIndex = (i + 1) as 1 | 2 | 3 | 4;
          }
        }
        sm.voices.sort((a, b) => a.voiceIndex - b.voiceIndex);
        if (sm.voices.length === 0) {
          const targetLength = mDef.actualTicks ?? measureTicks(mDef.timeSig);
          sm.voices.push({
            id: newId(),
            voiceIndex: 1,
            events: fillMeasureWithRests(targetLength),
          });
        }
      }
    }
  }

  if (envelope) {
    const env: ScoreForgeEnvelope = {
      app: 'scoreforge',
      savedAt: new Date().toISOString(),
      score: cloned,
    };
    return JSON.stringify(env, null, space);
  }
  return JSON.stringify(cloned, null, space);
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
 * @throws Error if the JSON is malformed, schemaVersion is unsupported, or validation fails with errors.
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

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Desteklenmeyen şema sürümü: ${version}. Bu sürüm daha yeni bir MiLaSi uygulaması gerektirir. (schemaVersion: ${version})`
    );
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
      `Desteklenmeyen şema sürümü: ${loadedScore.schemaVersion}. Beklenen sürüm: ${CURRENT_SCHEMA_VERSION}. (schemaVersion: ${loadedScore.schemaVersion})`
    );
  }

  // Validate loaded score structure and durations (D6: reject only on 'error', allow 'warning')
  const problems = validateScore(loadedScore);
  const errors = problems.filter((p) => p.severity === 'error');
  if (errors.length > 0) {
    const details = errors.map((p) => `[${p.code}] ${p.message}`).join('; ');
    throw new Error(`Validation failed on score load: ${details}`);
  }

  return loadedScore;
}
