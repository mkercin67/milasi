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
import { xToEntryCursor } from '../../layout/pointerCursor';
import { computeCursorPosition } from '../../layout/cursor';
import { GhostNoteData } from './types';
import { firstStaff } from '../../core/staffLookup';

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

    let targetSys = layout.systems[0] ?? null;
    let minDist = Infinity;
    for (const sys of layout.systems) {
      const dist = Math.abs(relY - (sys.y + 2));
      if (dist < minDist) {
        minDist = dist;
        targetSys = sys;
      }
    }
    if (!targetSys) return null;
    return {
      relX,
      relY,
      targetSys,
      sysRelX: relX - targetSys.x,
      sysRelY: relY - targetSys.y,
    };
  };

  const isInsideStaffArea = (
    coords: { relX: number; targetSys: { x: number; width: number }; sysRelY: number }
  ) => {
    return (
      coords.relX >= coords.targetSys.x &&
      coords.relX <= coords.targetSys.x + coords.targetSys.width &&
      coords.sysRelY >= -2.5 &&
      coords.sysRelY <= 6.5
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

    const { targetSys, sysRelX: systemRelX, sysRelY: systemRelY } = coords;
    const clef = firstStaff(score)?.clef ?? { sign: 'G', line: 2 };
    const activeVoiceIndex = cursor?.voiceIndex ?? 1;
    const targetCursor = xToEntryCursor(layout, score, targetSys.index, systemRelX, activeVoiceIndex);
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
      sysY: targetSys.y,
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

    const { targetSys, sysRelX, sysRelY } = coords;
    const clef = firstStaff(score)?.clef ?? { sign: 'G', line: 2 };
    const clickedCursor = xToEntryCursor(layout, score, targetSys.index, sysRelX, cursor?.voiceIndex ?? 1);
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
