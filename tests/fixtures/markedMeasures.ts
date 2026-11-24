// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Extension of the fixture token grammar (see mozartK545Mm1to7.ts) with the marks the acceptance
 * pieces need. A token is  [(] [<|>] <pitches>/<duration> [@<dynamic>] [!] [)] [\]]  where
 *   "(" prefix   a slur starts on this note;
 *   ")" suffix   the slur that is open ends on this note (checked first, so a token that has both
 *                closes the open slur and then starts a new one);
 *   "!" suffix   staccato;
 *   "@p" suffix  dynamic marking (any dynamic the program knows: pp, p, mp, mf, f, ff, ...);
 *   "~" suffix   the note is tied to the next note of the same pitch;
 *   "^" / "_" suffix   fermata above / below (one / two cycleFermata steps).
 * Slurs may run over bar lines; they are tracked per staff in the order the measures are given.
 *   "<" / ">" prefix  a crescendo / diminuendo hairpin starts on this note;
 *   "]" suffix   the hairpin that is open ends on this note (closed first, so a token may end one hairpin
 *                and start the next).
 * Marks are applied through the public commands, like everything else a user does.
 */
import { cycleFermata, setDynamic, toggleArticulation, toggleHairpin, toggleSlur, toggleTie } from '../../src/core/commands';
import type { Score, ScoreEvent } from '../../src/core/model';
import { newId } from '../../src/core/factory';
import { parseMeasure } from './mozartK545Mm1to7';

export interface TokenMarks {
  slurStart: boolean;
  slurEnd: boolean;
  staccato: boolean;
  tie: boolean;
  fermata?: 'above' | 'below';
  dynamic?: string;
  hairpinStart?: 'crescendo' | 'diminuendo';
  hairpinEnd: boolean;
}

export interface MarkedMeasure {
  events: ScoreEvent[];
  marks: TokenMarks[];
}

const TOKEN = /^(\()?([<>])?(.*?)(?:@([a-z]+))?(!)?(~)?([\^_])?(\))?(\])?$/;

/** Parses one measure string with marks. Plain strings (no marks) give the same events as parseMeasure. */
export function parseMarkedMeasure(text: string): MarkedMeasure {
  const marks: TokenMarks[] = [];
  const plain = text.split(' ').map((token) => {
    const m = TOKEN.exec(token);
    if (!m) throw new Error(`Bad token: ${token}`);
    marks.push({
      slurStart: !!m[1],
      slurEnd: !!m[8],
      staccato: !!m[5],
      tie: !!m[6],
      fermata: m[7] === '^' ? 'above' : m[7] === '_' ? 'below' : undefined,
      dynamic: m[4],
      hairpinStart: m[2] === '<' ? 'crescendo' : m[2] === '>' ? 'diminuendo' : undefined,
      hairpinEnd: !!m[9],
    });
    return m[3];
  });
  return { events: parseMeasure(plain.join(' ')), marks };
}

export interface PendingMarks {
  staffId: string;
  items: Array<{ id: string; marks: TokenMarks }>;
}

/**
 * Phase 1: writes the events of one staff (the score must be a plain, unfrozen copy). Call it for every
 * staff first, then run applyMarks: commands return frozen immer copies.
 */
export function fillStaffEvents(score: Score, partIndex: number, lines: readonly string[]): PendingMarks {
  const staff = score.parts[partIndex].staves[0];
  const items: PendingMarks['items'] = [];
  score.measures.forEach((m, i) => {
    const parsed = parseMarkedMeasure(lines[i]);
    staff.measures[m.id].voices[0].events = parsed.events;
    parsed.events.forEach((ev, k) => items.push({ id: ev.id, marks: parsed.marks[k] }));
  });
  return { staffId: staff.id, items };
}

/**
 * Like fillStaffEvents, for one voice of one staff of a part: voice 1 is the existing voice, higher voice
 * indexes are created. The score must be a plain, unfrozen copy.
 */
export function fillVoiceEvents(
  score: Score,
  partIndex: number,
  staffIndex: number,
  voiceIndex: 1 | 2,
  lines: readonly string[]
): PendingMarks {
  const staff = score.parts[partIndex].staves[staffIndex];
  const items: PendingMarks['items'] = [];
  score.measures.forEach((m, i) => {
    const parsed = parseMarkedMeasure(lines[i]);
    const sm = staff.measures[m.id];
    let voice = sm.voices.find((v) => v.voiceIndex === voiceIndex);
    if (!voice) {
      voice = { id: newId(), voiceIndex, events: [] };
      sm.voices.push(voice);
    }
    voice.events = parsed.events;
    parsed.events.forEach((ev, k) => items.push({ id: ev.id, marks: parsed.marks[k] }));
  });
  return { staffId: staff.id, items };
}

/** Phase 2: applies dynamics, staccato and slurs of one staff through the public commands. */
export function applyMarks(score: Score, pending: PendingMarks): Score {
  let result = score;
  let open: string | null = null;
  let hairpinOpen: { id: string; type: 'crescendo' | 'diminuendo' } | null = null;
  for (const { id, marks } of pending.items) {
    if (marks.dynamic) result = setDynamic(id, marks.dynamic).apply(result);
    if (marks.staccato) result = toggleArticulation(id, 'staccato').apply(result);
    if (marks.tie) result = toggleTie(id).apply(result);
    if (marks.fermata) result = cycleFermata(id).apply(result);
    if (marks.fermata === 'below') result = cycleFermata(id).apply(result);
    if (marks.slurEnd) {
      if (open === null) throw new Error(`Slur ends without a start at event ${id}`);
      result = toggleSlur({
        kind: 'range',
        staffId: pending.staffId,
        voiceIndex: 1,
        anchorId: open,
        focusId: id,
      }).apply(result);
      open = null;
    }
    if (marks.slurStart) open = id;
    if (marks.hairpinEnd) {
      if (hairpinOpen === null) throw new Error(`Hairpin ends without a start at event ${id}`);
      result = toggleHairpin(
        { kind: 'range', staffId: pending.staffId, voiceIndex: 1, anchorId: hairpinOpen.id, focusId: id },
        hairpinOpen.type
      ).apply(result);
      hairpinOpen = null;
    }
    if (marks.hairpinStart) hairpinOpen = { id, type: marks.hairpinStart };
  }
  if (open !== null) throw new Error('A slur was opened and never closed');
  if (hairpinOpen !== null) throw new Error('A hairpin was opened and never closed');
  return result;
}
