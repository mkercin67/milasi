// SPDX-License-Identifier: GPL-3.0-or-later
import type { LayoutSystem } from '../../layout/types';

export interface SystemViewComparable {
  system: LayoutSystem;
  staffSpacePx: number;
  useTextFallback?: boolean;
}

/**
 * React.memo comparator of SystemView: true when nothing visible changed.
 * Every field that is drawn must be compared. Text and line ends count: a note-name label or a
 * syllable whose spelling changes keeps its id and position (regression: switching the note-name
 * style from solfège to letters did not repaint until the layer was toggled off and on).
 */
export function systemViewPropsEqual<P extends SystemViewComparable>(
  prev: Readonly<P>,
  next: Readonly<P>
): boolean {
  if (prev.staffSpacePx !== next.staffSpacePx) return false;
  if (prev.useTextFallback !== next.useTextFallback) return false;
  if (prev.system === next.system) return true;
  if (prev.system.y !== next.system.y || prev.system.width !== next.system.width) return false;
  if (prev.system.items.length !== next.system.items.length) return false;
  for (let i = 0; i < prev.system.items.length; i++) {
    const p = prev.system.items[i];
    const n = next.system.items[i];
    if (p.id !== n.id || p.x !== n.x || p.y !== n.y || p.glyph !== n.glyph || p.scaleY !== n.scaleY) return false;
    if (p.text !== n.text || p.x2 !== n.x2 || p.y2 !== n.y2 || p.fontSize !== n.fontSize) return false;
  }
  return true;
}
