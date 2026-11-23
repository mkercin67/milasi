// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BaseDurationType, Clef, NoteEvent, Pitch, Score } from '../../core/model';
import { LayoutResult } from '../../layout/types';
import { RangeSelection } from '../../core/selection';
import { EditorMode, isCancelDragEvent } from '../keymap';
import { ScoreCursor } from '../../core/input';
import {
  pitchToStaffPosition,
  staffPositionToY,
  yToStaffPosition,
} from '../../layout/pitch';
import {
  clampOverrideOffset,
  getSystemMeasureBounds,
  hitTestEvent,
  isDragPastThreshold,
  snapDragOffset,
  xToCursor,
} from '../../layout/mouse';
import { formatPitchName } from '../i18n';
import { findEventLocation } from './types';
import { renderManualDragFeedback, renderPitchDragFeedback } from './scoreDragFeedback';
import { useScoreMarquee } from './useScoreMarquee';
import { useGhostNote } from './useGhostNote';
import { firstStaff } from '../../core/staffLookup';
import { clefOfEvent as coreClefOfEvent } from '../../core/clef';

/** Clef of the staff that holds the event (pitch maths of a drag must use it, not staff 0's). */
function clefOfEvent(score: Score, eventId: string): Clef {
  return coreClefOfEvent(score, eventId) ?? firstStaff(score)?.clef ?? { sign: 'G', line: 2 };
}

export interface UseScoreInteractionsParams {
  score: Score;
  layout: LayoutResult;
  staffSpacePx: number;
  zoom: number;
  mode: EditorMode;
  activeDuration: BaseDurationType;
  cursor: ScoreCursor | null;
  cursorPos: { x: number; y1: number; y2: number; systemIndex: number } | null;
  noteNameStyle: 'solfege' | 'letter';
  language: 'tr' | 'en';
  t: (key: string) => string;
  containerRectRef: React.MutableRefObject<{ left: number; top: number; width: number; height: number }>;
  updateContainerRect: () => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  dragOverlayRef: React.RefObject<SVGGElement | null>;
  onSelectEvent: (eventId: string | null) => void;
  onSelectRange?: (range: RangeSelection | null) => void;
  onExtendSelectionTo?: (targetEventId: string) => void;
  onSelectMeasure?: (measureId: string, tick?: number, staffId?: string) => void;
  onEnterPitchDirect?: (pitch: Pitch, customCursor?: ScoreCursor) => void;
  onApplyOverride?: (eventId: string, dx: number, dy: number, accumulate?: boolean) => void;
  onChangePitch?: (eventId: string, pitches: Pitch[]) => void;
  onHoverPitch?: (pitch: Pitch | null) => void;
  onHoverInfo?: (info: { pitch: Pitch; measureNumber: number } | null) => void;
  onDragStatus?: (status: string | null) => void;
  onPreviewPitches?: (pitches: Pitch[]) => void;
}

export function useScoreInteractions({
  score,
  layout,
  staffSpacePx,
  mode,
  activeDuration,
  cursor,
  cursorPos,
  noteNameStyle,
  language,
  t,
  containerRectRef,
  updateContainerRect,
  svgRef,
  dragOverlayRef,
  onSelectEvent,
  onSelectRange,
  onExtendSelectionTo,
  onSelectMeasure,
  onEnterPitchDirect,
  onApplyOverride,
  onChangePitch,
  onHoverPitch,
  onHoverInfo,
  onDragStatus,
  onPreviewPitches,
}: UseScoreInteractionsParams) {
  const { marqueeRect, handleMarqueeMove, handleMarqueeUp, marqueeRef } = useScoreMarquee(
    score,
    layout,
    staffSpacePx,
    onSelectRange
  );

  const {
    ghostNote,
    getPointerSystemCoords,
    clearGhostNote,
    updateGhostNote,
    enterPitchAtPointer,
  } = useGhostNote(
    score,
    layout,
    staffSpacePx,
    activeDuration,
    cursor,
    cursorPos,
    containerRectRef,
    onEnterPitchDirect,
    onHoverPitch,
    onHoverInfo
  );

  // Active drag state for 'select' (pitch) and 'position' (dx/dy)
  const dragStateRef = useRef<{
    dragMode: 'select' | 'position';
    startX: number;
    startY: number;
    eventId: string;
    isNote: boolean;
    isRest: boolean;
    measureId: string;
    originalPitches: Pitch[];
    startStepPositions: number[];
    isDragging: boolean;
    dx: number;
    dy: number;
    stepDelta: number;
    targetPitches: Pitch[];
  } | null>(null);

  // Pointer press state for 'input' click vs >4px move
  const inputPressRef = useRef<{
    startX: number;
    startY: number;
    movedPastThreshold: boolean;
  } | null>(null);

  const captureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null);
  const dragRafIdRef = useRef<number | null>(null);
  const hasDraggedRef = useRef<boolean>(false);
  const suppressNextClickRef = useRef<boolean>(false);
  const [isDraggingState, setIsDraggingState] = useState<boolean>(false);

  const releaseCapture = useCallback(() => {
    if (captureRef.current) {
      const { el, pointerId } = captureRef.current;
      try {
        if (typeof el.releasePointerCapture === 'function') {
          el.releasePointerCapture(pointerId);
        }
      } catch {
        // Ignore if capture already released
      }
      captureRef.current = null;
    }
  }, []);

  const clearDragFeedback = useCallback(() => {
    if (dragOverlayRef.current) {
      dragOverlayRef.current.innerHTML = '';
    }
  }, [dragOverlayRef]);

  const cancelActiveInteractions = useCallback(() => {
    if (dragRafIdRef.current) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }
    if (dragStateRef.current) {
      const eventId = dragStateRef.current.eventId;
      const groupEl = svgRef.current?.querySelector(`g[data-event-id="${eventId}"]`) as HTMLElement | null;
      if (groupEl) groupEl.style.opacity = '1';
    }
    clearDragFeedback();
    onDragStatus?.(null);
    dragStateRef.current = null;
    inputPressRef.current = null;
    setIsDraggingState(false);
    releaseCapture();
  }, [clearDragFeedback, onDragStatus, releaseCapture, svgRef]);

  // Clear ghost note & active drags whenever mode changes
  useEffect(() => {
    if (mode !== 'input') {
      clearGhostNote();
    }
    cancelActiveInteractions();
  }, [mode, cancelActiveInteractions, clearGhostNote]);

  // Cancel active drag on Escape or window blur (no command emitted)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCancelDragEvent(e) && dragStateRef.current?.isDragging) {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancelActiveInteractions();
      }
    };
    const handleBlur = () => {
      cancelActiveInteractions();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
    };
  }, [cancelActiveInteractions]);

  const trySetCapture = (target: HTMLElement, pointerId: number) => {
    try {
      if (typeof target.setPointerCapture === 'function') {
        target.setPointerCapture(pointerId);
        captureRef.current = { el: target, pointerId };
      }
    } catch {
      // Ignore synthetic events without active pointerId
    }
  };

  const handlePointerEnter = () => {
    updateContainerRect();
  };

  const handlePointerLeave = () => {
    clearGhostNote();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    suppressNextClickRef.current = false;
    hasDraggedRef.current = false;

    // The surrounding UI can shift (status bar, toolbar) without any resize/scroll event, so the
    // cached rect is refreshed on every press and move; a stale rect offsets hit tests and ghost notes.
    updateContainerRect();

    if (mode === 'input') {
      inputPressRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        movedPastThreshold: false,
      };
      trySetCapture(e.currentTarget, e.pointerId);
      dragStateRef.current = null;
      return;
    }

    const coords = getPointerSystemCoords(e.clientX, e.clientY);
    const hit = coords ? hitTestEvent(layout, coords.targetSys.index, coords.sysRelX, coords.sysRelY) : null;

    if (!hit) {
      dragStateRef.current = null;
      if (mode === 'select') {
        marqueeRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
          isMarquee: false,
        };
        trySetCapture(e.currentTarget, e.pointerId);
      }
      return;
    }

    if (e.shiftKey && onExtendSelectionTo) {
      e.preventDefault();
      suppressNextClickRef.current = true;
      onExtendSelectionTo(hit.eventId);
      dragStateRef.current = null;
      return;
    }

    const loc = findEventLocation(score, hit.eventId);
    if (!loc) {
      dragStateRef.current = null;
      return;
    }

    const isNote = loc.event.kind === 'note';
    const isRest = loc.event.kind === 'rest';

    if (mode === 'lyrics') {
      onSelectEvent(hit.eventId);
      dragStateRef.current = null;
      return;
    }

    if (mode === 'select' && isRest) {
      onSelectEvent(hit.eventId);
      dragStateRef.current = null;
      return;
    }

    const clef = clefOfEvent(score, hit.eventId);
    const originalPitches = isNote ? (loc.event as NoteEvent).pitches : [];
    const startStepPositions = originalPitches.map((p) => pitchToStaffPosition(p, clef));

    dragStateRef.current = {
      dragMode: mode,
      startX: e.clientX,
      startY: e.clientY,
      eventId: hit.eventId,
      isNote,
      isRest,
      measureId: loc.measureId,
      originalPitches,
      startStepPositions,
      isDragging: false,
      dx: 0,
      dy: 0,
      stepDelta: 0,
      targetPitches: originalPitches,
    };
    trySetCapture(e.currentTarget, e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    updateContainerRect();
    // 0. Marquee drag tracking in select mode
    if (
      handleMarqueeMove(
        e.clientX,
        e.clientY,
        containerRectRef.current.left,
        containerRectRef.current.top
      )
    ) {
      return;
    }

    // 1. Input mode press & hover tracking
    if (mode === 'input') {
      if (inputPressRef.current && !inputPressRef.current.movedPastThreshold) {
        const dxPx = e.clientX - inputPressRef.current.startX;
        const dyPx = e.clientY - inputPressRef.current.startY;
        if (isDragPastThreshold(dxPx, dyPx, 4)) {
          inputPressRef.current.movedPastThreshold = true;
        }
      }

      updateGhostNote(e.clientX, e.clientY);
      return;
    }

    // 2. Active drag in 'select' or 'position' mode
    if (!dragStateRef.current) return;

    const deltaPxX = e.clientX - dragStateRef.current.startX;
    const deltaPxY = e.clientY - dragStateRef.current.startY;

    if (!dragStateRef.current.isDragging && isDragPastThreshold(deltaPxX, deltaPxY, 4)) {
      dragStateRef.current.isDragging = true;
      setIsDraggingState(true);
      hasDraggedRef.current = true;
      onSelectEvent(dragStateRef.current.eventId);

      const groupEl = svgRef.current?.querySelector(
        `g[data-event-id="${dragStateRef.current.eventId}"]`
      ) as HTMLElement | null;
      if (groupEl) {
        groupEl.style.opacity = '0.3';
      }
    }

    if (!dragStateRef.current.isDragging) return;

    const { dragMode, eventId, isNote, isRest, measureId, startStepPositions } = dragStateRef.current;

    if (dragMode === 'select' && isNote && startStepPositions.length > 0) {
      const clef = clefOfEvent(score, eventId);
      const mDef = score.measures.find((m) => m.id === measureId) ?? score.measures[0];
      const keySig = mDef?.keySig ?? 0;

      const deltaYSpaces = deltaPxY / staffSpacePx;
      const stepDelta = Math.round(-deltaYSpaces * 2);

      const minSp = Math.min(...startStepPositions);
      const maxSp = Math.max(...startStepPositions);
      const clampedStepDelta = Math.max(-3 - minSp, Math.min(11 - maxSp, stepDelta));

      const targetPitches = startStepPositions.map((sp) =>
        yToStaffPosition(clef, staffPositionToY(sp + clampedStepDelta), keySig)
      );
      if (dragStateRef.current.stepDelta !== clampedStepDelta) {
        onPreviewPitches?.(targetPitches);
      }
      dragStateRef.current.stepDelta = clampedStepDelta;
      dragStateRef.current.targetPitches = targetPitches;

      const pitchName = targetPitches
        .map((p) => formatPitchName(p, noteNameStyle, language))
        .join(', ');
      onDragStatus?.(pitchName);

      if (!dragRafIdRef.current) {
        dragRafIdRef.current = requestAnimationFrame(() => {
          dragRafIdRef.current = null;
          if (!dragStateRef.current?.isDragging) return;
          renderPitchDragFeedback(
            dragOverlayRef.current,
            svgRef.current,
            dragStateRef.current.eventId,
            clampedStepDelta,
            startStepPositions,
            staffSpacePx,
            layout
          );
        });
      }
      return;
    }

    if (dragMode === 'position') {
      const rawDeltaDx = deltaPxX / staffSpacePx;
      const rawDeltaDy = isRest ? deltaPxY / staffSpacePx : 0;
      const snappedDeltaDx = snapDragOffset(rawDeltaDx, Boolean(e.shiftKey));
      const snappedDeltaDy = isRest ? snapDragOffset(rawDeltaDy, Boolean(e.shiftKey)) : 0;

      const targetSys = layout.systems.find((s) => s.items.some((it) => it.eventId === eventId));
      const eventItems = targetSys ? targetSys.items.filter((it) => it.eventId === eventId) : [];
      const mBounds = targetSys
        ? getSystemMeasureBounds(targetSys).find((b) => b.measureId === measureId)
        : undefined;
      const existingApplied = layout.appliedOverrides?.[eventId] ?? { dx: 0, dy: 0 };

      const targetRawDx = existingApplied.dx + snappedDeltaDx;
      const targetRawDy = isRest ? existingApplied.dy + snappedDeltaDy : 0;

      let finalTotalDx = targetRawDx;
      let finalTotalDy = targetRawDy;
      let isAtLimit = false;

      if (mBounds && eventItems.length > 0) {
        const clamped = clampOverrideOffset(
          eventItems,
          mBounds,
          targetRawDx,
          targetRawDy,
          isRest,
          existingApplied.dx,
          existingApplied.dy
        );
        finalTotalDx = clamped.dx;
        finalTotalDy = clamped.dy;
        isAtLimit = clamped.isAtLimit;
      }

      dragStateRef.current.dx = finalTotalDx;
      dragStateRef.current.dy = finalTotalDy;

      const visDx = finalTotalDx - existingApplied.dx;
      const visDy = finalTotalDy - existingApplied.dy;

      const limitSuffix = isAtLimit ? ` · ${t('status.offsetLimit')}` : '';
      const statusStr = `dx ${finalTotalDx.toFixed(2)} · dy ${finalTotalDy.toFixed(2)}${limitSuffix}`;
      onDragStatus?.(statusStr);

      if (!dragRafIdRef.current) {
        dragRafIdRef.current = requestAnimationFrame(() => {
          dragRafIdRef.current = null;
          if (!dragStateRef.current?.isDragging) return;
          renderManualDragFeedback(
            dragOverlayRef.current,
            svgRef.current,
            dragStateRef.current.eventId,
            visDx,
            visDy,
            staffSpacePx
          );
        });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    releaseCapture();

    if (handleMarqueeUp(containerRectRef.current.left, containerRectRef.current.top)) {
      suppressNextClickRef.current = true;
    }

    if (mode === 'input') {
      const press = inputPressRef.current;
      inputPressRef.current = null;
      suppressNextClickRef.current = true;
      if (press && !press.movedPastThreshold && !isDragPastThreshold(e.clientX - press.startX, e.clientY - press.startY, 4)) {
        enterPitchAtPointer(e.clientX, e.clientY);
      }
      return;
    }

    if (dragRafIdRef.current) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }

    if (dragStateRef.current?.isDragging) {
      const { dragMode, eventId, isNote, dx, dy, stepDelta, targetPitches } = dragStateRef.current;
      const groupEl = svgRef.current?.querySelector(`g[data-event-id="${eventId}"]`) as HTMLElement | null;
      if (groupEl) groupEl.style.opacity = '1';
      clearDragFeedback();
      onDragStatus?.(null);

      if (dragMode === 'select' && isNote) {
        if (stepDelta !== 0 && targetPitches.length > 0) {
          onChangePitch?.(eventId, targetPitches);
        }
      } else if (dragMode === 'position') {
        const existingApplied = layout.appliedOverrides?.[eventId] ?? { dx: 0, dy: 0 };
        if (dx !== existingApplied.dx || dy !== existingApplied.dy) {
          onApplyOverride?.(eventId, dx, dy, false);
        }
      }
    }

    setIsDraggingState(false);
    dragStateRef.current = null;
  };

  const handlePointerCancel = () => {
    cancelActiveInteractions();
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    if (mode === 'input') {
      enterPitchAtPointer(e.clientX, e.clientY);
      return;
    }

    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }

    updateContainerRect();
    const coords = getPointerSystemCoords(e.clientX, e.clientY);
    const hit = coords ? hitTestEvent(layout, coords.targetSys.index, coords.sysRelX, coords.sysRelY) : null;

    if (hit) {
      if (e.shiftKey && onExtendSelectionTo) {
        onExtendSelectionTo(hit.eventId);
      } else {
        onSelectEvent(hit.eventId);
      }
      return;
    }

    if (mode === 'select' && coords && onSelectMeasure) {
      const found = xToCursor(layout, coords.targetSys.index, coords.sysRelX, score, { staffId: coords.staffId });
      if (found) {
        onSelectMeasure(found.measureId, found.tick, coords.staffId);
      }
    }
    onSelectEvent(null);
  };

  return {
    ghostNote,
    marqueeRect,
    isDraggingState,
    handlers: {
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handlePointerCancel,
      handlePointerEnter,
      handlePointerLeave,
      handleClick,
    },
  };
}
