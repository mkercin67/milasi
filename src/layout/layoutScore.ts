/**
 * Score layout engine producing deterministic LayoutResult structures.
 *
 * Implements single-staff automatic layout, horizontal spacing, accidentals,
 * chords with seconds displacement, ledger lines, stem directions, flags,
 * system wrapping, non-last system justification, and manual visual overrides.
 */

import {
  BaseDurationType,
  Clef,
  MeasureDef,
  NoteEvent,
  Part,
  RestEvent,
  Score,
  ScoreEvent,
  StaffMeasure,
} from '../core/model';
import { PPQ } from '../core/time';
import { MeasureAccidentalTracker } from './accidentals';
import { computeBeamGroupGeometry, getBeamGroupStemDirection, BeamStemInput } from './beamLayout';
import { groupBeams } from './beams';
import {
  getKeySignatureAccidentals,
  getKeySignatureAlter,
  getKeySignatureChangeAccidentals,
} from './keySignature';
import { getLedgerLineYs, getStemDirection, pitchToStaffPosition, staffPositionToY } from './pitch';
import { clampOverrideOffset, getSystemMeasureBounds, SystemMeasureBounds } from './mouse';
import {
  LayoutItem,
  LayoutOptions,
  LayoutResult,
  LayoutStaff,
  LayoutSystem,
  StemDirection,
} from './types';

// Standard engraving dimensions in staff spaces
export const NOTEHEAD_WIDTH = 1.18;
export const STEM_LENGTH = 3.5;
export const STEM_THICKNESS = 0.12;
export const STAFF_LINE_THICKNESS = 0.13;
export const LEDGER_EXTENSION = 0.4;
export const LEDGER_THICKNESS = 0.16;
export const BARLINE_THICKNESS = 0.16;
export const THICK_BARLINE_THICKNESS = 0.5;

/**
 * Returns estimated layout width for a single item in staff spaces.
 */
export function getItemWidth(item: LayoutItem): number {
  if (item.kind === 'text') {
    return 0;
  }
  if (item.kind === 'beam' && item.points && item.points.length > 0) {
    const maxX = Math.max(...item.points.map((p) => p.x));
    return Math.max(0, maxX - item.x);
  }
  if (item.kind === 'line') {
    if (item.x2 !== undefined) {
      return Math.max(0, item.x2 - item.x);
    }
    return item.thickness ?? BARLINE_THICKNESS;
  }
  if (item.kind === 'glyph' && item.glyph) {
    if (item.glyph === 'gClef' || item.glyph === 'fClef') return 2.8;
    if (item.glyph === 'noteheadWhole') return 1.5;
    if (item.glyph.startsWith('notehead')) return NOTEHEAD_WIDTH;
    if (item.glyph.startsWith('accidental')) return 1.0;
    if (item.glyph.startsWith('timeSig')) return 1.2;
    if (item.glyph.startsWith('flag')) return 1.2;
    if (item.glyph.startsWith('rest')) return 1.2;
    if (item.glyph === 'augmentationDot') return 0.5;
    return 1.0;
  }
  return 1.0;
}

interface MeasureItemEntry {
  item: LayoutItem;
  /** If this item is a ledger line attached to a note, relative offset to note center */
  ledgerNoteRelativeX?: number;
}

/** Metadata captured per measure for a beam group, independent of system stretching/overrides. */
export interface MeasureBeamGroupMeta {
  beamGroupId: string;
  stemDir: StemDirection;
  events: Array<{
    eventId: string;
    baseType: BaseDurationType;
    stepPositions: number[];
    startTick: number;
  }>;
}

export interface MeasureLayoutChunk {
  measureDefId: string;
  items: MeasureItemEntry[];
  naturalWidth: number;
  barlineItemIndex: number;
  beamGroups: MeasureBeamGroupMeta[];
}

export const measureLayoutCacheStats = {
  calls: 0,
  hits: 0,
  misses: 0,
  reset() {
    this.calls = 0;
    this.hits = 0;
    this.misses = 0;
  },
};

const measureChunkCache = new WeakMap<StaffMeasure, Map<string, MeasureLayoutChunk>>();

function createTimeSigItems(
  startX: number,
  timeSig: { num: number; den: number }
): { items: LayoutItem[]; width: number } {
  const items: LayoutItem[] = [];
  const numStr = timeSig.num.toString();
  const denStr = timeSig.den.toString();

  let curX = startX;
  for (let i = 0; i < numStr.length; i++) {
    items.push({
      id: `timesig-num-${i}`,
      kind: 'glyph',
      glyph: `timeSig${numStr[i]}`,
      x: curX,
      y: 1.0,
    });
    items.push({
      id: `timesig-den-${i}`,
      kind: 'glyph',
      glyph: `timeSig${denStr[i]}`,
      x: curX,
      y: 3.0,
    });
    curX += 1.4;
  }

  return { items, width: curX - startX + 0.8 };
}

/**
 * Computes natural layout items and natural width for a single measure.
 * Uses a WeakMap cache keyed by the StaffMeasure reference for O(1) retrieval of unchanged measures.
 */
export function layoutSingleMeasure(
  staffMeasure: StaffMeasure | undefined,
  mDef: MeasureDef,
  clef: Clef,
  isFirstMeasure: boolean,
  isLastMeasure: boolean,
  prevMDef?: MeasureDef
): MeasureLayoutChunk {
  measureLayoutCacheStats.calls++;

  const prevKey = prevMDef
    ? `${prevMDef.keySig}_${prevMDef.timeSig.num}/${prevMDef.timeSig.den}`
    : 'none';
  const barlineType = mDef.endBarline ?? (isLastMeasure ? 'final' : 'single');
  const cacheKey = `${mDef.id}_${mDef.keySig}_${mDef.timeSig.num}/${mDef.timeSig.den}_${clef.sign}${clef.line}_${isFirstMeasure}_${isLastMeasure}_${prevKey}_${mDef.actualTicks ?? 'full'}_${barlineType}_${mDef.repeatStart ? 'rs' : ''}_${mDef.repeatEnd ? 're' : ''}_${mDef.volta?.number ?? 'none'}`;

  if (staffMeasure) {
    const existing = measureChunkCache.get(staffMeasure);
    if (existing && existing.has(cacheKey)) {
      measureLayoutCacheStats.hits++;
      return existing.get(cacheKey)!;
    }
  }

  measureLayoutCacheStats.misses++;

  const events: ScoreEvent[] = staffMeasure?.voices[0]?.events ?? [];
  const tracker = new MeasureAccidentalTracker(mDef.keySig);
  const measureItems: MeasureItemEntry[] = [];
  let relX = 0;

  // Precompute beam groupings per measure so uniform stem directions and flag omission stay cached per measure
  const beamGroupsRaw = groupBeams(events, mDef.timeSig);
  const noteStepsMap = new Map<string, number[]>();
  const startTickMap = new Map<string, number>();
  const fullTicks = (mDef.timeSig.num * 4 * PPQ) / mDef.timeSig.den;
  const pickupOffset =
    mDef.actualTicks && mDef.actualTicks < fullTicks ? fullTicks - mDef.actualTicks : 0;
  let runningTick = 0;
  for (const ev of events) {
    startTickMap.set(ev.id, runningTick + pickupOffset);
    runningTick += ev.duration;
    if (ev.kind === 'note') {
      const sortedSteps = [...ev.pitches]
        .map((p) => pitchToStaffPosition(p, clef))
        .sort((a, b) => a - b);
      noteStepsMap.set(ev.id, sortedSteps);
    }
  }

  const eventToBeamDir = new Map<string, StemDirection>();
  const beamGroupsMeta: MeasureBeamGroupMeta[] = [];
  for (let gIdx = 0; gIdx < beamGroupsRaw.length; gIdx++) {
    const g = beamGroupsRaw[gIdx];
    const groupSteps = g.eventIds.map((id) => noteStepsMap.get(id) ?? []);
    const groupStemDir = getBeamGroupStemDirection(groupSteps);
    const beamGroupId = `beam-${mDef.id}-${gIdx}`;
    for (const id of g.eventIds) {
      eventToBeamDir.set(id, groupStemDir);
    }
    beamGroupsMeta.push({
      beamGroupId,
      stemDir: groupStemDir,
      events: g.eventIds.map((id) => {
        const evObj = events.find((e) => e.id === id)!;
        return {
          eventId: id,
          baseType: evObj.baseType,
          stepPositions: noteStepsMap.get(id) ?? [],
          startTick: startTickMap.get(id) ?? 0,
        };
      }),
    });
  }

  // Key signature change mid-score
  if (!isFirstMeasure && prevMDef && prevMDef.keySig !== mDef.keySig) {
    const keyChangeAccidentals = getKeySignatureChangeAccidentals(
      prevMDef.keySig,
      mDef.keySig,
      clef
    );
    let curKeyX = relX;
    for (let i = 0; i < keyChangeAccidentals.length; i++) {
      const acc = keyChangeAccidentals[i];
      measureItems.push({
        item: {
          id: `keychange-${mDef.id}-${i}`,
          kind: 'glyph',
          glyph: acc.glyph,
          x: curKeyX,
          y: acc.y,
        },
      });
      curKeyX += 1.1;
    }
    if (keyChangeAccidentals.length > 0) {
      relX = curKeyX + 0.4;
    }
  }

  // Time signature in first measure or mid-score time signature change
  if (isFirstMeasure) {
    const tsLayout = createTimeSigItems(relX, mDef.timeSig);
    for (const item of tsLayout.items) {
      measureItems.push({ item });
    }
    relX += tsLayout.width;
  } else if (
    prevMDef &&
    (prevMDef.timeSig.num !== mDef.timeSig.num || prevMDef.timeSig.den !== mDef.timeSig.den)
  ) {
    const tsLayout = createTimeSigItems(relX, mDef.timeSig);
    for (const item of tsLayout.items) {
      measureItems.push({ item });
    }
    relX += tsLayout.width;
  }

  // Repeat start barline
  if (mDef.repeatStart) {
    measureItems.push({
      item: {
        id: `repeat-start-${mDef.id}`,
        kind: 'glyph',
        glyph: 'repeatLeft',
        x: relX,
        y: 4.0,
      },
    });
    relX += 1.8;
  }

  // Track note positions and lyrics for centered hyphens and melisma extenders
  interface LyricLayoutEntry {
    ev: NoteEvent;
    eIdx: number;
    lyricX: number;
    lyricY: number;
    displayText: string;
    hasHyphen: boolean;
    hasExtender: boolean;
  }
  const lyricsToLayout: LyricLayoutEntry[] = [];
  const notePositions: Array<{ evId: string; noteheadRightX: number; lyricX: number }> = [];

  // Process events
  for (let eIdx = 0; eIdx < events.length; eIdx++) {
    const ev = events[eIdx];
    const isWholeMeasureRest = ev.kind === 'rest' && Boolean((ev as RestEvent).wholeMeasure);
    const durationFactor = ev.duration / PPQ;
    let estLyricWidth = 0;
    if (ev.kind === 'note' && (ev as NoteEvent).lyrics && (ev as NoteEvent).lyrics!.length > 0) {
      const v1 = (ev as NoteEvent).lyrics!.find((l) => l.verse === 1);
      if (v1 && v1.text) {
        estLyricWidth = v1.text.length * 0.72;
      }
    }
    const eventWidth = isWholeMeasureRest
      ? 8.0
      : Math.max(3.5 + durationFactor * 2.0, estLyricWidth > 0 ? estLyricWidth + 1.8 : 0);

    let firstEventAccidentalPadding = 0;
    if (eIdx === 0 && ev.kind === 'note') {
      const noteEv = ev as NoteEvent;
      const hasAccidental = noteEv.pitches.some((p) => {
        const activeAlter = getKeySignatureAlter(p.step, mDef.keySig);
        return (
          p.alter !== activeAlter &&
          Number.isInteger(p.alter) &&
          p.alter >= -2 &&
          p.alter <= 2
        );
      });
      if (hasAccidental) {
        firstEventAccidentalPadding = 1.2;
      }
    }

    const eventCenterX = isWholeMeasureRest
      ? relX + eventWidth / 2 - 0.7
      : relX + 0.8 + firstEventAccidentalPadding;

    if (ev.kind === 'rest') {
      let restGlyph = 'restQuarter';
      let restY = 2.0;

      if (isWholeMeasureRest) {
        restGlyph = 'restWhole';
        restY = 1.0;
      } else {
        switch (ev.baseType) {
          case 'whole':
            restGlyph = 'restWhole';
            restY = 1.0;
            break;
          case 'half':
            restGlyph = 'restHalf';
            restY = 2.0;
            break;
          case 'quarter':
            restGlyph = 'restQuarter';
            restY = 2.0;
            break;
          case 'eighth':
            restGlyph = 'rest8th';
            restY = 2.0;
            break;
          case '16th':
            restGlyph = 'rest16th';
            restY = 2.0;
            break;
          case '32nd':
            restGlyph = 'rest32nd';
            restY = 2.0;
            break;
        }
      }

      measureItems.push({
        item: {
          id: ev.id,
          eventId: ev.id,
          kind: 'glyph',
          glyph: restGlyph,
          x: eventCenterX,
          y: restY,
        },
      });

      if (ev.dots > 0) {
        for (let d = 0; d < ev.dots; d++) {
          measureItems.push({
            item: {
              id: `${ev.id}-dot-${d}`,
              eventId: ev.id,
              kind: 'glyph',
              glyph: 'augmentationDot',
              x: eventCenterX + 1.2 + d * 0.5,
              y: restY,
            },
          });
        }
      }
    } else if (ev.kind === 'note') {
      const noteEv = ev as NoteEvent;
      const sortedPitches = [...noteEv.pitches].sort((a, b) => {
        return pitchToStaffPosition(a, clef) - pitchToStaffPosition(b, clef);
      });

      const stepPositions = sortedPitches.map((p) => pitchToStaffPosition(p, clef));
      const meanStepPos =
        stepPositions.reduce((sum, sp) => sum + sp, 0) / (stepPositions.length || 1);
      const beamStemDir = eventToBeamDir.get(ev.id);
      const stemDir = beamStemDir ?? getStemDirection(meanStepPos);
      const isBeamed = beamStemDir !== undefined;

      let noteheadGlyph = 'noteheadBlack';
      if (ev.baseType === 'whole') {
        noteheadGlyph = 'noteheadWhole';
      } else if (ev.baseType === 'half') {
        noteheadGlyph = 'noteheadHalf';
      }

      // Chords: check for seconds displacement
      const isDisplaced: boolean[] = new Array(sortedPitches.length).fill(false);
      for (let pIdx = 1; pIdx < sortedPitches.length; pIdx++) {
        if (stepPositions[pIdx] - stepPositions[pIdx - 1] === 1) {
          if (stemDir === 'up') {
            isDisplaced[pIdx] = true;
          } else {
            isDisplaced[pIdx - 1] = true;
          }
        }
      }

      // Accidentals
      for (let pIdx = 0; pIdx < sortedPitches.length; pIdx++) {
        const pitch = sortedPitches[pIdx];
        const accGlyph = tracker.processPitch(pitch);
        if (accGlyph) {
          const accY = staffPositionToY(stepPositions[pIdx]);
          measureItems.push({
            item: {
              id: `${ev.id}-acc-${pIdx}`,
              eventId: ev.id,
              kind: 'glyph',
              glyph: accGlyph,
              x: eventCenterX - 1.2,
              y: accY,
            },
          });
        }
      }

      // Noteheads & Ledger lines
      for (let pIdx = 0; pIdx < sortedPitches.length; pIdx++) {
        const stepPos = stepPositions[pIdx];
        const noteY = staffPositionToY(stepPos);
        let noteX = eventCenterX;

        if (isDisplaced[pIdx]) {
          noteX += stemDir === 'up' ? NOTEHEAD_WIDTH : -NOTEHEAD_WIDTH;
        }

        measureItems.push({
          item: {
            id: pIdx === 0 ? ev.id : `${ev.id}-pitch-${pIdx}`,
            eventId: ev.id,
            kind: 'glyph',
            glyph: noteheadGlyph,
            x: noteX,
            y: noteY,
          },
        });

        const ledgerYs = getLedgerLineYs(stepPos);
        for (const lY of ledgerYs) {
          measureItems.push({
            item: {
              id: `${ev.id}-ledger-${pIdx}-${lY}`,
              eventId: ev.id,
              kind: 'line',
              x: noteX - LEDGER_EXTENSION,
              y: lY,
              x2: noteX + NOTEHEAD_WIDTH + LEDGER_EXTENSION,
              y2: lY,
              thickness: LEDGER_THICKNESS,
            },
            ledgerNoteRelativeX: noteX,
          });
        }

        if (ev.dots > 0) {
          const dotY = stepPos % 2 === 0 ? noteY - 0.5 : noteY;
          const dotBaseX = noteX + NOTEHEAD_WIDTH + 0.3;
          for (let d = 0; d < ev.dots; d++) {
            measureItems.push({
              item: {
                id: `${ev.id}-dot-${pIdx}-${d}`,
                eventId: ev.id,
                kind: 'glyph',
                glyph: 'augmentationDot',
                x: dotBaseX + d * 0.4,
                y: dotY,
              },
            });
          }
        }
      }

      // Stems & Flags
      if (ev.baseType !== 'whole') {
        const lowestStep = stepPositions[0];
        const highestStep = stepPositions[stepPositions.length - 1];

        let stemX = eventCenterX;
        let stemStartY = 0;
        let stemEndY = 0;

        if (stemDir === 'up') {
          stemX = eventCenterX + NOTEHEAD_WIDTH;
          stemStartY = staffPositionToY(lowestStep) - 0.168;
          stemEndY = staffPositionToY(highestStep) - STEM_LENGTH;
        } else {
          stemX = eventCenterX;
          stemStartY = staffPositionToY(highestStep) + 0.168;
          stemEndY = staffPositionToY(lowestStep) + STEM_LENGTH;
        }

        measureItems.push({
          item: {
            id: `${ev.id}-stem`,
            eventId: ev.id,
            kind: 'line',
            x: stemX,
            y: stemStartY,
            x2: stemX,
            y2: stemEndY,
            thickness: STEM_THICKNESS,
          },
        });

        if (!isBeamed && (ev.baseType === 'eighth' || ev.baseType === '16th' || ev.baseType === '32nd')) {
          let flagGlyph = '';
          if (ev.baseType === 'eighth') {
            flagGlyph = stemDir === 'up' ? 'flag8thUp' : 'flag8thDown';
          } else if (ev.baseType === '16th') {
            flagGlyph = stemDir === 'up' ? 'flag16thUp' : 'flag16thDown';
          } else if (ev.baseType === '32nd') {
            flagGlyph = stemDir === 'up' ? 'flag32ndUp' : 'flag32ndDown';
          }

          if (flagGlyph) {
            measureItems.push({
              item: {
                id: `${ev.id}-flag`,
                eventId: ev.id,
                kind: 'glyph',
                glyph: flagGlyph,
                x: stemX,
                y: stemEndY,
              },
            });
          }
        }
      }

      const eventLyricX = eventCenterX + NOTEHEAD_WIDTH / 2;
      notePositions.push({
        evId: ev.id,
        noteheadRightX: eventCenterX + NOTEHEAD_WIDTH,
        lyricX: eventLyricX,
      });

      if (ev.kind === 'note' && (ev as NoteEvent).lyrics && (ev as NoteEvent).lyrics!.length > 0) {
        const verse1 = (ev as NoteEvent).lyrics!.find((l) => l.verse === 1);
        if (verse1 && verse1.text) {
          const rawText = verse1.text;
          const hasHyphen = rawText.endsWith('-');
          const hasExtender = rawText.endsWith('_') || rawText === '_';
          const displayText = rawText.replace(/[-_]+$/, '');
          lyricsToLayout.push({
            ev: ev as NoteEvent,
            eIdx,
            lyricX: eventLyricX,
            lyricY: 6.8,
            displayText,
            hasHyphen,
            hasExtender,
          });
        }
      }
    }

    relX += eventWidth + firstEventAccidentalPadding;
  }

  // Barline at end of measure
  const barlineX = relX + 0.6;

  // Render lyric text, centered hyphens, and melisma extender lines
  for (let lIdx = 0; lIdx < lyricsToLayout.length; lIdx++) {
    const lInfo = lyricsToLayout[lIdx];
    const { ev, eIdx, lyricX, lyricY, displayText, hasHyphen, hasExtender } = lInfo;

    if (displayText.length > 0) {
      measureItems.push({
        item: {
          id: `lyric-text-${ev.id}`,
          eventId: ev.id,
          kind: 'text',
          text: displayText,
          x: lyricX,
          y: lyricY,
          textAnchor: 'middle',
          fontSize: 1.15,
          fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
        },
      });
    }

    if (hasHyphen) {
      // Centered dash between this syllable and the next syllable of the word
      const nextLyric = lyricsToLayout[lIdx + 1];
      let nextX: number;
      if (nextLyric) {
        nextX = nextLyric.lyricX;
      } else {
        // Next syllable is in next measure; center hyphen between this note and barline
        nextX = barlineX;
      }
      const hyphenX = (lyricX + nextX) / 2;
      measureItems.push({
        item: {
          id: `lyric-hyphen-${ev.id}`,
          eventId: ev.id,
          kind: 'text',
          text: '-',
          x: hyphenX,
          y: lyricY,
          textAnchor: 'middle',
          fontSize: 1.15,
          fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
        },
      });
    }

    if (hasExtender) {
      // Extender line: from the end of the syllable to the end of the last melisma note
      let lastMelismaNoteId = ev.id;
      for (let candIdx = eIdx + 1; candIdx < events.length; candIdx++) {
        const cand = events[candIdx];
        if (cand.kind === 'note') {
          const candVerse1 = (cand as NoteEvent).lyrics?.find((l) => l.verse === 1);
          if (candVerse1 && candVerse1.text && candVerse1.text.replace(/[-_]+$/, '').length > 0) {
            // Next syllable starts here; stop melisma
            break;
          }
          lastMelismaNoteId = cand.id;
        }
      }

      const lastPos = notePositions.find((p) => p.evId === lastMelismaNoteId);
      const lastNoteEndX = lastPos ? lastPos.noteheadRightX : lyricX + 1.5;
      const extStartX = lyricX + Math.max(0.6, displayText.length * 0.28) + 0.2;
      const extEndX = Math.max(extStartX + 1.0, lastNoteEndX);

      measureItems.push({
        item: {
          id: `lyric-extender-${ev.id}`,
          eventId: ev.id,
          kind: 'line',
          x: extStartX,
          y: lyricY - 0.2,
          x2: extEndX,
          y2: lyricY - 0.2,
          thickness: 0.12,
        },
      });
    }
  }
  let barlineItemIndex = measureItems.length;

  if (mDef.repeatEnd) {
    measureItems.push({
      item: {
        id: `repeat-end-${mDef.id}`,
        kind: 'glyph',
        glyph: 'repeatRight',
        x: barlineX,
        y: 4.0,
      },
    });
    relX = barlineX + 1.8;
  } else if (barlineType === 'final') {
    measureItems.push({
      item: {
        id: `barline-${mDef.id}-thin`,
        kind: 'line',
        x: barlineX,
        y: 0,
        x2: barlineX,
        y2: 4,
        thickness: BARLINE_THICKNESS,
      },
    });
    measureItems.push({
      item: {
        id: `barline-${mDef.id}-thick`,
        kind: 'line',
        x: barlineX + 0.4,
        y: 0,
        x2: barlineX + 0.4,
        y2: 4,
        thickness: THICK_BARLINE_THICKNESS,
      },
    });
    relX = barlineX + 0.4 + THICK_BARLINE_THICKNESS;
  } else if (barlineType === 'double') {
    measureItems.push({
      item: {
        id: `barline-${mDef.id}-1`,
        kind: 'line',
        x: barlineX,
        y: 0,
        x2: barlineX,
        y2: 4,
        thickness: BARLINE_THICKNESS,
      },
    });
    measureItems.push({
      item: {
        id: `barline-${mDef.id}-2`,
        kind: 'line',
        x: barlineX + 0.35,
        y: 0,
        x2: barlineX + 0.35,
        y2: 4,
        thickness: BARLINE_THICKNESS,
      },
    });
    relX = barlineX + 0.35 + BARLINE_THICKNESS;
  } else {
    measureItems.push({
      item: {
        id: `barline-${mDef.id}`,
        kind: 'line',
        x: barlineX,
        y: 0,
        x2: barlineX,
        y2: 4,
        thickness: BARLINE_THICKNESS,
      },
    });
    relX = barlineX + BARLINE_THICKNESS;
  }

  const chunk: MeasureLayoutChunk = {
    measureDefId: mDef.id,
    items: measureItems,
    naturalWidth: relX,
    barlineItemIndex,
    beamGroups: beamGroupsMeta,
  };

  if (staffMeasure) {
    let map = measureChunkCache.get(staffMeasure);
    if (!map) {
      map = new Map();
      measureChunkCache.set(staffMeasure, map);
    }
    map.set(cacheKey, chunk);
  }

  return chunk;
}

/**
 * Computes the layout of a single staff in a score into wrapped systems.
 *
 * @param score - The score data to lay out.
 * @param options - Layout configuration (width, systemSpacing).
 * @returns Deterministic LayoutResult with coordinates in staff spaces.
 */
interface HeaderLayoutResult {
  items: LayoutItem[];
  height: number;
}

function computeHeaderLayout(
  meta: { title?: string; subtitle?: string; composer?: string; arranger?: string } | undefined,
  targetWidth: number
): HeaderLayoutResult {
  const title = meta?.title?.trim() || '';
  const subtitle = meta?.subtitle?.trim() || '';
  const composer = meta?.composer?.trim() || '';
  const arranger = meta?.arranger?.trim() || '';

  if (!title && !subtitle && !composer && !arranger) {
    return { items: [], height: 0 };
  }

  const TITLE_FONT_SIZE = 2.2;
  const SUBTITLE_FONT_SIZE = 1.3;
  const COMPOSER_FONT_SIZE = 1.2;
  const ARRANGER_FONT_SIZE = 1.0;
  const FONT_FAMILY = '"Times New Roman", Times, "Liberation Serif", serif';

  const items: LayoutItem[] = [];

  // Deterministic character width estimation from font size and length
  const estWidth = (text: string, sz: number) => text.length * sz * 0.52;

  // Title wrapping: wrap to 2 lines if wider than 90% of targetWidth
  let titleLines: string[] = [];
  if (title) {
    const fullW = estWidth(title, TITLE_FONT_SIZE);
    if (fullW > 0.9 * targetWidth && title.includes(' ')) {
      const words = title.split(' ');
      let bestL1 = '';
      let bestL2 = '';
      let minDiff = Infinity;
      for (let i = 1; i < words.length; i++) {
        const l1 = words.slice(0, i).join(' ');
        const l2 = words.slice(i).join(' ');
        const w1 = estWidth(l1, TITLE_FONT_SIZE);
        const w2 = estWidth(l2, TITLE_FONT_SIZE);
        if (w1 <= 0.9 * targetWidth && w2 <= 0.9 * targetWidth) {
          const diff = Math.abs(w1 - w2);
          if (diff < minDiff) {
            minDiff = diff;
            bestL1 = l1;
            bestL2 = l2;
          }
        }
      }
      if (bestL1 && bestL2) {
        titleLines = [bestL1, bestL2];
      } else {
        const mid = Math.ceil(words.length / 2);
        titleLines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
      }
    } else {
      titleLines = [title];
    }
  }

  // Check horizontal collision between centered title and right-aligned composer/arranger
  const maxTitleW =
    titleLines.length > 0 ? Math.max(...titleLines.map((l) => estWidth(l, TITLE_FONT_SIZE))) : 0;
  const titleRight = targetWidth / 2 + maxTitleW / 2;

  const composerW = composer ? estWidth(composer, COMPOSER_FONT_SIZE) : 0;
  const arrangerW = arranger ? estWidth(arranger, ARRANGER_FONT_SIZE) : 0;
  const rightSideMaxW = Math.max(composerW, arrangerW);
  const rightSideLeft = targetWidth - rightSideMaxW;

  const horizontalCollision = Boolean(title && rightSideMaxW > 0 && titleRight + 2.0 > rightSideLeft);

  let curY = 1.0; // Margin at top of header

  // Place title lines
  titleLines.forEach((line, idx) => {
    items.push({
      id: idx === 0 ? 'header-title' : `header-title-${idx + 1}`,
      kind: 'text',
      text: line,
      x: targetWidth / 2,
      y: curY + TITLE_FONT_SIZE,
      textAnchor: 'middle',
      fontSize: TITLE_FONT_SIZE,
      fontWeight: 'bold',
      fontFamily: FONT_FAMILY,
    });
    curY += TITLE_FONT_SIZE * 1.25;
  });

  if (titleLines.length > 0) {
    curY += 0.4;
  }

  // Place subtitle
  if (subtitle) {
    items.push({
      id: 'header-subtitle',
      kind: 'text',
      text: subtitle,
      x: targetWidth / 2,
      y: curY + SUBTITLE_FONT_SIZE,
      textAnchor: 'middle',
      fontSize: SUBTITLE_FONT_SIZE,
      fontStyle: 'italic',
      fontFamily: FONT_FAMILY,
    });
    curY += SUBTITLE_FONT_SIZE * 1.25 + 0.4;
  }

  // Place composer and arranger
  if (horizontalCollision) {
    // Stack below title and subtitle to prevent overlapping
    if (composer) {
      items.push({
        id: 'header-composer',
        kind: 'text',
        text: composer,
        x: targetWidth,
        y: curY + COMPOSER_FONT_SIZE,
        textAnchor: 'end',
        fontSize: COMPOSER_FONT_SIZE,
        fontFamily: FONT_FAMILY,
      });
      curY += COMPOSER_FONT_SIZE * 1.25;
    }
    if (arranger) {
      items.push({
        id: 'header-arranger',
        kind: 'text',
        text: arranger,
        x: targetWidth,
        y: curY + ARRANGER_FONT_SIZE,
        textAnchor: 'end',
        fontSize: ARRANGER_FONT_SIZE,
        fontStyle: 'italic',
        fontFamily: FONT_FAMILY,
      });
      curY += ARRANGER_FONT_SIZE * 1.25;
    }
  } else {
    // Place on right side aligned with top
    let sideY = 1.0 + (titleLines.length > 0 ? TITLE_FONT_SIZE : 0);
    if (composer) {
      items.push({
        id: 'header-composer',
        kind: 'text',
        text: composer,
        x: targetWidth,
        y: sideY + (title ? 0 : COMPOSER_FONT_SIZE),
        textAnchor: 'end',
        fontSize: COMPOSER_FONT_SIZE,
        fontFamily: FONT_FAMILY,
      });
      sideY += COMPOSER_FONT_SIZE * 1.25;
    }
    if (arranger) {
      items.push({
        id: 'header-arranger',
        kind: 'text',
        text: arranger,
        x: targetWidth,
        y: sideY,
        textAnchor: 'end',
        fontSize: ARRANGER_FONT_SIZE,
        fontStyle: 'italic',
        fontFamily: FONT_FAMILY,
      });
      sideY += ARRANGER_FONT_SIZE * 1.25;
    }
    curY = Math.max(curY, sideY);
  }

  return {
    items,
    height: curY,
  };
}

export function layoutScore(score: Score, options: LayoutOptions = {}): LayoutResult {
  const targetWidth = options.width ?? options.contentWidth ?? 70;
  const systemSpacing = options.systemSpacing ?? 10;
  const staffMarginTop = 7.0;
  const staffMarginBottom = 4.0;

  const part: Part | undefined = score.parts[0];
  const staff = part?.staves[0];
  const clef: Clef = staff?.clef ?? { sign: 'G', line: 2 };

  function createClefItems(startX: number, clefToUse: Clef): { items: LayoutItem[]; width: number } {
    const glyph = clefToUse.sign === 'F' ? 'fClef' : 'gClef';
    const y = clefToUse.sign === 'F' ? 1.0 : 3.0;
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

  // Measure each measure definition into a natural chunk
  const measureChunks: MeasureLayoutChunk[] = [];

  for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
    const mDef = score.measures[mIdx];
    const prevMDef = mIdx > 0 ? score.measures[mIdx - 1] : undefined;
    const isFirstMeasure = mIdx === 0;
    const isLastMeasure = mIdx === score.measures.length - 1;
    const staffMeasure = staff?.measures[mDef.id];
    measureChunks.push(
      layoutSingleMeasure(staffMeasure, mDef, clef, isFirstMeasure, isLastMeasure, prevMDef)
    );
  }

  // Pack measures into systems with width check
  interface SystemPlan {
    measures: MeasureLayoutChunk[];
    measureIndices: number[];
    headerWidth: number;
    headerItems: LayoutItem[];
  }

  const systemPlans: SystemPlan[] = [];
  let currentPlanMeasures: MeasureLayoutChunk[] = [];
  let currentPlanIndices: number[] = [];
  let currentUsedWidth = 0;

  function computeHeader(firstMIdx: number = 0): { headerWidth: number; headerItems: LayoutItem[] } {
    const items: LayoutItem[] = [];
    let startX = 0;

    items.push({
      id: `sys-start-barline`,
      kind: 'line',
      x: startX,
      y: 0,
      x2: startX,
      y2: 4,
      thickness: BARLINE_THICKNESS,
    });
    startX += 0.4;

    const clefLayout = createClefItems(startX, clef);
    items.push(...clefLayout.items);
    startX += clefLayout.width;

    const keySigToUse = score.measures[firstMIdx]?.keySig ?? 0;
    const keySigLayout = createKeySigItems(startX, keySigToUse, clef);
    items.push(...keySigLayout.items);
    startX += keySigLayout.width;

    return { headerWidth: startX, headerItems: items };
  }

  let currentHeader = computeHeader(0);
  currentUsedWidth = currentHeader.headerWidth;

  for (let mIdx = 0; mIdx < measureChunks.length; mIdx++) {
    const chunk = measureChunks[mIdx];
    const projectedWidth = currentUsedWidth + chunk.naturalWidth;

    if (projectedWidth > targetWidth) {
      if (currentPlanMeasures.length > 0) {
        // Measure does not fit in current system; close system and wrap to next
        systemPlans.push({
          measures: currentPlanMeasures,
          measureIndices: currentPlanIndices,
          headerWidth: currentHeader.headerWidth,
          headerItems: currentHeader.headerItems,
        });

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
        systemPlans.push({
          measures: [chunk],
          measureIndices: [mIdx],
          headerWidth: currentHeader.headerWidth,
          headerItems: currentHeader.headerItems,
        });

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
    systemPlans.push({
      measures: currentPlanMeasures,
      measureIndices: currentPlanIndices,
      headerWidth: currentHeader.headerWidth,
      headerItems: currentHeader.headerItems,
    });
  }

  // Construct LayoutSystem objects (justify non-last systems, do not stretch last system)
  const systems: LayoutSystem[] = [];

  const headerLayout = computeHeaderLayout(score.meta, targetWidth);
  const preliminarySys0Y = headerLayout.height > 0 ? headerLayout.height + staffMarginTop : staffMarginTop;
  const isPickup = Boolean(score.measures[0]?.actualTicks);

  for (let sIdx = 0; sIdx < systemPlans.length; sIdx++) {
    const plan = systemPlans[sIdx];
    const isLastSystem = sIdx === systemPlans.length - 1;
    const systemItems: LayoutItem[] = [];

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
          x: 0,
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

    // Non-last systems are justified so the last barline lands at targetWidth.
    // Last system is NOT stretched.
    // Overflowing single measures are NOT stretched.
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

      for (let iIdx = 0; iIdx < chunk.items.length; iIdx++) {
        const entry = chunk.items[iIdx];
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

        const isBarline = iIdx >= chunk.barlineItemIndex;

        let finalX: number;
        let finalX2: number | undefined = undefined;

        if (isLastMeasureInSystem && shouldJustify && isBarline) {
          // Align last barline exactly so right edge lands at targetWidth
          const barlineThickness = itemToPlace.thickness ?? BARLINE_THICKNESS;
          finalX = targetWidth - barlineThickness;
          finalX2 = finalX;
        } else if (entry.ledgerNoteRelativeX !== undefined) {
          // Keep ledger lines centered on stretched noteheads
          const stretchedNoteX = contentOffset + entry.ledgerNoteRelativeX * stretchRatio;
          finalX = stretchedNoteX - LEDGER_EXTENSION;
          finalX2 = stretchedNoteX + NOTEHEAD_WIDTH + LEDGER_EXTENSION;
        } else {
          finalX = contentOffset + itemToPlace.x * stretchRatio;
          if (itemToPlace.x2 !== undefined) {
            finalX2 = contentOffset + itemToPlace.x2 * stretchRatio;
          }
        }

        systemItems.push({
          ...itemToPlace,
          x: finalX,
          x2: finalX2,
        });
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

    // Determine staff line end X:
    // In justified non-last systems: staff line ends exactly at targetWidth.
    // In last system: staff line ends exactly at final barline right edge.
    let staffEndEndX: number;
    if (!isLastSystem && shouldJustify) {
      staffEndEndX = targetWidth;
    } else {
      staffEndEndX = contentOffset;
    }

    for (let line = 0; line <= 4; line++) {
      systemItems.unshift({
        id: `sys-${sIdx}-staffline-${line}`,
        kind: 'line',
        x: 0,
        y: line,
        x2: staffEndEndX,
        y2: line,
        thickness: STAFF_LINE_THICKNESS,
      });
    }

    const staffContainer: LayoutStaff = {
      id: `staff-${sIdx}`,
      y: staffMarginTop,
      items: systemItems,
    };

    systems.push({
      index: sIdx,
      x: 0,
      y: sIdx * (systemSpacing + 4) + preliminarySys0Y,
      width: Math.max(staffEndEndX, targetWidth),
      height: 6,
      staves: [staffContainer],
      items: [...systemItems],
    });
  }

  // Build lookup of event IDs to their kind and measure for layout override rules
  const eventKindMap = new Map<string, string>();
  const eventMeasureMap = new Map<string, string>();
  for (const part of score.parts) {
    for (const st of part.staves) {
      for (const mId of Object.keys(st.measures)) {
        for (const vc of st.measures[mId].voices) {
          for (const ev of vc.events) {
            eventKindMap.set(ev.id, ev.kind);
            eventMeasureMap.set(ev.id, mId);
          }
        }
      }
    }
  }

  const appliedOverrides: Record<string, { dx: number; dy: number }> = {};

  // Apply visual overrides (both element-level and event-level overrides apply)
  // Render-time clamping: clamps stored values inside measure and system without mutating score.overrides
  for (const sys of systems) {
    const measureBoundsList = getSystemMeasureBounds(sys);
    const measureBoundsMap = new Map<string, SystemMeasureBounds>();
    for (const mb of measureBoundsList) {
      measureBoundsMap.set(mb.measureId, mb);
    }

    const eventItemsMap = new Map<string, LayoutItem[]>();
    for (const item of sys.items) {
      if (item.eventId) {
        let list = eventItemsMap.get(item.eventId);
        if (!list) {
          list = [];
          eventItemsMap.set(item.eventId, list);
        }
        list.push(item);
      }
    }

    const processedItems = new Set<string>();

    for (const [eventId, items] of eventItemsMap.entries()) {
      const isRest = eventKindMap.get(eventId) === 'rest';
      const measureId = eventMeasureMap.get(eventId);
      const mBounds = measureId ? measureBoundsMap.get(measureId) : undefined;

      const evOverride = score.overrides[eventId];
      const rawDx = evOverride?.dx ?? 0;
      const rawDy = evOverride?.dy ?? 0;

      let effectiveDx = 0;
      let effectiveDy = 0;

      if (evOverride && (rawDx !== 0 || (isRest && rawDy !== 0))) {
        if (mBounds) {
          const clamped = clampOverrideOffset(items, mBounds, rawDx, rawDy, isRest, 0, 0);
          effectiveDx = clamped.dx;
          effectiveDy = clamped.dy;
        } else {
          effectiveDx = rawDx;
          effectiveDy = isRest ? rawDy : 0;
        }
      }

      if (effectiveDx !== 0 || effectiveDy !== 0) {
        appliedOverrides[eventId] = { dx: effectiveDx, dy: effectiveDy };
      }

      for (const item of items) {
        processedItems.add(item.id);
        const itemOverride = score.overrides[item.id];
        const itemExtraDx =
          itemOverride && item.id !== eventId
            ? itemOverride.dx ?? 0
            : 0;
        const itemExtraDy =
          itemOverride && item.id !== eventId && isRest
            ? itemOverride.dy ?? 0
            : 0;

        const totalDx = effectiveDx + itemExtraDx;
        const totalDy = effectiveDy + itemExtraDy;

        if (totalDx !== 0) {
          item.x += totalDx;
          if (item.x2 !== undefined) item.x2 += totalDx;
        }
        if (totalDy !== 0) {
          item.y += totalDy;
          if (item.y2 !== undefined) item.y2 += totalDy;
        }

        const scale = itemOverride?.scale ?? evOverride?.scale;
        if (scale !== undefined) {
          item.scale = scale;
        }

        const hidden = itemOverride?.hidden ?? evOverride?.hidden;
        if (hidden !== undefined) {
          item.hidden = hidden;
        }
      }
    }

    // Standalone items (lines, barlines, headers)
    for (const item of sys.items) {
      if (processedItems.has(item.id)) continue;
      const itemOverride = score.overrides[item.id];
      if (!itemOverride) continue;

      const rawDx = itemOverride.dx ?? 0;
      const rawDy = itemOverride.dy ?? 0;
      const clampedDx = rawDx;
      const clampedDy = rawDy;

      if (clampedDx !== 0) {
        item.x += clampedDx;
        if (item.x2 !== undefined) item.x2 += clampedDx;
      }
      if (clampedDy !== 0) {
        item.y += clampedDy;
        if (item.y2 !== undefined) item.y2 += clampedDy;
      }
      if (itemOverride.scale !== undefined) item.scale = itemOverride.scale;
      if (itemOverride.hidden !== undefined) item.hidden = itemOverride.hidden;
    }
  }

  // Compute system-layer beam polygons from final stretched & overridden stems
  for (let sIdx = 0; sIdx < systems.length; sIdx++) {
    const sys = systems[sIdx];
    const plan = systemPlans[sIdx];
    if (!plan) continue;

    const stemByEventId = new Map<string, LayoutItem>();
    const noteByEventId = new Map<string, LayoutItem>();
    for (const item of sys.items) {
      if (item.eventId && item.id === `${item.eventId}-stem`) {
        stemByEventId.set(item.eventId, item);
      } else if (item.eventId && item.id === item.eventId) {
        noteByEventId.set(item.eventId, item);
      }
    }

    for (const chunk of plan.measures) {
      for (const bg of chunk.beamGroups) {
        const stemInputs: BeamStemInput[] = [];
        const stemItemsToUpdate: Array<{ eventId: string; item: LayoutItem }> = [];

        for (const evMeta of bg.events) {
          const stemItem = stemByEventId.get(evMeta.eventId);
          if (!stemItem || stemItem.hidden) continue;

          const noteItem = noteByEventId.get(evMeta.eventId);
          const lowestStep = evMeta.stepPositions[0] ?? 0;
          const highestStep = evMeta.stepPositions[evMeta.stepPositions.length - 1] ?? 0;
          const beamSideStep = bg.stemDir === 'up' ? highestStep : lowestStep;
          const beamSideNoteY = staffPositionToY(beamSideStep);
          const naturalStemEndY =
            beamSideNoteY + (bg.stemDir === 'up' ? -STEM_LENGTH : STEM_LENGTH);

          stemInputs.push({
            eventId: evMeta.eventId,
            baseType: evMeta.baseType,
            stepPositions: evMeta.stepPositions,
            noteX: noteItem ? noteItem.x : stemItem.x,
            stemX: stemItem.x,
            stemStartY: stemItem.y,
            beamSideNoteY,
            naturalStemEndY,
            startTick: evMeta.startTick,
          });
          stemItemsToUpdate.push({ eventId: evMeta.eventId, item: stemItem });
        }

        if (stemInputs.length < 2) continue;

        const geom = computeBeamGroupGeometry(bg.beamGroupId, stemInputs, bg.stemDir);

        for (const { eventId, item } of stemItemsToUpdate) {
          if (geom.stemEndYs[eventId] !== undefined) {
            item.y2 = geom.stemEndYs[eventId];
          }
        }

        sys.items.push(...geom.beamItems);
        if (sys.staves[0] && sys.staves[0].items !== sys.items) {
          sys.staves[0].items.push(...geom.beamItems);
        }
      }
    }
  }

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

  const allItems = systems.flatMap((s) => s.items);

  // SVG height fits its content accurately
  const headerExtra = headerLayout.height > 0 && systems.length > 0 ? systems[0].y - staffMarginTop : 0;
  const totalHeight = systems.length * (systemSpacing + 4) + staffMarginTop + staffMarginBottom + headerExtra;

  const maxSysWidth = Math.max(targetWidth, ...systems.map((s) => s.width));

  return {
    width: maxSysWidth,
    height: totalHeight,
    systems,
    items: allItems,
    score,
    appliedOverrides,
  };
}
