// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Interactive SVG score viewport component.
 *
 * Implements explicit three-mode interaction:
 * - 'select': click selects events or places cursor in empty measure; vertical note drag changes pitch;
 *             rest drag is select-only; no ghost note.
 * - 'input':  hover shows ghost note (hidden outside staff area); <=4px click enters ghost pitch;
 *             >4px movement executes no command and never hides/removes existing notes.
 * - 'position': horizontal note/chord drag (dx only, inside own measure) and 2D rest drag
 *             (dx inside measure, dy inside [-1, 5] glyph band), 0.25 snap (Shift = no snap).
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { layoutScore } from '../layout/layoutScore';
import { layoutTies } from '../layout/ties';
import {
  buildNoteheadIndex,
  layoutArticulations,
  layoutDynamics,
  layoutFermatas,
  layoutSlurs,
  layoutHairpins,
  layoutTuplets,
} from '../layout/notations';
import { getGlyphPath, UNITS_PER_EM } from '../render/glyphPaths.generated';
import { SystemView } from './SystemView';
import { useI18n } from './i18n';
import { computeCursorPosition } from '../layout/cursor';
import { ScoreViewProps } from './scoreView/types';
import { SystemPlaceholder } from './scoreView/SystemPlaceholder';
import { useScoreVirtualization } from './scoreView/useScoreVirtualization';
import { useScoreInteractions } from './scoreView/useScoreInteractions';
import { ScoreSvgLayers } from './scoreView/ScoreSvgLayers';
import { computeBeatGuide } from './scoreView/beatGuide';

export { type ScoreViewProps } from './scoreView/types';

export const ScoreView: React.FC<ScoreViewProps> = ({
  score,
  selectedEventId,
  onSelectEvent,
  selectedEventIds,
  selectedRange: _selectedRange = null,
  onSelectRange,
  onExtendSelectionTo,
  cursor = null,
  mode = 'select',
  activeDuration = 'quarter',
  activeDots = 0,
  onSelectMeasure,
  onEnterPitchDirect,
  onApplyOverride,
  onChangePitch,
  onHoverPitch,
  onHoverInfo,
  onDragStatus,
  onLayoutChange,
  isPlaying = false,
  isPaused = false,
  activePlaybackEventIds = [],
  onPreviewPitches,
  onOpenScoreInfo,
}) => {
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __componentRenders?: Record<string, number> };
    if (!w.__componentRenders) w.__componentRenders = {};
    w.__componentRenders.ScoreView = (w.__componentRenders.ScoreView || 0) + 1;
  }
  const { t, zoom, noteNameStyle, language } = useI18n();
  const isInputMode = mode === 'input';

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragOverlayRef = useRef<SVGGElement>(null);
  const cursorLineRef = useRef<SVGLineElement>(null);

  const staffSpacePx = 10 * zoom;
  const scale = staffSpacePx / (UNITS_PER_EM / 4);

  const useTextFallback = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('state') === 'crash_recovery') {
      throw new Error('Simulated layout/render crash for recovery verification');
    }
    return params.has('text') || params.get('renderer') === 'text';
  }, []);

  const initialWidth = 1000;
  const initialSpaces = Math.max(25, Math.floor(initialWidth / staffSpacePx));

  const [availableSpaces, setAvailableSpaces] = React.useState<number>(initialSpaces);

  const layout = useMemo(() => {
    const t0 = performance.now();
    const result = layoutScore(score, { width: availableSpaces, noteNameStyle });
    const dt = performance.now() - t0;
    if (typeof window !== 'undefined') {
      const w = window as unknown as { __layoutTimes?: number[]; __layoutRunCounter?: number };
      if (!w.__layoutTimes) w.__layoutTimes = [];
      w.__layoutTimes.push(dt);
      w.__layoutRunCounter = (w.__layoutRunCounter || 0) + 1;
    }
    return result;
  }, [score, availableSpaces, noteNameStyle]);

  useEffect(() => {
    onLayoutChange?.(layout);
  }, [layout, onLayoutChange]);

  // Map eventId to layout coordinates for fast, zero-DOM-read playhead and highlighting
  // Optimization: only construct eventLayoutMap during active or paused playback (idle editing skips this entirely)
  const eventLayoutMap = useMemo(() => {
    if (!isPlaying && !isPaused) return null;
    const map = new Map<string, { x: number; sysIndex: number; sysY: number }>();
    for (const sys of layout.systems) {
      for (const item of sys.items) {
        if (item.eventId && !map.has(item.eventId)) {
          map.set(item.eventId, { x: item.x, sysIndex: sys.index, sysY: sys.y });
        }
      }
    }
    return map;
  }, [layout, isPlaying, isPaused]);

  const lastPlayheadRef = useRef<{ x: number; y1: number; y2: number; sysIndex: number } | null>(null);

  const playhead = useMemo(() => {
    if (!isPlaying && !isPaused || !eventLayoutMap) {
      lastPlayheadRef.current = null;
      return null;
    }
    if (activePlaybackEventIds && activePlaybackEventIds.length > 0) {
      for (const id of activePlaybackEventIds) {
        const loc = eventLayoutMap.get(id);
        if (loc) {
          const res = {
            x: loc.x * staffSpacePx,
            y1: (loc.sysY - 1) * staffSpacePx,
            y2: (loc.sysY + 5) * staffSpacePx,
            sysIndex: loc.sysIndex,
          };
          lastPlayheadRef.current = res;
          return res;
        }
      }
    }
    return lastPlayheadRef.current;
  }, [isPlaying, isPaused, activePlaybackEventIds, eventLayoutMap, staffSpacePx]);

  const {
    containerWidthPx,
    containerRectRef,
    updateContainerRect,
    visibleSystemIndices,
    handleContainerScroll,
  } = useScoreVirtualization({
    cardRef,
    containerRef,
    svgRef,
    layout,
    staffSpacePx,
    isPlaying,
    playhead,
  });

  useEffect(() => {
    const spaces = Math.max(25, Math.floor(containerWidthPx / staffSpacePx));
    setAvailableSpaces((prev) => (prev === spaces ? prev : spaces));
  }, [containerWidthPx, staffSpacePx]);

  const noteheadIndex = useMemo(() => {
    return buildNoteheadIndex(layout);
  }, [layout]);

  const ties = useMemo(() => {
    return layoutTies(score, layout, noteheadIndex);
  }, [score, layout, noteheadIndex]);

  const articulationItems = useMemo(
    () => layoutArticulations(score, layout, noteheadIndex),
    [score, layout, noteheadIndex]
  );

  const slurs = useMemo(() => {
    return [
      ...layoutSlurs(score, layout, noteheadIndex, articulationItems),
      ...layoutHairpins(score, layout, noteheadIndex),
    ];
  }, [score, layout, noteheadIndex, articulationItems]);

  const dynamics = useMemo(() => {
    return layoutDynamics(score, layout, noteheadIndex);
  }, [score, layout, noteheadIndex]);

  const articulations = useMemo(() => {
    return [
      ...articulationItems,
      ...layoutFermatas(score, layout, noteheadIndex),
      ...layoutTuplets(score, layout, noteheadIndex),
    ];
  }, [score, layout, noteheadIndex, articulationItems]);

  const visibleTies = useMemo(() => {
    return ties.filter((t) => visibleSystemIndices.has(t.systemIndex));
  }, [ties, visibleSystemIndices]);

  const visibleSlurs = useMemo(() => {
    return slurs.filter((s) => visibleSystemIndices.has(s.systemIndex));
  }, [slurs, visibleSystemIndices]);

  const visibleDynamics = useMemo(() => {
    return dynamics.filter((d) => visibleSystemIndices.has(d.systemIndex ?? 0));
  }, [dynamics, visibleSystemIndices]);

  const visibleArticulations = useMemo(() => {
    return articulations.filter((a) => visibleSystemIndices.has(a.systemIndex ?? 0));
  }, [articulations, visibleSystemIndices]);

  const usedGlyphs = useMemo(() => {
    const set = new Set<string>();
    set.add('noteheadBlack');
    set.add('noteheadHalf');
    set.add('noteheadWhole');
    set.add('restWhole');
    set.add('restHalf');
    set.add('restQuarter');
    set.add('rest8th');
    set.add('rest16th');
    set.add('rest32nd');
    // M6b Dynamics glyphs
    set.add('dynamicPP');
    set.add('dynamicPiano');
    set.add('dynamicMP');
    set.add('dynamicMF');
    set.add('dynamicForte');
    set.add('dynamicFF');
    set.add('dynamicSforzato');
    set.add('dynamicFortePiano');
    // M6b Articulations glyphs
    set.add('articStaccatoAbove');
    set.add('articStaccatoBelow');
    set.add('articTenutoAbove');
    set.add('articTenutoBelow');
    set.add('articAccentAbove');
    set.add('articAccentBelow');
    set.add('articMarcatoAbove');
    set.add('articMarcatoBelow');
    // M7c-2 fermata and phrase marks
    set.add('fermataAbove');
    set.add('fermataBelow');
    set.add('breathMarkComma');
    set.add('caesura');
    // M7c-2b tuplet numbers
    for (let n = 2; n <= 9; n++) set.add(`tuplet${n}`);
    // Optimization: scan only visible systems instead of all 50 systems across 200 measures
    for (const sIdx of visibleSystemIndices) {
      const sys = layout.systems[sIdx];
      if (!sys) continue;
      for (const item of sys.items) {
        if (item.kind === 'glyph' && item.glyph) {
          set.add(item.glyph);
        }
      }
    }
    return Array.from(set);
  }, [layout.systems, visibleSystemIndices]);

  const cursorPos = useMemo(() => {
    if (!isInputMode || !cursor) return null;
    return computeCursorPosition(layout, score, cursor);
  }, [layout, score, cursor, isInputMode]);

  const beatGuide = useMemo(() => {
    if (!isInputMode || !cursor) return null;
    return computeBeatGuide(
      layout,
      score,
      cursor.measureId,
      cursor.tick,
      cursor.voiceIndex ?? 1,
      activeDuration,
      activeDots,
      cursor.staffId
    );
  }, [layout, score, isInputMode, cursor, activeDuration, activeDots]);

  useLayoutEffect(() => {
    if (!isInputMode || !cursorPos || !cursorLineRef.current) return;
    const x = cursorPos.x * staffSpacePx;
    const y1 = cursorPos.y1 * staffSpacePx;
    const y2 = cursorPos.y2 * staffSpacePx;
    cursorLineRef.current.setAttribute('x1', String(x));
    cursorLineRef.current.setAttribute('y1', String(y1));
    cursorLineRef.current.setAttribute('x2', String(x));
    cursorLineRef.current.setAttribute('y2', String(y2));
  }, [cursorPos, staffSpacePx, isInputMode]);

  useEffect(() => {
    if (!isInputMode || !cursorPos || !containerRef.current) return;
    const container = containerRef.current;
    const cursorY1 = cursorPos.y1 * staffSpacePx;
    const cursorY2 = cursorPos.y2 * staffSpacePx;
    const scrollTop = container.scrollTop;
    const clientH = container.clientHeight;

    if (cursorY1 < scrollTop) {
      container.scrollTop = Math.max(0, cursorY1 - 20);
    } else if (cursorY2 > scrollTop + clientH) {
      container.scrollTop = cursorY2 - clientH + 20;
    }
  }, [cursorPos, staffSpacePx, isInputMode]);

  const {
    ghostNote,
    marqueeRect,
    isDraggingState,
    handlers,
  } = useScoreInteractions({
    score,
    layout,
    staffSpacePx,
    zoom,
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
  });

  // Dynamic green playback highlighting via DOM class and attributes without full React re-render
  const prevHighlightedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!svgRef.current) return;
    const currentSet = new Set(isPlaying || isPaused ? activePlaybackEventIds : []);
    const prevSet = prevHighlightedIdsRef.current;

    for (const id of prevSet) {
      if (!currentSet.has(id)) {
        const el = svgRef.current.querySelector(`g[data-event-id="${id}"]`);
        if (el) {
          el.classList.remove('playback-highlight');
          el.removeAttribute('data-playback-active');
        }
      }
    }

    for (const id of currentSet) {
      if (!prevSet.has(id)) {
        const el = svgRef.current.querySelector(`g[data-event-id="${id}"]`);
        if (el) {
          el.classList.add('playback-highlight');
          el.setAttribute('data-playback-active', 'true');
        }
      }
    }

    prevHighlightedIdsRef.current = currentSet;
  }, [activePlaybackEventIds, isPlaying, isPaused]);

  useEffect(() => {
    if (!isPlaying && !isPaused && prevHighlightedIdsRef.current.size > 0) {
      if (svgRef.current) {
        for (const id of prevHighlightedIdsRef.current) {
          const el = svgRef.current.querySelector(`g[data-event-id="${id}"]`);
          if (el) {
            el.classList.remove('playback-highlight');
            el.removeAttribute('data-playback-active');
          }
        }
      }
      prevHighlightedIdsRef.current.clear();
    }
  }, [isPlaying, isPaused]);

  const totalWidthPx = layout.width * staffSpacePx;
  const totalHeightPx = layout.height * staffSpacePx;

  return (
    <div
      ref={containerRef}
      onClick={handlers.handleClick}
      onPointerDown={handlers.handlePointerDown}
      onPointerMove={handlers.handlePointerMove}
      onPointerUp={handlers.handlePointerUp}
      onPointerCancel={handlers.handlePointerCancel}
      onPointerEnter={handlers.handlePointerEnter}
      onPointerLeave={handlers.handlePointerLeave}
      onScroll={handleContainerScroll}
      onContextMenu={(e) => e.preventDefault()}
      className="notranslate"
      translate="no"
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        minHeight: 0,
        userSelect: 'none',
      }}
    >
      <style>{`
        @font-face {
          font-family: 'Bravura';
          src: url('/fonts/Bravura.woff2') format('woff2');
          font-weight: normal;
          font-style: normal;
          font-display: block;
        }
        .scoreforge-glyph {
          font-family: 'Bravura', serif !important;
          dominant-baseline: alphabetic !important;
          text-anchor: start !important;
          user-select: none;
        }
        ${
          selectedEventId
            ? `svg g[data-event-id="${selectedEventId}"] {
                fill: #2563eb !important;
                stroke: #2563eb !important;
              }
              svg use[data-event-id="${selectedEventId}"] {
                fill: #2563eb !important;
              }
              svg g[data-event-id="${selectedEventId}"] text,
              svg text[data-event-id="${selectedEventId}"] {
                fill: #2563eb !important;
              }
              svg g[data-event-id="${selectedEventId}"] use {
                fill: #2563eb !important;
              }
              svg line[data-event-id="${selectedEventId}"] {
                stroke: #2563eb !important;
              }`
            : ''
        }
        ${
          selectedEventIds && selectedEventIds.size > 0
            ? Array.from(selectedEventIds)
                .map(
                  (id) => `
              svg g[data-event-id="${id}"] {
                fill: #2563eb !important;
                stroke: #2563eb !important;
              }
              svg use[data-event-id="${id}"] {
                fill: #2563eb !important;
              }
              svg g[data-event-id="${id}"] text,
              svg text[data-event-id="${id}"] {
                fill: #2563eb !important;
              }
              svg g[data-event-id="${id}"] use {
                fill: #2563eb !important;
              }
              svg line[data-event-id="${id}"] {
                stroke: #2563eb !important;
              }
            `
                )
                .join('\n')
            : ''
        }
        svg rect.measure-hit-area {
          fill: transparent !important;
          stroke: none !important;
        }
        svg g.score-event-group.playback-highlight,
        svg g.score-event-group.playback-highlight use,
        svg g.score-event-group.playback-highlight path,
        svg g.score-event-group.playback-highlight text {
          fill: #16a34a !important;
          color: #16a34a !important;
        }
        svg g.score-event-group.playback-highlight line {
          stroke: #16a34a !important;
        }
        ${
          isInputMode
            ? `svg rect.measure-hit-area:hover {
                fill: rgba(37, 99, 235, 0.04) !important;
                stroke: none !important;
              }`
            : ''
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .score-input-cursor {
          animation: cursor-blink 1s step-start infinite;
        }
      `}</style>

      <div
        ref={cardRef}
        className="notranslate"
        translate="no"
        style={{
          position: 'relative',
          backgroundColor: '#ffffff',
          padding: '2.5rem 3rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
          maxWidth: '100%',
          boxSizing: 'border-box',
          contain: 'layout paint',
          willChange: 'auto',
        }}
      >
        <svg
          ref={svgRef}
          className="notranslate"
          viewBox={`0 0 ${totalWidthPx} ${totalHeightPx}`}
          width={`${totalWidthPx}px`}
          height={`${totalHeightPx}px`}
          style={{ color: '#000000', overflow: 'visible', userSelect: 'none', display: 'block' }}
        >
          {!useTextFallback && (
            <defs>
              {usedGlyphs.map((glyphName) => {
                const pathD = getGlyphPath(glyphName);
                if (!pathD) return null;
                return <path key={glyphName} id={`glyph-${glyphName}`} d={pathD} />;
              })}
            </defs>
          )}

          {layout.systems.map((sys) => {
            const isVisible = visibleSystemIndices.has(sys.index);
            if (!isVisible) {
              return (
                <SystemPlaceholder
                  key={sys.index}
                  index={sys.index}
                  y={sys.y}
                  height={sys.height}
                  totalWidthPx={totalWidthPx}
                  staffSpacePx={staffSpacePx}
                />
              );
            }
            return (
              <SystemView
                key={sys.index}
                system={sys}
                staffSpacePx={staffSpacePx}
                useTextFallback={useTextFallback}
                onOpenScoreInfo={onOpenScoreInfo}
              />
            );
          })}

          <ScoreSvgLayers
            layout={layout}
            selectedEventIds={selectedEventIds}
            visibleSystemIndices={visibleSystemIndices}
            staffSpacePx={staffSpacePx}
            scale={scale}
            zoom={zoom}
            useTextFallback={useTextFallback}
            visibleTies={visibleTies}
            visibleSlurs={visibleSlurs}
            visibleDynamics={visibleDynamics}
            visibleArticulations={visibleArticulations}
            marqueeRect={marqueeRect}
            isPlaying={isPlaying}
            isPaused={isPaused}
            playhead={playhead}
            isInputMode={isInputMode}
            activeVoiceIndex={cursor?.voiceIndex ?? 1}
            cursorPos={cursorPos}
            cursorLineRef={cursorLineRef}
            beatGuide={beatGuide}
            ghostNote={ghostNote}
            isDraggingState={isDraggingState}
            dragOverlayRef={dragOverlayRef}
          />
        </svg>
      </div>
    </div>
  );
};
