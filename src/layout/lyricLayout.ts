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
  /** Verse of this syllable (M7c-7); absent = 1. All entries of one call belong to the same verse. */
  verse?: number;
}

export interface NoteheadPositionEntry {
  evId: string;
  noteheadRightX: number;
}

/** Distance between the lines of two verses on one staff (staff spaces). */
export const LYRIC_VERSE_STEP = 2.0;

/** Id prefix of a verse: verse 1 keeps the ids of every earlier version. */
function idPrefix(verse: number): string {
  return verse === 1 ? 'lyric' : `lyric-v${verse}`;
}

/** The syllables of ONE verse (entries of different verses must be laid out in separate calls). */
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
    const verse = lInfo.verse ?? 1;
    const prefix = idPrefix(verse);

    if (displayText.length > 0) {
      measureItems.push({
        item: {
          id: `${prefix}-text-${ev.id}`,
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
          id: `${prefix}-hyphen-${ev.id}`,
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
          const candVerse = (cand as NoteEvent).lyrics?.find((l) => l.verse === verse);
          if (candVerse && candVerse.text && candVerse.text.replace(/[-_]+$/, '').length > 0) {
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
          id: `${prefix}-extender-${ev.id}`,
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
