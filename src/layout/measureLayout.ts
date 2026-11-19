// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Measure layout engine for single-measure layout, caching, and glyph positioning.
 */

import {
  Clef,
  MeasureDef,
  NoteEvent,
  RestEvent,
  ScoreEvent,
  StaffMeasure,
} from '../core/model';
import { PPQ } from '../core/time';
import { MeasureAccidentalTracker } from './accidentals';
import { getBeamGroupStemDirection } from './beamLayout';
import { groupBeams } from './beams';
import {
  getKeySignatureAlter,
  getKeySignatureChangeAccidentals,
} from './keySignature';
import {
  BARLINE_THICKNESS,
  createTimeSigItems,
  LEDGER_EXTENSION,
  LEDGER_THICKNESS,
  MeasureBeamGroupMeta,
  MeasureItemEntry,
  MeasureLayoutChunk,
  NOTEHEAD_WIDTH,
  STEM_LENGTH,
  STEM_THICKNESS,
  THICK_BARLINE_THICKNESS,
} from './layoutPrimitives';
import { getLedgerLineYs, getStemDirection, pitchToStaffPosition, staffPositionToY } from './pitch';
import { StemDirection } from './types';

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

import { layoutMeasureLyrics, LyricLayoutEntry } from './lyricLayout';

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

  let eventsHash = 0;
  const voiceEvents = staffMeasure?.voices.find((v) => v.voiceIndex === 1)?.events;
  if (voiceEvents) {
    for (let i = 0; i < voiceEvents.length; i++) {
      const ev = voiceEvents[i];
      eventsHash = (eventsHash * 31 + ev.duration + (ev.kind === 'note' && ev.tiedToNext ? 1 : 0)) | 0;
      if (ev.kind === 'note') {
        for (let j = 0; j < ev.pitches.length; j++) {
          const p = ev.pitches[j];
          eventsHash =
            (eventsHash * 31 +
              p.step.charCodeAt(0) * 10 +
              p.octave +
              ((p.alter ?? 0) + 2) * 100) |
            0;
        }
      } else {
        eventsHash = (eventsHash * 31 + 7) | 0;
      }
    }
  }

  const prevKey = prevMDef
    ? `${prevMDef.keySig}_${prevMDef.timeSig.num}/${prevMDef.timeSig.den}`
    : 'none';
  const barlineType = mDef.endBarline ?? (isLastMeasure ? 'final' : 'single');
  const cacheKey = `${mDef.id}_${mDef.keySig}_${mDef.timeSig.num}/${mDef.timeSig.den}_${clef.sign}${clef.line}_${isFirstMeasure}_${isLastMeasure}_${prevKey}_${mDef.actualTicks ?? 'full'}_${barlineType}_${mDef.repeatStart ? 'rs' : ''}_${mDef.repeatEnd ? 're' : ''}_${mDef.volta?.number ?? 'none'}_${eventsHash}`;

  if (staffMeasure) {
    const existing = measureChunkCache.get(staffMeasure);
    if (existing && existing.has(cacheKey)) {
      measureLayoutCacheStats.hits++;
      return existing.get(cacheKey)!;
    }
  }

  measureLayoutCacheStats.misses++;

  const events: ScoreEvent[] = staffMeasure?.voices.find((v) => v.voiceIndex === 1)?.events ?? [];
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
          case 'whole': restGlyph = 'restWhole'; restY = 1.0; break;
          case 'half': restGlyph = 'restHalf'; restY = 2.0; break;
          case 'quarter': restGlyph = 'restQuarter'; restY = 2.0; break;
          case 'eighth': restGlyph = 'rest8th'; restY = 2.0; break;
          case '16th': restGlyph = 'rest16th'; restY = 2.0; break;
          case '32nd': restGlyph = 'rest32nd'; restY = 2.0; break;
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
          if (ev.baseType === 'eighth') flagGlyph = stemDir === 'up' ? 'flag8thUp' : 'flag8thDown';
          else if (ev.baseType === '16th') flagGlyph = stemDir === 'up' ? 'flag16thUp' : 'flag16thDown';
          else if (ev.baseType === '32nd') flagGlyph = stemDir === 'up' ? 'flag32ndUp' : 'flag32ndDown';

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
  layoutMeasureLyrics(lyricsToLayout, events, notePositions, barlineX, measureItems);

  const barlineItemIndex = measureItems.length;

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
    cacheKey,
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
