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
  MeasureAlignment,
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

function alignmentKey(a: MeasureAlignment): string {
  const shifts = [...a.shifts]
    .sort((x, y) => x[0] - y[0])
    .map(([t, d]) => `${t}:${d.toFixed(4)}`)
    .join(',');
  return `${shifts}|${a.centeredShift.toFixed(4)}|${a.contentEndX.toFixed(4)}`;
}

/**
 * Checks whether a StaffMeasure is polyphonic.
 * Definition: at least 2 voices each contain at least one sounding NoteEvent.
 */
export function isStaffMeasurePolyphonic(staffMeasure: StaffMeasure | undefined): boolean {
  if (!staffMeasure || !staffMeasure.voices) return false;
  if (staffMeasure.voices.some((v) => v.voiceIndex > 1 && v.events.length > 0)) {
    return true;
  }
  let soundingCount = 0;
  for (let i = 0; i < staffMeasure.voices.length; i++) {
    const v = staffMeasure.voices[i];
    if (v.events.some((e) => e.kind === 'note')) {
      soundingCount++;
      if (soundingCount >= 2) return true;
    }
  }
  return false;
}

/**
 * Lays out events in a polyphonic StaffMeasure according to Rules RA-RH.
 */
function layoutPolyphonicEvents(
  staffMeasure: StaffMeasure,
  mDef: MeasureDef,
  clef: Clef,
  relXStart: number,
  tracker: MeasureAccidentalTracker,
  measureItems: MeasureItemEntry[],
  beamGroupsMeta: MeasureBeamGroupMeta[],
  columnsOut: Map<number, number>,
  alignment?: MeasureAlignment,
  idScope?: string
): number {
  let relX = relXStart;
  let alignShift = 0;
  const fullTicks = (mDef.timeSig.num * 4 * PPQ) / mDef.timeSig.den;
  const pickupOffset =
    mDef.actualTicks && mDef.actualTicks < fullTicks ? fullTicks - mDef.actualTicks : 0;

  // 1. Gather all events by voice with their start ticks and durations
  interface PolyEventEntry {
    voiceIndex: 1 | 2 | 3 | 4;
    event: ScoreEvent;
    startTick: number;
    duration: number;
  }
  const allEntries: PolyEventEntry[] = [];
  const voiceEntriesMap = new Map<number, PolyEventEntry[]>();

  for (const voice of staffMeasure.voices) {
    const vIndex = voice.voiceIndex;
    let runningTick = 0;
    const list: PolyEventEntry[] = [];
    for (const ev of voice.events) {
      const entry: PolyEventEntry = {
        voiceIndex: vIndex,
        event: ev,
        startTick: runningTick + pickupOffset,
        duration: ev.duration,
      };
      list.push(entry);
      allEntries.push(entry);
      runningTick += ev.duration;
    }
    voiceEntriesMap.set(vIndex, list);
  }

  // 2. Precompute beam groups per voice (RA: Beams follow voice stem direction, never cross voices)
  for (const voice of staffMeasure.voices) {
    const vIndex = voice.voiceIndex;
    const vEvents = voice.events;
    const rawGroups = groupBeams(vEvents, mDef.timeSig);
    const stemDir: StemDirection = vIndex === 1 || vIndex === 3 ? 'up' : 'down';
    const vList = voiceEntriesMap.get(vIndex) ?? [];

    for (let gIdx = 0; gIdx < rawGroups.length; gIdx++) {
      const g = rawGroups[gIdx];
      const beamGroupId = `beam-${mDef.id}${idScope ?? ''}-v${vIndex}-${gIdx}`;
      beamGroupsMeta.push({
        beamGroupId,
        stemDir,
        events: g.eventIds.map((id) => {
          const evObj = vEvents.find((e) => e.id === id)!;
          const entry = vList.find((e) => e.event.id === id);
          const stepPositions =
            evObj.kind === 'note'
              ? (evObj as NoteEvent).pitches
                  .map((p) => pitchToStaffPosition(p, clef))
                  .sort((a, b) => a - b)
              : [];
          return {
            eventId: id,
            baseType: evObj.baseType,
            stepPositions,
            startTick: entry?.startTick ?? 0,
          };
        }),
      });
    }
  }

  const beamedEventIds = new Set<string>();
  for (const bg of beamGroupsMeta) {
    for (const ev of bg.events) {
      beamedEventIds.add(ev.eventId);
    }
  }

  // 3. Union of start ticks (Rule RB)
  const uniqueStartTicks = Array.from(new Set(allEntries.map((e) => e.startTick))).sort(
    (a, b) => a - b
  );

  const measureEndTick = pickupOffset + (mDef.actualTicks ?? fullTicks);

  for (let colIdx = 0; colIdx < uniqueStartTicks.length; colIdx++) {
    const curTick = uniqueStartTicks[colIdx];
    const nextTick = uniqueStartTicks[colIdx + 1] ?? measureEndTick;
    const colDuration = nextTick - curTick;
    const durationFactor = colDuration / PPQ;
    const colWidth = Math.max(3.5 + durationFactor * 2.0, 3.5);

    const colEntries = allEntries.filter((e) => e.startTick === curTick);

    // Check accidentals in this column (Rule RH)
    let hasAccidental = false;
    for (const entry of colEntries) {
      if (entry.event.kind === 'note') {
        const ne = entry.event as NoteEvent;
        for (const p of ne.pitches) {
          const activeAlter = getKeySignatureAlter(p.step, mDef.keySig);
          if (
            p.alter !== activeAlter &&
            Number.isInteger(p.alter) &&
            p.alter >= -2 &&
            p.alter <= 2
          ) {
            hasAccidental = true;
          }
        }
      }
    }

    const firstEventPadding = colIdx === 0 && hasAccidental ? 1.2 : hasAccidental ? 0.8 : 0;
    // Cross-staff alignment: push this column right so it lands on the unified column x.
    const tickKey = curTick - pickupOffset;
    if (alignment) {
      const want = alignment.shifts.get(tickKey);
      if (want !== undefined && want > alignShift) {
        relX += want - alignShift;
        alignShift = want;
      }
    }
    const colCenterX = relX + 0.8 + firstEventPadding;
    columnsOut.set(tickKey, colCenterX);

    // Check for rests at this tick (Rule RE)
    const restEntries = colEntries.filter((e) => e.event.kind === 'rest');
    const noteEntries = colEntries.filter((e) => e.event.kind === 'note');

    // Rule RE: Identical rests in v1 and v2 at same tick merge visually at staff center
    const v1Rest = restEntries.find((e) => e.voiceIndex === 1);
    const v2Rest = restEntries.find((e) => e.voiceIndex === 2);
    let restsMerged = false;

    if (
      v1Rest &&
      v2Rest &&
      v1Rest.event.baseType === v2Rest.event.baseType &&
      v1Rest.event.duration === v2Rest.event.duration &&
      v1Rest.event.dots === v2Rest.event.dots
    ) {
      const ev = v1Rest.event as RestEvent;
      let restGlyph = 'restQuarter';
      let restY = 2.0;
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

      measureItems.push({
        item: {
          id: ev.id,
          eventId: ev.id,
          kind: 'glyph',
          glyph: restGlyph,
          x: colCenterX,
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
              x: colCenterX + 1.2 + d * 0.5,
              y: restY,
            },
          });
        }
      }
      restsMerged = true;
    }

    // Individual rests (either not merged, or in v3/v4)
    for (const re of restEntries) {
      if (restsMerged && (re.voiceIndex === 1 || re.voiceIndex === 2)) {
        continue;
      }
      const ev = re.event as RestEvent;
      let restGlyph = 'restQuarter';
      switch (ev.baseType) {
        case 'whole':
          restGlyph = 'restWhole';
          break;
        case 'half':
          restGlyph = 'restHalf';
          break;
        case 'quarter':
          restGlyph = 'restQuarter';
          break;
        case 'eighth':
          restGlyph = 'rest8th';
          break;
        case '16th':
          restGlyph = 'rest16th';
          break;
        case '32nd':
          restGlyph = 'rest32nd';
          break;
      }

      // Rule RE elevation: v1 moves UP, v2 moves DOWN
      let restY = 2.0;
      if (re.voiceIndex === 1 || re.voiceIndex === 3) {
        restY = 0.0; // elevated
      } else {
        restY = 4.0; // depressed
      }

      measureItems.push({
        item: {
          id: ev.id,
          eventId: ev.id,
          kind: 'glyph',
          glyph: restGlyph,
          x: colCenterX,
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
              x: colCenterX + 1.2 + d * 0.5,
              y: restY,
            },
          });
        }
      }
    }

    // Process Notes in this column (RA, RC, RD, RG, RH)
    const v1Note = noteEntries.find((e) => e.voiceIndex === 1);
    const v2Note = noteEntries.find((e) => e.voiceIndex === 2);

    let isUnison = false;
    let isSameDurationUnison = false;
    let isSecond = false;

    if (v1Note && v2Note) {
      const ne1 = v1Note.event as NoteEvent;
      const ne2 = v2Note.event as NoteEvent;
      const p1Lowest = [...ne1.pitches].sort(
        (a, b) => pitchToStaffPosition(a, clef) - pitchToStaffPosition(b, clef)
      )[0];
      const p2Highest = [...ne2.pitches].sort(
        (a, b) => pitchToStaffPosition(b, clef) - pitchToStaffPosition(a, clef)
      )[0];

      const step1 = pitchToStaffPosition(p1Lowest, clef);
      const step2 = pitchToStaffPosition(p2Highest, clef);

      if (step1 === step2) {
        isUnison = true;
        isSameDurationUnison =
          ne1.baseType === ne2.baseType && ne1.duration === ne2.duration && ne1.dots === ne2.dots;
      } else if (step1 - step2 === 1) {
        isSecond = true;
      }
    }

    // Render notes in this column
    for (const entry of noteEntries) {
      const vIndex = entry.voiceIndex;
      const ev = entry.event as NoteEvent;
      const isBeamed = beamedEventIds.has(ev.id);
      const stemDir: StemDirection = vIndex === 1 || vIndex === 3 ? 'up' : 'down';

      // Base X positioning according to voice & interval rules
      let noteX = colCenterX;
      let voiceStemX = colCenterX;

      if (vIndex === 1) {
        if (isSecond) {
          // RC: Second interval: shared stem line, v1 head to LEFT
          const sharedStemLineX = colCenterX + 0.5 * NOTEHEAD_WIDTH;
          noteX = sharedStemLineX - NOTEHEAD_WIDTH;
          voiceStemX = sharedStemLineX;
        } else {
          noteX = colCenterX;
          voiceStemX = colCenterX + NOTEHEAD_WIDTH;
        }
      } else if (vIndex === 2) {
        if (isSecond) {
          // RC: Second interval: shared stem line, v2 head to RIGHT
          const sharedStemLineX = colCenterX + 0.5 * NOTEHEAD_WIDTH;
          noteX = sharedStemLineX;
          voiceStemX = sharedStemLineX;
        } else if (isUnison && !isSameDurationUnison) {
          // Rule RD (PROPOSED): Unison with different durations: v2 displaced to RIGHT
          noteX = colCenterX + NOTEHEAD_WIDTH;
          voiceStemX = noteX;
        } else {
          noteX = colCenterX;
          voiceStemX = colCenterX;
        }
      } else if (vIndex === 3) {
        // RA: Voice 3 offset +1.25 sp
        noteX = colCenterX + 1.25;
        voiceStemX = noteX + NOTEHEAD_WIDTH;
      } else if (vIndex === 4) {
        // RA: Voice 4 offset -1.25 sp
        noteX = colCenterX - 1.25;
        voiceStemX = noteX;
      }

      const sortedPitches = [...ev.pitches].sort((a, b) => {
        return pitchToStaffPosition(a, clef) - pitchToStaffPosition(b, clef);
      });
      const stepPositions = sortedPitches.map((p) => pitchToStaffPosition(p, clef));

      let noteheadGlyph = 'noteheadBlack';
      if (ev.baseType === 'whole') noteheadGlyph = 'noteheadWhole';
      else if (ev.baseType === 'half') noteheadGlyph = 'noteheadHalf';

      // Accidentals (Rule RH - PROPOSED)
      for (let pIdx = 0; pIdx < sortedPitches.length; pIdx++) {
        const pitch = sortedPitches[pIdx];
        const accGlyph = tracker.processPitch(pitch);
        if (accGlyph) {
          const accY = staffPositionToY(stepPositions[pIdx]);
          const accX = Math.min(noteX, colCenterX) - 1.2;
          measureItems.push({
            item: {
              id: `${ev.id}-acc-${pIdx}`,
              eventId: ev.id,
              kind: 'glyph',
              glyph: accGlyph,
              x: accX,
              y: accY,
            },
          });
        }
      }

      // If this is Voice 2 in a same-duration unison, skip drawing duplicate notehead
      const skipNotehead = vIndex === 2 && isSameDurationUnison;

      if (!skipNotehead) {
        for (let pIdx = 0; pIdx < sortedPitches.length; pIdx++) {
          const stepPos = stepPositions[pIdx];
          const noteY = staffPositionToY(stepPos);

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

          // Ledger lines
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

          // RG: Augmentation dots
          if (ev.dots > 0) {
            let dotY = noteY;
            if (stepPos % 2 === 0) {
              if (vIndex === 1 || vIndex === 3) {
                dotY = noteY - 0.5; // space above
              } else {
                dotY = noteY + 0.5; // space below (OBSERVED m.1 beat 3 soprano, m.4 beat 1 alto)
              }
            }
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
      }

      // Stems & Flags
      if (ev.baseType !== 'whole') {
        const lowestStep = stepPositions[0];
        const highestStep = stepPositions[stepPositions.length - 1];

        let stemStartY = 0;
        let stemEndY = 0;

        if (stemDir === 'up') {
          stemStartY = staffPositionToY(lowestStep) - 0.168;
          stemEndY = staffPositionToY(highestStep) - STEM_LENGTH;
        } else {
          stemStartY = staffPositionToY(highestStep) + 0.168;
          stemEndY = staffPositionToY(lowestStep) + STEM_LENGTH;
        }

        measureItems.push({
          item: {
            id: `${ev.id}-stem`,
            eventId: ev.id,
            kind: 'line',
            x: voiceStemX,
            y: stemStartY,
            x2: voiceStemX,
            y2: stemEndY,
            thickness: STEM_THICKNESS,
          },
        });

        if (
          !isBeamed &&
          (ev.baseType === 'eighth' || ev.baseType === '16th' || ev.baseType === '32nd')
        ) {
          let flagGlyph = '';
          if (ev.baseType === 'eighth') flagGlyph = stemDir === 'up' ? 'flag8thUp' : 'flag8thDown';
          else if (ev.baseType === '16th')
            flagGlyph = stemDir === 'up' ? 'flag16thUp' : 'flag16thDown';
          else if (ev.baseType === '32nd')
            flagGlyph = stemDir === 'up' ? 'flag32ndUp' : 'flag32ndDown';

          if (flagGlyph) {
            measureItems.push({
              item: {
                id: `${ev.id}-flag`,
                eventId: ev.id,
                kind: 'glyph',
                glyph: flagGlyph,
                x: voiceStemX,
                y: stemEndY,
              },
            });
          }
        }
      }
    }

    relX += colWidth + firstEventPadding;
  }

  return relX;
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
  prevMDef?: MeasureDef,
  alignment?: MeasureAlignment,
  idScope?: string
): MeasureLayoutChunk {
  measureLayoutCacheStats.calls++;

  let eventsHash = 0;
  const voices = staffMeasure?.voices ?? [];
  for (let vIdx = 0; vIdx < voices.length; vIdx++) {
    const v = voices[vIdx];
    eventsHash = (eventsHash * 31 + v.voiceIndex) | 0;
    const voiceEvents = v.events;
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
  const cacheKey = `${mDef.id}_${mDef.keySig}_${mDef.timeSig.num}/${mDef.timeSig.den}_${clef.sign}${clef.line}_${isFirstMeasure}_${isLastMeasure}_${prevKey}_${mDef.actualTicks ?? 'full'}_${barlineType}_${mDef.repeatStart ? 'rs' : ''}_${mDef.repeatEnd ? 're' : ''}_${mDef.volta?.number ?? 'none'}_${eventsHash}${alignment ? `_al${alignmentKey(alignment)}` : ''}${idScope ? `_sc${idScope}` : ''}`;

  if (staffMeasure) {
    const existing = measureChunkCache.get(staffMeasure);
    if (existing && existing.has(cacheKey)) {
      measureLayoutCacheStats.hits++;
      return existing.get(cacheKey)!;
    }
  }

  measureLayoutCacheStats.misses++;

  const events: ScoreEvent[] = staffMeasure?.voices.find((v) => v.voiceIndex === 1)?.events ?? [];
  const columns = new Map<number, number>();
  let alignShift = 0;
  let tickAcc = 0;
  const tracker = new MeasureAccidentalTracker(mDef.keySig);
  const measureItems: MeasureItemEntry[] = [];
  let relX = 0;

  const eventToBeamDir = new Map<string, StemDirection>();
  const beamGroupsMeta: MeasureBeamGroupMeta[] = [];

  const isPoly = isStaffMeasurePolyphonic(staffMeasure);
  if (!isPoly) {
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

    for (let gIdx = 0; gIdx < beamGroupsRaw.length; gIdx++) {
      const g = beamGroupsRaw[gIdx];
      const groupSteps = g.eventIds.map((id) => noteStepsMap.get(id) ?? []);
      const groupStemDir = getBeamGroupStemDirection(groupSteps);
      const beamGroupId = `beam-${mDef.id}${idScope ?? ''}-${gIdx}`;
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

  if (isStaffMeasurePolyphonic(staffMeasure)) {
    relX = layoutPolyphonicEvents(
      staffMeasure!,
      mDef,
      clef,
      relX,
      tracker,
      measureItems,
      beamGroupsMeta,
      columns,
      alignment,
      idScope
    );
  } else {
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

    // Cross-staff alignment (M7b-1b): shift this column onto the unified x, or centre a lone rest.
    if (alignment) {
      if (isWholeMeasureRest) {
        relX += alignment.centeredShift;
      } else {
        const want = alignment.shifts.get(tickAcc);
        if (want !== undefined && want > alignShift) {
          relX += want - alignShift;
          alignShift = want;
        }
      }
    }

    const eventCenterX = isWholeMeasureRest
      ? relX + eventWidth / 2 - 0.7
      : relX + 0.8 + firstEventAccidentalPadding;
    if (!isWholeMeasureRest) columns.set(tickAcc, eventCenterX);

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
      tickAcc += ev.duration;
    }

    // Render lyric text, centered hyphens, and melisma extender lines
    layoutMeasureLyrics(lyricsToLayout, events, notePositions, relX + 0.6, measureItems);
  }

  // Cross-staff alignment: every staff of the measure ends its content at the same x.
  if (alignment && alignment.contentEndX > relX) relX = alignment.contentEndX;
  const contentEndX = relX;

  // Barline at end of measure
  const barlineX = relX + 0.6;

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
    columns,
    centered:
      !isPoly &&
      events.length === 1 &&
      events[0].kind === 'rest' &&
      Boolean((events[0] as RestEvent).wholeMeasure),
    contentEndX,
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
