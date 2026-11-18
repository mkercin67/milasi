// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lyric layout rendering for single measures: syllables, centered hyphens, and melisma extender lines.
 */

import { NoteEvent, ScoreEvent } from '../core/model';
import { MeasureItemEntry } from './layoutPrimitives';

export interface LyricLayoutEntry {
  ev: NoteEvent;
  eIdx: number;
  lyricX: number;
  lyricY: number;
  displayText: string;
  hasHyphen: boolean;
  hasExtender: boolean;
}

export interface NoteheadPositionEntry {
  evId: string;
  noteheadRightX: number;
}

export function layoutMeasureLyrics(
  lyricsToLayout: LyricLayoutEntry[],
  events: ScoreEvent[],
  notePositions: NoteheadPositionEntry[],
  barlineX: number,
  measureItems: MeasureItemEntry[]
): void {
  for (let lIdx = 0; lIdx < lyricsToLayout.length; lIdx++) {
    const lInfo = lyricsToLayout[lIdx];
    const { ev, eIdx, lyricX, lyricY, displayText, hasHyphen, hasExtender } = lInfo;

    if (displayText.length > 0) {
      measureItems.push({
        item: {
          id: `lyric-text-${ev.id}`,
          eventId: ev.id,
          kind: 'text',
          text: displayText,
          x: lyricX,
          y: lyricY,
          textAnchor: 'middle',
          fontSize: 1.15,
          fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
        },
      });
    }

    if (hasHyphen) {
      // Centered dash between this syllable and the next syllable of the word
      const nextLyric = lyricsToLayout[lIdx + 1];
      let nextX: number;
      if (nextLyric) {
        nextX = nextLyric.lyricX;
      } else {
        // Next syllable is in next measure; center hyphen between this note and barline
        nextX = barlineX;
      }
      const hyphenX = (lyricX + nextX) / 2;
      measureItems.push({
        item: {
          id: `lyric-hyphen-${ev.id}`,
          eventId: ev.id,
          kind: 'text',
          text: '-',
          x: hyphenX,
          y: lyricY,
          textAnchor: 'middle',
          fontSize: 1.15,
          fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
        },
      });
    }

    if (hasExtender) {
      // Extender line: from the end of the syllable to the end of the last melisma note
      let lastMelismaNoteId = ev.id;
      for (let candIdx = eIdx + 1; candIdx < events.length; candIdx++) {
        const cand = events[candIdx];
        if (cand.kind === 'note') {
          const candVerse1 = (cand as NoteEvent).lyrics?.find((l) => l.verse === 1);
          if (candVerse1 && candVerse1.text && candVerse1.text.replace(/[-_]+$/, '').length > 0) {
            // Next syllable starts here; stop melisma
            break;
          }
          lastMelismaNoteId = cand.id;
        }
      }

      const lastPos = notePositions.find((p) => p.evId === lastMelismaNoteId);
      const lastNoteEndX = lastPos ? lastPos.noteheadRightX : lyricX + 1.5;
      const extStartX = lyricX + Math.max(0.6, displayText.length * 0.28) + 0.2;
      const extEndX = Math.max(extStartX + 1.0, lastNoteEndX);

      measureItems.push({
        item: {
          id: `lyric-extender-${ev.id}`,
          eventId: ev.id,
          kind: 'line',
          x: extStartX,
          y: lyricY - 0.2,
          x2: extEndX,
          y2: lyricY - 0.2,
          thickness: 0.12,
        },
      });
    }
  }
}
