// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Score layout engine producing deterministic LayoutResult structures.
 *
 * Implements single-staff automatic layout, horizontal spacing, system wrapping,
 * non-last system justification, and manual visual overrides.
 */

import { applySkylineSpacing } from './skylineSpacing';
import { clefAt, clefAtMeasureStart, sameClef } from '../core/clef';
import { Clef, Score, Staff } from '../core/model';
import { clefGlyphName, clefLineY, MeasureClefInfo } from './clefLayout';
import { getKeySignatureAccidentals } from './keySignature';
import {
  LayoutItem,
  LayoutOptions,
  LayoutResult,
  LayoutStaff,
  LayoutSystem,
} from './types';
import {
  BARLINE_THICKNESS,
  LEDGER_EXTENSION,
  MeasureAlignment,
  MeasureLayoutChunk,
  NOTEHEAD_WIDTH,
  STAFF_LINE_THICKNESS,
} from './layoutPrimitives';
import { alignStaffColumns } from './columnAlignment';
import {
  barRules,
  ensembleKey,
  groupMarks,
  GroupMark,
  labelGap,
  labelIndent,
  LABEL_FONT_SP,
  MARK_STEP_SP,
  partLabels,
} from './ensembleLayout';
import { computeHeaderLayout } from './headerLayout';
import { layoutSingleMeasure } from './measureLayout';
import { applyVisualOverrides } from './overrideLayout';
import { generateSingleSystemBeams, generateSystemBeams, SystemPlan } from './systemBeams';
import { allStaves, firstStaff } from '../core/staffLookup';

export * from './layoutPrimitives';
export * from './headerLayout';
export * from './measureLayout';
export * from './overrideLayout';
export * from './systemBeams';

/** Vertical gap in staff spaces between the bottom line of one staff and the top line of the next. */
const STAFF_GAP_SP = 7.0; // between two staves of one part (grand staff)
const PART_GAP_SP = 9.0; // between the last staff of a part and the first of the next (M7c-6)

interface CachedSystemLayout {
  items: LayoutItem[];
  staffEndEndX: number;
}

const MAX_SYSTEM_CACHE = 1000;
const systemLayoutCache = new Map<string, CachedSystemLayout>();

/** Clears the system layout memoization cache (for tests or hard resets). */
export function clearSystemLayoutCache(): void {
  systemLayoutCache.clear();
}

/** Left offset (staff spaces) of the grand-staff brace relative to the system start barline. */
const BRACE_X = -0.9;
const BRACKET_X = -0.55; // centre of the bracket bar (M7c-6)
const MARK_STEP = MARK_STEP_SP; // every nesting level of braces/brackets moves this far left

export function layoutScore(score: Score, options: LayoutOptions = {}): LayoutResult {
  const targetWidth = options.width ?? options.contentWidth ?? 70;
  const systemSpacing = options.systemSpacing ?? 10;
  const staffMarginTop = 7.0;
  const staffMarginBottom = 4.0;

  const beamGrouping = score.layoutSettings?.beamGrouping === 'half-bar' ? 'half-bar' : 'beat';
  const noteLabels = score.layoutSettings?.showNoteNames
    ? (options.noteNameStyle ?? 'solfege')
    : undefined;

  const staff = firstStaff(score);
  const clef: Clef = staff?.clef ?? { sign: 'G', line: 2 };

  // Multi-staff (M7b) and ensembles (M7c-6): the staves of ALL parts form one system, parts in order.
  // A single-staff score takes exactly the code paths it always did.
  const staves = allStaves(score);
  const staffCount = Math.max(1, staves.length);
  const multiStaff = staffCount > 1;
  const partOfStaff = score.parts.flatMap((p) => p.staves.map(() => p.id));
  const staffOffsets: number[] = [];
  for (let k = 0; k < staffCount; k++) {
    if (k === 0) {
      staffOffsets.push(0);
      continue;
    }
    const gap = partOfStaff[k] === partOfStaff[k - 1] ? STAFF_GAP_SP : PART_GAP_SP;
    staffOffsets.push(staffOffsets[k - 1] + 4 + gap); // top line to top line
  }
  const systemExtra = staffOffsets[staffCount - 1];
  const spanBottom = systemExtra + 4; // bottom line of the last staff, system-relative
  const sysStep = systemSpacing + 4 + systemExtra;
  // Groups (M7b-1c-ii, M7c-6): braces/brackets per group, a multi-staff part without its own group gets
  // the piano brace; barline spans (through / individual / mensurstrich) decide which staves share lines.
  const marks: GroupMark[] = multiStaff ? groupMarks(score) : [];
  const rules = multiStaff ? barRules(score) : [];
  const ensKey = multiStaff ? ensembleKey(score) : '';
  /** The brace over the whole system keeps the item shape every earlier version drew. */
  const isWholeBrace = (m: GroupMark) => m.kind === 'brace' && m.from === 0 && m.to === staffCount - 1 && m.depth === 0;

  function createClefItems(startX: number, clefToUse: Clef): { items: LayoutItem[]; width: number } {
    const glyph = clefGlyphName(clefToUse);
    const y = clefLineY(clefToUse);
    return {
      items: [
        {
          id: `clef-${startX}`,
          kind: 'glyph',
          glyph,
          x: startX,
          y,
        },
      ],
      width: 2.8,
    };
  }

  function createKeySigItems(startX: number, keySig: number, clefToUse: Clef): { items: LayoutItem[]; width: number } {
    const accidentals = getKeySignatureAccidentals(keySig, clefToUse);
    if (accidentals.length === 0) {
      return { items: [], width: 0 };
    }
    const items: LayoutItem[] = [];
    let curX = startX;
    for (let i = 0; i < accidentals.length; i++) {
      const acc = accidentals[i];
      items.push({
        id: `keysig-${i}`,
        kind: 'glyph',
        glyph: acc.glyph,
        x: curX,
        y: acc.y,
      });
      curX += 1.1;
    }
    return { items, width: curX - startX + 0.4 };
  }

  /** The clef that opens a measure on a staff (M7c-5: a change at tick 0 counts). */
  function measureStartClef(st: Staff, measureId: string): Clef {
    return clefAtMeasureStart(score, st, measureId);
  }

  /**
   * Clef changes inside a measure and the clef that opens the next one (drawn small before the barline).
   * Undefined for a staff without clef changes, so such scores take exactly the code path they always did.
   */
  function measureClefInfo(st: Staff, measureId: string): MeasureClefInfo | undefined {
    if (!st.clefChanges || st.clefChanges.length === 0) return undefined;
    const idx = score.measures.findIndex((m) => m.id === measureId);
    const changes = st.clefChanges
      .filter((c) => c.measureId === measureId && c.tick > 0)
      .map((c) => ({ tick: c.tick, clef: c.clef }));
    let trailing: Clef | undefined;
    const next = score.measures[idx + 1];
    if (next) {
      const nextStart = clefAtMeasureStart(score, st, next.id);
      if (!sameClef(clefAt(score, st, measureId, Number.MAX_SAFE_INTEGER), nextStart)) trailing = nextStart;
    }
    if (changes.length === 0 && !trailing) return undefined;
    return { changes, trailing };
  }

  // Measure each measure definition into a natural chunk
  const measureChunks: MeasureLayoutChunk[] = [];
  // Chunks of staves 1..n-1 (multi-staff only), indexed like measureChunks.
  const extraChunks: MeasureLayoutChunk[][] = Array.from({ length: staffCount - 1 }, () => []);

  /**
   * Lays out one measure on every staff: a first pass per staff, the cross-staff column
   * alignment, then a second pass only for staves that actually have to move.
   */
  function layoutAllStaves(
    mDefIn: Score['measures'][number],
    isFirstMeasureIn: boolean,
    isLastMeasureIn: boolean,
    prevMDefIn?: Score['measures'][number]
  ): MeasureLayoutChunk[] {
    const scopeOf = (k: number) => (k === 0 ? undefined : `-s${k}`);
    const first = staves.map((st, k) =>
      layoutSingleMeasure(
        st.measures[mDefIn.id],
        mDefIn,
        measureStartClef(st, mDefIn.id),
        isFirstMeasureIn,
        isLastMeasureIn,
        prevMDefIn,
        undefined,
        scopeOf(k),
        beamGrouping,
        noteLabels,
        measureClefInfo(st, mDefIn.id)
      )
    );
    const al = alignStaffColumns(
      first.map((ch) => ({
        positions: ch.columns ?? new Map<number, number>(),
        width: ch.naturalWidth,
        centered: ch.centered,
      }))
    );
    return first.map((ch, k) => {
      const ownEnd = ch.contentEndX ?? ch.naturalWidth;
      const alignment: MeasureAlignment = {
        shifts: al.shifts[k],
        centeredShift: al.centeredShift[k],
        contentEndX: al.width - (ch.naturalWidth - ownEnd),
      };
      const noop =
        [...alignment.shifts.values()].every((d) => Math.abs(d) < 1e-9) &&
        Math.abs(alignment.centeredShift) < 1e-9 &&
        alignment.contentEndX <= ownEnd + 1e-9;
      if (noop) return ch;
      return layoutSingleMeasure(
        staves[k].measures[mDefIn.id],
        mDefIn,
        measureStartClef(staves[k], mDefIn.id),
        isFirstMeasureIn,
        isLastMeasureIn,
        prevMDefIn,
        alignment,
        scopeOf(k),
        beamGrouping,
        noteLabels,
        measureClefInfo(staves[k], mDefIn.id)
      );
    });
  }

  for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
    const mDef = score.measures[mIdx];
    const prevMDef = mIdx > 0 ? score.measures[mIdx - 1] : undefined;
    const isFirstMeasure = mIdx === 0;
    const isLastMeasure = mIdx === score.measures.length - 1;
    if (multiStaff) {
      const perStaff = layoutAllStaves(mDef, isFirstMeasure, isLastMeasure, prevMDef);
      measureChunks.push(perStaff[0]);
      for (let k = 1; k < staffCount; k++) extraChunks[k - 1].push(perStaff[k]);
      continue;
    }
    const staffMeasure = staff?.measures[mDef.id];
    measureChunks.push(
      layoutSingleMeasure(
        staffMeasure,
        mDef,
        staff ? measureStartClef(staff, mDef.id) : clef,
        isFirstMeasure,
        isLastMeasure,
        prevMDef,
        undefined,
        undefined,
        beamGrouping,
        noteLabels,
        staff ? measureClefInfo(staff, mDef.id) : undefined
      )
    );
  }

  // Pack measures into systems with width check
  const systemPlans: SystemPlan[] = [];

  function makePlan(
    chunks: MeasureLayoutChunk[],
    indices: number[],
    header: { headerWidth: number; headerItems: LayoutItem[]; indent: number }
  ): SystemPlan {
    const plan: SystemPlan = {
      measures: chunks,
      measureIndices: indices,
      headerWidth: header.headerWidth,
      headerItems: header.headerItems,
      ...(header.indent > 0 ? { indent: header.indent } : {}),
    };
    if (multiStaff) {
      plan.staffChunks = extraChunks.map((list) => indices.map((i) => list[i]));
      plan.beamChunks = [
        ...chunks.map((chunk) => ({ chunk, yOffset: 0, staffId: staves[0].id })),
        ...plan.staffChunks.flatMap((list, k) =>
          list.map((chunk) => ({ chunk, yOffset: staffOffsets[k + 1], staffId: staves[k + 1].id }))
        ),
      ];
    }
    return plan;
  }

  let currentPlanMeasures: MeasureLayoutChunk[] = [];
  let currentPlanIndices: number[] = [];
  let currentUsedWidth = 0;

  function computeHeader(firstMIdx: number = 0): { headerWidth: number; headerItems: LayoutItem[]; indent: number } {
    const items: LayoutItem[] = [];
    // Part labels (M7c-6): full names on the first system, short names afterwards; the system starts at `indent`.
    const labels = multiStaff ? partLabels(score, firstMIdx === 0) : [];
    const gap = labelGap(marks);
    const indent = labelIndent(labels, gap);
    let startX = indent;

    items.push({
      id: `sys-start-barline`,
      kind: 'line',
      x: startX,
      y: 0,
      x2: startX,
      y2: multiStaff ? spanBottom : 4,
      thickness: BARLINE_THICKNESS,
    });
    if (marks.some(isWholeBrace)) {
      // The SMuFL brace is 4 sp tall at natural size and rises from its baseline: stretch it to the
      // full system span and hang it just left of the system start barline.
      items.push({
        id: 'sys-brace',
        kind: 'glyph',
        glyph: 'brace',
        x: indent + BRACE_X,
        y: spanBottom,
        scaleY: spanBottom / 4,
      });
    }
    startX += 0.4;
    const afterBarlineX = startX;

    const headerClef = staff ? measureStartClef(staff, score.measures[firstMIdx]?.id ?? '') : clef;
    const clefLayout = createClefItems(startX, headerClef);
    items.push(...clefLayout.items);
    startX += clefLayout.width;

    const keySigToUse = score.measures[firstMIdx]?.keySig ?? 0;
    const keySigLayout = createKeySigItems(startX, keySigToUse, headerClef);
    items.push(...keySigLayout.items);
    startX += keySigLayout.width;

    if (multiStaff) {
      for (const it of items) {
        if (it.id !== 'sys-start-barline') it.staffId = staves[0].id;
      }
      for (let k = 1; k < staffCount; k++) {
        const stClef = measureStartClef(staves[k], score.measures[firstMIdx]?.id ?? '');
        const cl = createClefItems(afterBarlineX, stClef);
        const ks = createKeySigItems(afterBarlineX + cl.width, keySigToUse, stClef);
        for (const it of [...cl.items, ...ks.items]) {
          items.push({ ...it, id: `s${k}-${it.id}`, y: it.y + staffOffsets[k], staffId: staves[k].id });
        }
      }
    }

    // Braces and brackets over part of the system (M7c-6); the whole-system brace was added above.
    marks.forEach((m, i) => {
      if (isWholeBrace(m)) return;
      const top = staffOffsets[m.from];
      const bottom = staffOffsets[m.to] + 4;
      const fromId = staves[m.from].id;
      const toId = staves[m.to].id;
      if (m.kind === 'brace') {
        items.push({
          id: `sys-brace-${i}`,
          kind: 'glyph',
          glyph: 'brace',
          x: indent + BRACE_X - m.depth * MARK_STEP,
          y: bottom,
          scaleY: (bottom - top) / 4,
          staffId: fromId,
          spanStaffId: toId,
        });
        return;
      }
      const lx = indent + BRACKET_X - m.depth * MARK_STEP;
      items.push(
        { id: `sys-bracket-${i}`, kind: 'line', x: lx, y: top, x2: lx, y2: bottom, thickness: 0.5, staffId: fromId, spanStaffId: toId },
        { id: `sys-bracket-${i}-top`, kind: 'line', x: lx - 0.25, y: top, x2: lx + 0.9, y2: top, thickness: 0.3, staffId: fromId },
        { id: `sys-bracket-${i}-bottom`, kind: 'line', x: lx - 0.25, y: bottom, x2: lx + 0.9, y2: bottom, thickness: 0.3, staffId: toId }
      );
    });

    for (const [i, l] of labels.entries()) {
      const lines = l.text.split('\n');
      const centre = staffOffsets[l.from] + (staffOffsets[l.to] + 4 - staffOffsets[l.from]) / 2;
      const lineStep = LABEL_FONT_SP * 1.15;
      lines.forEach((line, li) => {
        items.push({
          id: `part-label-${i}-${li}`,
          kind: 'text',
          text: line,
          x: indent - gap,
          y: centre + 0.35 * LABEL_FONT_SP + (li - (lines.length - 1) / 2) * lineStep,
          textAnchor: 'end',
          fontSize: LABEL_FONT_SP,
          fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
          staffId: staves[l.from].id,
        });
      });
    }

    return { headerWidth: startX, headerItems: items, indent };
  }

  let currentHeader = computeHeader(0);
  currentUsedWidth = currentHeader.headerWidth;

  // M7d-1: a measure with systemBreakBefore always starts a system (a break only shortens a system).
  const forcedBreakBefore = new Set(score.measures.filter((m) => m.systemBreakBefore).map((m) => m.id));

  for (let mIdx = 0; mIdx < measureChunks.length; mIdx++) {
    const chunk = measureChunks[mIdx];
    if (forcedBreakBefore.has(chunk.measureDefId) && currentPlanMeasures.length > 0) {
      systemPlans.push(makePlan(currentPlanMeasures, currentPlanIndices, currentHeader));
      currentPlanMeasures = [];
      currentPlanIndices = [];
      currentHeader = computeHeader(mIdx);
      currentUsedWidth = currentHeader.headerWidth;
    }
    const projectedWidth = currentUsedWidth + chunk.naturalWidth;

    if (projectedWidth > targetWidth) {
      if (currentPlanMeasures.length > 0) {
        // Measure does not fit in current system; close system and wrap to next
        systemPlans.push(makePlan(currentPlanMeasures, currentPlanIndices, currentHeader));

        // Start new system plan
        currentPlanMeasures = [chunk];
        currentPlanIndices = [mIdx];
        currentHeader = computeHeader(mIdx);
        currentUsedWidth = currentHeader.headerWidth + chunk.naturalWidth;
      } else {
        // Width is too small for even one measure: put one measure and allow overflow
        console.warn(
          `[ScoreForge layout] Container width (${targetWidth}) is too small for measure ${chunk.measureDefId}; allowing overflow.`
        );
        systemPlans.push(makePlan([chunk], [mIdx], currentHeader));

        currentPlanMeasures = [];
        currentPlanIndices = [];
        currentHeader = computeHeader(mIdx + 1);
        currentUsedWidth = currentHeader.headerWidth;
      }
    } else {
      currentPlanMeasures.push(chunk);
      currentPlanIndices.push(mIdx);
      currentUsedWidth = projectedWidth;
    }
  }

  if (currentPlanMeasures.length > 0) {
    systemPlans.push(makePlan(currentPlanMeasures, currentPlanIndices, currentHeader));
  }

  // Construct LayoutSystem objects (justify non-last systems, do not stretch last system)
  const systems: LayoutSystem[] = [];

  const headerLayout = computeHeaderLayout(score.meta, targetWidth);
  const preliminarySys0Y = headerLayout.height > 0 ? headerLayout.height + staffMarginTop : staffMarginTop;
  const isPickup = Boolean(score.measures[0]?.actualTicks);

  const hasOverrides = Boolean(score.overrides && Object.keys(score.overrides).length > 0);

  for (let sIdx = 0; sIdx < systemPlans.length; sIdx++) {
    const plan = systemPlans[sIdx];
    const isLastSystem = sIdx === systemPlans.length - 1;
    let mKeys = '';
    for (let i = 0; i < plan.measures.length; i++) {
      mKeys += (i === 0 ? '' : ';') + (plan.measures[i].cacheKey ?? plan.measures[i].measureDefId);
    }
    if (plan.staffChunks) {
      for (const list of plan.staffChunks) {
        for (const ch of list) mKeys += `|${ch.cacheKey ?? ch.measureDefId}`;
      }
    }
    const staffKey = multiStaff ? `_n${staves.map((st) => st.id).join(',')}_e${ensKey}` : '';
    const sysKey = !hasOverrides
      ? `${sIdx === 0 ? 's0' : 'sx'}_${isLastSystem ? 'last' : 'norm'}_${targetWidth}_${preliminarySys0Y}${staffKey}_${plan.measureIndices[0]}_${mKeys}`
      : null;

    let systemItems: LayoutItem[];
    let staffEndEndX: number;

    if (sysKey && systemLayoutCache.has(sysKey)) {
      const cached = systemLayoutCache.get(sysKey)!;
      systemItems = cached.items;
      staffEndEndX = cached.staffEndEndX;
    } else {
      systemItems = [];

      // Header block on first page above system 0
      if (sIdx === 0 && headerLayout.items.length > 0) {
        for (const hItem of headerLayout.items) {
          systemItems.push({
            ...hItem,
            y: hItem.y - preliminarySys0Y,
          });
        }
      }

      // Measure number above start of system for systems after the first
      if (sIdx > 0) {
        const firstMIdx = plan.measureIndices[0] ?? 0;
        const measureNumber = isPickup ? firstMIdx : firstMIdx + 1;
        if (measureNumber > 0) {
          systemItems.push({
            id: `sys-${sIdx}-measure-number`,
            kind: 'text',
            text: String(measureNumber),
            x: plan.indent ?? 0,
            y: -1.2,
            fontSize: 1.1,
            fontWeight: 'bold',
            fontStyle: 'italic',
            fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
          });
        }
      }

      // Header items
      for (const hItem of plan.headerItems) {
        systemItems.push({
          ...hItem,
          id: `sys-${sIdx}-${hItem.id}`,
        });
      }

      const naturalContentWidth = plan.measures.reduce((sum, m) => sum + m.naturalWidth, 0);
      const availableContentSpace = targetWidth - plan.headerWidth;

      const shouldJustify =
        !isLastSystem && naturalContentWidth > 0 && availableContentSpace > naturalContentWidth;
      const stretchRatio = shouldJustify ? availableContentSpace / naturalContentWidth : 1.0;

      let contentOffset = plan.headerWidth;

      for (let mInSys = 0; mInSys < plan.measures.length; mInSys++) {
        const chunk = plan.measures[mInSys];
        const globalMIdx = plan.measureIndices[mInSys];
        const mDef = score.measures[globalMIdx];
        const isLastMeasureInSystem = mInSys === plan.measures.length - 1;
        const isNextOnSameSystem = !isLastMeasureInSystem;
        const nextMDef = isNextOnSameSystem ? score.measures[plan.measureIndices[mInSys + 1]] : undefined;
        const prevMDefOnSameSystem = mInSys > 0 ? score.measures[plan.measureIndices[mInSys - 1]] : undefined;

        const hasCombinedRepeatEnd = Boolean(mDef.repeatEnd && nextMDef?.repeatStart);
        const isCombinedRepeatStartSuppressed = Boolean(mDef.repeatStart && prevMDefOnSameSystem?.repeatEnd);

        // Tempo display above measure if specified on this measure
        const tempo = mDef?.tempo ?? (globalMIdx === 0 && score.measures[0]?.tempo ? score.measures[0].tempo : undefined);
        if (tempo) {
          let curTempoX = contentOffset;
          if (tempo.tempoText) {
            systemItems.push({
              id: `tempo-text-${mDef.id}`,
              kind: 'text',
              text: tempo.tempoText,
              x: curTempoX,
              y: -2.4,
              fontSize: 1.25,
              fontWeight: 'bold',
              fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
            });
            curTempoX += tempo.tempoText.length * 0.65 + 0.5;
          }

          if (!(tempo.hideMetronome && tempo.tempoText)) {
            let beatGlyph = 'metNoteQuarterUp';
            if (tempo.beatUnit === 0.5) beatGlyph = 'metNote8thUp';
            else if (tempo.beatUnit === 2.0) beatGlyph = 'metNoteHalfUp';
            else if (tempo.beatUnit === 1.5) beatGlyph = 'metNoteQuarterUp';

            systemItems.push({
              id: `tempo-glyph-${mDef.id}`,
              kind: 'glyph',
              glyph: beatGlyph,
              x: curTempoX,
              y: -2.4,
              scale: 0.8,
            });
            curTempoX += 1.4;

            if (tempo.beatUnit === 1.5) {
              systemItems.push({
                id: `tempo-dot-${mDef.id}`,
                kind: 'glyph',
                glyph: 'metAugmentationDot',
                x: curTempoX,
                y: -2.4,
                scale: 0.8,
              });
              curTempoX += 0.8;
            }

            systemItems.push({
              id: `tempo-bpm-${mDef.id}`,
              kind: 'text',
              text: ` = ${tempo.bpm}`,
              x: curTempoX,
              y: -2.4,
              fontSize: 1.2,
              fontWeight: 'bold',
              fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
            });
          }
        }

        const placeStaffItems = (stChunk: MeasureLayoutChunk, staffIdx: number) => {
          const yOff = staffOffsets[staffIdx];
        for (let iIdx = 0; iIdx < stChunk.items.length; iIdx++) {
          const entry = stChunk.items[iIdx];
          const raw = entry.item;

          // If this measure's repeat-start is covered by previous measure's combined repeatRightLeft, skip it
          if (raw.id.startsWith('repeat-start-') && isCombinedRepeatStartSuppressed) {
            continue;
          }

          // If this measure has repeatEnd and next measure has repeatStart on the same system, draw combined repeatRightLeft
          let itemToPlace = raw;
          if (raw.id.startsWith('repeat-end-') && hasCombinedRepeatEnd) {
            itemToPlace = {
              ...raw,
              id: `repeat-combined-${mDef.id}`,
              glyph: 'repeatRightLeft',
            };
          }

          const isBarline = iIdx >= stChunk.barlineItemIndex;
          // One barline line spans all staves (drawn by staff 0); other staves skip theirs.
          const barRule = multiStaff && isBarline && itemToPlace.kind === 'line' ? rules[staffIdx] : undefined;
          if (barRule?.mode === 'skip') continue;
          // A line through ALL staves keeps the legacy shape (no staff id, stretched by skyline spacing).
          const isThroughBarline = barRule?.mode === 'start' && staffIdx === 0 && barRule.to === staffCount - 1;

          let finalX: number;
          let finalX2: number | undefined = undefined;

          if (isLastMeasureInSystem && shouldJustify && isBarline) {
            const barlineThickness = itemToPlace.thickness ?? BARLINE_THICKNESS;
            finalX = targetWidth - barlineThickness;
            finalX2 = finalX;
          } else if (entry.ledgerNoteRelativeX !== undefined) {
            const stretchedNoteX =
              entry.anchorX !== undefined
                ? contentOffset + entry.anchorX * stretchRatio + (entry.ledgerNoteRelativeX - entry.anchorX)
                : contentOffset + entry.ledgerNoteRelativeX * stretchRatio;
            finalX = stretchedNoteX - LEDGER_EXTENSION;
            finalX2 = stretchedNoteX + NOTEHEAD_WIDTH + LEDGER_EXTENSION;
          } else if (entry.anchorX !== undefined) {
            // Fixed offset from the stretched column: stems/dots/flags must not scale with the ratio.
            const anchorFinal = contentOffset + entry.anchorX * stretchRatio;
            finalX = anchorFinal + (itemToPlace.x - entry.anchorX);
            if (itemToPlace.x2 !== undefined) {
              finalX2 = anchorFinal + (itemToPlace.x2 - entry.anchorX);
            }
          } else {
            finalX = contentOffset + itemToPlace.x * stretchRatio;
            if (itemToPlace.x2 !== undefined) {
              finalX2 = contentOffset + itemToPlace.x2 * stretchRatio;
            }
          }

          const placed: LayoutItem = {
            ...itemToPlace,
            x: finalX,
            x2: finalX2,
          };
          if (multiStaff) {
            if (isThroughBarline) {
              placed.y2 = spanBottom;
            } else {
              placed.staffId = staves[staffIdx].id;
              if (staffIdx > 0) {
                placed.y = itemToPlace.y + yOff;
                if (itemToPlace.y2 !== undefined) placed.y2 = itemToPlace.y2 + yOff;
                if (!itemToPlace.eventId) placed.id = `s${staffIdx}-${itemToPlace.id}`;
              }
              if (barRule && barRule.mode === 'start') {
                // Barline through several staves, but not the whole system (M7c-6).
                placed.y2 = staffOffsets[barRule.to] + 4;
                placed.spanStaffId = staves[barRule.to].id;
              } else if (barRule && barRule.mode === 'gap') {
                // Mensurstrich: the line only crosses the gap down to the next staff.
                placed.y = staffOffsets[staffIdx] + 4;
                placed.y2 = staffOffsets[barRule.to];
                placed.spanStaffId = staves[barRule.to].id;
              }
            }
          }
          systemItems.push(placed);
        }
        };
        placeStaffItems(chunk, 0);
        for (let k = 1; k < staffCount; k++) {
          placeStaffItems(plan.staffChunks![k - 1][mInSys], k);
        }

        const measureStartX = contentOffset;
        const measureEndX = isLastMeasureInSystem && shouldJustify
          ? targetWidth
          : contentOffset + chunk.naturalWidth * stretchRatio;

        // Volta brackets above measure (Milestone 6d)
        if (mDef.volta) {
          const vNum = mDef.volta.number;
          const vStartX = measureStartX;
          const vEndX = measureEndX;
          const vY = -3.8;
          const hookEndY = -2.5;

          // Label "1." or "2."
          systemItems.push({
            id: `volta-text-${mDef.id}`,
            kind: 'text',
            text: `${vNum}.`,
            x: vStartX + 0.6,
            y: vY + 1.0,
            fontSize: 1.15,
            fontWeight: 'bold',
            fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
          });

          // Horizontal bracket line
          systemItems.push({
            id: `volta-line-${mDef.id}`,
            kind: 'line',
            x: vStartX,
            y: vY,
            x2: vEndX - 0.2,
            y2: vY,
            thickness: 0.16,
          });

          // Left hook (downward)
          systemItems.push({
            id: `volta-hook-left-${mDef.id}`,
            kind: 'line',
            x: vStartX,
            y: vY,
            x2: vStartX,
            y2: hookEndY,
            thickness: 0.16,
          });

          // Closing hook at the right end of a volta ONLY if the volta's last measure has repeatEnd
          const isLastMeasureOfVolta =
            globalMIdx === score.measures.length - 1 ||
            score.measures[globalMIdx + 1]?.volta?.number !== mDef.volta.number;

          if (isLastMeasureOfVolta && mDef.repeatEnd) {
            systemItems.push({
              id: `volta-hook-right-${mDef.id}`,
              kind: 'line',
              x: vEndX - 0.2,
              y: vY,
              x2: vEndX - 0.2,
              y2: hookEndY,
              thickness: 0.16,
            });
          }
        }

        contentOffset += chunk.naturalWidth * stretchRatio;
      }

      if (!isLastSystem && shouldJustify) {
        staffEndEndX = targetWidth;
      } else {
        staffEndEndX = contentOffset;
      }

      for (let line = 0; line <= 4; line++) {
        systemItems.unshift({
          id: `sys-${sIdx}-staffline-${line}`,
          kind: 'line',
          x: plan.indent ?? 0,
          y: line,
          x2: staffEndEndX,
          y2: line,
          thickness: STAFF_LINE_THICKNESS,
          ...(multiStaff ? { staffId: staves[0].id } : {}),
        });
      }
      for (let k = 1; k < staffCount; k++) {
        for (let line = 0; line <= 4; line++) {
          systemItems.push({
            id: `sys-${sIdx}-s${k}-staffline-${line}`,
            kind: 'line',
            x: plan.indent ?? 0,
            y: staffOffsets[k] + line,
            x2: staffEndEndX,
            y2: staffOffsets[k] + line,
            thickness: STAFF_LINE_THICKNESS,
            staffId: staves[k].id,
          });
        }
      }

      // If score has no overrides, generate beams right here and cache them with the system items
      if (!hasOverrides) {
        const tempSys: LayoutSystem = {
          index: sIdx,
          x: 0,
          y: sIdx * sysStep + preliminarySys0Y,
          width: Math.max(staffEndEndX, targetWidth),
          height: 6 + systemExtra,
          staves: [],
          items: systemItems,
        };
        generateSingleSystemBeams(tempSys, plan);
      }

      if (sysKey) {
        if (systemLayoutCache.size >= MAX_SYSTEM_CACHE) {
          const firstKey = systemLayoutCache.keys().next().value;
          if (firstKey) systemLayoutCache.delete(firstKey);
        }
        systemLayoutCache.set(sysKey, {
          items: systemItems,
          staffEndEndX,
        });
      }
    }

    const staffContainers: LayoutStaff[] = multiStaff
      ? staves.map((st, k) => ({
          id: st.id,
          y: staffMarginTop + staffOffsets[k],
          // Items without a staff id (system-level text, through barlines) belong to staff 0.
          items: systemItems.filter((it) => (it.staffId ?? staves[0].id) === st.id),
        }))
      : [
          {
            id: `staff-${sIdx}`,
            y: staffMarginTop,
            items: systemItems,
          },
        ];

    systems.push({
      index: sIdx,
      x: 0,
      y: sIdx * sysStep + preliminarySys0Y,
      width: Math.max(staffEndEndX, targetWidth),
      height: 6 + systemExtra,
      staves: staffContainers,
      items: [...systemItems],
    });
  }

  // Apply visual overrides
  const appliedOverrides = applyVisualOverrides(score, systems);

  // If score has manual overrides, generate beams after stem overrides are applied
  if (hasOverrides) {
    generateSystemBeams(systems, systemPlans);
  }

  // Skyline spacing (M7b-4): grow the gap between staves wherever their content needs it.
  const skylineExtra = multiStaff ? applySkylineSpacing(systems, spanBottom) : 0;

  // Dynamic header clearance: guarantee that system 0 musical items start at least 2 staff spaces below header bottom
  if (headerLayout.height > 0 && systems.length > 0) {
    const sys0 = systems[0];
    const musicalItems = sys0.items.filter((it) => !it.id.startsWith('header-'));
    const minMusicalY = musicalItems.length > 0 ? Math.min(...musicalItems.map((it) => it.y)) : 0;
    const neededOffset = Math.max(staffMarginTop, 2.0 - minMusicalY);
    const finalSys0Y = headerLayout.height + neededOffset;
    const dy = finalSys0Y - sys0.y;
    if (dy !== 0) {
      for (let s = 0; s < systems.length; s++) {
        systems[s].y += dy;
      }
      for (const item of sys0.items) {
        if (item.id.startsWith('header-')) {
          item.y -= dy;
        }
      }
    }
  }

  let memoizedItems: LayoutItem[] | null = null;
  const headerExtra = headerLayout.height > 0 && systems.length > 0 ? systems[0].y - staffMarginTop : 0;
  const totalHeight = systems.length * sysStep + staffMarginTop + staffMarginBottom + headerExtra + skylineExtra;
  const maxSysWidth = Math.max(targetWidth, ...systems.map((s) => s.width));

  return {
    width: maxSysWidth,
    height: totalHeight,
    systems,
    get items() {
      if (!memoizedItems) {
        memoizedItems = systems.flatMap((s) => s.items);
      }
      return memoizedItems;
    },
    score,
    appliedOverrides,
  };
}
