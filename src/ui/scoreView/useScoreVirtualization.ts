// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LayoutResult } from '../../layout/types';

export interface UseScoreVirtualizationParams {
  cardRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  layout: LayoutResult;
  staffSpacePx: number;
  isPlaying?: boolean;
  playhead?: { x: number; y1: number; y2: number; sysIndex: number } | null;
}

export function useScoreVirtualization({
  cardRef,
  containerRef,
  svgRef,
  layout,
  staffSpacePx,
  isPlaying = false,
  playhead,
}: UseScoreVirtualizationParams) {
  const [containerWidthPx, setContainerWidthPx] = useState<number>(1000);

  // Cached SVG bounding rect (updated on mount, enter, scroll, resize, zoom — never inside pointermove/keydown)
  const containerRectRef = useRef<{ left: number; top: number; width: number; height: number }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const svgTopInContainerRef = useRef<number>(0);

  const updateContainerRect = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    const sRect = svgRef.current.getBoundingClientRect();
    const cRect = containerRef.current.getBoundingClientRect();
    svgTopInContainerRef.current = sRect.top - cRect.top + containerRef.current.scrollTop;
    containerRectRef.current = {
      left: sRect.left,
      top: sRect.top,
      width: sRect.width,
      height: sRect.height,
    };
  }, [containerRef, svgRef]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setContainerWidthPx(w);
          updateContainerRect();
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [cardRef, updateContainerRect]);

  const [viewportScroll, setViewportScroll] = useState<{ scrollTop: number; clientHeight: number }>({
    scrollTop: 0,
    clientHeight: 0,
  });

  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      setViewportScroll({
        scrollTop: containerRef.current.scrollTop,
        clientHeight: containerRef.current.clientHeight,
      });
    }
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportScroll({
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

interface VirtualTestWindow extends Window {
  __setVirtualViewportForTest?: (scrollTop: number, clientHeight: number) => void;
}

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const testWin = window as unknown as VirtualTestWindow;
    testWin.__setVirtualViewportForTest = (scrollTop: number, clientHeight: number) => {
      setViewportScroll({ scrollTop, clientHeight });
    };
    return () => {
      delete testWin.__setVirtualViewportForTest;
    };
  }, []);

  // Refresh cached rect when layout size or zoom changes
  useLayoutEffect(() => {
    updateContainerRect();
  }, [layout.width, layout.height, staffSpacePx, updateContainerRect]);

  const visibleSystemIndices = useMemo(() => {
    if (viewportScroll.clientHeight <= 0 || layout.systems.length <= 3) {
      return new Set<number>(layout.systems.map((s) => s.index));
    }

    const svgTopInContainer = svgTopInContainerRef.current;
    const visibleTopPx = viewportScroll.scrollTop - svgTopInContainer;
    const bufferPx = Math.max(viewportScroll.clientHeight, 600); // 1 screen above & below
    const minVisibleY = (visibleTopPx - bufferPx) / staffSpacePx;
    const maxVisibleY = (visibleTopPx + viewportScroll.clientHeight + bufferPx) / staffSpacePx;

    const visible = new Set<number>();
    for (const sys of layout.systems) {
      const sysTop = sys.y;
      const sysBottom = sys.y + sys.height;
      if (sysBottom >= minVisibleY && sysTop <= maxVisibleY) {
        visible.add(sys.index);
      }
    }

    if (visible.size === 0 && layout.systems.length > 0) {
      visible.add(layout.systems[0].index);
    }

    return visible;
  }, [viewportScroll, layout.systems, staffSpacePx]);

  // Auto-scroll to keep active system visible, paused for 3s if user scrolls
  const lastAutoScrollSysRef = useRef<number>(-1);
  const userScrollPauseUntilRef = useRef<number>(0);
  const isProgrammaticScrollRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isPlaying || !playhead) return;
    if (playhead.sysIndex === lastAutoScrollSysRef.current) return;

    const now = performance.now();
    if (now < userScrollPauseUntilRef.current) return;

    lastAutoScrollSysRef.current = playhead.sysIndex;

    if (containerRef.current) {
      const sys = layout.systems[playhead.sysIndex];
      if (sys) {
        const targetScrollTop = Math.max(0, (sys.y - 1.5) * staffSpacePx);
        isProgrammaticScrollRef.current = true;
        containerRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 500);
      }
    }
  }, [playhead, isPlaying, layout, staffSpacePx, containerRef]);

  const handleContainerScroll = useCallback(() => {
    updateContainerRect();
    if (!isProgrammaticScrollRef.current) {
      userScrollPauseUntilRef.current = performance.now() + 3000;
    }
    if (containerRef.current) {
      const top = containerRef.current.scrollTop;
      const height = containerRef.current.clientHeight;
      if (scrollRafRef.current === null) {
        scrollRafRef.current = requestAnimationFrame(() => {
          scrollRafRef.current = null;
          setViewportScroll((prev) => {
            if (prev.scrollTop === top && prev.clientHeight === height) return prev;
            return { scrollTop: top, clientHeight: height };
          });
        });
      }
    }
  }, [containerRef, updateContainerRect]);

  return {
    containerWidthPx,
    containerRectRef,
    updateContainerRect,
    visibleSystemIndices,
    handleContainerScroll,
  };
}
