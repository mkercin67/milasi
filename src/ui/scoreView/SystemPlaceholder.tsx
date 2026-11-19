// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';

export interface SystemPlaceholderProps {
  index: number;
  y: number;
  height: number;
  totalWidthPx: number;
  staffSpacePx: number;
}

export const SystemPlaceholder: React.FC<SystemPlaceholderProps> = React.memo(
  ({ index, y, height, totalWidthPx, staffSpacePx }) => {
    if (typeof window !== 'undefined') {
      const w = window as unknown as { __componentRenders?: Record<string, number> };
      if (!w.__componentRenders) w.__componentRenders = {};
      w.__componentRenders.SystemPlaceholder = (w.__componentRenders.SystemPlaceholder || 0) + 1;
    }
    return (
      <g
        data-system-index={index}
        data-system-placeholder="true"
        className="score-system-placeholder notranslate"
        transform={`translate(0, ${y * staffSpacePx})`}
        style={{ contain: 'strict' }}
      >
        <rect
          x={0}
          y={0}
          width={totalWidthPx}
          height={height * staffSpacePx}
          fill="transparent"
          pointerEvents="none"
        />
      </g>
    );
  }
);
