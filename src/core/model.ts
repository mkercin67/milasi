// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Core data model for ScoreForge.
 *
 * All types represent plain serializable data structures with no functions,
 * classes, or hidden internal state. Coordinates in overrides are expressed
 * in staff spaces, and time is measured in integer ticks.
 */

/** Unique identifier type (UUID string). */
export type Id = string;

/** A bracketed grouping of staves in multi-staff / orchestral layouts (Milestone 7). */
export interface StaffGroup {
  id: Id;
  name?: string;
  partIds: Id[]; // Parts enclosed by this group
  bracket: 'none' | 'brace' | 'bracket'; // 'brace' = piano curly brace; 'bracket' = orchestral square bracket
  barlineSpan: 'through' | 'individual' | 'mensurstrich';
}

/** Root score container. */
export interface Score {
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  id: Id;
  meta: {
    title: string;
    composer: string;
    subtitle?: string;
    arranger?: string;
  };
  parts: Part[];
  measures: MeasureDef[];
  groups: StaffGroup[];
  overrides: Record<Id, Override>;
}

/** Supported barline types for measure endings. */
export type BarlineType = 'single' | 'double' | 'final';

/** Volta (1st and 2nd ending) specification (Milestone 6d). */
export interface VoltaDef {
  number: 1 | 2;
  openRight?: boolean;
}

/** Global measure definition shared by all staves across parts. */
export interface MeasureDef {
  id: Id;
  timeSig: {
    num: number;
    den: number;
  };
  keySig: number; // -7..7 on circle of fifths (0 = C major / A minor)
  tempo?: {
    bpm: number;
    beatUnit: number;
    tempoText?: string;
  };
  actualTicks?: number; // Optional custom duration in ticks (e.g. pickup/anacrusis measures)
  endBarline?: BarlineType;
  repeatStart?: boolean;
  repeatEnd?: boolean;
  volta?: VoltaDef;
}

/** Supported clef sign symbols. */
export type ClefSign = 'G' | 'F' | 'C';

/** Clef specification. */
export interface Clef {
  sign: ClefSign;
  line: number; // e.g. 2 for G clef (treble), 4 for F clef (bass)
}

/** A single instrument or musical part consisting of one or more staves. */
export interface Part {
  id: Id;
  name: string;
  staves: Staff[];
  instrument: string;
  midiChannel: number; // 0..15 (mandatory in Schema v7)
  shortName: string; // e.g. "Vln.", "Pno." (mandatory in Schema v7)
}

/** A musical slur connecting two events in the same staff. */
export interface Slur {
  id: Id;
  startEventId: Id;
  endEventId: Id;
  placement?: 'above' | 'below';
}

/** Allowed dynamic markings (Milestone 6b). */
export type DynamicType = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'sfz' | 'fp';
export const ALLOWED_DYNAMICS: ReadonlySet<string> = new Set([
  'pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp',
]);

/** Allowed articulation markings (Milestone 6b). */
export type ArticulationType = 'staccato' | 'tenuto' | 'accent' | 'marcato';
export const ALLOWED_ARTICULATIONS: ReadonlySet<string> = new Set([
  'staccato', 'tenuto', 'accent', 'marcato',
]);

/** A single staff belonging to a part. */
export interface Staff {
  id: Id;
  clef: Clef;
  measures: Record<Id, StaffMeasure>; // Keyed by MeasureDef.id
  slurs?: Slur[];
}

/** Staff contents within a specific measure, containing one or more voices. */
export interface StaffMeasure {
  voices: Voice[];
}

/** A voice channel within a measure holding a sequential list of score events. */
export interface Voice {
  id: Id;
  voiceIndex: 1 | 2 | 3 | 4; // 1-based index (1..4)
  events: ScoreEvent[];
}

/** Discriminated union of score events. */
export type ScoreEvent = NoteEvent | RestEvent;

/** Supported fundamental duration types. */
export type BaseDurationType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd';

/** Base attributes shared by notes and rests. */
export interface BaseEvent {
  id: Id;
  duration: number; // Duration in ticks, scaled by dots and tuplets
  baseType: BaseDurationType;
  dots: number;
  tuplet?: {
    actual: number; // Number of notes played in the time of 'normal'
    normal: number; // Number of notes normally occupying this duration
  };
}

/** Syllable specification for lyrics (Milestone 6d). */
export interface LyricSyllable {
  verse: number;
  text: string;
}

/** Note event (single pitch or multi-pitch chord). */
export interface NoteEvent extends BaseEvent {
  kind: 'note';
  pitches: Pitch[];
  tiedToNext?: boolean;
  articulations: string[]; // e.g. 'staccato', 'accent', 'tenuto'
  dynamic?: string; // e.g. 'p', 'mf', 'f'
  lyrics?: LyricSyllable[]; // Syllables by verse (Milestone 6d)
}

/** Rest event. */
export interface RestEvent extends BaseEvent {
  kind: 'rest';
  wholeMeasure?: boolean;
}

/** Musical pitch step letter. */
export type PitchStep = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** Musical pitch with scientific octave and continuous microtonal alteration. */
export interface Pitch {
  step: PitchStep;
  octave: number; // Scientific pitch notation: C4 = middle C
  alter: number; // Semitone offset: 0 = natural, 1 = sharp, -1 = flat, 0.5 = quarter tone sharp
  tiedToNext?: boolean; // Tie to next note with identical pitch
}

/** Manual visual layout overrides in staff spaces. */
export interface Override {
  dx?: number;
  dy?: number;
  scale?: number;
  hidden?: boolean;
}
