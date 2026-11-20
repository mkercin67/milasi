// SPDX-License-Identifier: GPL-3.0-or-later
import { useRef, useState } from 'react';
import { BaseDurationType, Pitch, Score } from '../../core/model';
import { LayoutResult } from '../../layout/types';
import { ScoreCursor } from '../../core/input';
import {
  getLedgerLineYs,
  pitchToStaffPosition,
  staffPositionToY,
  yToStaffPosition,
} from '../../layout/pitch';
import { resolvePointerStaff, xToEntryCursor } from '../../layout/pointerCursor';
import { computeCursorPosition } from '../../layout/cursor';
import { GhostNoteData } from './types';
import { durationTicks } from '../../core/time';
import { findStaff, firstStaff } from '../../core/staffLookup';

export function useGhostNote(
  score: Score,
  layout: LayoutResult,
  staffSpacePx: number,
  activeDuration: BaseDurationType,
  // Bug-fix: renamed from _cursor to cursor so the active voice is accessible.
  cursor: ScoreCursor | null,
  cursorPos: { x: number; y1: number; y2: number; systemIndex: number } | null,
  containerRectRef: React.MutableRefObject<{ left: number; top: number; width: number; height: number }>,
  onEnterPitchDirect?: (pitch: Pitch, customCursor?: ScoreCursor) => void,
  onHoverPitch?: (pitch: Pitch | null) => void,
  onHoverInfo?: (info: { pitch: Pitch; measureNumber: number } | null) => void
) {
  const [ghostNote, setGhostNote] = useState<GhostNoteData | null>(null);
  const lastHoverPitchRef = useRef<Pitch | null>(null);

  const getPointerSystemCoords = (clientX: number, clientY: number) => {
    const relX = (clientX - containerRectRef.current.left) / staffSpacePx;
    const relY = (clientY - containerRectRef.current.top) / staffSpacePx;

    // System first, then the nearest staff by y inside it (grand staff, M7b-3b).
    const hit = resolvePointerStaff(layout, relY);
    if (!hit) return null;
    const targetSys = hit.system;
    return {
      relX,
      relY,
      targetSys,
      staffId: hit.staffId,
      sysRelX: relX - targetSys.x,
      /** Relative to the top line of the first staff of the system (hit testing, system items). */
      sysRelY: relY - targetSys.y,
      /** Relative to the top line of the staff under the pointer (pitch, staff-area test). */
      staffRelY: relY - targetSys.y - hit.staffOffset,
      staffOffset: hit.staffOffset,
    };
  };

  const isInsideStaffArea = (
    coords: { relX: number; targetSys: { x: number; width: number }; staffRelY: number }
  ) => {
    return (
      coords.relX >= coords.targetSys.x &&
      coords.relX <= coords.targetSys.x + coords.targetSys.width &&
      coords.staffRelY >= -2.5 &&
      coords.staffRelY <= 6.5
    );
  };

  const clearGhostNote = () => {
    setGhostNote(null);
    lastHoverPitchRef.current = null;
    onHoverPitch?.(null);
    onHoverInfo?.(null);
  };

  const updateGhostNote = (clientX: number, clientY: number) => {
    const coords = getPointerSystemCoords(clientX, clientY);
    if (!coords || !isInsideStaffArea(coords)) {
      clearGhostNote();
      return;
    }

    const { targetSys, sysRelX: systemRelX, staffRelY: systemRelY, staffId, staffOffset } = coords;
    const clef = (findStaff(score, staffId) ?? firstStaff(score))?.clef ?? { sign: 'G', line: 2 };
    const activeVoiceIndex = cursor?.voiceIndex ?? 1;
    const targetCursor = xToEntryCursor(
      layout,
      score,
      targetSys.index,
      systemRelX,
      activeVoiceIndex,
      staffId,
      durationTicks(activeDuration)
    );
    const mDef = score.measures.find((m) => m.id === targetCursor?.measureId) ?? score.measures[0];
    const keySig = mDef?.keySig ?? 0;

    const hoveredPitch = yToStaffPosition(clef, systemRelY, keySig);
    const hoveredMeasureIdx = score.measures.findIndex((m) => m.id === targetCursor?.measureId);
    const hoveredMeasureNumber = hoveredMeasureIdx >= 0 ? hoveredMeasureIdx + 1 : 1;

    if (
      !lastHoverPitchRef.current ||
      lastHoverPitchRef.current.step !== hoveredPitch.step ||
      lastHoverPitchRef.current.octave !== hoveredPitch.octave ||
      lastHoverPitchRef.current.alter !== hoveredPitch.alter
    ) {
      lastHoverPitchRef.current = hoveredPitch;
      onHoverPitch?.(hoveredPitch);
      onHoverInfo?.({ pitch: hoveredPitch, measureNumber: hoveredMeasureNumber });
    }

    const stepPos = pitchToStaffPosition(hoveredPitch, clef);
    const snappedY = staffPositionToY(stepPos);
    const ledgerYs = getLedgerLineYs(stepPos);

    const glyph =
      activeDuration === 'whole'
        ? 'noteheadWhole'
        : activeDuration === 'half'
        ? 'noteheadHalf'
        : 'noteheadBlack';

    // The ghost sits on the beat column under the pointer (columns are shared by all voices).
    // Measures with rests only have no column: fall back to the computed cursor position.
    let ghostX = cursorPos && cursorPos.systemIndex === targetSys.index ? cursorPos.x : systemRelX;
    if (targetCursor?.columnX != null) {
      ghostX = targetCursor.columnX - 0.2;
    } else if (targetCursor) {
      const computed = computeCursorPosition(layout, score, {
        staffId: targetCursor.staffId,
        voiceIndex: targetCursor.voiceIndex,
        measureId: targetCursor.measureId,
        tick: targetCursor.tick,
      });
      if (computed && computed.systemIndex === targetSys.index) ghostX = computed.x;
    }

    setGhostNote({
      pitch: hoveredPitch,
      sysIndex: targetSys.index,
      sysY: targetSys.y + staffOffset,
      x: ghostX,
      y: snappedY,
      glyph,
      ledgerYs,
    });
  };

  const enterPitchAtPointer = (clientX: number, clientY: number) => {
    if (!onEnterPitchDirect) return;
    const coords = getPointerSystemCoords(clientX, clientY);
    if (!coords || !isInsideStaffArea(coords)) return;

    const { targetSys, sysRelX, staffRelY: sysRelY, staffId } = coords;
    const clef = (findStaff(score, staffId) ?? firstStaff(score))?.clef ?? { sign: 'G', line: 2 };
    const clickedCursor = xToEntryCursor(
      layout,
      score,
      targetSys.index,
      sysRelX,
      cursor?.voiceIndex ?? 1,
      staffId,
      durationTicks(activeDuration)
    );
    const mDef = score.measures.find((m) => m.id === clickedCursor?.measureId) ?? score.measures[0];
    const keySig = mDef?.keySig ?? 0;
    const clickedPitch = yToStaffPosition(clef, sysRelY, keySig);

    // The active voice (Tab / toolbar) receives the note; a missing voice is created by entry.
    if (clickedCursor) {
      onEnterPitchDirect(clickedPitch, {
        staffId: clickedCursor.staffId,
        voiceIndex: clickedCursor.voiceIndex,
        measureId: clickedCursor.measureId,
        tick: clickedCursor.tick,
      });
    }
  };

  return {
    ghostNote,
    getPointerSystemCoords,
    clearGhostNote,
    updateGhostNote,
    enterPitchAtPointer,
  };
}
