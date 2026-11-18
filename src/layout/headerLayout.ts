// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Header block layout calculation (Title, Subtitle, Composer, Arranger).
 */

import { LayoutItem } from './types';

export interface HeaderLayoutResult {
  items: LayoutItem[];
  height: number;
}

export function computeHeaderLayout(
  meta: { title?: string; subtitle?: string; composer?: string; arranger?: string } | undefined,
  targetWidth: number
): HeaderLayoutResult {
  const title = meta?.title?.trim() || '';
  const subtitle = meta?.subtitle?.trim() || '';
  const composer = meta?.composer?.trim() || '';
  const arranger = meta?.arranger?.trim() || '';

  if (!title && !subtitle && !composer && !arranger) {
    return { items: [], height: 0 };
  }

  const TITLE_FONT_SIZE = 2.2;
  const SUBTITLE_FONT_SIZE = 1.3;
  const COMPOSER_FONT_SIZE = 1.2;
  const ARRANGER_FONT_SIZE = 1.0;
  const FONT_FAMILY = '"Times New Roman", Times, "Liberation Serif", serif';

  const items: LayoutItem[] = [];

  // Deterministic character width estimation from font size and length
  const estWidth = (text: string, sz: number) => text.length * sz * 0.52;

  // Title wrapping: wrap to 2 lines if wider than 90% of targetWidth
  let titleLines: string[] = [];
  if (title) {
    const fullW = estWidth(title, TITLE_FONT_SIZE);
    if (fullW > 0.9 * targetWidth && title.includes(' ')) {
      const words = title.split(' ');
      let bestL1 = '';
      let bestL2 = '';
      let minDiff = Infinity;
      for (let i = 1; i < words.length; i++) {
        const l1 = words.slice(0, i).join(' ');
        const l2 = words.slice(i).join(' ');
        const w1 = estWidth(l1, TITLE_FONT_SIZE);
        const w2 = estWidth(l2, TITLE_FONT_SIZE);
        if (w1 <= 0.9 * targetWidth && w2 <= 0.9 * targetWidth) {
          const diff = Math.abs(w1 - w2);
          if (diff < minDiff) {
            minDiff = diff;
            bestL1 = l1;
            bestL2 = l2;
          }
        }
      }
      if (bestL1 && bestL2) {
        titleLines = [bestL1, bestL2];
      } else {
        const mid = Math.ceil(words.length / 2);
        titleLines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
      }
    } else {
      titleLines = [title];
    }
  }

  // Check horizontal collision between centered title and right-aligned composer/arranger
  const maxTitleW =
    titleLines.length > 0 ? Math.max(...titleLines.map((l) => estWidth(l, TITLE_FONT_SIZE))) : 0;
  const titleRight = targetWidth / 2 + maxTitleW / 2;

  const composerW = composer ? estWidth(composer, COMPOSER_FONT_SIZE) : 0;
  const arrangerW = arranger ? estWidth(arranger, ARRANGER_FONT_SIZE) : 0;
  const rightSideMaxW = Math.max(composerW, arrangerW);
  const rightSideLeft = targetWidth - rightSideMaxW;

  const horizontalCollision = Boolean(title && rightSideMaxW > 0 && titleRight + 2.0 > rightSideLeft);

  let curY = 1.0; // Margin at top of header

  // Place title lines
  titleLines.forEach((line, idx) => {
    items.push({
      id: idx === 0 ? 'header-title' : `header-title-${idx + 1}`,
      kind: 'text',
      text: line,
      x: targetWidth / 2,
      y: curY + TITLE_FONT_SIZE,
      textAnchor: 'middle',
      fontSize: TITLE_FONT_SIZE,
      fontWeight: 'bold',
      fontFamily: FONT_FAMILY,
    });
    curY += TITLE_FONT_SIZE * 1.25;
  });

  if (titleLines.length > 0) {
    curY += 0.4;
  }

  // Place subtitle
  if (subtitle) {
    items.push({
      id: 'header-subtitle',
      kind: 'text',
      text: subtitle,
      x: targetWidth / 2,
      y: curY + SUBTITLE_FONT_SIZE,
      textAnchor: 'middle',
      fontSize: SUBTITLE_FONT_SIZE,
      fontStyle: 'italic',
      fontFamily: FONT_FAMILY,
    });
    curY += SUBTITLE_FONT_SIZE * 1.25 + 0.4;
  }

  // Place composer and arranger
  if (horizontalCollision) {
    // Stack below title and subtitle to prevent overlapping
    if (composer) {
      items.push({
        id: 'header-composer',
        kind: 'text',
        text: composer,
        x: targetWidth,
        y: curY + COMPOSER_FONT_SIZE,
        textAnchor: 'end',
        fontSize: COMPOSER_FONT_SIZE,
        fontFamily: FONT_FAMILY,
      });
      curY += COMPOSER_FONT_SIZE * 1.25;
    }
    if (arranger) {
      items.push({
        id: 'header-arranger',
        kind: 'text',
        text: arranger,
        x: targetWidth,
        y: curY + ARRANGER_FONT_SIZE,
        textAnchor: 'end',
        fontSize: ARRANGER_FONT_SIZE,
        fontStyle: 'italic',
        fontFamily: FONT_FAMILY,
      });
      curY += ARRANGER_FONT_SIZE * 1.25;
    }
  } else {
    // Place on right side aligned with top
    let sideY = 1.0 + (titleLines.length > 0 ? TITLE_FONT_SIZE : 0);
    if (composer) {
      items.push({
        id: 'header-composer',
        kind: 'text',
        text: composer,
        x: targetWidth,
        y: sideY + (title ? 0 : COMPOSER_FONT_SIZE),
        textAnchor: 'end',
        fontSize: COMPOSER_FONT_SIZE,
        fontFamily: FONT_FAMILY,
      });
      sideY += COMPOSER_FONT_SIZE * 1.25;
    }
    if (arranger) {
      items.push({
        id: 'header-arranger',
        kind: 'text',
        text: arranger,
        x: targetWidth,
        y: sideY,
        textAnchor: 'end',
        fontSize: ARRANGER_FONT_SIZE,
        fontStyle: 'italic',
        fontFamily: FONT_FAMILY,
      });
      sideY += ARRANGER_FONT_SIZE * 1.25;
    }
    curY = Math.max(curY, sideY);
  }

  return {
    items,
    height: curY,
  };
}
