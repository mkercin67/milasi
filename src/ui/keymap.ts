/**
 * Physical keyboard shortcut mapping for ScoreForge editor.
 *
 * All mappings are based exclusively on physical key codes (event.code),
 * ensuring identical behavior across QWERTY, Turkish Q, AZERTY, etc.
 */

import { BaseDurationType, PitchStep } from '../core/model';

export type EditorMode = 'select' | 'input' | 'position';

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
  | 'copy'
  | 'cut'
  | 'paste'
  | 'insert-measure'
  | 'delete-measure'
  | 'toggle-tie'
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
  | { type: 'nudge-override'; dx: number; dy: number }
  | { type: 'enter-pitch'; letter: PitchStep }
  | { type: 'set-duration'; baseType: BaseDurationType };

export interface KeyEventLike {
  code: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

const DIGIT_DURATIONS: Record<string, BaseDurationType> = {
  Digit2: '32nd',
  Digit3: '16th',
  Digit4: 'eighth',
  Digit5: 'quarter',
  Digit6: 'half',
  Digit7: 'whole',
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
 * @param e - Keyboard event or mock event containing code and modifier keys.
 * @param modeOrIsInput - Active editor mode ('select' | 'input' | 'position') or legacy boolean.
 * @returns Recognized UserAction or null if unmapped.
 */
export function mapKeyEvent(
  e: KeyEventLike,
  modeOrIsInput: EditorMode | boolean = 'select'
): UserAction | null {
  const mode: EditorMode =
    typeof modeOrIsInput === 'boolean' ? (modeOrIsInput ? 'input' : 'select') : modeOrIsInput;

  const isCmdOrCtrl = Boolean(e.ctrlKey || e.metaKey);
  const isShift = Boolean(e.shiftKey);
  const isAlt = Boolean(e.altKey);

  // All Alt shortcuts are disabled
  if (isAlt) {
    return null;
  }

  // Ctrl / Cmd combinations
  if (isCmdOrCtrl) {
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
    if (e.code === 'Digit0') {
      return 'reset-override';
    }

    if (mode === 'select') {
      if (e.code === 'KeyA') return 'select-all';
      if (e.code === 'KeyC') return 'copy';
      if (e.code === 'KeyX') return 'cut';
      if (e.code === 'KeyV') return 'paste';
      if (e.code === 'KeyB') return 'insert-measure';
      if (e.code === 'Delete' || e.code === 'Backspace') return 'delete-measure';
    } else if (mode === 'input') {
      if (e.code === 'KeyB') return 'insert-measure';
      if (e.code === 'KeyV') return 'paste';
    }
    return null;
  }

  // Position mode arrows & Tab navigation (evaluated before Shift check so Shift+Arrows nudge 1.0)
  if (mode === 'position') {
    const step = isShift ? 1.0 : 0.25;
    if (e.code === 'ArrowLeft') return { type: 'nudge-override', dx: -step, dy: 0 };
    if (e.code === 'ArrowRight') return { type: 'nudge-override', dx: step, dy: 0 };
    if (e.code === 'ArrowUp') return { type: 'nudge-override', dx: 0, dy: -step };
    if (e.code === 'ArrowDown') return { type: 'nudge-override', dx: 0, dy: step };
    if (e.code === 'Tab') {
      return isShift ? 'select-prev' : 'select-next';
    }
    if (isShift) return null;
  }

  // Shift combinations (Selection extension & accidental cycle)
  if (isShift) {
    if (e.code === 'ArrowLeft') {
      return 'extend-selection-prev';
    }
    if (e.code === 'ArrowRight') {
      return 'extend-selection-next';
    }
    if (e.code === 'ArrowUp') {
      return 'cycle-accidental-up';
    }
    if (e.code === 'ArrowDown') {
      return 'cycle-accidental-down';
    }
    return null;
  }

  // Explicit mode switches (unmodified)
  if (e.code === 'KeyV') {
    return 'set-mode-select';
  }
  if (e.code === 'KeyN') {
    return 'toggle-note-input';
  }
  if (e.code === 'KeyP') {
    return 'toggle-position-mode';
  }
  if (e.code === 'Escape') {
    if (mode === 'input') return 'exit-note-input';
    if (mode === 'position') return 'set-mode-select';
    return 'clear-selection';
  }

  // Tie and accidental reset keys
  if (e.code === 'KeyT') {
    return 'toggle-tie';
  }
  if (e.code === 'KeyX') {
    return 'reset-accidental';
  }

  // Pitch entry (Input mode only)
  if (PITCH_LETTERS[e.code]) {
    if (mode !== 'input') {
      return 'show-input-off-hint';
    }
    return { type: 'enter-pitch', letter: PITCH_LETTERS[e.code] };
  }

  // Rest entry (Input mode only)
  if (e.code === 'Digit0') {
    if (mode !== 'input') {
      return 'show-input-off-hint';
    }
    return 'enter-rest';
  }

  // Duration palette keys
  if (DIGIT_DURATIONS[e.code]) {
    return { type: 'set-duration', baseType: DIGIT_DURATIONS[e.code] };
  }

  if (e.code === 'Period') {
    return 'toggle-dot';
  }

  // Standard arrow navigation & semitone transposition
  if (e.code === 'ArrowLeft') {
    return 'select-prev';
  }
  if (e.code === 'ArrowRight') {
    return 'select-next';
  }
  if (e.code === 'ArrowUp') {
    return 'transpose-semitone-up';
  }
  if (e.code === 'ArrowDown') {
    return 'transpose-semitone-down';
  }

  if (e.code === 'Delete' || e.code === 'Backspace') {
    return 'convert-to-rest';
  }

  return null;
}
