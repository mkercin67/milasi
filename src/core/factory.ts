// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Factory functions for initializing ScoreForge model objects.
 */

import {
  BarlineType,
  BaseDurationType,
  Clef,
  Id,
  MeasureDef,
  NoteEvent,
  Part,
  Pitch,
  PitchStep,
  RestEvent,
  Score,
  Staff,
} from './model';
import { resolvePartShortName } from './instruments';
import { durationTicks, measureTicks } from './time';

/**
 * Generates a unique RFC4122 v4 UUID string.
 *
 * @returns A unique identifier.
 */
export function newId(): Id {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const val = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return val.toString(16);
  });
}

/**
 * Creates a new musical pitch.
 *
 * @param step - Step letter ('C' through 'B').
 * @param octave - Scientific octave number (4 for middle C).
 * @param alter - Semitone alteration (0 for natural, positive for sharp, negative for flat).
 * @returns A valid Pitch object.
 */
export function createPitch(step: PitchStep, octave: number, alter: number = 0): Pitch {
  return { step, octave, alter };
}

/** Options for creating a new score. */
export interface CreateScoreOptions {
  title?: string;
  composer?: string;
  subtitle?: string;
  arranger?: string;
}

/**
 * Creates an empty Score.
 *
 * @param options - Optional metadata (title, composer, subtitle, arranger).
 * @returns A new Score instance with schemaVersion 4.
 */
export function createScore(options?: CreateScoreOptions): Score {
  return {
    schemaVersion: 7,
    id: newId(),
    meta: {
      title: options?.title ?? 'Untitled Score',
      composer: options?.composer ?? 'Anonymous',
      subtitle: options?.subtitle ?? '',
      arranger: options?.arranger ?? '',
    },
    parts: [],
    measures: [],
    groups: [],
    overrides: {},
  };
}

/** Options for creating a musical part. */
export interface CreatePartOptions {
  name?: string;
  instrument?: string;
  clef?: Clef;
  staves?: Staff[];
  midiChannel?: number;
  shortName?: string;
}

/**
 * Creates a musical part with at least one default staff.
 *
 * @param nameOrOptions - Part name string or options object.
 * @returns A new Part instance.
 */
export function createPart(nameOrOptions?: string | CreatePartOptions): Part {
  const options =
    typeof nameOrOptions === 'string' ? { name: nameOrOptions } : (nameOrOptions ?? {});

  const defaultClef: Clef = options.clef ?? { sign: 'G', line: 2 };
  const staves =
    options.staves ?? [
      {
        id: newId(),
        clef: defaultClef,
        measures: {},
        slurs: [],
      },
    ];

  const partName = options.name ?? 'Part 1';
  const instrument = options.instrument ?? 'default';

  return {
    id: newId(),
    name: partName,
    staves,
    instrument,
    midiChannel: options.midiChannel ?? 0,
    shortName: options.shortName ?? resolvePartShortName(instrument, partName),
  };
}

/** A measure that follows another one keeps its time-signature display (C stays C when measures are added). */
export function inheritTimeSigDisplay(from: MeasureDef | undefined, to: MeasureDef): MeasureDef {
  if (from?.timeSigDisplay) to.timeSigDisplay = from.timeSigDisplay;
  return to;
}

/**
 * Creates a global measure definition.
 *
 * @param timeSig - Time signature (defaults to 4/4).
 * @param keySig - Key signature (-7 to 7 fifths, defaults to 0).
 * @param tempo - Optional tempo marking (bpm and beatUnit).
 * @returns A new MeasureDef instance.
 */
export function createMeasure(
  timeSig: { num: number; den: number } = { num: 4, den: 4 },
  keySig: number = 0,
  tempo?: { bpm: number; beatUnit: number; tempoText?: string },
  actualTicks?: number,
  endBarline?: BarlineType
): MeasureDef {
  return {
    id: newId(),
    timeSig: { ...timeSig },
    keySig,
    tempo: tempo ? { ...tempo } : undefined,
    actualTicks,
    endBarline,
  };
}

/** Options for creating a note event. */
export interface CreateNoteOptions {
  id?: Id;
  pitches: Pitch[];
  baseType?: BaseDurationType;
  dots?: number;
  tuplet?: { actual: number; normal: number };
  articulations?: string[];
  dynamic?: string;
  tiedToNext?: boolean;
}

/**
 * Creates a note event with automatic duration calculation in integer ticks.
 *
 * @param options - Note attributes including pitches and rhythmic value.
 * @returns A NoteEvent instance.
 */
export function createNote(options: CreateNoteOptions): NoteEvent {
  const baseType = options.baseType ?? 'quarter';
  const dots = options.dots ?? 0;
  const duration = durationTicks(baseType, dots, options.tuplet);

  return {
    kind: 'note',
    id: options.id ?? newId(),
    baseType,
    dots,
    tuplet: options.tuplet ? { ...options.tuplet } : undefined,
    duration,
    pitches: options.pitches.map((p) => ({ ...p })),
    articulations: options.articulations ? [...options.articulations] : [],
    dynamic: options.dynamic,
    tiedToNext: options.tiedToNext,
  };
}

/** Options for creating a rest event. */
export interface CreateRestOptions {
  id?: Id;
  baseType?: BaseDurationType;
  dots?: number;
  tuplet?: { actual: number; normal: number };
  duration?: number;
  wholeMeasure?: boolean;
}

/**
 * Creates a rest event with automatic duration calculation in integer ticks.
 *
 * @param options - Rest rhythmic values.
 * @returns A RestEvent instance.
 */
export function createRest(options?: CreateRestOptions): RestEvent {
  const wholeMeasure = options?.wholeMeasure ?? false;
  const baseType = wholeMeasure ? 'whole' : options?.baseType ?? 'quarter';
  const dots = wholeMeasure ? 0 : options?.dots ?? 0;
  const duration =
    options?.duration !== undefined
      ? options.duration
      : durationTicks(baseType, dots, options?.tuplet);

  return {
    kind: 'rest',
    id: options?.id ?? newId(),
    baseType,
    dots,
    tuplet: options?.tuplet ? { ...options.tuplet } : undefined,
    duration,
    wholeMeasure: wholeMeasure ? true : undefined,
  };
}

export interface CreateEmptyScoreOptions {
  title?: string;
  composer?: string;
  subtitle?: string;
  arranger?: string;
  clef?: Clef;
  keySig?: number;
  timeSig?: { num: number; den: number };
  measures?: number;
  numMeasures?: number;
}

/**
 * Creates a complete empty score with wholeMeasure rests in each measure.
 *
 * @param options - Clef, key signature, time signature, and measure count.
 * @returns A fully initialized Score ready for editing.
 */
export function createEmptyScore(options: CreateEmptyScoreOptions = {}): Score {
  const clef = options.clef ?? { sign: 'G', line: 2 };
  const keySig = options.keySig ?? 0;
  const timeSig = options.timeSig ?? { num: 4, den: 4 };
  const numMeasures = options.measures ?? options.numMeasures ?? 8;

  const score = createScore({
    title: options.title ?? 'Untitled Score',
    composer: options.composer ?? '',
  });

  const part = createPart({
    name: clef.sign === 'F' ? 'Bass' : 'Treble',
    clef,
  });
  score.parts = [part];

  const mDuration = measureTicks(timeSig);

  for (let i = 0; i < numMeasures; i++) {
    const isLast = i === numMeasures - 1;
    const mDef = createMeasure(timeSig, keySig, undefined, undefined, isLast ? 'final' : 'single');
    score.measures.push(mDef);

    const wholeRest = createRest({
      baseType: 'whole',
      duration: mDuration,
      wholeMeasure: true,
    });

    part.staves[0].measures[mDef.id] = { // staff-zero-ok: factory builds the legacy single-staff score
      voices: [{ id: newId(), voiceIndex: 1, events: [wholeRest] }],
    };
  }

  return score;
}


/**
 * Creates an empty piano score: one part, two staves (treble G clef, bass F clef) in a brace group
 * with through barlines. Every staff has a whole-measure rest in every measure.
 */
export function createGrandStaffScore(options: CreateEmptyScoreOptions = {}): Score {
  const score = createEmptyScore({ ...options, clef: { sign: 'G', line: 2 } });
  const part = score.parts[0];
  part.name = 'Piano';
  const timeSig = options.timeSig ?? { num: 4, den: 4 };
  const bass: Staff = { id: newId(), clef: { sign: 'F', line: 4 }, measures: {}, slurs: [] };
  for (const mDef of score.measures) {
    bass.measures[mDef.id] = {
      voices: [
        {
          id: newId(),
          voiceIndex: 1,
          events: [createRest({ baseType: 'whole', duration: measureTicks(timeSig), wholeMeasure: true })],
        },
      ],
    };
  }
  part.staves.push(bass);
  score.groups = [{ id: newId(), partIds: [part.id], bracket: 'brace', barlineSpan: 'through' }];
  return score;
}
