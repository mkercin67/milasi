import React from 'react';
import { LayoutItem, LayoutResult } from '../../layout/types';
import { TieLayoutItem } from '../../layout/ties';
import { SlurLayoutItem } from '../../layout/notations';
import { GhostNoteData } from './types';
import { getGlyphChar } from '../../render/smufl';

export interface ScoreSvgLayersProps {
  layout: LayoutResult;
  selectedEventIds?: Set<string>;
  visibleSystemIndices: Set<number>;
  staffSpacePx: number;
  scale: number;
  zoom: number;
  useTextFallback: boolean;
  visibleTies: TieLayoutItem[];
  visibleSlurs: SlurLayoutItem[];
  visibleDynamics: LayoutItem[];
  visibleArticulations: LayoutItem[];
  marqueeRect: { x: number; y: number; width: number; height: number } | null;
  isPlaying?: boolean;
  isPaused?: boolean;
  playhead?: { x: number; y1: number; y2: number; sysIndex: number } | null;
  isInputMode: boolean;
  cursorPos?: { x: number; y1: number; y2: number; systemIndex: number } | null;
  cursorLineRef: React.RefObject<SVGLineElement>;
  ghostNote: GhostNoteData | null;
  isDraggingState: boolean;
  dragOverlayRef: React.RefObject<SVGGElement>;
}

export const ScoreSvgLayers: React.FC<ScoreSvgLayersProps> = ({
  layout,
  selectedEventIds,
  visibleSystemIndices,
  staffSpacePx,
  scale,
  zoom,
  useTextFallback,
  visibleTies,
  visibleSlurs,
  visibleDynamics,
  visibleArticulations,
  marqueeRect,
  isPlaying = false,
  isPaused = false,
  playhead,
  isInputMode,
  cursorPos,
  cursorLineRef,
  ghostNote,
  isDraggingState,
  dragOverlayRef,
}) => {
  return (
    <>
      {/* Tinted background band for range selection */}
      {selectedEventIds && selectedEventIds.size > 0 && layout.systems.map((sys) => {
        if (!visibleSystemIndices.has(sys.index)) return null;
        const sysItems = sys.items.filter((it) => it.eventId && selectedEventIds.has(it.eventId));
        if (sysItems.length === 0) return null;
        const minX = Math.min(...sysItems.map((it) => it.x)) - 0.4;
        const maxX = Math.max(...sysItems.map((it) => (it.x2 ?? it.x) + 1.2)) + 0.4;
        const pxX = minX * staffSpacePx;
        const pxY = (sys.y - 1.5) * staffSpacePx;
        const widthPx = Math.max(10, (maxX - minX) * staffSpacePx);
        const heightPx = 7 * staffSpacePx;
        return (
          <rect
            key={`range-band-sys-${sys.index}`}
            className="score-range-band notranslate"
            data-testid="range-selection-band"
            x={pxX}
            y={pxY}
            width={widthPx}
            height={heightPx}
            rx={4}
            fill="rgba(37, 99, 235, 0.12)"
            pointerEvents="none"
          />
        );
      })}

      {/* SVG Ties */}
      {visibleTies.map((tie) => {
        const sys = layout.systems[tie.systemIndex];
        const sysY = sys ? sys.y : 0;
        return (
          <path
            key={tie.id}
            data-tie-id={tie.id}
            className="score-tie notranslate"
            d={tie.d}
            transform={`translate(0, ${sysY * staffSpacePx}) scale(${staffSpacePx})`}
            fill="currentColor"
            pointerEvents="none"
          />
        );
      })}

      {/* SVG Slurs */}
      {visibleSlurs.map((slur) => {
        const sys = layout.systems[slur.systemIndex];
        const sysY = sys ? sys.y : 0;
        return (
          <path
            key={slur.id}
            data-slur-id={slur.slurId}
            className="score-slur notranslate"
            d={slur.d}
            transform={`translate(0, ${sysY * staffSpacePx}) scale(${staffSpacePx})`}
            fill="currentColor"
            pointerEvents="none"
          />
        );
      })}

      {/* SVG Dynamics */}
      {visibleDynamics.map((item) => {
        const sysIdx = item.systemIndex ?? 0;
        const sys = layout.systems[sysIdx];
        const sysY = sys ? sys.y : 0;
        const pxX = item.x * staffSpacePx;
        const pxY = (sysY + item.y) * staffSpacePx;
        const fontSize = staffSpacePx * 4;
        return (
          <g
            key={item.id}
            className="score-dynamic notranslate"
            data-event-id={item.eventId}
            data-dynamic-id={item.id}
            data-dynamic-type={item.type}
            pointerEvents="none"
          >
            {useTextFallback && item.glyph ? (
              <text
                x={pxX}
                y={pxY}
                fontSize={fontSize}
                fontFamily="Bravura, BravuraText, sans-serif"
                textAnchor="start"
                dominantBaseline="alphabetic"
                fill="currentColor"
              >
                {getGlyphChar(item.glyph)}
              </text>
            ) : (
              <use
                href={`#glyph-${item.glyph}`}
                transform={`translate(${pxX}, ${pxY}) scale(${scale})`}
                fill="currentColor"
              />
            )}
          </g>
        );
      })}

      {/* SVG Articulations */}
      {visibleArticulations.map((item) => {
        const sysIdx = item.systemIndex ?? 0;
        const sys = layout.systems[sysIdx];
        const sysY = sys ? sys.y : 0;
        const pxX = item.x * staffSpacePx;
        const pxY = (sysY + item.y) * staffSpacePx;
        const fontSize = staffSpacePx * 4;
        return (
          <g
            key={item.id}
            className="score-articulation notranslate"
            data-event-id={item.eventId}
            data-articulation-id={item.id}
            data-articulation-type={item.type}
            pointerEvents="none"
          >
            {useTextFallback && item.glyph ? (
              <text
                x={pxX}
                y={pxY}
                fontSize={fontSize}
                fontFamily="Bravura, BravuraText, sans-serif"
                textAnchor="start"
                dominantBaseline="alphabetic"
                fill="currentColor"
              >
                {getGlyphChar(item.glyph)}
              </text>
            ) : (
              <use
                href={`#glyph-${item.glyph}`}
                transform={`translate(${pxX}, ${pxY}) scale(${scale})`}
                fill="currentColor"
              />
            )}
          </g>
        );
      })}

      {/* Marquee selection rectangle */}
      {marqueeRect && (
        <rect
          className="score-marquee-rect notranslate"
          data-testid="marquee-selection-box"
          x={marqueeRect.x}
          y={marqueeRect.y}
          width={marqueeRect.width}
          height={marqueeRect.height}
          fill="rgba(37, 99, 235, 0.08)"
          stroke="#2563eb"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      )}

      {/* Playback Playhead Line */}
      {(isPlaying || isPaused) && playhead && (
        <line
          data-testid="playback-playhead"
          className="score-playback-playhead notranslate"
          x1={playhead.x}
          y1={playhead.y1}
          x2={playhead.x}
          y2={playhead.y2}
          stroke="#16a34a"
          strokeWidth={2}
          opacity={0.85}
          pointerEvents="none"
        />
      )}

      {/* Persistent cursor overlay inside the SVG */}
      {isInputMode && cursorPos && (
        <line
          ref={cursorLineRef}
          className="score-input-cursor notranslate"
          x1={cursorPos.x * staffSpacePx}
          y1={cursorPos.y1 * staffSpacePx}
          x2={cursorPos.x * staffSpacePx}
          y2={cursorPos.y2 * staffSpacePx}
          stroke="#2563eb"
          strokeWidth={2}
        />
      )}

      {/* Semi-transparent ghost note overlay (Input mode only, hidden outside staff or while dragging) */}
      {isInputMode && ghostNote && !isDraggingState && (
        <g className="score-ghost-note notranslate" pointerEvents="none">
          {ghostNote.ledgerYs.map((ly) => (
            <line
              key={`ghost-ledger-${ly}`}
              x1={(ghostNote.x - 0.4) * staffSpacePx}
              y1={(ghostNote.sysY + ly) * staffSpacePx}
              x2={(ghostNote.x + 1.6) * staffSpacePx}
              y2={(ghostNote.sysY + ly) * staffSpacePx}
              stroke="#2563eb"
              strokeWidth={1.6 * zoom}
              opacity={0.45}
              strokeLinecap="butt"
            />
          ))}
          <use
            href={`#glyph-${ghostNote.glyph}`}
            transform={`translate(${ghostNote.x * staffSpacePx}, ${(ghostNote.sysY + ghostNote.y) * staffSpacePx}) scale(${scale})`}
            fill="#2563eb"
            opacity={0.45}
          />
        </g>
      )}

      {/* Live drag feedback overlay */}
      <g ref={dragOverlayRef} className="score-drag-overlay notranslate" pointerEvents="none" />
    </>
  );
};
