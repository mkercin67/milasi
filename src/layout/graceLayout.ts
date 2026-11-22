// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Grace note layout (M7c-3b). A grace group belongs to the main note that follows it and is laid out inside the
 * measure chunk, in a fixed reserve of width to the left of the main note's column. Positions are measure-relative
 * (staff spaces); items carry `graceOf` (the main note's event id) and NO `eventId`, so mouse picking, the notehead index, ties and
 * every other event-based pass ignore them, while system justification keeps them at a fixed offset from the main
 * note (see applyEventAnchors).
 *
 * Sizes follow common engraving practice (small noteheads about 65 percent of normal size, stems up, a slash across
 * the stem of an acciaccatura). They are a first proposal and stay UNVERIFIED until compared with a printed edition.
 */
import { Clef, GraceNote, NoteEvent } from '../core/model';
import { MeasureAccidentalTracker } from './accidentals';
import { getKeySignatureAlter } from './keySignature';
import { LEDGER_THICKNESS, MeasureItemEntry, NOTEHEAD_WIDTH, STEM_THICKNESS } from './layoutPrimitives';
import { getLedgerLineYs, pitchToStaffPosition, staffPositionToY } from './pitch';
import { LayoutItem } from './types';

/** Size of a grace notehead relative to a normal one. */
const GRACE_SCALE = 0.65;
const GRACE_NOTEHEAD_W = NOTEHEAD_WIDTH * GRACE_SCALE;
/** Horizontal pitch of one grace note (notehead plus air). */
const GRACE_PITCH = 1.3;
/** Extra width for a small accidental in front of a grace note. */
const GRACE_ACC_W = 0.8;
/** Air between the last grace note and the main note (or the main note's accidental). */
const GRACE_TAIL = 0.5;
/** Room for the main note's own accidental, which then sits between the grace group and the main note. */
const MAIN_ACC_W = 1.2;
const GRACE_STEM_LENGTH = 2.6;
const GRACE_MIN_STEM = 2.0;
const GRACE_BEAM_THICKNESS = 0.3;
const GRACE_BEAM_STEP = 0.45;
const GRACE_MAX_BEAM_SLOPE = 0.6;
const SLASH_THICKNESS = 0.12;
const GRACE_LEDGER_EXT = 0.25;

const FLAGS: Record<GraceNote['baseType'], string> = {
  eighth: 'flag8thUp',
  '16th': 'flag16thUp',
  '32nd': 'flag32ndUp',
};
const BEAM_LEVELS: Record<GraceNote['baseType'], number> = { eighth: 1, '16th': 2, '32nd': 3 };

export interface GracePlan {
  /** Total width reserved in front of the main note's column, including room for the main accidental. */
  width: number;
  /** Builds the items for a group whose first element starts at `startX`; the main note's column is `startX + width`. */
  build(startX: number): MeasureItemEntry[];
}

/** True when the main note prints an accidental in front of it (used only to reserve room). */
function mainNeedsAccidental(ev: NoteEvent, keySig: number): boolean {
  return ev.pitches.some(
    (p) =>
      (p.alter !== getKeySignatureAlter(p.step, keySig) || ev.showAccidental === true) &&
      Number.isInteger(p.alter) &&
      p.alter >= -2 &&
      p.alter <= 2
  );
}

/**
 * Plans the grace group of a main note. Runs the grace pitches through the measure's accidental tracker NOW, so an
 * accidental on a grace note correctly carries on within the bar. Call it once per event, before the main note's own
 * accidentals are processed.
 */
export function planGraceGroup(
  ev: NoteEvent,
  keySig: number,
  clef: Clef,
  tracker: MeasureAccidentalTracker
): GracePlan | null {
  const graces = ev.graces;
  if (!graces || graces.length === 0) return null;

  const accGlyphs: Array<{ glyph: string; courtesy: boolean } | null> = graces.map((g) => {
    const glyph = tracker.processPitch(g.pitch, false);
    return glyph ? { glyph, courtesy: tracker.lastWasCourtesy } : null;
  });

  let width = 0;
  const offsets: number[] = [];
  for (let i = 0; i < graces.length; i++) {
    if (accGlyphs[i]) width += GRACE_ACC_W;
    offsets.push(width);
    width += GRACE_PITCH;
  }
  width += GRACE_TAIL + (mainNeedsAccidental(ev, keySig) ? MAIN_ACC_W : 0);

  const build = (startX: number): MeasureItemEntry[] => {
    const entries: MeasureItemEntry[] = [];
    const push = (item: LayoutItem) => entries.push({ item });
    const stepPos = graces.map((g) => pitchToStaffPosition(g.pitch, clef));
    const xs = offsets.map((o) => startX + o);
    const ys = stepPos.map((sp) => staffPositionToY(sp));
    const stemXs = xs.map((x) => x + GRACE_NOTEHEAD_W);

    for (let i = 0; i < graces.length; i++) {
      const base = `${ev.id}-grace-${i}`;
      const acc = accGlyphs[i];
      if (acc) {
        push({
          id: `${base}-acc`,
          graceOf: ev.id,
          kind: 'glyph',
          glyph: acc.glyph,
          glyphScale: GRACE_SCALE,
          x: xs[i] - GRACE_ACC_W + 0.1,
          y: ys[i],
          ...(acc.courtesy ? { courtesy: true } : {}),
        });
      }
      push({
        id: `${base}-head`,
        graceOf: ev.id,
        kind: 'glyph',
        glyph: 'noteheadBlack',
        glyphScale: GRACE_SCALE,
        x: xs[i],
        y: ys[i],
      });
      for (const lY of getLedgerLineYs(stepPos[i])) {
        push({
          id: `${base}-ledger-${lY}`,
          graceOf: ev.id,
          kind: 'line',
          x: xs[i] - GRACE_LEDGER_EXT,
          y: lY,
          x2: xs[i] + GRACE_NOTEHEAD_W + GRACE_LEDGER_EXT,
          y2: lY,
          thickness: LEDGER_THICKNESS,
        });
      }
    }

    const stemStartY = (i: number) => ys[i] - 0.11;
    const beamed = graces.length >= 2;
    // Stem tops: a single grace note has a plain stem; a group shares one straight beam through the stem tops.
    let stemTop: (i: number) => number;
    if (beamed) {
      const first = ys[0] - GRACE_STEM_LENGTH;
      const last = ys[graces.length - 1] - GRACE_STEM_LENGTH;
      let slope = last - first;
      slope = Math.max(-GRACE_MAX_BEAM_SLOPE, Math.min(GRACE_MAX_BEAM_SLOPE, slope));
      const span = stemXs[graces.length - 1] - stemXs[0] || 1;
      const lineAt = (i: number) => first + (slope * (stemXs[i] - stemXs[0])) / span;
      // Raise the whole beam when a stem would become shorter than the minimum.
      let lift = 0;
      for (let i = 0; i < graces.length; i++) lift = Math.min(lift, ys[i] - GRACE_MIN_STEM - lineAt(i));
      stemTop = (i) => lineAt(i) + lift;
    } else {
      stemTop = (i) => ys[i] - GRACE_STEM_LENGTH;
    }

    for (let i = 0; i < graces.length; i++) {
      push({
        id: `${ev.id}-grace-${i}-stem`,
        graceOf: ev.id,
        kind: 'line',
        x: stemXs[i],
        y: stemStartY(i),
        x2: stemXs[i],
        y2: stemTop(i),
        thickness: STEM_THICKNESS,
      });
    }

    if (!beamed) {
      push({
        id: `${ev.id}-grace-0-flag`,
        graceOf: ev.id,
        kind: 'glyph',
        glyph: FLAGS[graces[0].baseType],
        glyphScale: GRACE_SCALE,
        x: stemXs[0],
        y: stemTop(0),
      });
    } else {
      // Beam levels are drawn per pair of neighbours; both notes need at least that many beams.
      const maxLevel = Math.max(...graces.map((g) => BEAM_LEVELS[g.baseType]));
      for (let level = 1; level <= maxLevel; level++) {
        for (let i = 0; i + 1 < graces.length; i++) {
          if (BEAM_LEVELS[graces[i].baseType] < level || BEAM_LEVELS[graces[i + 1].baseType] < level) continue;
          const off = GRACE_BEAM_THICKNESS / 2 + (level - 1) * GRACE_BEAM_STEP;
          push({
            id: `${ev.id}-grace-${i}-beam-${level}`,
            graceOf: ev.id,
            kind: 'line',
            x: stemXs[i] - STEM_THICKNESS / 2,
            y: stemTop(i) + off,
            x2: stemXs[i + 1] + STEM_THICKNESS / 2,
            y2: stemTop(i + 1) + off,
            thickness: GRACE_BEAM_THICKNESS,
          });
        }
      }
    }

    // Acciaccatura: one slash across the stem (single note) or across all stems and the beam (group).
    if (graces[0].kind === 'acciaccatura') {
      const last = graces.length - 1;
      const xl = stemXs[0] - 0.55;
      const xr = stemXs[last] + 0.65;
      const topAt = (x: number) => {
        if (!beamed) return stemTop(0);
        const t = (x - stemXs[0]) / (stemXs[last] - stemXs[0] || 1);
        return stemTop(0) + t * (stemTop(last) - stemTop(0));
      };
      push({
        id: `${ev.id}-grace-0-slash`,
        graceOf: ev.id,
        kind: 'line',
        x: xl,
        y: topAt(xl) + 1.2,
        x2: xr,
        y2: topAt(xr) + 0.4,
        thickness: SLASH_THICKNESS,
      });
    }
    return entries;
  };

  return { width, build };
}
