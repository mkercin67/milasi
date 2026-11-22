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
/** How eighth-note runs are beamed (M7b-7): per beat (default) or across the half bar in 4/4. */
export type BeamGroupingMode = 'beat' | 'half-bar';

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
  /** Score-wide engraving settings (optional; absent = defaults). */
  layoutSettings?: {
    beamGrouping?: BeamGroupingMode;
    /** Show a derived note-name line (Do Re Mi or C D E) under each note. Absent = off. */
    showNoteNames?: boolean;
  };
}

/** Supported barline types for measure endings. */
export type BarlineType = 'single' | 'double' | 'final';

/** Volta (1st and 2nd ending) specification (Milestone 6d). */
export interface VoltaDef {
  number: 1 | 2;
  openRight?: boolean;
}

/** How a time signature is drawn: digits (default), the common-time sign C (4/4) or the cut-time sign (2/2). */
export type TimeSigDisplay = 'numeric' | 'common' | 'cut';

/** Global measure definition shared by all staves across parts. */
export interface MeasureDef {
  id: Id;
  timeSig: {
    num: number;
    den: number;
  };
  /** Display style of the time signature; absent = numeric. 'common' needs 4/4, 'cut' needs 2/2. */
  timeSigDisplay?: TimeSigDisplay;
  keySig: number; // -7..7 on circle of fifths (0 = C major / A minor)
  tempo?: {
    bpm: number;
    beatUnit: number;
    tempoText?: string;
    /** When true and tempoText is set, only the text is drawn (no metronome mark). BPM still drives playback. */
    hideMetronome?: boolean;
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
  /** Staff line of the clef sign, 1 = bottom .. 5 = top: 2 for the G clef (treble), 4 for the F clef (bass), 3 for the alto clef. */
  line: number;
  /** Octave clef (M7c-4): -1 = "8vb" (written note sounds an octave lower), +1 = "8va"; only on G and F clefs. */
  octaveShift?: -1 | 1;
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

/** A crescendo or diminuendo hairpin spanning from one event to a later one in the same staff (M7c-2c). */
export type HairpinType = 'crescendo' | 'diminuendo';
export interface Hairpin {
  id: Id;
  type: HairpinType;
  startEventId: Id;
  endEventId: Id;
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
  hairpins?: Hairpin[];
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

/** Fermata placement relative to the event. */
export type FermataPlacement = 'above' | 'below';

/** Ornament signs (M7c-3): trill, mordent (lower), inverted mordent (upper, short trill), turn. Ignored by playback. */
export type OrnamentType = 'trill' | 'mordent' | 'invertedMordent' | 'turn';

/** Kind of a grace note (M7c-3b): slashed acciaccatura or plain appoggiatura. */
export type GraceKind = 'acciaccatura' | 'appoggiatura';

/** Durations allowed for grace notes. */
export type GraceBaseType = 'eighth' | '16th' | '32nd';

/** Maximum number of grace notes before one main note. */
export const MAX_GRACE_NOTES = 4;

/**
 * A grace note (M7c-3b). It belongs to the main note that follows it and has no duration in the bar,
 * so measure sums, tuplets and cursors are not affected. Identified by its index in `NoteEvent.graces`.
 */
export interface GraceNote {
  kind: GraceKind;
  pitch: Pitch;
  baseType: GraceBaseType;
}

/** Mark drawn after an event: breath mark (comma) or caesura. */
export type PhraseMark = 'breath' | 'caesura';

/** Base attributes shared by notes and rests. */
export interface BaseEvent {
  id: Id;
  /** Fermata on this event (M7c-2); drawn above or below, ignored by playback. */
  fermata?: FermataPlacement;
  /** Breath mark or caesura drawn after this event (M7c-2); ignored by playback. */
  phraseMark?: PhraseMark;
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
  /** Ornament sign drawn above this note (M7c-3); ignored by playback. */
  ornament?: OrnamentType;
  /** Grace notes played before this note (M7c-3b), in written order; at most MAX_GRACE_NOTES. */
  graces?: GraceNote[];
  /** Print the accidental of every pitch even when the key and the bar do not require it (courtesy / cautionary accidental). */
  showAccidental?: boolean;
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
