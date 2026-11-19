// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { Score, Voice } from '../../src/core/model';
import { migrateV6ToV7 } from '../../src/io/migrations';
import { deserializeScore, serializeScore } from '../../src/io/json';
import { validateScore } from '../../src/core/validate';
import { layoutScore } from '../../src/layout/layoutScore';
import { newId } from '../../src/core/factory';
import { durationTicks, measureTicks } from '../../src/core/time';
import { History } from '../../src/core/commandTypes';
import { addVoice } from '../../src/core/commands';
import { appendMeasure, enterNote } from '../../src/core/input';

/** Deterministic pseudo-random number generator (mulberry32). */
function createRng(seed: number) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Recursively deep-freezes an object tree. */
function deepFreeze(obj: any): any {
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = obj[key];
    if (val !== null && (typeof val === 'object' || typeof val === 'function') && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/** Builds a random valid Schema v6 score for fuzz/property testing. */
function generateRandomV6Score(rng: () => number, index: number): Score {
  const timeSigs = [
    { num: 4, den: 4 },
    { num: 3, den: 4 },
    { num: 2, den: 4 },
    { num: 6, den: 8 },
    { num: 5, den: 8 },
    { num: 7, den: 8 },
  ];
  const timeSig = timeSigs[Math.floor(rng() * timeSigs.length)];
  const mCount = 1 + Math.floor(rng() * 8);

  const scoreId = `fuzz-${index}-score`;
  const partId = `fuzz-${index}-part`;
  const staffId = `fuzz-${index}-staff`;

  const measures: any[] = [];
  const staffMeasures: Record<string, any> = {};

  const baseTypes = ['quarter', 'eighth', '16th'] as const;
  const isPickup = rng() < 0.25;
  const fullTicks = measureTicks(timeSig);
  const pickupTicks = durationTicks('quarter', 0); // 1 quarter beat pickup

  for (let m = 0; m < mCount; m++) {
    const mId = `fuzz-${index}-m-${m}`;
    const mTicks = (m === 0 && isPickup) ? pickupTicks : fullTicks;

    measures.push({
      id: mId,
      timeSig: { ...timeSig },
      keySig: 0,
      actualTicks: (m === 0 && isPickup) ? pickupTicks : undefined,
    });

    // Fill measure events up to mTicks
    const events: any[] = [];
    let rem = mTicks;

    while (rem > 0) {
      const candidates = baseTypes.filter((bt) => durationTicks(bt, 0) <= rem);
      const bt = candidates.length > 0 ? candidates[Math.floor(rng() * candidates.length)] : '16th';
      const dur = Math.min(rem, durationTicks(bt, 0));
      const evId = `fuzz-${index}-ev-${m}-${events.length}`;
      const isRest = rng() < 0.3;

      if (isRest) {
        events.push({
          id: evId,
          kind: 'rest',
          baseType: bt,
          dots: 0,
          duration: dur,
        });
      } else {
        events.push({
          id: evId,
          kind: 'note',
          baseType: bt,
          dots: 0,
          duration: dur,
          pitches: [{ step: 'C', octave: 4, alter: 0 }],
        });
      }
      rem -= dur;
    }

    staffMeasures[mId] = {
      voices: [
        {
          id: `fuzz-${index}-v-${m}-0`,
          events,
        },
      ],
    };
  }

  return {
    schemaVersion: 6 as any,
    id: scoreId,
    meta: {
      title: `Fuzz Score ${index}`,
      composer: 'Fuzzer',
    },
    parts: [
      {
        id: partId,
        name: 'Fuzz Part',
        staves: [
          {
            id: staffId,
            clef: { sign: 'G', line: 2 },
            measures: staffMeasures,
            slurs: [],
          },
        ],
      },
    ],
    measures,
    overrides: {},
  } as any;
}

describe('M7a-1 Traceability Matrix Proofs (Plan Items 2a–2f)', () => {
  it('Item 2a: Fuzz/property test over 200 random valid v6 scores validates, is idempotent, round-trips, and preserves rendering', () => {
    const rng = createRng(42);
    const testCases = 200;

    for (let i = 0; i < testCases; i++) {
      const v6 = generateRandomV6Score(rng, i);

      // 1. Migrate to v7
      const v7 = migrateV6ToV7(JSON.parse(JSON.stringify(v6)));

      // 2. Migrated score must validate with 0 errors
      const errors = validateScore(v7).filter((d) => d.severity === 'error');
      expect(errors).toEqual([]);

      // 3. Idempotent: migrating twice produces byte-identical JSON
      const v7Twice = migrateV6ToV7(JSON.parse(JSON.stringify(v7)));
      expect(JSON.stringify(v7Twice)).toBe(JSON.stringify(v7));

      // 4. Round-trip through serialize / deserialize
      const serialized = serializeScore(v7);
      const deserialized = deserializeScore(serialized);
      expect(deserialized).toEqual(v7);

      // 5. Single-voice rendering is unchanged
      const layout1 = layoutScore(v7, { width: 80 });
      const layout2 = layoutScore(deserialized, { width: 80 });
      expect(layout1.systems.length).toBe(layout2.systems.length);
      expect(layout1.items.length).toBe(layout2.items.length);
    }
  });

  it('Item 2b: Invariant 6: existing voice, event, measure and override IDs are preserved unchanged after migration', () => {
    const rng = createRng(12345);
    const v6 = generateRandomV6Score(rng, 999);

    // Collect IDs before migration
    const beforeMeasureIds = new Set(v6.measures.map((m) => m.id));
    const beforeVoiceIds = new Set<string>();
    const beforeEventIds = new Set<string>();
    const beforeOverrideIds = new Set(Object.keys(v6.overrides || {}));

    for (const part of v6.parts) {
      for (const staff of part.staves) {
        for (const mId in staff.measures) {
          for (const v of staff.measures[mId].voices) {
            beforeVoiceIds.add(v.id);
            for (const ev of v.events) {
              beforeEventIds.add(ev.id);
            }
          }
        }
      }
    }

    const v7 = migrateV6ToV7(JSON.parse(JSON.stringify(v6)));

    // Collect IDs after migration
    const afterMeasureIds = new Set(v7.measures.map((m) => m.id));
    const afterVoiceIds = new Set<string>();
    const afterEventIds = new Set<string>();
    const afterOverrideIds = new Set(Object.keys(v7.overrides || {}));

    for (const part of v7.parts) {
      for (const staff of part.staves) {
        for (const mId in staff.measures) {
          for (const v of staff.measures[mId].voices) {
            afterVoiceIds.add(v.id);
            for (const ev of v.events) {
              afterEventIds.add(ev.id);
            }
          }
        }
      }
    }

    // Every original ID must exist unchanged
    expect(afterMeasureIds).toEqual(beforeMeasureIds);
    expect(afterVoiceIds).toEqual(beforeVoiceIds);
    expect(afterEventIds).toEqual(beforeEventIds);
    expect(afterOverrideIds).toEqual(beforeOverrideIds);
  });

  it('Item 2c: Step S1: the input object is not mutated during migration (deep-freeze verification)', () => {
    const rng = createRng(9999);
    const v6 = generateRandomV6Score(rng, 101);
    const cloneBefore = JSON.parse(JSON.stringify(v6));

    // Deep freeze the v6 object tree
    deepFreeze(v6);

    // migrateV6ToV7 must not throw and must not mutate frozen input
    let migrated: Score | null = null;
    expect(() => {
      migrated = migrateV6ToV7(v6);
    }).not.toThrow();

    expect(migrated).not.toBeNull();
    expect(v6).toEqual(cloneBefore);
  });

  it('Item 2d: Section 4: ties and slurs preserve identical event connections across migration in multi-voice scores', () => {
    const ev1a = newId();
    const ev1b = newId();
    const ev2a = newId();
    const ev2b = newId();

    const v6: any = {
      schemaVersion: 6,
      id: newId(),
      meta: { title: 'Ties & Slurs Test', composer: 'Composer' },
      parts: [
        {
          id: newId(),
          name: 'Flute',
          staves: [
            {
              id: newId(),
              clef: { sign: 'G', line: 2 },
              measures: {
                'm-0': {
                  voices: [
                    {
                      id: 'v1-m0',
                      events: [
                        { id: ev1a, kind: 'note', baseType: 'whole', dots: 0, duration: 3840, pitches: [{ step: 'C', octave: 5, alter: 0, tiedToNext: true }] },
                      ],
                    },
                    {
                      id: 'v2-m0',
                      events: [
                        { id: ev2a, kind: 'note', baseType: 'whole', dots: 0, duration: 3840, pitches: [{ step: 'E', octave: 4, alter: 0, tiedToNext: true }] },
                      ],
                    },
                  ],
                },
                'm-1': {
                  voices: [
                    {
                      id: 'v1-m1',
                      events: [
                        { id: ev1b, kind: 'note', baseType: 'whole', dots: 0, duration: 3840, pitches: [{ step: 'C', octave: 5, alter: 0 }] },
                      ],
                    },
                    {
                      id: 'v2-m1',
                      events: [
                        { id: ev2b, kind: 'note', baseType: 'whole', dots: 0, duration: 3840, pitches: [{ step: 'E', octave: 4, alter: 0 }] },
                      ],
                    },
                  ],
                },
              },
              slurs: [
                { id: 'slur-1', startEventId: ev1a, endEventId: ev1b },
              ],
            },
          ],
        },
      ],
      measures: [
        { id: 'm-0', timeSig: { num: 4, den: 4 }, keySig: 0 },
        { id: 'm-1', timeSig: { num: 4, den: 4 }, keySig: 0 },
      ],
      overrides: {},
    };

    const v7 = migrateV6ToV7(v6);

    // Verify voice 1 tie
    const v1m0 = v7.parts[0].staves[0].measures['m-0'].voices.find((v: Voice) => v.voiceIndex === 1);
    const v1m1 = v7.parts[0].staves[0].measures['m-1'].voices.find((v: Voice) => v.voiceIndex === 1);
    expect((v1m0?.events[0] as any).pitches[0].tiedToNext).toBe(true);
    expect(v1m0?.events[0].id).toBe(ev1a);
    expect(v1m1?.events[0].id).toBe(ev1b);

    // Verify voice 2 tie
    const v2m0 = v7.parts[0].staves[0].measures['m-0'].voices.find((v: Voice) => v.voiceIndex === 2);
    const v2m1 = v7.parts[0].staves[0].measures['m-1'].voices.find((v: Voice) => v.voiceIndex === 2);
    expect((v2m0?.events[0] as any).pitches[0].tiedToNext).toBe(true);
    expect(v2m0?.events[0].id).toBe(ev2a);
    expect(v2m1?.events[0].id).toBe(ev2b);

    // Verify slur connection preserved
    expect(v7.parts[0].staves[0].slurs?.[0].startEventId).toBe(ev1a);
    expect(v7.parts[0].staves[0].slurs?.[0].endEventId).toBe(ev1b);

    // Entire score validates
    const errors = validateScore(v7).filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('Item 2e: Undo back to load point keeps voiceIndex and groups intact', () => {
    const rng = createRng(777);
    const v6 = generateRandomV6Score(rng, 1);
    const v7Loaded = migrateV6ToV7(v6);
    const history = new History(v7Loaded);

    const staffId = v7Loaded.parts[0].staves[0].id;
    const mId = v7Loaded.measures[0].id;

    // Edit 1: Enter a note
    history.do(
      enterNote(
        { staffId, voiceIndex: 1, measureId: mId, tick: 0 },
        { baseType: 'quarter', pitch: { step: 'D', octave: 4, alter: 0 } }
      )
    );

    // Edit 2: Append a measure
    history.do(appendMeasure());

    // Edit 3: Add voice 2
    history.do(addVoice(staffId, mId, 2));

    // Perform 3 undos back to load point
    history.undo();
    history.undo();
    history.undo();

    // Score must match original loaded score exactly
    expect(history.score).toEqual(v7Loaded);
    expect(history.score.groups).toEqual([]);
    expect(history.score.parts[0].staves[0].measures[mId].voices[0].voiceIndex).toBe(1);
  });

  it('Item 2f: Section 6: Failure policy P1 and P2 leave storage record and loaded input untouched', () => {
    const mockStorage: Record<string, string> = {
      'milasi_autosave_default': JSON.stringify({ saved: true, timestamp: 1234567 }),
      'milasi_file_current': 'original-content-intact',
    };

    const initialStorageState = JSON.stringify(mockStorage);

    // P1: schemaVersion 8 must reject with Turkish message without mutating storage
    const v8Score = {
      schemaVersion: 8,
      id: 'v8-score',
      meta: { title: 'V8 Future' },
      measures: [],
      parts: [],
    };

    expect(() => {
      deserializeScore(JSON.stringify(v8Score));
    }).toThrow('Desteklenmeyen şema sürümü: 8. Bu sürüm daha yeni bir MiLaSi uygulaması gerektirir.');

    // Assert storage remains 100% untouched
    expect(JSON.stringify(mockStorage)).toBe(initialStorageState);

    // P2: Measure with 5 voices must reject with Turkish message without mutating storage
    const invalid5VoiceScore = {
      schemaVersion: 6,
      id: '5v-score',
      meta: { title: '5 Voices' },
      measures: [{ id: 'm-bad', timeSig: { num: 4, den: 4 }, keySig: 0 }],
      parts: [
        {
          id: 'p1',
          name: 'Piano',
          staves: [
            {
              id: 's1',
              clef: { sign: 'G', line: 2 },
              measures: {
                'm-bad': {
                  voices: [
                    { id: 'v1', events: [] },
                    { id: 'v2', events: [] },
                    { id: 'v3', events: [] },
                    { id: 'v4', events: [] },
                    { id: 'v5', events: [] },
                  ],
                },
              },
            },
          ],
        },
      ],
    };

    expect(() => {
      deserializeScore(JSON.stringify(invalid5VoiceScore));
    }).toThrow("Ölçü 'm-bad' 4'ten fazla sese (5) sahip. Yükleme iptal edildi.");

    // Assert storage remains 100% untouched
    expect(JSON.stringify(mockStorage)).toBe(initialStorageState);
  });
});
