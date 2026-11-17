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

  // Ctrl / Cmd combinations across all modes
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
    if (e.code === 'Digit0' && !isShift) {
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

  // Mode switching keys (unmodified)
  if (!isShift) {
    if (e.code === 'KeyV') return 'set-mode-select';
    if (e.code === 'KeyN') return 'toggle-note-input';
    if (e.code === 'KeyP') return 'toggle-position-mode';
    if (e.code === 'Escape') {
      if (mode === 'input') return 'exit-note-input';
      if (mode === 'position') return 'set-mode-select';
      return 'clear-selection';
    }
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

      return null;
    }

    // Unmodified keys in select mode
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
    if (isShift) {
      if (e.code === 'ArrowLeft') return 'extend-selection-prev';
      if (e.code === 'ArrowRight') return 'extend-selection-next';
      if (e.code === 'ArrowUp') return 'cycle-accidental-up';
      if (e.code === 'ArrowDown') return 'cycle-accidental-down';
      return null;
    }

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
    if (e.code === 'ArrowUp') return 'transpose-semitone-up';
    if (e.code === 'ArrowDown') return 'transpose-semitone-down';
    if (e.code === 'Delete' || e.code === 'Backspace') return 'convert-to-rest';

    return null;
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
    // Global mode switches & Undo/Redo
    { key: 'Z', code: 'KeyZ', modifiers: 'Ctrl', mode: 'all', action: 'undo' },
    { key: 'Z', code: 'KeyZ', modifiers: 'Ctrl+Shift', mode: 'all', action: 'redo' },
    { key: 'Y', code: 'KeyY', modifiers: 'Ctrl', mode: 'all', action: 'redo' },
    { key: 'Up', code: 'ArrowUp', modifiers: 'Ctrl', mode: 'all', action: 'transpose-octave-up' },
    { key: 'Down', code: 'ArrowDown', modifiers: 'Ctrl', mode: 'all', action: 'transpose-octave-down' },
    { key: '0', code: 'Digit0', modifiers: 'Ctrl', mode: 'all', action: 'reset-override' },
    { key: 'V', code: 'KeyV', modifiers: 'none', mode: 'all', action: 'set-mode-select' },
    { key: 'N', code: 'KeyN', modifiers: 'none', mode: 'all', action: 'toggle-note-input' },
    { key: 'P', code: 'KeyP', modifiers: 'none', mode: 'all', action: 'toggle-position-mode' },
    { key: 'Esc', code: 'Escape', modifiers: 'none', mode: 'select', action: 'clear-selection' },
    { key: 'Esc', code: 'Escape', modifiers: 'none', mode: 'input', action: 'exit-note-input' },
    { key: 'Esc', code: 'Escape', modifiers: 'none', mode: 'position', action: 'set-mode-select' },
    { key: '.', code: 'Period', modifiers: 'none', mode: 'all', action: 'toggle-dot' },

    // Select mode editing
    { key: 'A', code: 'KeyA', modifiers: 'Ctrl', mode: 'select', action: 'select-all' },
    { key: 'C', code: 'KeyC', modifiers: 'Ctrl', mode: 'select', action: 'copy' },
    { key: 'X', code: 'KeyX', modifiers: 'Ctrl', mode: 'select', action: 'cut' },
    { key: 'V', code: 'KeyV', modifiers: 'Ctrl', mode: 'select', action: 'paste' },
    { key: 'B', code: 'KeyB', modifiers: 'Ctrl', mode: 'select', action: 'insert-measure' },
    { key: 'Del', code: 'Delete', modifiers: 'Ctrl', mode: 'select', action: 'delete-measure' },
    { key: 'Backspace', code: 'Backspace', modifiers: 'Ctrl', mode: 'select', action: 'delete-measure' },
    { key: 'S', code: 'KeyS', modifiers: 'none', mode: 'select', action: 'toggle-slur' },
    { key: 'T', code: 'KeyT', modifiers: 'none', mode: 'select', action: 'toggle-tie' },
    { key: 'X', code: 'KeyX', modifiers: 'none', mode: 'select', action: 'reset-accidental' },
    { key: 'J', code: 'KeyJ', modifiers: 'none', mode: 'select', action: 'toggle-articulation: staccato' },
    { key: 'K', code: 'KeyK', modifiers: 'none', mode: 'select', action: 'toggle-articulation: tenuto' },
    { key: 'L', code: 'KeyL', modifiers: 'none', mode: 'select', action: 'toggle-articulation: accent' },
    { key: 'L', code: 'KeyL', modifiers: 'Shift', mode: 'select', action: 'toggle-articulation: marcato' },

    // Dynamics (Select & Position)
    { key: '1', code: 'Digit1', modifiers: 'Shift', mode: 'select', action: 'apply-dynamic: pp' },
    { key: '2', code: 'Digit2', modifiers: 'Shift', mode: 'select', action: 'apply-dynamic: p' },
    { key: '3', code: 'Digit3', modifiers: 'Shift', mode: 'select', action: 'apply-dynamic: mp' },
    { key: '4', code: 'Digit4', modifiers: 'Shift', mode: 'select', action: 'apply-dynamic: mf' },
    { key: '5', code: 'Digit5', modifiers: 'Shift', mode: 'select', action: 'apply-dynamic: f' },
    { key: '6', code: 'Digit6', modifiers: 'Shift', mode: 'select', action: 'apply-dynamic: ff' },
    { key: '7', code: 'Digit7', modifiers: 'Shift', mode: 'select', action: 'apply-dynamic: sfz' },
    { key: '8', code: 'Digit8', modifiers: 'Shift', mode: 'select', action: 'apply-dynamic: fp' },

    { key: '1', code: 'Digit1', modifiers: 'Shift', mode: 'position', action: 'apply-dynamic: pp' },
    { key: '2', code: 'Digit2', modifiers: 'Shift', mode: 'position', action: 'apply-dynamic: p' },
    { key: '3', code: 'Digit3', modifiers: 'Shift', mode: 'position', action: 'apply-dynamic: mp' },
    { key: '4', code: 'Digit4', modifiers: 'Shift', mode: 'position', action: 'apply-dynamic: mf' },
    { key: '5', code: 'Digit5', modifiers: 'Shift', mode: 'position', action: 'apply-dynamic: f' },
    { key: '6', code: 'Digit6', modifiers: 'Shift', mode: 'position', action: 'apply-dynamic: ff' },
    { key: '7', code: 'Digit7', modifiers: 'Shift', mode: 'position', action: 'apply-dynamic: sfz' },
    { key: '8', code: 'Digit8', modifiers: 'Shift', mode: 'position', action: 'apply-dynamic: fp' },

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

    // Input mode shortcuts
    { key: 'C..B', code: 'KeyC..KeyB', modifiers: 'none', mode: 'input', action: 'enter-pitch' },
    { key: '0', code: 'Digit0', modifiers: 'none', mode: 'input', action: 'enter-rest' },
    { key: 'B', code: 'KeyB', modifiers: 'Ctrl', mode: 'input', action: 'insert-measure' },
    { key: 'V', code: 'KeyV', modifiers: 'Ctrl', mode: 'input', action: 'paste' },

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
