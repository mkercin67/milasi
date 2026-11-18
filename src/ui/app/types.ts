// SPDX-License-Identifier: GPL-3.0-or-later
import { Pitch, ScoreEvent } from '../../core/model';

export interface SelectedEventInfo {
  eventId: string;
  measureNumber: number;
  measureId?: string;
  event: ScoreEvent;
  isNote: boolean;
  isChord: boolean;
  isRest: boolean;
  pitches: Pitch[];
  baseType: ScoreEvent['baseType'];
  dots: number;
  dynamic?: string;
  articulations?: string[];
  hasSlur?: boolean;
}
