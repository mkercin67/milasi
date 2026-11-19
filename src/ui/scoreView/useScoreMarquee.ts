// SPDX-License-Identifier: GPL-3.0-or-later
import { useRef, useState } from 'react';
import { Score, ScoreEvent } from '../../core/model';
import { LayoutResult } from '../../layout/types';
import { RangeSelection, findEventContext } from '../../core/selection';

export function useScoreMarquee(
  score: Score,
  layout: LayoutResult,
  staffSpacePx: number,
  onSelectRange?: (range: RangeSelection | null) => void
) {
  const marqueeRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isMarquee: boolean;
  } | null>(null);

  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const handleMarqueeMove = (
    clientX: number,
    clientY: number,
    containerLeft: number,
    containerTop: number
  ): boolean => {
    if (!marqueeRef.current) return false;
    marqueeRef.current.currentX = clientX;
    marqueeRef.current.currentY = clientY;
    const deltaX = Math.abs(clientX - marqueeRef.current.startX);
    const deltaY = Math.abs(clientY - marqueeRef.current.startY);
    if (!marqueeRef.current.isMarquee && (deltaX > 4 || deltaY > 4)) {
      marqueeRef.current.isMarquee = true;
    }
    if (marqueeRef.current.isMarquee) {
      const left = Math.min(marqueeRef.current.startX, marqueeRef.current.currentX) - containerLeft;
      const top = Math.min(marqueeRef.current.startY, marqueeRef.current.currentY) - containerTop;
      const width = Math.abs(marqueeRef.current.currentX - marqueeRef.current.startX);
      const height = Math.abs(marqueeRef.current.currentY - marqueeRef.current.startY);
      setMarqueeRect({ x: left, y: top, width, height });
      return true;
    }
    return false;
  };

  const handleMarqueeUp = (
    containerLeft: number,
    containerTop: number
  ): boolean => {
    let wasMarquee = false;
    if (marqueeRef.current) {
      if (marqueeRef.current.isMarquee) {
        wasMarquee = true;
        const { startX, startY, currentX, currentY } = marqueeRef.current;
        const left = Math.min(startX, currentX) - containerLeft;
        const right = Math.max(startX, currentX) - containerLeft;
        const top = Math.min(startY, currentY) - containerTop;
        const bottom = Math.max(startY, currentY) - containerTop;

        const intersectingEventIds = new Set<string>();
        for (const sys of layout.systems) {
          for (const item of sys.items) {
            if (item.eventId) {
              const pxX = item.x * staffSpacePx;
              const pxY = (sys.y + item.y) * staffSpacePx;
              if (pxX >= left - 15 && pxX <= right + 15 && pxY >= top - 20 && pxY <= bottom + 20) {
                intersectingEventIds.add(item.eventId);
              }
            }
          }
        }

        const staff = score.parts[0]?.staves[0];
        if (staff && intersectingEventIds.size > 0) {
          const orderedEvents: ScoreEvent[] = [];
          for (const mDef of score.measures) {
            const sm = staff.measures[mDef.id];
            if (sm) {
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (intersectingEventIds.has(ev.id)) {
                    orderedEvents.push(ev);
                  }
                }
              }
            }
          }
          if (orderedEvents.length > 0) {
            const firstEv = orderedEvents[0];
            const lastEv = orderedEvents[orderedEvents.length - 1];
            const firstCtx = findEventContext(score, firstEv.id);
            const voiceIndex = (firstCtx?.voiceIndex ?? 1) as 1 | 2 | 3 | 4;
            const voiceId =
              firstCtx?.voiceId ?? staff.measures[score.measures[0]?.id]?.voices.find((v) => v.voiceIndex === 1)?.id;
            onSelectRange?.({
              staffId: staff.id,
              voiceIndex,
              ...(voiceId ? { voiceId } : {}),
              anchorId: firstEv.id,
              focusId: lastEv.id,
            });
          }
        }
      }
      marqueeRef.current = null;
      setMarqueeRect(null);
    }
    return wasMarquee;
  };

  return {
    marqueeRef,
    marqueeRect,
    handleMarqueeMove,
    handleMarqueeUp,
  };
}
