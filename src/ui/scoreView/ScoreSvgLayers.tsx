// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { LayoutItem, LayoutResult } from '../../layout/types';
import { TieLayoutItem } from '../../layout/ties';
import { SlurLayoutItem } from '../../layout/notations';
import { GhostNoteData } from './types';
import { getGlyphChar } from '../../render/smufl';
import { BeatGuideData } from './beatGuide';
import { VOICE_COLORS } from '../voiceColors';
import { computeSelectionBands } from './selectionBands';

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
  activeVoiceIndex?: 1 | 2 | 3 | 4;
  cursorPos?: { x: number; y1: number; y2: number; systemIndex: number } | null;
  cursorLineRef: React.RefObject<SVGLineElement>;
  beatGuide?: BeatGuideData | null;
  ghostNote: GhostNoteData | null;
  isDraggingState: boolean;
  dragOverlayRef: React.RefObject<SVGGElement>;
}

export const ScoreSvgLayers: React.FC<ScoreSvgLayersProps> = React.memo(({
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
  activeVoiceIndex = 1,
  cursorPos,
  cursorLineRef,
  beatGuide,
  ghostNote,
  isDraggingState,
  dragOverlayRef,
}) => {
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __componentRenders?: Record<string, number> };
    if (!w.__componentRenders) w.__componentRenders = {};
    w.__componentRenders.ScoreSvgLayers = (w.__componentRenders.ScoreSvgLayers || 0) + 1;
  }
  const voiceColor = VOICE_COLORS[activeVoiceIndex] ?? '#1e293b';
  return (
    <>
      {/* Tinted background band for range selection */}
      {selectedEventIds && selectedEventIds.size > 0 && computeSelectionBands(layout, selectedEventIds, visibleSystemIndices).map((band) => {
        const sys = layout.systems[band.systemIndex];
        const pxX = band.minX * staffSpacePx;
        const pxY = (sys.y + band.staffOffset - 1.5) * staffSpacePx;
        const widthPx = Math.max(10, (band.maxX - band.minX) * staffSpacePx);
        const heightPx = 7 * staffSpacePx;
        return (
          <rect
            key={`range-band-sys-${band.systemIndex}-staff-${band.staffIndex}`}
            className="score-range-band notranslate"
            data-testid="range-selection-band"
            data-staff-index={band.staffIndex}
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

      {/* Pending slot band in active voice color (M7a-4 U8b) */}
      {isInputMode && beatGuide?.pendingBand && (
        <rect
          data-testid="pending-slot-band"
          className="score-pending-band notranslate"
          x={beatGuide.pendingBand.x * staffSpacePx}
          y={beatGuide.pendingBand.y * staffSpacePx}
          width={beatGuide.pendingBand.width * staffSpacePx}
          height={beatGuide.pendingBand.height * staffSpacePx}
          fill={voiceColor}
          opacity={0.15}
          rx={3}
          pointerEvents="none"
        />
      )}

      {/* Coincident event vertical guide line (M7a-4 U8c) */}
      {isInputMode && beatGuide?.coincidentLineX !== null && beatGuide?.coincidentLineX !== undefined && (
        <line
          data-testid="coincident-event-line"
          className="score-coincident-line notranslate"
          x1={beatGuide.coincidentLineX * staffSpacePx}
          y1={(beatGuide.sysY - 0.5) * staffSpacePx}
          x2={beatGuide.coincidentLineX * staffSpacePx}
          y2={(beatGuide.sysY + 4.5) * staffSpacePx}
          stroke={voiceColor}
          strokeWidth={1.5}
          strokeDasharray="3 3"
          opacity={0.5}
          pointerEvents="none"
        />
      )}

      {/* Beat guide tick marks and faint beat numbers (M7a-4 U8a) */}
      {isInputMode && beatGuide && beatGuide.beatMarks.map((bm) => (
        <g key={`beat-mark-${bm.beatNumber}`} className="score-beat-guide notranslate" pointerEvents="none">
          <line
            x1={bm.x * staffSpacePx}
            y1={(beatGuide.sysY + 4.3) * staffSpacePx}
            x2={bm.x * staffSpacePx}
            y2={(beatGuide.sysY + 4.7) * staffSpacePx}
            stroke="#94a3b8"
            strokeWidth={1}
            opacity={0.7}
          />
          <text
            x={bm.x * staffSpacePx}
            y={(beatGuide.sysY + 5.5) * staffSpacePx}
            textAnchor="middle"
            dominantBaseline="alphabetic"
            fill="#94a3b8"
            fontSize={0.8 * staffSpacePx}
            fontWeight={500}
            fontFamily="system-ui, sans-serif"
            opacity={0.75}
          >
            {bm.beatNumber}
          </text>
        </g>
      ))}

      {/* Persistent cursor overlay inside the SVG with per-voice color and badge (M7a-4 U7) */}
      {isInputMode && cursorPos && (
        <g className="score-input-cursor notranslate">
          <line
            ref={cursorLineRef}
            x1={cursorPos.x * staffSpacePx}
            y1={cursorPos.y1 * staffSpacePx}
            x2={cursorPos.x * staffSpacePx}
            y2={cursorPos.y2 * staffSpacePx}
            stroke={voiceColor}
            strokeWidth={2}
          />
          <circle
            cx={cursorPos.x * staffSpacePx}
            cy={(cursorPos.y1 - 0.75) * staffSpacePx}
            r={0.55 * staffSpacePx}
            fill={voiceColor}
          />
          <text
            data-testid="caret-voice-label"
            x={cursorPos.x * staffSpacePx}
            y={(cursorPos.y1 - 0.75) * staffSpacePx}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontSize={0.7 * staffSpacePx}
            fontWeight="bold"
            fontFamily="system-ui, sans-serif"
          >
            {activeVoiceIndex}
          </text>
        </g>
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
});
