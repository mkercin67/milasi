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
    return (
      <g
        data-system-index={index}
        data-system-placeholder="true"
        className="score-system-placeholder notranslate"
        transform={`translate(0, ${y * staffSpacePx})`}
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
