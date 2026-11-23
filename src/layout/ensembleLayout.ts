// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Ensemble structure for the system layout (M7c-6): which staves share a barline, and where braces
 * and brackets go. Pure functions over the score; layoutScore turns the result into layout items.
 * Staff indexes count all staves of all parts in system order (see allStaves).
 */

import type { Score, StaffGroup } from '../core/model';

/** A brace or bracket over staves `from..to` (inclusive). */
export interface GroupMark {
  kind: 'brace' | 'bracket';
  from: number;
  to: number;
  /** Number of marks that enclose this one; every level moves the mark further left. */
  depth: number;
}

/** What a staff does with the barline lines of its measures. */
export interface StaffBarRule {
  /**
   * start: draws one line down to the bottom of staff `to` (a through barline);
   * skip: draws none (covered by another staff, or the end of a mensurstrich);
   * own: draws its own line as usual;
   * gap: draws only the gap down to the top of staff `to` (mensurstrich).
   */
  mode: 'start' | 'skip' | 'own' | 'gap';
  to: number;
}

interface PartRange {
  partIndex: number;
  from: number;
  to: number;
}

function partRanges(score: Score): PartRange[] {
  const out: PartRange[] = [];
  let k = 0;
  score.parts.forEach((p, partIndex) => {
    out.push({ partIndex, from: k, to: k + p.staves.length - 1 });
    k += p.staves.length;
  });
  return out;
}

/** The staff range of a group, or undefined when it names unknown or non-adjacent parts. */
function groupRange(score: Score, g: StaffGroup, ranges: PartRange[]): { from: number; to: number; pFrom: number; pTo: number } | undefined {
  const idx = g.partIds.map((id) => score.parts.findIndex((p) => p.id === id));
  if (idx.length === 0 || idx.some((i) => i < 0)) return undefined;
  const sorted = [...idx].sort((a, b) => a - b);
  if (new Set(sorted).size !== sorted.length || sorted[sorted.length - 1] - sorted[0] !== sorted.length - 1) return undefined;
  const pFrom = sorted[0];
  const pTo = sorted[sorted.length - 1];
  return { from: ranges[pFrom].from, to: ranges[pTo].to, pFrom, pTo };
}

/**
 * Braces and brackets. A multi-staff part gets the piano brace unless a group over exactly that part
 * says otherwise; groups with bracket 'none' draw nothing.
 */
export function groupMarks(score: Score): GroupMark[] {
  const ranges = partRanges(score);
  const raw: { kind: GroupMark['kind']; from: number; to: number }[] = [];
  for (const g of score.groups) {
    const r = groupRange(score, g, ranges);
    if (!r || g.bracket === 'none') continue;
    raw.push({ kind: g.bracket, from: r.from, to: r.to });
  }
  score.parts.forEach((p, i) => {
    if (p.staves.length < 2) return;
    const named = score.groups.some((g) => g.partIds.length === 1 && g.partIds[0] === p.id);
    if (!named) raw.push({ kind: 'brace', from: ranges[i].from, to: ranges[i].to });
  });
  raw.sort((a, b) => a.from - b.from || b.to - a.to);
  return raw.map((m, i) => {
    let depth = 0;
    raw.forEach((o, j) => {
      if (j === i || o.from > m.from || o.to < m.to) return;
      const same = o.from === m.from && o.to === m.to;
      if (!same || j < i) depth++;
    });
    return { ...m, depth };
  });
}

type Join = 'through' | 'individual' | 'mensurstrich';

/** The barline join between staff k and k+1. */
function joinOf(score: Score, ranges: PartRange[], k: number): Join {
  const upper = ranges.find((r) => k >= r.from && k <= r.to)!;
  const lower = ranges.find((r) => k + 1 >= r.from && k + 1 <= r.to)!;
  // Smallest group containing both parts decides.
  let best: { span: number; join: Join } | undefined;
  for (const g of score.groups) {
    const gr = groupRange(score, g, ranges);
    if (!gr) continue;
    if (gr.pFrom <= upper.partIndex && gr.pTo >= lower.partIndex) {
      const span = gr.pTo - gr.pFrom;
      if (!best || span < best.span) best = { span, join: g.barlineSpan };
    }
  }
  if (upper.partIndex === lower.partIndex) {
    // Staves of one part (piano) share their barlines unless a group says mensurstrich.
    return best?.join === 'mensurstrich' ? 'mensurstrich' : 'through';
  }
  return best?.join ?? 'individual';
}

/** Barline behaviour of every staff. */
export function barRules(score: Score): StaffBarRule[] {
  const ranges = partRanges(score);
  const n = ranges.length === 0 ? 0 : ranges[ranges.length - 1].to + 1;
  const joins: Join[] = [];
  for (let k = 0; k < n - 1; k++) joins.push(joinOf(score, ranges, k));
  const rules: StaffBarRule[] = [];
  for (let k = 0; k < n; k++) {
    const prev = k > 0 ? joins[k - 1] : undefined;
    const next = k < n - 1 ? joins[k] : undefined;
    if (prev === 'through') {
      rules.push({ mode: 'skip', to: k });
    } else if (next === 'through') {
      let e = k;
      while (e < n - 1 && joins[e] === 'through') e++;
      rules.push({ mode: 'start', to: e });
    } else if (next === 'mensurstrich') {
      rules.push({ mode: 'gap', to: k + 1 });
    } else if (prev === 'mensurstrich') {
      rules.push({ mode: 'skip', to: k });
    } else {
      rules.push({ mode: 'own', to: k });
    }
  }
  return rules;
}

/** Stable text of everything above that changes the system layout (part of the system cache key). */
export function ensembleKey(score: Score): string {
  const marks = groupMarks(score)
    .map((m) => `${m.kind[0]}${m.from}-${m.to}d${m.depth}`)
    .join(',');
  const rules = barRules(score)
    .map((r) => `${r.mode[0]}${r.to}`)
    .join(',');
  const parts = score.parts.map((p) => p.staves.length).join('');
  return `${parts}|${marks}|${rules}`;
}
