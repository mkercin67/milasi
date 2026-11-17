import { LayoutResult } from '../../layout/types';
import { getLedgerLineYs } from '../../layout/pitch';

export function renderManualDragFeedback(
  dragOverlay: SVGGElement | null,
  svg: SVGSVGElement | null,
  eventId: string,
  dx: number,
  dy: number,
  staffSpacePx: number
): void {
  if (!dragOverlay || !svg) return;
  const groupEl = svg.querySelector(`g[data-event-id="${eventId}"]`);
  if (!groupEl) return;
  const tx = dx * staffSpacePx;
  const ty = dy * staffSpacePx;
  dragOverlay.innerHTML = `<g transform="translate(${tx}, ${ty})">${groupEl.innerHTML}</g>`;
}

export function renderPitchDragFeedback(
  dragOverlay: SVGGElement | null,
  svg: SVGSVGElement | null,
  eventId: string,
  stepDelta: number,
  startStepPositions: number[],
  staffSpacePx: number,
  layout: LayoutResult
): void {
  if (!dragOverlay || !svg) return;
  const groupEl = svg.querySelector(`g[data-event-id="${eventId}"]`);
  if (!groupEl) return;

  const ty = -stepDelta * 0.5 * staffSpacePx;
  const targetSys =
    layout.systems.find((sys) => sys.items.some((it) => it.eventId === eventId)) ?? layout.systems[0];
  const noteItem = layout.items.find((it) => it.eventId === eventId && it.kind === 'glyph');

  let ledgerSvg = '';
  if (noteItem && targetSys) {
    for (const sp of startStepPositions.map((s) => s + stepDelta)) {
      const lYs = getLedgerLineYs(sp);
      for (const ly of lYs) {
        const lyPx = (targetSys.y + ly) * staffSpacePx;
        const lx1 = (targetSys.x + noteItem.x - 0.4) * staffSpacePx;
        const lx2 = (targetSys.x + noteItem.x + 1.18 + 0.4) * staffSpacePx;
        ledgerSvg += `<line x1="${lx1}" y1="${lyPx}" x2="${lx2}" y2="${lyPx}" stroke="#2563eb" stroke-width="${0.16 * staffSpacePx}" stroke-linecap="butt" />`;
      }
    }
  }

  dragOverlay.innerHTML = `<g transform="translate(0, ${ty})">${groupEl.innerHTML}</g>${ledgerSvg}`;
}
