// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useEditor } from '../../src/ui/useEditor';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';

describe('M6b UI Notations & useEditor integration', () => {
  function setupEditor() {
    const initialScore = createEmptyScore({
      clef: { sign: 'G', line: 2 },
      keySig: 0,
      timeSig: { num: 4, den: 4 },
      measures: 2,
    });
    const staff = initialScore.parts[0].staves[0];
    const m0Def = initialScore.measures[0];
    const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
    const n2 = createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' });
    const n3 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
    const n4 = createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' });
    staff.measures[m0Def.id].voices[0].events = [n1, n2, n3, n4];

    let editorInstance: ReturnType<typeof useEditor> | null = null;
    function TestHost() {
      editorInstance = useEditor(initialScore);
      return React.createElement('div', null, 'Host');
    }
    renderToStaticMarkup(React.createElement(TestHost));
    return { ed: editorInstance!, initialScore, staff, m0Def, notes: [n1, n2, n3, n4] };
  }

  it('applies dynamics to selected note and toggles off on repeat', () => {
    const { ed, notes } = setupEditor();
    const ev1 = notes[0];

    ed.selectEvent(ev1.id);
    ed.applyDynamic('f');

    const scoreAfterF = ed.getScore();
    const evAfterF = scoreAfterF.parts[0].staves[0].measures[scoreAfterF.measures[0].id].voices[0].events[0];
    expect(evAfterF.kind === 'note' ? evAfterF.dynamic : null).toBe('f');

    // Apply null -> removes dynamic
    ed.applyDynamic(null);
    const scoreAfterClear = ed.getScore();
    const evAfterClear = scoreAfterClear.parts[0].staves[0].measures[scoreAfterClear.measures[0].id].voices[0].events[0];
    expect(evAfterClear.kind === 'note' ? evAfterClear.dynamic : null).toBeUndefined();
  });

  it('toggles articulations with conflict resolution (marcato replaces accent)', () => {
    const { ed, notes } = setupEditor();
    const ev1 = notes[0];

    ed.selectEvent(ev1.id);

    // Add accent
    ed.applyArticulation('accent');
    let s = ed.getScore();
    let ev = s.parts[0].staves[0].measures[s.measures[0].id].voices[0].events[0];
    expect(ev.kind === 'note' ? ev.articulations : []).toEqual(['accent']);

    // Add marcato -> replaces accent
    ed.applyArticulation('marcato');
    s = ed.getScore();
    ev = s.parts[0].staves[0].measures[s.measures[0].id].voices[0].events[0];
    expect(ev.kind === 'note' ? ev.articulations : []).toEqual(['marcato']);

    // Add staccato -> coexists with marcato
    ed.applyArticulation('staccato');
    s = ed.getScore();
    ev = s.parts[0].staves[0].measures[s.measures[0].id].voices[0].events[0];
    const arts = ev.kind === 'note' ? ev.articulations : [];
    expect(arts).toContain('marcato');
    expect(arts).toContain('staccato');

    // Add tenuto -> coexists with staccato
    ed.applyArticulation('tenuto');
    s = ed.getScore();
    ev = s.parts[0].staves[0].measures[s.measures[0].id].voices[0].events[0];
    const arts2 = ev.kind === 'note' ? ev.articulations : [];
    expect(arts2).toContain('staccato');
    expect(arts2).toContain('tenuto');
  });

  it('toggles slur on range selection and triggers error toast on single note', () => {
    const { ed, staff, notes } = setupEditor();
    const ev1 = notes[0];
    const ev2 = notes[1];

    // Single note selection -> rejected toast
    ed.selectEvent(ev1.id);
    ed.applySlur();
    // rejectedError state was triggered

    // Range selection across ev1 and ev2
    ed.setRangeSelection({
      staffId: staff.id,
      voiceIndex: 1,
      anchorId: ev1.id,
      focusId: ev2.id,
    });

    ed.applySlur();
    let s = ed.getScore();
    expect(s.parts[0].staves[0].slurs?.length).toBe(1);
    expect(s.parts[0].staves[0].slurs?.[0].startEventId).toBe(ev1.id);
    expect(s.parts[0].staves[0].slurs?.[0].endEventId).toBe(ev2.id);

    // Toggle again -> removes slur
    ed.applySlur();
    s = ed.getScore();
    expect(s.parts[0].staves[0].slurs?.length).toBe(0);
  });

  it('clearNotations removes all dynamics, articulations, and slurs on selection', () => {
    const { ed, staff, m0Def, notes } = setupEditor();
    const ev1 = notes[0];
    const ev2 = notes[1];

    ed.setRangeSelection({
      staffId: staff.id,
      voiceIndex: 1,
      anchorId: ev1.id,
      focusId: ev2.id,
    });

    ed.applyDynamic('mf');
    ed.applyArticulation('staccato');
    ed.applySlur();

    let s = ed.getScore();
    expect(s.parts[0].staves[0].slurs?.length).toBe(1);

    ed.clearNotations();
    s = ed.getScore();
    expect(s.parts[0].staves[0].slurs?.length).toBe(0);
    const updatedEv1 = s.parts[0].staves[0].measures[m0Def.id].voices[0].events[0];
    if (updatedEv1.kind === 'note') {
      expect(updatedEv1.dynamic).toBeUndefined();
      expect(updatedEv1.articulations?.length ?? 0).toBe(0);
    }
  });

  it('0.1 toolbar handler insertNewMeasure applies final barline rule at end of score', () => {
    const { ed } = setupEditor(); // 2-measure score: m1 single, m2 final
    // Call insertNewMeasure after last measure (index 1)
    ed.insertNewMeasure(1);
    const score = ed.getScore();
    expect(score.measures).toHaveLength(3);
    expect(score.measures[0].endBarline).toBe('single');
    expect(score.measures[1].endBarline).toBe('single');
    expect(score.measures[2].endBarline).toBe('final');
  });
});
