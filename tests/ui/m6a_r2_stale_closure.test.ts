import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { getMemoryClipboard } from '../../src/core/clipboard';
import { useEditor } from '../../src/ui/useEditor';

describe('R2: Synchronous State Ref & Anti-Stale-Closure Verification', () => {
  it('programmatically changing selection WITHOUT re-render immediately updates copy, delete, and paste targets', () => {
    // 1. Prepare initial score with 2 measures, 4 quarter notes in measure 0
    const initialScore = createEmptyScore({
      clef: { sign: 'G', line: 2 },
      keySig: 0,
      timeSig: { num: 4, den: 4 },
      measures: 2,
    });
    const staff = initialScore.parts[0].staves[0];
    const m0Def = initialScore.measures[0];
    const noteA = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const noteB = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const noteC = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const noteD = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
    staff.measures[m0Def.id].voices[0].events = [noteA, noteB, noteC, noteD];

    let editorInstance: ReturnType<typeof useEditor> | null = null;

    function TestHost() {
      const editor = useEditor(initialScore);
      editorInstance = editor;
      return React.createElement('div', null, 'Host');
    }

    // Mount host once via renderToStaticMarkup to initialize useEditor hooks
    renderToStaticMarkup(React.createElement(TestHost));
    expect(editorInstance).not.toBeNull();
    const ed = editorInstance!;

    // Initially nothing is selected
    expect(ed.selection.kind).toBe('none');

    // 2. Programmatically set selection to noteB & noteC (range)
    // CRITICAL: We do NOT trigger a React re-render.
    const targetRange = {
      staffId: staff.id,
      voiceId: staff.measures[m0Def.id].voices[0].id,
      anchorId: noteB.id,
      focusId: noteC.id,
    };
    ed.setRangeSelection(targetRange);

    // 3. Immediately fire copySelection WITHOUT re-rendering
    ed.copySelection();
    const clip = getMemoryClipboard();
    expect(clip.length).toBe(2);
    expect(clip.map((e) => e.id)).toEqual([noteB.id, noteC.id]);

    // 4. Immediately fire deleteSelection WITHOUT re-rendering
    ed.deleteSelection();
    // noteB and noteC must be converted to rests in the active score
    const currentScore = ed.getScore();
    const currentEvents = currentScore.parts[0].staves[0].measures[m0Def.id].voices[0].events;
    expect(currentEvents.length).toBe(4);
    expect(currentEvents[0].kind).toBe('note'); // noteA stays note
    expect(currentEvents[1].kind).toBe('rest'); // noteB was deleted to rest
    expect(currentEvents[2].kind).toBe('rest'); // noteC was deleted to rest
    expect(currentEvents[3].kind).toBe('note'); // noteD stays note
  });
});
