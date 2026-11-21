// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { EditorMode, getCompleteKeyTable, KeyEventLike, mapKeyEvent } from '../../src/ui/keymap';

describe('keymap', () => {
  it('maps ArrowUp and ArrowDown to semitone transposition', () => {
    expect(mapKeyEvent({ code: 'ArrowUp' })).toBe('transpose-semitone-up');
    expect(mapKeyEvent({ code: 'ArrowDown' })).toBe('transpose-semitone-down');
  });

  it('maps Ctrl/Cmd+ArrowUp and Ctrl/Cmd+ArrowDown to octave transposition', () => {
    expect(mapKeyEvent({ code: 'ArrowUp', ctrlKey: true })).toBe('transpose-octave-up');
    expect(mapKeyEvent({ code: 'ArrowUp', metaKey: true })).toBe('transpose-octave-up');

    expect(mapKeyEvent({ code: 'ArrowDown', ctrlKey: true })).toBe('transpose-octave-down');
    expect(mapKeyEvent({ code: 'ArrowDown', metaKey: true })).toBe('transpose-octave-down');
  });

  it('maps Delete and Backspace to convert-to-rest', () => {
    expect(mapKeyEvent({ code: 'Delete' })).toBe('convert-to-rest');
    expect(mapKeyEvent({ code: 'Backspace' })).toBe('convert-to-rest');
  });

  it('maps ArrowLeft and ArrowRight to previous and next navigation', () => {
    expect(mapKeyEvent({ code: 'ArrowLeft' })).toBe('select-prev');
    expect(mapKeyEvent({ code: 'ArrowRight' })).toBe('select-next');
  });

  it('maps Escape based on editor mode and playback state', () => {
    expect(mapKeyEvent({ code: 'Escape' }, 'select')).toBe('clear-selection');
    expect(mapKeyEvent({ code: 'Escape' }, 'input')).toBe('exit-note-input');
    expect(mapKeyEvent({ code: 'Escape' }, 'position')).toBe('set-mode-select');
    expect(mapKeyEvent({ code: 'Escape' }, 'lyrics')).toBe('set-mode-select');
    expect(mapKeyEvent({ code: 'Escape' }, 'select', { isPlaying: true })).toBe('stop-playback');
    expect(mapKeyEvent({ code: 'Escape' }, 'input', { isPlaying: true })).toBe('stop-playback');
  });

  it('maps Space and Shift+Space for playback control, and Space for lyrics commit', () => {
    expect(mapKeyEvent({ code: 'Space' }, 'select')).toBe('toggle-playback');
    expect(mapKeyEvent({ code: 'Space' }, 'input')).toBe('toggle-playback');
    expect(mapKeyEvent({ code: 'Space', shiftKey: true }, 'select')).toBe('play-from-start');
    expect(mapKeyEvent({ code: 'Space' }, 'lyrics')).toBe('lyrics-commit-and-next');
  });

  it('maps Ctrl+S, Ctrl+Shift+S, and Ctrl+O to storage actions across modes', () => {
    for (const m of ['select', 'input', 'position', 'lyrics'] as EditorMode[]) {
      expect(mapKeyEvent({ code: 'KeyS', ctrlKey: true }, m)).toBe('save-score');
      expect(mapKeyEvent({ code: 'KeyS', metaKey: true }, m)).toBe('save-score');
      expect(mapKeyEvent({ code: 'KeyS', ctrlKey: true, shiftKey: true }, m)).toBe('save-as-score');
      expect(mapKeyEvent({ code: 'KeyO', ctrlKey: true }, m)).toBe('open-score');
      expect(mapKeyEvent({ code: 'KeyO', metaKey: true }, m)).toBe('open-score');
    }
  });

  it('maps lyrics mode navigation and commit keys', () => {
    expect(mapKeyEvent({ code: 'Enter' }, 'lyrics')).toBe('lyrics-commit-and-next');
    expect(mapKeyEvent({ code: 'Tab' }, 'lyrics')).toBe('lyrics-next-note');
    expect(mapKeyEvent({ code: 'Tab', shiftKey: true }, 'lyrics')).toBe('lyrics-prev-note');
    expect(mapKeyEvent({ code: 'Backspace' }, 'lyrics', { lyricsInputEmpty: true })).toBe('lyrics-backspace-prev');
    expect(mapKeyEvent({ code: 'Backspace' }, 'lyrics', { lyricsInputEmpty: false })).toBeNull();
  });

  it('maps Ctrl+Z and Ctrl+Shift+Z / Ctrl+Y to undo and redo across all modes', () => {
    for (const m of ['select', 'input', 'position'] as EditorMode[]) {
      expect(mapKeyEvent({ code: 'KeyZ', ctrlKey: true }, m)).toBe('undo');
      expect(mapKeyEvent({ code: 'KeyZ', metaKey: true }, m)).toBe('undo');
      expect(mapKeyEvent({ code: 'KeyZ', ctrlKey: true, shiftKey: true }, m)).toBe('redo');
      expect(mapKeyEvent({ code: 'KeyY', ctrlKey: true }, m)).toBe('redo');
      expect(mapKeyEvent({ code: 'KeyY', metaKey: true }, m)).toBe('redo');
    }
  });

  it('maps KeyN, KeyP, KeyV cleanly across select/input/position modes', () => {
    expect(mapKeyEvent({ code: 'KeyN' })).toBe('toggle-note-input');
    expect(mapKeyEvent({ code: 'KeyP' })).toBe('toggle-position-mode');
    expect(mapKeyEvent({ code: 'KeyV' }, 'input')).toBe('set-mode-select');
    expect(mapKeyEvent({ code: 'KeyV' }, 'position')).toBe('set-mode-select');

    // Ignored when Ctrl/Alt is held
    expect(mapKeyEvent({ code: 'KeyN', ctrlKey: true })).toBeNull();
    expect(mapKeyEvent({ code: 'KeyP', ctrlKey: true })).toBeNull();
    expect(mapKeyEvent({ code: 'KeyV', altKey: true })).toBeNull();
  });

  it('maps KeyA..KeyG to enter-pitch when mode is input; prompts hint when select/position', () => {
    // When mode is input: enters pitch
    expect(mapKeyEvent({ code: 'KeyA' }, 'input')).toEqual({ type: 'enter-pitch', letter: 'A' });
    expect(mapKeyEvent({ code: 'KeyB' }, 'input')).toEqual({ type: 'enter-pitch', letter: 'B' });
    expect(mapKeyEvent({ code: 'KeyC' }, 'input')).toEqual({ type: 'enter-pitch', letter: 'C' });
    expect(mapKeyEvent({ code: 'KeyD' }, 'input')).toEqual({ type: 'enter-pitch', letter: 'D' });
    expect(mapKeyEvent({ code: 'KeyE' }, 'input')).toEqual({ type: 'enter-pitch', letter: 'E' });
    expect(mapKeyEvent({ code: 'KeyF' }, 'input')).toEqual({ type: 'enter-pitch', letter: 'F' });
    expect(mapKeyEvent({ code: 'KeyG' }, 'input')).toEqual({ type: 'enter-pitch', letter: 'G' });

    // When mode is select or position: returns 'show-input-off-hint'
    expect(mapKeyEvent({ code: 'KeyA' }, 'select')).toBe('show-input-off-hint');
    expect(mapKeyEvent({ code: 'KeyC' }, 'select')).toBe('show-input-off-hint');
    expect(mapKeyEvent({ code: 'KeyA' }, 'position')).toBe('show-input-off-hint');

    // Modifiers ignore note entry
    expect(mapKeyEvent({ code: 'KeyC', ctrlKey: true }, 'input')).toBeNull();
    expect(mapKeyEvent({ code: 'KeyC', altKey: true }, 'input')).toBeNull();
  });

  it('M7b-8: Shift+C..B adds a chord pitch in input mode only; Ctrl/Alt variants stay unmapped', () => {
    for (const letter of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
      expect(mapKeyEvent({ code: `Key${letter}`, shiftKey: true }, 'input')).toEqual({ type: 'add-chord-pitch', letter });
    }
    expect(mapKeyEvent({ code: 'KeyC', shiftKey: true, ctrlKey: true }, 'input')).not.toEqual({ type: 'add-chord-pitch', letter: 'C' });
    expect(mapKeyEvent({ code: 'KeyC', shiftKey: true }, 'select')).not.toEqual({ type: 'add-chord-pitch', letter: 'C' });
    // Shift+L stays marcato
    expect(mapKeyEvent({ code: 'KeyL', shiftKey: true }, 'input')).toEqual({ type: 'toggle-articulation', articulation: 'marcato' });
  });

  it('maps Digit0 to enter-rest in input mode; prompts hint when select/position; Ctrl+Digit0 to reset-override', () => {
    expect(mapKeyEvent({ code: 'Digit0' }, 'input')).toBe('enter-rest');
    expect(mapKeyEvent({ code: 'Digit0' }, 'select')).toBe('show-input-off-hint');
    expect(mapKeyEvent({ code: 'Digit0' }, 'position')).toBe('show-input-off-hint');
    expect(mapKeyEvent({ code: 'Digit0', ctrlKey: true }, 'input')).toBe('reset-override');
    expect(mapKeyEvent({ code: 'Digit0', metaKey: true }, 'select')).toBe('reset-override');
  });

  it('disables all Alt shortcuts and maps position-mode Arrows / Tab / Shift+Tab cleanly', () => {
    // All Alt shortcuts must return null
    expect(mapKeyEvent({ code: 'ArrowUp', altKey: true }, 'select')).toBeNull();
    expect(mapKeyEvent({ code: 'ArrowDown', altKey: true }, 'position')).toBeNull();
    expect(mapKeyEvent({ code: 'ArrowLeft', altKey: true }, 'input')).toBeNull();
    expect(mapKeyEvent({ code: 'ArrowRight', altKey: true, shiftKey: true }, 'select')).toBeNull();
    expect(mapKeyEvent({ code: 'KeyC', altKey: true }, 'input')).toBeNull();
    expect(mapKeyEvent({ code: 'KeyP', altKey: true }, 'select')).toBeNull();
    expect(mapKeyEvent({ code: 'Digit5', altKey: true }, 'input')).toBeNull();

    // Position mode 0.25 staff space nudge with Arrows
    expect(mapKeyEvent({ code: 'ArrowUp' }, 'position')).toEqual({
      type: 'nudge-override',
      dx: 0,
      dy: -0.25,
    });
    expect(mapKeyEvent({ code: 'ArrowDown' }, 'position')).toEqual({
      type: 'nudge-override',
      dx: 0,
      dy: 0.25,
    });
    expect(mapKeyEvent({ code: 'ArrowLeft' }, 'position')).toEqual({
      type: 'nudge-override',
      dx: -0.25,
      dy: 0,
    });
    expect(mapKeyEvent({ code: 'ArrowRight' }, 'position')).toEqual({
      type: 'nudge-override',
      dx: 0.25,
      dy: 0,
    });

    // Position mode 1.0 staff space nudge with Shift+Arrow
    expect(mapKeyEvent({ code: 'ArrowUp', shiftKey: true }, 'position')).toEqual({
      type: 'nudge-override',
      dx: 0,
      dy: -1.0,
    });
    expect(mapKeyEvent({ code: 'ArrowRight', shiftKey: true }, 'position')).toEqual({
      type: 'nudge-override',
      dx: 1.0,
      dy: 0,
    });

    // Position mode Tab / Shift+Tab navigation
    expect(mapKeyEvent({ code: 'Tab' }, 'position')).toBe('select-next');
    expect(mapKeyEvent({ code: 'Tab', shiftKey: true }, 'position')).toBe('select-prev');
  });

  it('maps Digit2..Digit7 to set-duration in select and input modes without shift', () => {
    for (const m of ['select', 'input'] as EditorMode[]) {
      expect(mapKeyEvent({ code: 'Digit2' }, m)).toEqual({ type: 'set-duration', baseType: '32nd' });
      expect(mapKeyEvent({ code: 'Digit3' }, m)).toEqual({ type: 'set-duration', baseType: '16th' });
      expect(mapKeyEvent({ code: 'Digit4' }, m)).toEqual({ type: 'set-duration', baseType: 'eighth' });
      expect(mapKeyEvent({ code: 'Digit5' }, m)).toEqual({ type: 'set-duration', baseType: 'quarter' });
      expect(mapKeyEvent({ code: 'Digit6' }, m)).toEqual({ type: 'set-duration', baseType: 'half' });
      expect(mapKeyEvent({ code: 'Digit7' }, m)).toEqual({ type: 'set-duration', baseType: 'whole' });
    }
  });

  it('maps Period exclusively to toggle-dot across all modes (no punctuation for articulations)', () => {
    expect(mapKeyEvent({ code: 'Period' }, 'input')).toBe('toggle-dot');
    expect(mapKeyEvent({ code: 'Period' }, 'select')).toBe('toggle-dot');
    expect(mapKeyEvent({ code: 'Period' }, 'position')).toBe('toggle-dot');
  });

  it('maps M6b notation keys: Slur (KeyS), Tie (KeyT), Natural (KeyX), Dynamics (Shift+Digit1..8), and Articulations (KeyJ, KeyK, KeyL, Shift+KeyL)', () => {
    // Slur toggle: KeyS in select, position, and input modes
    expect(mapKeyEvent({ code: 'KeyS' }, 'select')).toBe('toggle-slur');
    expect(mapKeyEvent({ code: 'KeyS' }, 'position')).toBe('toggle-slur');
    expect(mapKeyEvent({ code: 'KeyS' }, 'input')).toBe('toggle-slur');

    // Tie toggle: KeyT in select, position, and input modes
    expect(mapKeyEvent({ code: 'KeyT' }, 'select')).toBe('toggle-tie');
    expect(mapKeyEvent({ code: 'KeyT' }, 'position')).toBe('toggle-tie');
    expect(mapKeyEvent({ code: 'KeyT' }, 'input')).toBe('toggle-tie');

    // Natural reset: KeyX in select, position, and input modes
    expect(mapKeyEvent({ code: 'KeyX' }, 'select')).toBe('reset-accidental');
    expect(mapKeyEvent({ code: 'KeyX' }, 'position')).toBe('reset-accidental');
    expect(mapKeyEvent({ code: 'KeyX' }, 'input')).toBe('reset-accidental');

    // Dynamics Shift+Digit1..8 across select, position, and input modes
    const expectedDynamics = [
      { code: 'Digit1', dyn: 'pp' },
      { code: 'Digit2', dyn: 'p' },
      { code: 'Digit3', dyn: 'mp' },
      { code: 'Digit4', dyn: 'mf' },
      { code: 'Digit5', dyn: 'f' },
      { code: 'Digit6', dyn: 'ff' },
      { code: 'Digit7', dyn: 'sfz' },
      { code: 'Digit8', dyn: 'fp' },
    ];
    for (const { code, dyn } of expectedDynamics) {
      for (const m of ['select', 'position', 'input'] as EditorMode[]) {
        expect(mapKeyEvent({ code, shiftKey: true }, m)).toEqual({
          type: 'apply-dynamic',
          dynamic: dyn,
        });
      }
    }

    // Articulations: KeyJ (staccato), KeyK (tenuto), KeyL (accent), Shift+KeyL (marcato)
    for (const m of ['select', 'position', 'input'] as EditorMode[]) {
      expect(mapKeyEvent({ code: 'KeyJ' }, m)).toEqual({
        type: 'toggle-articulation',
        articulation: 'staccato',
      });
      expect(mapKeyEvent({ code: 'KeyK' }, m)).toEqual({
        type: 'toggle-articulation',
        articulation: 'tenuto',
      });
      expect(mapKeyEvent({ code: 'KeyL' }, m)).toEqual({
        type: 'toggle-articulation',
        articulation: 'accent',
      });
      expect(mapKeyEvent({ code: 'KeyL', shiftKey: true }, m)).toEqual({
        type: 'toggle-articulation',
        articulation: 'marcato',
      });
    }
  });

  it('maps M6a editing keys: select-all, copy, cut, paste, insert-measure, accidentals (Delete never deletes measures)', () => {
    expect(mapKeyEvent({ code: 'KeyA', ctrlKey: true }, 'select')).toBe('select-all');
    expect(mapKeyEvent({ code: 'KeyC', ctrlKey: true }, 'select')).toBe('copy');
    expect(mapKeyEvent({ code: 'KeyX', ctrlKey: true }, 'select')).toBe('cut');
    expect(mapKeyEvent({ code: 'KeyV', ctrlKey: true }, 'select')).toBe('paste');
    expect(mapKeyEvent({ code: 'KeyB', ctrlKey: true }, 'select')).toBe('insert-measure');
    // Ctrl+Delete never deletes measures
    expect(mapKeyEvent({ code: 'Delete', ctrlKey: true }, 'select')).toBeNull();
    expect(mapKeyEvent({ code: 'Backspace', ctrlKey: true }, 'select')).toBeNull();

    expect(mapKeyEvent({ code: 'ArrowLeft', shiftKey: true }, 'select')).toBe('extend-selection-prev');
    expect(mapKeyEvent({ code: 'ArrowRight', shiftKey: true }, 'select')).toBe('extend-selection-next');
    expect(mapKeyEvent({ code: 'ArrowUp', shiftKey: true }, 'select')).toBe('cycle-accidental-up');
    expect(mapKeyEvent({ code: 'ArrowDown', shiftKey: true }, 'select')).toBe('cycle-accidental-down');
  });

  it('shows helpful legacy punctuation hints when pressing >, ^, or -', () => {
    expect(mapKeyEvent({ code: 'Period', shiftKey: true, key: '>' }, 'select')).toEqual({
      type: 'legacy-key-hint',
      hintKey: 'accent',
    });
    expect(mapKeyEvent({ code: 'IntlBackslash', key: '>' }, 'select')).toEqual({
      type: 'legacy-key-hint',
      hintKey: 'accent',
    });
    expect(mapKeyEvent({ code: 'BracketRight', key: '^' }, 'select')).toEqual({
      type: 'legacy-key-hint',
      hintKey: 'marcato',
    });
    expect(mapKeyEvent({ code: 'Minus', key: '-' }, 'select')).toEqual({
      type: 'legacy-key-hint',
      hintKey: 'tenuto',
    });
  });

  it('FAILS if there is any duplicate shortcut (code + modifiers + mode)', () => {
    const table = getCompleteKeyTable();
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const entry of table) {
      const modesToCheck: EditorMode[] =
        entry.mode === 'all' ? ['select', 'input', 'position'] : [entry.mode];

      for (const m of modesToCheck) {
        const id = `${entry.code}|${entry.modifiers}|${m}`;
        if (seen.has(id)) {
          duplicates.push(`Duplicate shortcut detected: ${id} -> ${entry.action}`);
        } else {
          seen.add(id);
        }
      }
    }

    expect(duplicates).toEqual([]);
  });

  it('simulates identical event.code with different event.key values (Turkish Q, US) and expects identical action', () => {
    // Turkish Q vs US keyboard variations:
    // On Turkish Q: Shift+Digit3 might produce '^' or '#' depending on layout;
    // but code is strictly 'Digit3'.
    const testCases: Array<{ event1: KeyEventLike; event2: KeyEventLike; mode: EditorMode }> = [
      {
        event1: { code: 'Digit3', shiftKey: true, key: '#' }, // US layout
        event2: { code: 'Digit3', shiftKey: true, key: '^' }, // Turkish layout
        mode: 'select',
      },
      {
        event1: { code: 'Digit6', shiftKey: true, key: '^' }, // US layout
        event2: { code: 'Digit6', shiftKey: true, key: '&' }, // Turkish layout
        mode: 'select',
      },
      {
        event1: { code: 'KeyJ', key: 'j' },
        event2: { code: 'KeyJ', key: 'ı' }, // Alt layout
        mode: 'select',
      },
      {
        event1: { code: 'KeyL', shiftKey: true, key: 'L' },
        event2: { code: 'KeyL', shiftKey: true, key: 'l' },
        mode: 'select',
      },
      {
        event1: { code: 'KeyS', key: 's' },
        event2: { code: 'KeyS', key: 'ş' },
        mode: 'select',
      },
    ];

    for (const tc of testCases) {
      const res1 = mapKeyEvent(tc.event1, tc.mode);
      const res2 = mapKeyEvent(tc.event2, tc.mode);
      expect(res1).not.toBeNull();
      expect(res1).toEqual(res2);
    }
  });

  it('uses getKeycapLabel with fallback and navigator.keyboard layout map', async () => {
    const { getKeycapLabel, initKeyboardLayoutMap } = await import('../../src/ui/keymap');

    // Default fallback when layout map is not loaded
    expect(getKeycapLabel('KeyC')).toBe('C');
    expect(getKeycapLabel('Digit5')).toBe('5');
    expect(getKeycapLabel('Period', '.')).toBe('.');

    // Mock navigator.keyboard.getLayoutMap
    const mockMap = new Map<string, string>([
      ['KeyQ', 'a'], // French AZERTY layout: KeyQ produces 'A'
      ['KeyW', 'z'],
    ]);

    const originalNavigator = globalThis.navigator;
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          keyboard: {
            getLayoutMap: async () => mockMap,
          },
        },
        configurable: true,
        writable: true,
      });

      await initKeyboardLayoutMap();
      expect(getKeycapLabel('KeyQ')).toBe('A');
      expect(getKeycapLabel('KeyW')).toBe('Z');
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    }
  });

  it('U2b: Ctrl+Home/End and Ctrl+Left/Right navigate the score in input mode only', () => {
    expect(mapKeyEvent({ code: 'Home', ctrlKey: true }, 'input')).toBe('cursor-score-start');
    expect(mapKeyEvent({ code: 'End', ctrlKey: true }, 'input')).toBe('cursor-score-end');
    expect(mapKeyEvent({ code: 'ArrowLeft', ctrlKey: true }, 'input')).toBe('cursor-prev-measure');
    expect(mapKeyEvent({ code: 'ArrowRight', ctrlKey: true }, 'input')).toBe('cursor-next-measure');
    // Plain Home/End keep their measure-level meaning
    expect(mapKeyEvent({ code: 'Home' }, 'input')).toBe('cursor-measure-start');
    expect(mapKeyEvent({ code: 'End' }, 'input')).toBe('cursor-measure-end');
    // Not active outside input mode
    for (const mode of ['select', 'position', 'lyrics'] as EditorMode[]) {
      expect(mapKeyEvent({ code: 'Home', ctrlKey: true }, mode)).not.toBe('cursor-score-start');
      expect(mapKeyEvent({ code: 'ArrowRight', ctrlKey: true }, mode)).not.toBe('cursor-next-measure');
    }
  });
});
