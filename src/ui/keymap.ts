// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Physical keyboard shortcut mapping for ScoreForge editor.
 *
 * All mappings are based exclusively on physical key codes (event.code),
 * ensuring identical behavior across QWERTY, Turkish Q, AZERTY, etc.
 */

import { ArticulationType, BaseDurationType, DynamicType, PitchStep } from '../core/model';

export type EditorMode = 'select' | 'input' | 'position' | 'lyrics';

export type UserAction =
  | 'transpose-semitone-up'
  | 'transpose-semitone-down'
  | 'transpose-octave-up'
  | 'transpose-octave-down'
  | 'convert-to-rest'
  | 'select-prev'
  | 'select-next'
  | 'extend-selection-prev'
  | 'extend-selection-next'
  | 'select-all'
  | 'select-measure-voices'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'insert-measure'
  | 'delete-measure'
  | 'toggle-tie'
  | 'toggle-slur'
  | 'toggle-lyrics-mode'
  | 'lyrics-next-note'
  | 'lyrics-prev-note'
  | 'lyrics-commit-and-next'
  | 'lyrics-backspace-prev'
  | 'clear-notations'
  | 'cycle-accidental-up'
  | 'cycle-accidental-down'
  | 'reset-accidental'
  | 'clear-selection'
  | 'undo'
  | 'redo'
  | 'set-mode-select'
  | 'toggle-note-input'
  | 'toggle-position-mode'
  | 'exit-note-input'
  | 'enter-rest'
  | 'toggle-dot'
  | 'show-input-off-hint'
  | 'reset-override'
  | 'toggle-playback'
  | 'play-from-start'
  | 'stop-playback'
  | 'save-score'
  | 'save-as-score'
  | 'open-score'
  | 'toggle-diagnostics'
  | 'next-voice'
  | 'prev-voice'
  | 'cursor-measure-start'
  | 'cursor-measure-end'
  | 'cursor-score-start'
  | 'cursor-score-end'
  | 'cursor-prev-measure'
  | 'cursor-next-measure'
  | 'staff-up'
  | 'staff-down'
  | { type: 'apply-dynamic'; dynamic: DynamicType }
  | { type: 'toggle-articulation'; articulation: ArticulationType }
  | { type: 'nudge-override'; dx: number; dy: number }
  | { type: 'enter-pitch'; letter: PitchStep }
  | { type: 'add-chord-pitch'; letter: PitchStep }
  | { type: 'set-duration'; baseType: BaseDurationType }
  | { type: 'legacy-key-hint'; hintKey: 'accent' | 'marcato' | 'tenuto' };

export interface KeyEventLike {
  code: string;
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface KeyMapContext {
  isPlaying?: boolean;
  lyricsInputEmpty?: boolean;
}

let layoutMapCache: Map<string, string> | null = null;

/**
 * Initializes layout mapping from the browser's Keyboard API if available.
 */
export async function initKeyboardLayoutMap(): Promise<void> {
  if (
    typeof navigator !== 'undefined' &&
    'keyboard' in navigator &&
    typeof (navigator as unknown as { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard?.getLayoutMap === 'function'
  ) {
    try {
      const map = await (navigator as unknown as { keyboard: { getLayoutMap: () => Promise<Map<string, string>> } }).keyboard.getLayoutMap();
      layoutMapCache = new Map();
      for (const [code, key] of map.entries()) {
        layoutMapCache.set(code, String(key).toUpperCase());
      }
    } catch {
      // getLayoutMap may reject if permissions policy blocks it
    }
  }
}

/**
 * Resolves localized keycap label for a physical key code.
 */
export function getKeycapLabel(code: string, fallbackKey?: string): string {
  if (layoutMapCache && layoutMapCache.has(code)) {
    return layoutMapCache.get(code)!;
  }
  if (fallbackKey) return fallbackKey;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

/**
 * Helper to check if an event represents the Escape key.
 */
export function isCancelDragEvent(e: KeyEventLike): boolean {
  return e.code === 'Escape';
}

/**
 * Helper to check if an event commits a text input (Enter).
 */
export function isInputCommitEvent(e: KeyEventLike): boolean {
  return e.code === 'Enter';
}

const DIGIT_DURATIONS: Record<string, BaseDurationType> = {
  Digit2: '32nd',
  Digit3: '16th',
  Digit4: 'eighth',
  Digit5: 'quarter',
  Digit6: 'half',
  Digit7: 'whole',
};

const DYNAMICS_BY_CODE: Record<string, DynamicType> = {
  Digit1: 'pp',
  Digit2: 'p',
  Digit3: 'mp',
  Digit4: 'mf',
  Digit5: 'f',
  Digit6: 'ff',
  Digit7: 'sfz',
  Digit8: 'fp',
};

const PITCH_LETTERS: Record<string, PitchStep> = {
  KeyC: 'C',
  KeyD: 'D',
  KeyE: 'E',
  KeyF: 'F',
  KeyG: 'G',
  KeyA: 'A',
  KeyB: 'B',
};

/**
 * Maps a physical keyboard event to a high-level editor action according to the active mode.
 *
 * All mappings are based exclusively on physical key codes (event.code) and boolean modifiers.
 * event.key is strictly ignored.
 *
 * @param e - Keyboard event or mock event containing code and modifier keys.
 * @param modeOrIsInput - Active editor mode ('select' | 'input' | 'position') or legacy boolean.
 * @returns Recognized UserAction or null if unmapped.
 */
export function mapKeyEvent(
  e: KeyEventLike,
  modeOrIsInput: EditorMode | boolean = 'select',
  context?: KeyMapContext
): UserAction | null {
  const mode: EditorMode =
    typeof modeOrIsInput === 'boolean' ? (modeOrIsInput ? 'input' : 'select') : modeOrIsInput;

  const isCmdOrCtrl = Boolean(e.ctrlKey || e.metaKey);
  const isShift = Boolean(e.shiftKey);
  const isAlt = Boolean(e.altKey);

  // Diagnostics shortcut (Ctrl+Alt+D)
  if (isCmdOrCtrl && isAlt && e.code === 'KeyD') {
    return 'toggle-diagnostics';
  }

  // All other Alt shortcuts are disabled
  if (isAlt) {
    return null;
  }

  // Ctrl / Cmd combinations across all modes
  if (isCmdOrCtrl) {
    if (e.code === 'KeyS') {
      return isShift ? 'save-as-score' : 'save-score';
    }
    if (e.code === 'KeyO') {
      return 'open-score';
    }
    if (e.code === 'KeyZ') {
      return isShift ? 'redo' : 'undo';
    }
    if (e.code === 'KeyY') {
      return 'redo';
    }
    if (e.code === 'ArrowUp' && !isShift) {
      return 'transpose-octave-up';
    }
    if (e.code === 'ArrowDown' && !isShift) {
      return 'transpose-octave-down';
    }
    if (e.code === 'Digit0' && !isShift) {
      return 'reset-override';
    }

    if (mode === 'select') {
      if (e.code === 'KeyA') return 'select-all';
      if (e.code === 'KeyC') return 'copy';
      if (e.code === 'KeyX') return 'cut';
      if (e.code === 'KeyV') return 'paste';
      if (e.code === 'KeyB') return 'insert-measure';
    } else if (mode === 'input') {
      if (e.code === 'KeyB') return 'insert-measure';
      if (e.code === 'KeyV') return 'paste';
      // Cursor navigation across the score (no Alt combinations: AltGr on Turkish keyboards)
      if (!isShift) {
        if (e.code === 'Home') return 'cursor-score-start';
        if (e.code === 'End') return 'cursor-score-end';
        if (e.code === 'ArrowLeft') return 'cursor-prev-measure';
        if (e.code === 'ArrowRight') return 'cursor-next-measure';
      }
    }
    return null;
  }

  // Playback shortcuts: Space = play/pause (Shift+Space = play from start)
  if (e.code === 'Space') {
    if (mode === 'lyrics') {
      return 'lyrics-commit-and-next';
    }
    return isShift ? 'play-from-start' : 'toggle-playback';
  }

  // Escape handling: stops playback first if active
  if (e.code === 'Escape') {
    if (context?.isPlaying) {
      return 'stop-playback';
    }
    if (mode === 'input') return 'exit-note-input';
    if (mode === 'position' || mode === 'lyrics') return 'set-mode-select';
    return 'clear-selection';
  }

  // Mode switching keys (unmodified)
  if (!isShift) {
    if (e.code === 'KeyV') return 'set-mode-select';
    if (e.code === 'KeyN') return 'toggle-note-input';
    if (e.code === 'KeyP') return 'toggle-position-mode';
    if (e.code === 'KeyU') return 'toggle-lyrics-mode';
  }

  // Lyrics mode keys
  if (mode === 'lyrics') {
    if (e.code === 'Enter') {
      return 'lyrics-commit-and-next';
    }
    if (e.code === 'Tab') {
      return isShift ? 'lyrics-prev-note' : 'lyrics-next-note';
    }
    if (e.code === 'Backspace' && context?.lyricsInputEmpty) {
      return 'lyrics-backspace-prev';
    }
    return null;
  }

  // Augmentation dot is Period across all modes (unmodified)
  if (!isShift && e.code === 'Period') {
    return 'toggle-dot';
  }

  // POSITION MODE
  if (mode === 'position') {
    // Arrow nudging: 0.25 normal, 1.0 with Shift
    const step = isShift ? 1.0 : 0.25;
    if (e.code === 'ArrowLeft') return { type: 'nudge-override', dx: -step, dy: 0 };
    if (e.code === 'ArrowRight') return { type: 'nudge-override', dx: step, dy: 0 };
    if (e.code === 'ArrowUp') return { type: 'nudge-override', dx: 0, dy: -step };
    if (e.code === 'ArrowDown') return { type: 'nudge-override', dx: 0, dy: step };

    // Tab navigation
    if (e.code === 'Tab') {
      return isShift ? 'select-prev' : 'select-next';
    }

    // Dynamics in position mode (Shift+Digit1..Digit8)
    if (isShift && DYNAMICS_BY_CODE[e.code]) {
      return { type: 'apply-dynamic', dynamic: DYNAMICS_BY_CODE[e.code] };
    }

    // Articulations in position mode (KeyJ, KeyK, KeyL, Shift+KeyL)
    if (isShift && e.code === 'KeyL') {
      return { type: 'toggle-articulation', articulation: 'marcato' };
    }
    if (!isShift) {
      if (e.code === 'KeyJ') return { type: 'toggle-articulation', articulation: 'staccato' };
      if (e.code === 'KeyK') return { type: 'toggle-articulation', articulation: 'tenuto' };
      if (e.code === 'KeyL') return { type: 'toggle-articulation', articulation: 'accent' };
      if (e.code === 'KeyS') return 'toggle-slur';
      if (e.code === 'KeyT') return 'toggle-tie';
      if (e.code === 'KeyX') return 'reset-accidental';
      if (e.code === 'Delete' || e.code === 'Backspace') return 'convert-to-rest';
      if (PITCH_LETTERS[e.code] || e.code === 'Digit0') return 'show-input-off-hint';
    }
    return null;
  }

  // SELECT MODE
  if (mode === 'select') {
    // Shift shortcuts
    if (isShift) {
      if (e.code === 'ArrowLeft') return 'extend-selection-prev';
      if (e.code === 'ArrowRight') return 'extend-selection-next';
      if (e.code === 'ArrowUp') return 'cycle-accidental-up';
      if (e.code === 'ArrowDown') return 'cycle-accidental-down';

      // Dynamics: Shift+Digit1..Digit8
      if (DYNAMICS_BY_CODE[e.code]) {
        return { type: 'apply-dynamic', dynamic: DYNAMICS_BY_CODE[e.code] };
      }

      // Marcato: Shift+KeyL
      if (e.code === 'KeyL') {
        return { type: 'toggle-articulation', articulation: 'marcato' };
      }

      if (e.key === '>' || e.code === 'Period') {
        return { type: 'legacy-key-hint', hintKey: 'accent' };
      }
      if (e.key === '^' && e.code !== 'Digit6') {
        return { type: 'legacy-key-hint', hintKey: 'marcato' };
      }

      return null;
    }

    // Legacy punctuation articulation hints
    if (e.key === '>' || (isShift && e.code === 'Period')) {
      return { type: 'legacy-key-hint', hintKey: 'accent' };
    }
    if (e.key === '^' && e.code !== 'Digit6') {
      return { type: 'legacy-key-hint', hintKey: 'marcato' };
    }
    if (!isCmdOrCtrl && (e.key === '-' || e.code === 'Minus')) {
      return { type: 'legacy-key-hint', hintKey: 'tenuto' };
    }

    // Unmodified keys in select mode
    if (e.code === 'KeyM') return 'select-measure-voices';
    if (e.code === 'KeyS') return 'toggle-slur';
    if (e.code === 'KeyT') return 'toggle-tie';
    if (e.code === 'KeyX') return 'reset-accidental';

    // Articulations: KeyJ (staccato), KeyK (tenuto), KeyL (accent)
    if (e.code === 'KeyJ') return { type: 'toggle-articulation', articulation: 'staccato' };
    if (e.code === 'KeyK') return { type: 'toggle-articulation', articulation: 'tenuto' };
    if (e.code === 'KeyL') return { type: 'toggle-articulation', articulation: 'accent' };

    // Duration palette
    if (DIGIT_DURATIONS[e.code]) {
      return { type: 'set-duration', baseType: DIGIT_DURATIONS[e.code] };
    }

    // Navigation and transposition
    if (e.code === 'ArrowLeft') return 'select-prev';
    if (e.code === 'ArrowRight') return 'select-next';
    if (e.code === 'ArrowUp') return 'transpose-semitone-up';
    if (e.code === 'ArrowDown') return 'transpose-semitone-down';
    if (e.code === 'Delete' || e.code === 'Backspace') return 'convert-to-rest';

    // Pitch keys or Digit0 show input-off hint
    if (PITCH_LETTERS[e.code] || e.code === 'Digit0') {
      return 'show-input-off-hint';
    }

    return null;
  }

  // INPUT MODE
  if (mode === 'input') {
    // Tab and Shift+Tab for voice cycling (Decision D1)
    if (e.code === 'Tab' || e.key === 'Tab') {
      return isShift ? 'prev-voice' : 'next-voice';
    }

    // Staff switching on a grand staff (M7b-3a): physical BracketLeft/BracketRight, no modifiers
    // (Turkish Q keyboard: Ğ / Ü).
    if (!isShift && !isCmdOrCtrl && !isAlt) {
      if (e.code === 'BracketLeft') return 'staff-up';
      if (e.code === 'BracketRight') return 'staff-down';
    }

    if (isShift) {
      if (e.code === 'KeyL') {
        return { type: 'toggle-articulation', articulation: 'marcato' };
      }
      if (DYNAMICS_BY_CODE[e.code]) {
        return { type: 'apply-dynamic', dynamic: DYNAMICS_BY_CODE[e.code] };
      }
      if (e.code === 'ArrowLeft') return 'extend-selection-prev';
      if (e.code === 'ArrowRight') return 'extend-selection-next';
      if (e.code === 'ArrowUp') return 'cycle-accidental-up';
      if (e.code === 'ArrowDown') return 'cycle-accidental-down';
      // Chord entry: Shift+C..B adds that pitch above the note just entered (M7b-8)
      if (PITCH_LETTERS[e.code] && !isCmdOrCtrl && !isAlt) {
        return { type: 'add-chord-pitch', letter: PITCH_LETTERS[e.code] };
      }
      return null;
    }

    // Input mode notation keys: Tie (T), Slur (S), Natural (X), Articulations (J, K, L)
    if (e.code === 'KeyT') return 'toggle-tie';
    if (e.code === 'KeyS') return 'toggle-slur';
    if (e.code === 'KeyX') return 'reset-accidental';
    if (e.code === 'KeyJ') return { type: 'toggle-articulation', articulation: 'staccato' };
    if (e.code === 'KeyK') return { type: 'toggle-articulation', articulation: 'tenuto' };
    if (e.code === 'KeyL') return { type: 'toggle-articulation', articulation: 'accent' };

    // Note entry (C..B)
    if (PITCH_LETTERS[e.code]) {
      return { type: 'enter-pitch', letter: PITCH_LETTERS[e.code] };
    }

    // Rest entry
    if (e.code === 'Digit0') {
      return 'enter-rest';
    }

    // Duration palette
    if (DIGIT_DURATIONS[e.code]) {
      return { type: 'set-duration', baseType: DIGIT_DURATIONS[e.code] };
    }

    // Navigation and editing
    if (e.code === 'ArrowLeft') return 'select-prev';
    if (e.code === 'ArrowRight') return 'select-next';
    if (e.code === 'Home') return 'cursor-measure-start';
    if (e.code === 'End') return 'cursor-measure-end';
    if (e.code === 'ArrowUp') return 'transpose-semitone-up';
    if (e.code === 'ArrowDown') return 'transpose-semitone-down';
    if (e.code === 'Delete' || e.code === 'Backspace') return 'convert-to-rest';

    // Legacy punctuation articulation hints
    if (e.key === '>' || (isShift && e.code === 'Period')) {
      return { type: 'legacy-key-hint', hintKey: 'accent' };
    }
    if (e.key === '^' && e.code !== 'Digit6') {
      return { type: 'legacy-key-hint', hintKey: 'marcato' };
    }
    if (!isCmdOrCtrl && (e.key === '-' || e.code === 'Minus')) {
      return { type: 'legacy-key-hint', hintKey: 'tenuto' };
    }

    return null;
  }

  // Legacy punctuation articulation hints across all modes
  if (e.key === '>' || (isShift && e.code === 'Period')) {
    return { type: 'legacy-key-hint', hintKey: 'accent' };
  }
  if (e.key === '^') {
    return { type: 'legacy-key-hint', hintKey: 'marcato' };
  }
  if (!isCmdOrCtrl && (e.key === '-' || e.code === 'Minus')) {
    return { type: 'legacy-key-hint', hintKey: 'tenuto' };
  }

  return null;
}

export interface KeyTableEntry {
  key: string;
  code: string;
  modifiers: string;
  mode: EditorMode | 'all';
  action: string;
}

/**
 * Returns the complete specification table of all physical key shortcuts.
 */
export function getCompleteKeyTable(): KeyTableEntry[] {
  return [
    // Global mode switches, Storage & Playback
    { key: 'Space', code: 'Space', modifiers: 'none', mode: 'all', action: 'toggle-playback' },
    { key: 'Space', code: 'Space', modifiers: 'Shift', mode: 'all', action: 'play-from-start' },
    { key: 'S', code: 'KeyS', modifiers: 'Ctrl', mode: 'all', action: 'save-score' },
    { key: 'S', code: 'KeyS', modifiers: 'Ctrl+Shift', mode: 'all', action: 'save-as-score' },
    { key: 'O', code: 'KeyO', modifiers: 'Ctrl', mode: 'all', action: 'open-score' },
    { key: 'Z', code: 'KeyZ', modifiers: 'Ctrl', mode: 'all', action: 'undo' },
    { key: 'Z', code: 'KeyZ', modifiers: 'Ctrl+Shift', mode: 'all', action: 'redo' },
    { key: 'Y', code: 'KeyY', modifiers: 'Ctrl', mode: 'all', action: 'redo' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'Ctrl', mode: 'all', action: 'transpose-octave-up' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'Ctrl', mode: 'all', action: 'transpose-octave-down' },
    { key: '0', code: 'Digit0', modifiers: 'Ctrl', mode: 'all', action: 'reset-override' },
    { key: 'V', code: 'KeyV', modifiers: 'none', mode: 'all', action: 'set-mode-select' },
    { key: 'N', code: 'KeyN', modifiers: 'none', mode: 'all', action: 'toggle-note-input' },
    { key: 'P', code: 'KeyP', modifiers: 'none', mode: 'all', action: 'toggle-position-mode' },
    { key: 'U', code: 'KeyU', modifiers: 'none', mode: 'all', action: 'toggle-lyrics-mode' },
    { key: 'Esc', code: 'Escape', modifiers: 'none', mode: 'select', action: 'clear-selection' },
    { key: 'Esc', code: 'Escape', modifiers: 'none', mode: 'input', action: 'exit-note-input' },
    { key: 'Esc', code: 'Escape', modifiers: 'none', mode: 'position', action: 'set-mode-select' },
    { key: 'Esc', code: 'Escape', modifiers: 'none', mode: 'lyrics', action: 'set-mode-select' },
    { key: 'Space', code: 'Space', modifiers: 'none', mode: 'lyrics', action: 'lyrics-commit-and-next' },
    { key: 'Enter', code: 'Enter', modifiers: 'none', mode: 'lyrics', action: 'lyrics-commit-and-next' },
    { key: 'Tab', code: 'Tab', modifiers: 'none', mode: 'lyrics', action: 'lyrics-next-note' },
    { key: 'Tab', code: 'Tab', modifiers: 'Shift', mode: 'lyrics', action: 'lyrics-prev-note' },
    { key: 'Backspace', code: 'Backspace', modifiers: 'none', mode: 'lyrics', action: 'lyrics-backspace-prev' },
    { key: '.', code: 'Period', modifiers: 'none', mode: 'all', action: 'toggle-dot' },

    // Select mode editing
    { key: 'A', code: 'KeyA', modifiers: 'Ctrl', mode: 'select', action: 'select-all' },
    { key: 'M', code: 'KeyM', modifiers: 'none', mode: 'select', action: 'select-measure-voices' },
    { key: 'C', code: 'KeyC', modifiers: 'Ctrl', mode: 'select', action: 'copy' },
    { key: 'X', code: 'KeyX', modifiers: 'Ctrl', mode: 'select', action: 'cut' },
    { key: 'V', code: 'KeyV', modifiers: 'Ctrl', mode: 'select', action: 'paste' },
    { key: 'B', code: 'KeyB', modifiers: 'Ctrl', mode: 'select', action: 'insert-measure' },
    { key: 'S', code: 'KeyS', modifiers: 'none', mode: 'select', action: 'toggle-slur' },
    { key: 'T', code: 'KeyT', modifiers: 'none', mode: 'select', action: 'toggle-tie' },
    { key: 'X', code: 'KeyX', modifiers: 'none', mode: 'select', action: 'reset-accidental' },
    { key: 'J', code: 'KeyJ', modifiers: 'none', mode: 'select', action: 'toggle-articulation: staccato' },
    { key: 'K', code: 'KeyK', modifiers: 'none', mode: 'select', action: 'toggle-articulation: tenuto' },
    { key: 'L', code: 'KeyL', modifiers: 'none', mode: 'select', action: 'toggle-articulation: accent' },
    { key: 'L', code: 'KeyL', modifiers: 'Shift', mode: 'select', action: 'toggle-articulation: marcato' },

    // Position mode shortcuts
    { key: 'Left', code: 'ArrowLeft', modifiers: 'none', mode: 'position', action: 'nudge dx: -0.25' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'none', mode: 'position', action: 'nudge dx: +0.25' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'none', mode: 'position', action: 'nudge dy: -0.25' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'none', mode: 'position', action: 'nudge dy: +0.25' },
    { key: 'Left', code: 'ArrowLeft', modifiers: 'Shift', mode: 'position', action: 'nudge dx: -1.0' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'Shift', mode: 'position', action: 'nudge dx: +1.0' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'Shift', mode: 'position', action: 'nudge dy: -1.0' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'Shift', mode: 'position', action: 'nudge dy: +1.0' },
    { key: 'Tab', code: 'Tab', modifiers: 'none', mode: 'position', action: 'select-next' },
    { key: 'Tab', code: 'Tab', modifiers: 'Shift', mode: 'position', action: 'select-prev' },
    { key: 'S', code: 'KeyS', modifiers: 'none', mode: 'position', action: 'toggle-slur' },
    { key: 'T', code: 'KeyT', modifiers: 'none', mode: 'position', action: 'toggle-tie' },
    { key: 'X', code: 'KeyX', modifiers: 'none', mode: 'position', action: 'reset-accidental' },
    { key: 'J', code: 'KeyJ', modifiers: 'none', mode: 'position', action: 'toggle-articulation: staccato' },
    { key: 'K', code: 'KeyK', modifiers: 'none', mode: 'position', action: 'toggle-articulation: tenuto' },
    { key: 'L', code: 'KeyL', modifiers: 'none', mode: 'position', action: 'toggle-articulation: accent' },
    { key: 'L', code: 'KeyL', modifiers: 'Shift', mode: 'position', action: 'toggle-articulation: marcato' },

    // Dynamics across Select, Position, and Input modes
    ...(['select', 'position', 'input'] as const).flatMap((m) =>
      Object.entries(DYNAMICS_BY_CODE).map(([c, dyn]) => ({
        key: c.slice(5),
        code: c,
        modifiers: 'Shift',
        mode: m,
        action: `apply-dynamic: ${dyn}`,
      }))
    ),

    // Input mode shortcuts
    { key: 'Tab', code: 'Tab', modifiers: 'none', mode: 'input', action: 'next-voice' },
    { key: 'Tab', code: 'Tab', modifiers: 'Shift', mode: 'input', action: 'prev-voice' },
    { key: '[', code: 'BracketLeft', modifiers: 'none', mode: 'input', action: 'staff-up' },
    { key: ']', code: 'BracketRight', modifiers: 'none', mode: 'input', action: 'staff-down' },
    { key: 'Home', code: 'Home', modifiers: 'none', mode: 'input', action: 'cursor-measure-start' },
    { key: 'End', code: 'End', modifiers: 'none', mode: 'input', action: 'cursor-measure-end' },
    { key: 'Home', code: 'Home', modifiers: 'Ctrl', mode: 'input', action: 'cursor-score-start' },
    { key: 'End', code: 'End', modifiers: 'Ctrl', mode: 'input', action: 'cursor-score-end' },
    { key: 'Left', code: 'ArrowLeft', modifiers: 'Ctrl', mode: 'input', action: 'cursor-prev-measure' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'Ctrl', mode: 'input', action: 'cursor-next-measure' },
    { key: 'C..B', code: 'KeyC..KeyB', modifiers: 'none', mode: 'input', action: 'enter-pitch' },
    { key: 'C..B', code: 'KeyC..KeyB', modifiers: 'Shift', mode: 'input', action: 'add-chord-pitch' },
    { key: '0', code: 'Digit0', modifiers: 'none', mode: 'input', action: 'enter-rest' },
    { key: 'B', code: 'KeyB', modifiers: 'Ctrl', mode: 'input', action: 'insert-measure' },
    { key: 'V', code: 'KeyV', modifiers: 'Ctrl', mode: 'input', action: 'paste' },
    { key: 'S', code: 'KeyS', modifiers: 'none', mode: 'input', action: 'toggle-slur' },
    { key: 'T', code: 'KeyT', modifiers: 'none', mode: 'input', action: 'toggle-tie' },
    { key: 'X', code: 'KeyX', modifiers: 'none', mode: 'input', action: 'reset-accidental' },
    { key: 'J', code: 'KeyJ', modifiers: 'none', mode: 'input', action: 'toggle-articulation: staccato' },
    { key: 'K', code: 'KeyK', modifiers: 'none', mode: 'input', action: 'toggle-articulation: tenuto' },
    { key: 'L', code: 'KeyL', modifiers: 'none', mode: 'input', action: 'toggle-articulation: accent' },
    { key: 'L', code: 'KeyL', modifiers: 'Shift', mode: 'input', action: 'toggle-articulation: marcato' },

    // Duration Digits (Select & Input)
    { key: '2', code: 'Digit2', modifiers: 'none', mode: 'select', action: 'set-duration: 32nd' },
    { key: '3', code: 'Digit3', modifiers: 'none', mode: 'select', action: 'set-duration: 16th' },
    { key: '4', code: 'Digit4', modifiers: 'none', mode: 'select', action: 'set-duration: eighth' },
    { key: '5', code: 'Digit5', modifiers: 'none', mode: 'select', action: 'set-duration: quarter' },
    { key: '6', code: 'Digit6', modifiers: 'none', mode: 'select', action: 'set-duration: half' },
    { key: '7', code: 'Digit7', modifiers: 'none', mode: 'select', action: 'set-duration: whole' },

    { key: '2', code: 'Digit2', modifiers: 'none', mode: 'input', action: 'set-duration: 32nd' },
    { key: '3', code: 'Digit3', modifiers: 'none', mode: 'input', action: 'set-duration: 16th' },
    { key: '4', code: 'Digit4', modifiers: 'none', mode: 'input', action: 'set-duration: eighth' },
    { key: '5', code: 'Digit5', modifiers: 'none', mode: 'input', action: 'set-duration: quarter' },
    { key: '6', code: 'Digit6', modifiers: 'none', mode: 'input', action: 'set-duration: half' },
    { key: '7', code: 'Digit7', modifiers: 'none', mode: 'input', action: 'set-duration: whole' },

    // Navigation & Accidental cycling (Select & Input)
    { key: 'Left', code: 'ArrowLeft', modifiers: 'none', mode: 'select', action: 'select-prev' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'none', mode: 'select', action: 'select-next' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'none', mode: 'select', action: 'transpose-semitone-up' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'none', mode: 'select', action: 'transpose-semitone-down' },
    { key: 'Left', code: 'ArrowLeft', modifiers: 'Shift', mode: 'select', action: 'extend-selection-prev' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'Shift', mode: 'select', action: 'extend-selection-next' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'Shift', mode: 'select', action: 'cycle-accidental-up' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'Shift', mode: 'select', action: 'cycle-accidental-down' },
    { key: 'Del', code: 'Delete', modifiers: 'none', mode: 'select', action: 'convert-to-rest' },
    { key: 'Backspace', code: 'Backspace', modifiers: 'none', mode: 'select', action: 'convert-to-rest' },

    { key: 'Left', code: 'ArrowLeft', modifiers: 'none', mode: 'input', action: 'select-prev' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'none', mode: 'input', action: 'select-next' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'none', mode: 'input', action: 'transpose-semitone-up' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'none', mode: 'input', action: 'transpose-semitone-down' },
    { key: 'Left', code: 'ArrowLeft', modifiers: 'Shift', mode: 'input', action: 'extend-selection-prev' },
    { key: 'Right', code: 'ArrowRight', modifiers: 'Shift', mode: 'input', action: 'extend-selection-next' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'Shift', mode: 'input', action: 'cycle-accidental-up' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'Shift', mode: 'input', action: 'cycle-accidental-down' },
    { key: 'Del', code: 'Delete', modifiers: 'none', mode: 'input', action: 'convert-to-rest' },
    { key: 'Backspace', code: 'Backspace', modifiers: 'none', mode: 'input', action: 'convert-to-rest' },
  ];
}
