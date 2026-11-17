import { describe, expect, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { autoSolfege, History, setLyrics } from '../../src/core/commands';

describe('Milestone 6d: Lyrics & Solfege Commands (setLyrics, autoSolfege)', () => {
  it('FAILING-FIRST: setLyrics sets lyric syllable on a note and undo/redo works cleanly', () => {
    const score = createEmptyScore({ numMeasures: 2 });
    const m0Id = score.measures[0].id;
    const note = createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' });
    score.parts[0].staves[0].measures[m0Id].voices[0].events = [note];

    const history = new History(score);
    const cmd = setLyrics(note.id, 'Süt-');
    const updated = history.do(cmd);
    const updatedNote = updated.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    expect(updatedNote.kind === 'note' ? updatedNote.lyrics : undefined).toBe('Süt-');

    // Undo reverts back to undefined
    const undone = history.undo()!;
    const undoneNote = undone.parts[0].staves[0].measures[m0Id].voices[0].events[0];
    expect(undoneNote.kind === 'note' ? undoneNote.lyrics : undefined).toBeUndefined();
  });

  it('autoSolfege assigns Turkish solfege syllables (Do, Re, Mi, Fa, Sol, La, Si) to notes based on pitch step', () => {
    const score = createEmptyScore({ numMeasures: 2 });
    const m0Id = score.measures[0].id;
    const voice = score.parts[0].staves[0].measures[m0Id].voices[0];

    voice.events = [
      createNote({ pitches: [createPitch('C', 4, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('D', 4, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('E', 4, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'quarter' }),
    ];

    const cmd = autoSolfege(score.id);
    const updated = cmd.apply(score);
    const evs = updated.parts[0].staves[0].measures[m0Id].voices[0].events;

    expect(evs[0].kind === 'note' ? evs[0].lyrics : undefined).toBe('Do');
    expect(evs[1].kind === 'note' ? evs[1].lyrics : undefined).toBe('Re');
    expect(evs[2].kind === 'note' ? evs[2].lyrics : undefined).toBe('Mi');
    expect(evs[3].kind === 'note' ? evs[3].lyrics : undefined).toBe('Fa');
  });

  it('autoSolfege assigns Sol, La, Si for G, A, B', () => {
    const score = createEmptyScore({ numMeasures: 2 });
    const m0Id = score.measures[0].id;
    const voice = score.parts[0].staves[0].measures[m0Id].voices[0];

    voice.events = [
      createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('A', 4, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('B', 4, 0)], baseType: 'quarter' }),
      createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'quarter' }),
    ];

    const updated = autoSolfege(score.id).apply(score);
    const evs = updated.parts[0].staves[0].measures[m0Id].voices[0].events;

    expect(evs[0].kind === 'note' ? evs[0].lyrics : undefined).toBe('Sol');
    expect(evs[1].kind === 'note' ? evs[1].lyrics : undefined).toBe('La');
    expect(evs[2].kind === 'note' ? evs[2].lyrics : undefined).toBe('Si');
    expect(evs[3].kind === 'note' ? evs[3].lyrics : undefined).toBe('Do');
  });
});
