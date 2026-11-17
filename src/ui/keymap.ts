/**
 * Physical keyboard shortcut mapping for ScoreForge editor.
 *
 * All mappings are based exclusively on physical key codes (event.code),
 * ensuring identical behavior across QWERTY, Turkish Q, AZERTY, etc.
 */

import { ArticulationType, BaseDurationType, DynamicType, PitchStep } from '../core/model';

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
  | 'toggle-slur'
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
  | { type: 'apply-dynamic'; dynamic: DynamicType }
  | { type: 'toggle-articulation'; articulation: ArticulationType }
  | { type: 'nudge-override'; dx: number; dy: number }
  | { type: 'enter-pitch'; letter: PitchStep }
  | { type: 'set-duration'; baseType: BaseDurationType };

export interface KeyEventLike {
  code: string;
  key?: string;
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

  // Shift combinations (Selection extension, accidental cycle, notations, dynamics, slurs)
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

    // Slur toggle: Shift+S
    if (e.code === 'KeyS') {
      return 'toggle-slur';
    }

    // Dynamics quick-apply: Shift+1..8
    if (e.code === 'Digit1') return { type: 'apply-dynamic', dynamic: 'pp' };
    if (e.code === 'Digit2') return { type: 'apply-dynamic', dynamic: 'p' };
    if (e.code === 'Digit3') return { type: 'apply-dynamic', dynamic: 'mp' };
    if (e.code === 'Digit4') return { type: 'apply-dynamic', dynamic: 'mf' };
    if (e.code === 'Digit5') return { type: 'apply-dynamic', dynamic: 'f' };
    if (e.code === 'Digit6') {
      if (e.key === '^') return { type: 'toggle-articulation', articulation: 'marcato' };
      return { type: 'apply-dynamic', dynamic: 'ff' };
    }
    if (e.code === 'Digit7') return { type: 'apply-dynamic', dynamic: 'sfz' };
    if (e.code === 'Digit8') return { type: 'apply-dynamic', dynamic: 'fp' };

    // Accent: > or Shift+Period
    if (e.code === 'Period' || e.key === '>') {
      return { type: 'toggle-articulation', articulation: 'accent' };
    }
    if (e.key === '^') {
      return { type: 'toggle-articulation', articulation: 'marcato' };
    }

    return null;
  }

  // Articulations in Select mode
  if (mode === 'select') {
    if (e.code === 'Period') {
      return { type: 'toggle-articulation', articulation: 'staccato' };
    }
    if (e.code === 'Minus') {
      return { type: 'toggle-articulation', articulation: 'tenuto' };
    }
    if (e.code === 'Slash' || e.key === '>') {
      return { type: 'toggle-articulation', articulation: 'accent' };
    }
    if (e.key === '^' || e.code === 'KeyM') {
      return { type: 'toggle-articulation', articulation: 'marcato' };
    }
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
