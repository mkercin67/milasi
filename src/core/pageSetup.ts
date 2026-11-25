// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Page setup helpers (M7d-1): defaults, paper sizes and the conversion from millimetres to staff spaces.
 * Pure functions, no DOM. Layout works in staff spaces; paper is in millimetres.
 */
import type { PageSetup, Score } from './model';

/** Portrait paper sizes in millimetres (width, height). */
const PAPER_MM: Record<'A4' | 'A5' | 'Letter', { widthMm: number; heightMm: number }> = {
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  Letter: { widthMm: 215.9, heightMm: 279.4 },
};

export const DEFAULT_STAFF_HEIGHT_MM = 7;
const DEFAULT_MARGIN_MM = 15;

/** A4 portrait, 15 mm margins, 7 mm staff height (one staff space = 1.75 mm). */
export function defaultPageSetup(): PageSetup {
  return {
    paper: 'A4',
    orientation: 'portrait',
    marginsMm: { top: DEFAULT_MARGIN_MM, bottom: DEFAULT_MARGIN_MM, left: DEFAULT_MARGIN_MM, right: DEFAULT_MARGIN_MM },
    staffHeightMm: DEFAULT_STAFF_HEIGHT_MM,
  };
}

/** The score's page setup, or the defaults when it has none. */
export function resolvePageSetup(score: Score): PageSetup {
  return score.pageSetup ?? defaultPageSetup();
}

/** Millimetres to staff spaces at the given staff height. */
export function mmToStaffSpaces(mm: number, staffHeightMm: number): number {
  return mm / (staffHeightMm / 4);
}

export interface PageGeometry {
  /** Whole sheet in staff spaces. */
  widthSp: number;
  heightSp: number;
  /** Margins in staff spaces. */
  margins: { top: number; bottom: number; left: number; right: number };
  /** Area inside the margins in staff spaces. */
  printableWidthSp: number;
  printableHeightSp: number;
}

/** Paper size in millimetres after orientation, or undefined for an incomplete custom size. */
export function paperSizeMm(setup: PageSetup): { widthMm: number; heightMm: number } | undefined {
  let size: { widthMm: number; heightMm: number };
  if (setup.paper === 'custom') {
    if (setup.widthMm === undefined || setup.heightMm === undefined) return undefined;
    size = { widthMm: setup.widthMm, heightMm: setup.heightMm };
  } else {
    size = PAPER_MM[setup.paper];
  }
  return setup.orientation === 'landscape' ? { widthMm: size.heightMm, heightMm: size.widthMm } : size;
}

/** The page in staff spaces, or undefined for an incomplete custom size. */
export function pageGeometry(setup: PageSetup): PageGeometry | undefined {
  const size = paperSizeMm(setup);
  if (!size) return undefined;
  const k = (mm: number): number => mmToStaffSpaces(mm, setup.staffHeightMm);
  const margins = {
    top: k(setup.marginsMm.top),
    bottom: k(setup.marginsMm.bottom),
    left: k(setup.marginsMm.left),
    right: k(setup.marginsMm.right),
  };
  const widthSp = k(size.widthMm);
  const heightSp = k(size.heightMm);
  return {
    widthSp,
    heightSp,
    margins,
    printableWidthSp: widthSp - margins.left - margins.right,
    printableHeightSp: heightSp - margins.top - margins.bottom,
  };
}

/** Problems with a page setup as plain messages (empty = fine). Used by validateScore. */
export function pageSetupProblems(setup: PageSetup): string[] {
  const out: string[] = [];
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!['A4', 'A5', 'Letter', 'custom'].includes(setup.paper)) out.push(`unknown paper ${String(setup.paper)}`);
  if (setup.orientation !== 'portrait' && setup.orientation !== 'landscape') out.push(`unknown orientation ${String(setup.orientation)}`);
  if (!isNum(setup.staffHeightMm) || setup.staffHeightMm < 3 || setup.staffHeightMm > 12) out.push('staffHeightMm must be between 3 and 12');
  const m = setup.marginsMm;
  if (!m || ![m.top, m.bottom, m.left, m.right].every((v) => isNum(v) && v >= 0 && v <= 100)) out.push('margins must be numbers from 0 to 100 mm');
  if (setup.paper === 'custom') {
    if (!isNum(setup.widthMm) || !isNum(setup.heightMm) || setup.widthMm < 50 || setup.heightMm < 50) out.push('a custom paper needs widthMm and heightMm of at least 50');
  }
  if (out.length === 0) {
    const g = pageGeometry(setup);
    if (!g || g.printableWidthSp < 20 || g.printableHeightSp < 20) out.push('the margins leave less than 20 staff spaces of printable area');
  }
  return out;
}
