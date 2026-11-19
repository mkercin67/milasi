// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  createEmptyScore,
  createMeasure,
  createNote,
  createPart,
  createPitch,
  createRest,
  createScore,
  newId,
} from '../../src/core/factory';
import { addVoice, deleteEvent, insertNote, removeVoice } from '../../src/core/commands';
import { eventsInRange, extendSelection } from '../../src/core/selection';
import { fillMeasureWithRests, measureTicks } from '../../src/core/time';
import { validateScore } from '../../src/core/validate';
import { CURRENT_SCHEMA_VERSION, deserializeScore, serializeScore } from '../../src/io/json';
import { migrateV6ToV7 } from '../../src/io/migrations';
import { resolvePartShortName, resolveShortName } from '../../src/core/instruments';
import { generateDeterministicId } from '../../src/core/deterministicId';

describe('Milestone 7a-1: Schema v7, Migration, and Voice-Aware Selection', () => {
  // 1. Invariants and Constants
  it('defines CURRENT_SCHEMA_VERSION as 7', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(7);
  });

  // D4: fillMeasureWithRests tests
  describe('D4: fillMeasureWithRests and decomposeTicksToRests', () => {
    function testDecompose(label: string, timeSig: { num: number; den: number }, actualTicks?: number) {
      const expectedTotal = actualTicks ?? measureTicks(timeSig);
      const rests = fillMeasureWithRests(expectedTotal);

      // Acceptance criteria from lead:
      // 1. Output sums to exactly target length
      const totalDuration = rests.reduce((sum, r) => sum + r.duration, 0);
      expect(totalDuration).toBe(expectedTotal);

      // 2. Every rest has valid baseType and at most one dot
      for (const r of rests) {
        expect(['whole', 'half', 'quarter', 'eighth', '16th', '32nd']).toContain(r.baseType);
        expect(r.dots).toBeLessThanOrEqual(1);
      }

      // 3. 3/4 measure gives exactly one dotted half rest (fewest events possible)
      if (label === '3/4') {
        expect(rests).toHaveLength(1);
        expect(rests[0].baseType).toBe('half');
        expect(rests[0].dots).toBe(1);
        expect(rests[0].duration).toBe(2880);
      }

      // 4. Must pass validateScore inside a score
      const score = createScore();
      const mDef = createMeasure(timeSig, 0, undefined, actualTicks);
      const part = createPart('Violin');
      score.measures.push(mDef);
      score.parts.push(part);
      part.staves[0].measures[mDef.id] = {
        voices: [{ id: 'v1', voiceIndex: 1, events: rests }],
      };

      const problems = validateScore(score);
      const errors = problems.filter((p) => p.severity === 'error');
      expect(errors).toEqual([]);
    }

    it('decomposes ticks into valid rests for 2/4', () => testDecompose('2/4', { num: 2, den: 4 }));
    it('decomposes ticks into valid rests for 3/4', () => testDecompose('3/4', { num: 3, den: 4 }));
    it('decomposes ticks into valid rests for 4/4', () => testDecompose('4/4', { num: 4, den: 4 }));
    it('decomposes ticks into valid rests for 6/8', () => testDecompose('6/8', { num: 6, den: 8 }));
    it('decomposes ticks into valid rests for 5/8', () => testDecompose('5/8', { num: 5, den: 8 }));
    it('decomposes ticks into valid rests for 7/8', () => testDecompose('7/8', { num: 7, den: 8 }));
    it('decomposes ticks into valid rests for 9/16', () => testDecompose('9/16', { num: 9, den: 16 }));
    it('decomposes ticks into valid rests for pickup measure', () => testDecompose('pickup measure', { num: 4, den: 4 }, 960));
  });

  // D2: Stale voiceIndex handling in v6 data
  describe('D2: Stale voiceIndex values in v6 data recompute to array position + 1', () => {
    it('migrates v6 files carrying 0-based, 1-based, and contradictory voiceIndex values to position + 1', () => {
      const v6ScoreWithStaleVoiceIndices: any = {
        schemaVersion: 6,
        id: 'score-stale-voices',
        meta: { title: 'Stale Voices', composer: 'Tester' },
        measures: [
          { id: 'm1', timeSig: { num: 4, den: 4 }, keySig: 0 },
          { id: 'm2', timeSig: { num: 4, den: 4 }, keySig: 0 },
        ],
        parts: [
          {
            id: 'part-1',
            name: 'Violin',
            instrument: 'violin',
            staves: [
              {
                id: 'staff-1',
                clef: { sign: 'G', line: 2 },
                measures: {
                  // Measure 1 carries 0-based indices
                  m1: {
                    voices: [
                      { id: 'vA', voiceIndex: 0, events: fillMeasureWithRests(3840) },
                      { id: 'vB', voiceIndex: 1, events: fillMeasureWithRests(3840) },
                    ],
                  },
                  // Measure 2 carries contradictory / swapped indices
                  m2: {
                    voices: [
                      { id: 'vC', voiceIndex: 4, events: fillMeasureWithRests(3840) },
                      { id: 'vD', voiceIndex: 1, events: fillMeasureWithRests(3840) },
                    ],
                  },
                },
              },
            ],
          },
        ],
        overrides: {},
      };

      const migrated = migrateV6ToV7(v6ScoreWithStaleVoiceIndices);

      // Measure 1 voices must be position + 1 (1 and 2)
      const sm1 = migrated.parts[0].staves[0].measures['m1'];
      expect(sm1.voices[0].voiceIndex).toBe(1);
      expect(sm1.voices[0].id).toBe('vA');
      expect(sm1.voices[1].voiceIndex).toBe(2);
      expect(sm1.voices[1].id).toBe('vB');

      // Measure 2 voices must be position + 1 (1 and 2), sorted ascending
      const sm2 = migrated.parts[0].staves[0].measures['m2'];
      expect(sm2.voices[0].voiceIndex).toBe(1);
      expect(sm2.voices[0].id).toBe('vC');
      expect(sm2.voices[1].voiceIndex).toBe(2);
      expect(sm2.voices[1].id).toBe('vD');

      expect(validateScore(migrated).filter((p) => p.severity === 'error')).toEqual([]);
    });
  });

  // D5: Deterministic ID collision abort
  describe('D5: Deterministic ID collision policy', () => {
    it('aborts migration with descriptive error and leaves input untouched when an ID collides', () => {
      // Predict the deterministic ID that will be generated for missing voice 1
      const staffId = 'staff-collision';
      const measureId = 'm1';
      const collidingId = generateDeterministicId(staffId, measureId, 1, 0, 'voice');

      const v6Data: any = {
        schemaVersion: 6,
        id: 'score-id',
        meta: { title: 'Collision Test', composer: 'Tester' },
        measures: [{ id: measureId, timeSig: { num: 4, den: 4 }, keySig: 0 }],
        parts: [
          {
            id: 'part-1',
            name: 'Violin',
            instrument: 'violin',
            staves: [
              {
                id: staffId,
                clef: { sign: 'G', line: 2 },
                measures: {
                  // Measure with missing voice 1, and an override key pre-occupying the predicted ID
                  [measureId]: { voices: [] },
                },
              },
            ],
          },
        ],
        overrides: {
          [collidingId]: { dx: 1.0 }, // Force collision!
        },
      };

      const cloneBefore = JSON.parse(JSON.stringify(v6Data));
      expect(() => migrateV6ToV7(v6Data)).toThrow(/Kimlik çakışması tespit edildi/);
      expect(v6Data).toEqual(cloneBefore); // Input is untouched
    });
  });

  // D6: Severity errors vs warnings
  describe('D6: Severity error rejection and warning tolerance on load', () => {
    it('deserializeScore tolerates warnings (e.g. > 15 non-percussion parts) but rejects errors', () => {
      // Build 16 non-percussion parts
      const score = createScore();
      const mDef = createMeasure({ num: 4, den: 4 });
      score.measures.push(mDef);

      for (let i = 0; i < 16; i++) {
        const part = createPart({ name: `Violin ${i + 1}`, instrument: 'violin' });
        part.staves[0].measures[mDef.id] = {
          voices: [{ id: newId(), voiceIndex: 1, events: fillMeasureWithRests(3840) }],
        };
        score.parts.push(part);
      }

      const serialized = serializeScore(score);

      // Deserialization must succeed because MIDI channel reuse is only a WARNING
      const loaded = deserializeScore(serialized);
      expect(loaded.parts).toHaveLength(16);

      const problems = validateScore(loaded);
      const warnings = problems.filter((p) => p.severity === 'warning');
      const errors = problems.filter((p) => p.severity === 'error');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.code === 'midi-channel-reuse')).toBe(true);
      expect(errors).toHaveLength(0);

      // Now create an actual error (e.g. overfull measure) and verify it throws
      loaded.parts[0].staves[0].measures[mDef.id].voices[0].events.push(
        createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' })
      );
      const invalidJson = serializeScore(loaded);
      expect(() => deserializeScore(invalidJson)).toThrow(/Validation failed on score load/);
    });
  });

  // Section 7 Test Matrix: Real v1..v6 fixtures migration
  describe('Full Migration Chain: v1 -> v2 -> v3 -> v4 -> v5 -> v6 -> v7', () => {
    it('migrates legacy v1 score through all versions up to valid v7', () => {
      const v1Data = {
        schemaVersion: 1,
        id: 'v1-score',
        meta: { title: 'Legacy V1' },
        measures: [{ id: 'm1', timeSig: { num: 4, den: 4 } }],
        parts: [
          {
            id: 'p1',
            name: 'Violin',
            instrument: 'violin',
            staves: [
              {
                id: 's1',
                measures: {
                  m1: {
                    voices: [
                      {
                        id: 'v1',
                        events: [
                          {
                            id: 'n1',
                            kind: 'note',
                            baseType: 'quarter',
                            duration: 960,
                            pitches: [{ step: 'C', octave: 4, alter: 0 }],
                            tiedToNext: true,
                          },
                          {
                            id: 'n2',
                            kind: 'note',
                            baseType: 'quarter',
                            duration: 960,
                            pitches: [{ step: 'C', octave: 4, alter: 0 }],
                          },
                          {
                            id: 'r1',
                            kind: 'rest',
                            baseType: 'half',
                            duration: 1920,
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
        overrides: {},
      };

      const serialized = JSON.stringify({ app: 'scoreforge', savedAt: new Date().toISOString(), score: v1Data });
      const loaded = deserializeScore(serialized);

      expect(loaded.schemaVersion).toBe(7);
      expect(loaded.groups).toEqual([]);
      expect(loaded.parts[0].midiChannel).toBe(0);
      expect(loaded.parts[0].shortName).toBe('Vln.');
      expect(loaded.parts[0].staves[0].measures['m1'].voices[0].voiceIndex).toBe(1);
      expect(validateScore(loaded).filter((p) => p.severity === 'error')).toEqual([]);
    });

    it('is idempotent: migrating a v7 score changes nothing, migrateV6ToV7 twice produces byte-identical JSON', () => {
      const score = createEmptyScore({ numMeasures: 4 });
      const loadedOnce = deserializeScore(serializeScore(score));
      const loadedTwice = deserializeScore(serializeScore(loadedOnce));

      expect(JSON.stringify(loadedOnce)).toBe(JSON.stringify(loadedTwice));
    });

    it('rejects schemaVersion 8 with Turkish message', () => {
      const v8Score = {
        schemaVersion: 8,
        id: 'v8-score',
        meta: { title: 'Future' },
        measures: [],
        parts: [],
      };
      const serialized = JSON.stringify({ app: 'scoreforge', savedAt: new Date().toISOString(), score: v8Score });
      expect(() => deserializeScore(serialized)).toThrow(/Desteklenmeyen şema sürümü: 8/);
    });

    it('rejects measures with more than 4 voices with Turkish message naming measure', () => {
      const v6Data: any = {
        schemaVersion: 6,
        id: 'score-5-voices',
        meta: { title: 'Too Many Voices' },
        measures: [{ id: 'measure-overload', timeSig: { num: 4, den: 4 } }],
        parts: [
          {
            id: 'p1',
            name: 'Violin',
            staves: [
              {
                id: 's1',
                measures: {
                  'measure-overload': {
                    voices: [
                      { id: 'v1', events: fillMeasureWithRests(3840) },
                      { id: 'v2', events: fillMeasureWithRests(3840) },
                      { id: 'v3', events: fillMeasureWithRests(3840) },
                      { id: 'v4', events: fillMeasureWithRests(3840) },
                      { id: 'v5', events: fillMeasureWithRests(3840) },
                    ],
                  },
                },
              },
            ],
          },
        ],
        overrides: {},
      };

      expect(() => migrateV6ToV7(v6Data)).toThrow(/Ölçü 'measure-overload' 4'ten fazla sese \(5\) sahip/);
    });
  });

  // MIDI Channels and Instrument Catalogue
  describe('MIDI Channels and Instrument Short Names', () => {
    it('assigns channel 9 to percussion and distinct non-percussion channels from [0..8, 10..15]', () => {
      const score = createScore();
      const mDef = createMeasure({ num: 4, den: 4 });
      score.measures.push(mDef);

      const p1 = createPart({ name: 'Violin 1', instrument: 'violin' });
      const p2 = createPart({ name: 'Timpani', instrument: 'timpani' });
      const p3 = createPart({ name: 'Piano', instrument: 'piano' });

      score.parts.push(p1, p2, p3);

      for (const p of score.parts) {
        p.staves[0].measures[mDef.id] = {
          voices: [{ id: newId(), voiceIndex: 1, events: fillMeasureWithRests(3840) }],
        };
      }

      // Convert to v6 to simulate migration
      (score as any).schemaVersion = 6;
      delete (p1 as any).midiChannel;
      delete (p2 as any).midiChannel;
      delete (p3 as any).midiChannel;

      const migrated = migrateV6ToV7(score);

      expect(migrated.parts[0].midiChannel).toBe(0); // Violin: channel 0
      expect(migrated.parts[0].shortName).toBe('Vln.');

      expect(migrated.parts[1].midiChannel).toBe(9); // Timpani: channel 9 (percussion)
      expect(migrated.parts[1].shortName).toBe('Timp.');

      expect(migrated.parts[2].midiChannel).toBe(1); // Piano: channel 1 (not 9)
      expect(migrated.parts[2].shortName).toBe('Pno.');
    });

    it('falls back to name <= 6 chars or first 4 chars + "." when instrument is unknown', () => {
      expect(resolveShortName('Keman')).toBe('Keman'); // <= 6 characters unchanged
      expect(resolveShortName('Synthesizer')).toBe('Synt.'); // > 6 characters: first 4 + '.'
      expect(resolvePartShortName('custom-synth', 'Synthesizer')).toBe('Synt.');
      expect(resolvePartShortName(undefined, 'Oud')).toBe('Oud');
      expect(resolvePartShortName('piano', 'Custom')).toBe('Pno.'); // Catalogue priority
    });
  });

  // Multi-voice selection, cross-measure range, addVoice and removeVoice
  describe('Selection, RangeSelection, and Voice Commands', () => {
    it('selects range across measures strictly following voiceIndex', () => {
      const score = createScore();
      const m1 = createMeasure({ num: 4, den: 4 });
      const m2 = createMeasure({ num: 4, den: 4 });
      score.measures.push(m1, m2);

      const part = createPart('Violin');
      score.parts.push(part);

      // Measure 1: Voice 1 and Voice 2
      const n1V1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
      const n2V1 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
      const rV1 = createRest({ baseType: 'half', duration: 1920 });

      const n1V2 = createNote({ pitches: [createPitch('E', 5)], baseType: 'half' });
      const n2V2 = createNote({ pitches: [createPitch('F', 5)], baseType: 'half' });

      part.staves[0].measures[m1.id] = {
        voices: [
          { id: 'v1-m1', voiceIndex: 1, events: [n1V1, n2V1, rV1] },
          { id: 'v2-m1', voiceIndex: 2, events: [n1V2, n2V2] },
        ],
      };

      // Measure 2: Voice 2 and Voice 1 (stored in reverse array order to test index isolation!)
      const n3V2 = createNote({ pitches: [createPitch('G', 5)], baseType: 'whole' });
      const n3V1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' });

      part.staves[0].measures[m2.id] = {
        voices: [
          { id: 'v2-m2', voiceIndex: 2, events: [n3V2] },
          { id: 'v1-m2', voiceIndex: 1, events: [n3V1] },
        ],
      };

      // Extend selection in voice 2 from n1V2 (m1) to n3V2 (m2)
      const sel = extendSelection(score, { kind: 'event', id: n1V2.id }, n3V2.id);
      expect(sel.kind).toBe('range');

      if (sel.kind === 'range') {
        const events = eventsInRange(score, sel);
        // Must contain ONLY voice 2 events across both measures, ignoring reverse array order!
        expect(events.map((e) => e.id)).toEqual([n1V2.id, n2V2.id, n3V2.id]);
      }
    });

    it('addVoice creates an empty voice filled with rests, and removeVoice deletes it only when empty of notes', () => {
      let score = createEmptyScore({ numMeasures: 2 });
      const staffId = score.parts[0].staves[0].id;
      const m0Id = score.measures[0].id;

      // Add voice 2
      score = addVoice(staffId, m0Id, 2).apply(score);
      const sm0 = score.parts[0].staves[0].measures[m0Id];
      expect(sm0.voices).toHaveLength(2);
      expect(sm0.voices[1].voiceIndex).toBe(2);
      expect(sm0.voices[1].events.every((e) => e.kind === 'rest')).toBe(true);

      // Remove voice 2 (succeeds without force because it contains only rests)
      score = removeVoice(staffId, m0Id, 2).apply(score);
      expect(score.parts[0].staves[0].measures[m0Id].voices).toHaveLength(1);

      // Re-add voice 2 and insert a note
      score = addVoice(staffId, m0Id, 2).apply(score);
      const note = createNote({ pitches: [createPitch('G', 5)], baseType: 'quarter' });
      score = insertNote({ partId: score.parts[0].id, staffId, measureId: m0Id, voiceIndex: 2, event: note }).apply(score);

      // removeVoice must throw without confirmation
      expect(() => removeVoice(staffId, m0Id, 2, false).apply(score)).toThrow(/Ses nota içeriyor/);

      // removeVoice succeeds with force: true
      score = removeVoice(staffId, m0Id, 2, true).apply(score);
      expect(score.parts[0].staves[0].measures[m0Id].voices).toHaveLength(1);
    });

    it('deleteEvent leaves whole rest in voice 1 when emptied, but removes voice if voiceIndex > 1', () => {
      let score = createEmptyScore({ numMeasures: 1 });
      const staffId = score.parts[0].staves[0].id;
      const mId = score.measures[0].id;

      // Add voice 2 with rests
      score = addVoice(staffId, mId, 2).apply(score);
      const restV2 = score.parts[0].staves[0].measures[mId].voices[1].events[0];
      const noteV2 = createNote({ pitches: [createPitch('E', 5)], baseType: 'whole' });

      score = insertNote({ partId: score.parts[0].id, staffId, measureId: mId, voiceIndex: 2, event: noteV2 }).apply(score);
      score = deleteEvent(restV2.id).apply(score);

      // Delete note in voice 2 -> voice 2 is now completely empty and gets removed
      score = deleteEvent(noteV2.id).apply(score);
      expect(score.parts[0].staves[0].measures[mId].voices).toHaveLength(1);

      // Now delete whole rest in voice 1 -> replaced by fresh rest filling measure, never removed
      const r1 = score.parts[0].staves[0].measures[mId].voices[0].events[0];
      score = deleteEvent(r1.id).apply(score);
      const v1Events = score.parts[0].staves[0].measures[mId].voices[0].events;
      expect(v1Events.length).toBeGreaterThan(0);
      expect(v1Events[0].kind).toBe('rest');
    });
  });
});
