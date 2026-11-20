// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Voice color definitions and WCAG 2.1 contrast computation utilities.
 *
 * Ensures all voice indicators achieve >= 4.5:1 contrast against page background (#ffffff)
 * and maintain clear visual separation from selection blue (#2563eb).
 */

export const VOICE_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: '#1e293b', // slate-800, contrast 14.63:1 against #ffffff
  2: '#b45309', // amber-700, contrast 5.02:1 against #ffffff
  3: '#047857', // emerald-700, contrast 5.48:1 against #ffffff
  4: '#7e22ce', // purple-700, contrast 6.98:1 against #ffffff
};

export const SELECTION_BLUE = '#2563eb';
export const PAGE_BACKGROUND = '#ffffff';

export function srgbToLinear(c: number): number {
  const v = c / 255.0;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function getLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
