// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Memoized React component rendering a single layout system into SVG elements.
 *
 * Performance optimizations:
 * 1. Combines 5 staff lines into a single <path> element (saving 4 elements per system).
 * 2. Replaces individual event hit rects with ONE transparent rect per measure (saving ~75% rect elements).
 * 3. Renders glyphs as <use href="#glyph-NAME"> vector paths by default (zero font layout overhead).
 * 4. Supports ?text / useTextFallback: true for A/B testing with <text> elements.
 * 5. Skips DOM reconciliation for unchanged systems via React.memo.
 */

import React, { useMemo } from 'react';
import { LayoutItem, LayoutSystem } from '../layout/types';
import { getGlyphChar } from '../render/smufl';
import { UNITS_PER_EM } from '../render/glyphPaths.generated';
import { glyphScaleAttr } from '../render/renderSvg';
import { systemViewPropsEqual } from './scoreView/systemEquality';

/** Editor-view colour of courtesy accidentals (exports draw them black). */
const COURTESY_COLOR = '#9ca3af';

export interface SystemViewProps {
  system: LayoutSystem;
  staffSpacePx: number;
  useTextFallback?: boolean;
  onOpenScoreInfo?: () => void;
}

export const SystemView: React.FC<SystemViewProps> = React.memo(
  ({ system, staffSpacePx, useTextFallback = false, onOpenScoreInfo }) => {
    if (typeof window !== 'undefined') {
      const w = window as unknown as { __componentRenders?: Record<string, number> };
      if (!w.__componentRenders) w.__componentRenders = {};
      w.__componentRenders.SystemView = (w.__componentRenders.SystemView || 0) + 1;
    }
    const fontSize = staffSpacePx * 4;
    const scale = staffSpacePx / (UNITS_PER_EM / 4);

    // Separate staff lines, grouped event items, and standalone items
    const { staffLines, eventGroups, standaloneItems } = useMemo(() => {
      const staffLines: LayoutItem[] = [];
      const standaloneItems: LayoutItem[] = [];
      const groupsMap = new Map<string, LayoutItem[]>();

      for (const item of system.items) {
        if (item.kind === 'line' && item.id.includes('staffline')) {
          staffLines.push(item);
        } else if (item.eventId) {
          let list = groupsMap.get(item.eventId);
          if (!list) {
            list = [];
            groupsMap.set(item.eventId, list);
          }
          list.push(item);
        } else {
          standaloneItems.push(item);
        }
      }

      const eventGroups = Array.from(groupsMap.entries()).map(([eventId, items]) => ({
        eventId,
        items,
      }));

      return { staffLines, eventGroups, standaloneItems };
    }, [system.items]);

    // Combine 5 staff lines into 1 SVG <path>
    const staffLinesPath = useMemo(() => {
      if (staffLines.length === 0) return null;
      const minX = Math.min(...staffLines.map((l) => l.x)) * staffSpacePx;
      const maxX = Math.max(...staffLines.map((l) => l.x2 ?? l.x)) * staffSpacePx;
      const thickness = (staffLines[0]?.thickness ?? 0.13) * staffSpacePx;
      const d = staffLines
        .map((l) => `M ${minX} ${(system.y + l.y) * staffSpacePx} H ${maxX}`)
        .join(' ');
      return { d, thickness };
    }, [staffLines, system.y, staffSpacePx]);

    // Compute ONE transparent hit-test rect per measure instead of 1 per event
    const measureBoxes = useMemo(() => {
      const barlines: Array<{ id: string; x: number }> = [];
      for (const item of system.items) {
        if (item.kind === 'line' && item.id.startsWith('barline-') && !item.id.includes('staffline')) {
          barlines.push({ id: item.id, x: item.x });
        }
      }
      barlines.sort((a, b) => a.x - b.x);

      const boxes: Array<{ measureId: string; x: number; width: number }> = [];
      let startX = 0;
      for (const bl of barlines) {
        const mId = bl.id.replace('barline-', '').replace('-thin', '');
        const width = Math.max(1, bl.x - startX);
        boxes.push({ measureId: mId, x: startX, width });
        startX = bl.x;
      }
      return boxes;
    }, [system.items]);

    const renderItem = (item: LayoutItem) => {
      if (item.hidden) return null;
      const pxX = item.x * staffSpacePx;
      const pxY = (system.y + item.y) * staffSpacePx;

      if (item.kind === 'beam' && item.points && item.points.length > 0) {
        const d =
          item.points
            .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * staffSpacePx} ${(system.y + p.y) * staffSpacePx}`)
            .join(' ') + ' Z';
        return (
          <path
            key={item.id}
            data-id={item.id}
            data-beam-group={item.beamGroupId}
            data-event-ids={item.eventIds?.join(',')}
            data-beam-level={item.level}
            className="scoreforge-beam"
            d={d}
            fill="currentColor"
            stroke="none"
          />
        );
      }

      if (item.kind === 'line') {
        const pxX2 = (item.x2 ?? item.x) * staffSpacePx;
        const pxY2 = (system.y + (item.y2 ?? item.y)) * staffSpacePx;
        const strokeWidth = (item.thickness ?? 0.13) * staffSpacePx;
        return (
          <line
            key={item.id}
            data-id={item.id}
            data-event-id={item.eventId}
            x1={pxX}
            y1={pxY}
            x2={pxX2}
            y2={pxY2}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        );
      }

      if (item.kind === 'glyph' && item.glyph) {
        if (useTextFallback) {
          return (
            <text
              key={item.id}
              data-id={item.id}
              data-event-id={item.eventId}
              x={pxX}
              y={pxY}
              className="scoreforge-glyph notranslate"
              style={{
                fontFamily: 'Bravura, serif',
                dominantBaseline: 'alphabetic',
                textAnchor: 'start',
              }}
              dominantBaseline="alphabetic"
              textAnchor="start"
              fontSize={`${fontSize}px`}
              fill="currentColor"
            >
              {getGlyphChar(item.glyph)}
            </text>
          );
        }

        return (
          <use
            key={item.id}
            data-id={item.id}
            data-event-id={item.eventId}
            href={`#glyph-${item.glyph}`}
            transform={`translate(${pxX}, ${pxY}) scale(${glyphScaleAttr(item, scale)})`}
            fill={item.courtesy ? COURTESY_COLOR : 'currentColor'}
          />
        );
      }

      if (item.kind === 'text' && item.text) {
        const sz = item.fontSize ? item.fontSize * staffSpacePx : staffSpacePx * 1.5;
        const isHeader = item.id.startsWith('header-');
        return (
          <text
            key={item.id}
            data-id={item.id}
            data-event-id={item.eventId}
            x={pxX}
            y={pxY}
            fill="currentColor"
            textAnchor={item.textAnchor}
            fontFamily={item.fontFamily ?? '"Times New Roman", Times, "Liberation Serif", serif'}
            fontSize={`${sz}px`}
            fontWeight={item.fontWeight ? String(item.fontWeight) : undefined}
            fontStyle={item.fontStyle}
            style={{
              cursor: isHeader ? 'pointer' : undefined,
              userSelect: 'none',
            }}
            onClick={isHeader ? onOpenScoreInfo : undefined}
          >
            {item.text}
          </text>
        );
      }

      return null;
    };

    return (
      <g data-system-index={system.index} className="notranslate" style={{ contain: 'layout paint' }}>
        {/* Merged staff lines: 1 path replaces 5 lines */}
        {staffLinesPath && (
          <path
            data-id={`sys-${system.index}-stafflines`}
            d={staffLinesPath.d}
            stroke="currentColor"
            strokeWidth={staffLinesPath.thickness}
            strokeLinecap="butt"
          />
        )}

        {/* Background hit rects per measure (rendered behind notes so notes receive pointer events directly) */}
        {measureBoxes.map((m) => (
          <rect
            key={`measure-hit-${m.measureId}`}
            data-measure-id={m.measureId}
            className="measure-hit-area notranslate"
            x={m.x * staffSpacePx}
            y={(system.y - 1) * staffSpacePx}
            width={m.width * staffSpacePx}
            height={6 * staffSpacePx}
            fill="transparent"
            stroke="none"
            strokeWidth={0}
            pointerEvents="all"
            style={{ cursor: 'pointer', fill: 'transparent', stroke: 'none' }}
          />
        ))}

        {/* Event groups: all items of an event grouped together for atomic manual positioning */}
        {eventGroups.map((group) => (
          <g
            key={group.eventId}
            data-event-id={group.eventId}
            className="score-event-group notranslate"
            style={{ cursor: 'grab' }}
          >
            {group.items.map(renderItem)}
          </g>
        ))}

        {/* Standalone lines and glyphs (barlines, system clefs, timesigs) */}
        {standaloneItems.map(renderItem)}
      </g>
    );
  },
  systemViewPropsEqual
);
