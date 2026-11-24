// SPDX-License-Identifier: GPL-3.0-or-later
/** Verse helpers of the lyric entry mode (M7c-7). */

import { isValidLyricVerse, MAX_LYRIC_VERSES, Score } from '../../core/model';

/** The highest verse that has text anywhere in the score (0 when there are no lyrics). */
export function highestVerse(score: Score): number {
  let highest = 0;
  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (const sm of Object.values(staff.measures)) {
        for (const voice of sm.voices) {
          for (const ev of voice.events) {
            if (ev.kind !== 'note') continue;
            for (const l of ev.lyrics ?? []) {
              if (l.text && isValidLyricVerse(l.verse)) highest = Math.max(highest, l.verse);
            }
          }
        }
      }
    }
  }
  return highest;
}

/** The verse "new verse" jumps to: one after the highest used one, never above the limit. */
export function nextNewVerse(score: Score): number {
  return Math.min(MAX_LYRIC_VERSES, Math.max(1, highestVerse(score) + 1));
}

/** True while another verse can still be added. */
export function canAddVerse(score: Score): boolean {
  return highestVerse(score) < MAX_LYRIC_VERSES;
}
