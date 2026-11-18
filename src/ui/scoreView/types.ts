// SPDX-License-Identifier: GPL-3.0-or-later
import { BaseDurationType, Pitch, Score, ScoreEvent } from '../../core/model';
import { RangeSelection } from '../../core/selection';
import { ScoreCursor } from '../../core/input';
import { EditorMode } from '../keymap';
import { LayoutResult } from '../../layout/types';

export interface ScoreViewProps {
  score: Score;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string | null) => void;
  selectedEventIds?: Set<string>;
  selectedRange?: RangeSelection | null;
  onSelectRange?: (range: RangeSelection | null) => void;
  onExtendSelectionTo?: (targetEventId: string) => void;
  cursor?: ScoreCursor | null;
  mode?: EditorMode;
  activeDuration?: BaseDurationType;
  onSelectMeasure?: (measureId: string, tick?: number) => void;
  onEnterPitchDirect?: (pitch: Pitch, customCursor?: ScoreCursor) => void;
  onApplyOverride?: (eventId: string, dx: number, dy: number, accumulate?: boolean) => void;
  onChangePitch?: (eventId: string, pitches: Pitch[]) => void;
  onHoverPitch?: (pitch: Pitch | null) => void;
  onHoverInfo?: (info: { pitch: Pitch; measureNumber: number } | null) => void;
  onDragStatus?: (status: string | null) => void;
  onLayoutChange?: (layout: LayoutResult) => void;
  isPlaying?: boolean;
  isPaused?: boolean;
  activePlaybackEventIds?: string[];
  playbackSeconds?: number;
  onPreviewPitches?: (pitches: Pitch[]) => void;
  onOpenScoreInfo?: () => void;
}

export interface GhostNoteData {
  pitch: Pitch;
  sysIndex: number;
  sysY: number;
  x: number;
  y: number;
  glyph: string;
  ledgerYs: number[];
}

export function findEventLocation(
  score: Score,
  eventId: string
): { event: ScoreEvent; measureId: string } | null {
  for (const p of score.parts) {
    for (const st of p.staves) {
      for (const mId of Object.keys(st.measures)) {
        const ev = st.measures[mId].voices[0]?.events.find((it) => it.id === eventId);
        if (ev) {
          return { event: ev, measureId: mId };
        }
      }
    }
  }
  return null;
}
