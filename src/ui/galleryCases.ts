/**
 * ScoreForge Regression Gallery Cases.
 *
 * Each case represents a distinct notation feature, built exclusively through
 * public score commands.
 */

import { createEmptyScore, createNote, createPitch } from '../core/factory';
import { Score } from '../core/model';
import {
  toggleTie,
  toggleSlur,
  setDynamic,
  toggleArticulation,
  setScoreMetadata,
  setTempo,
  setKeySignature,
  setTimeSignature,
  setPickup,
  setEndBarline,
  setRepeatStart,
  setRepeatEnd,
  setVolta,
  setLyrics,
} from '../core/commands';
import {
  setMeasureEventsViaCommands,
  qNote,
  hNote,
  wNote,
  note,
  rest,
} from './galleryBuilders';

export interface GalleryCase {
  id: string;
  title: string;
  description: string;
  pending?: boolean;
  build: () => Score;
}

export function getGalleryCases(): GalleryCase[] {
  return [
    {
      id: 'note-values-and-dots',
      title: '1. Note Values & Augmentation Dots',
      description: 'Whole, half, quarter, 8th, 16th, 32nd notes with single and double dots.',
      build: () => {
        let score = createEmptyScore({ title: '1. Note Values & Dots', measures: 3 });
        score = setMeasureEventsViaCommands(score, 0, [wNote('C', 4)]);
        score = setMeasureEventsViaCommands(score, 1, [hNote('D', 4, 1), qNote('E', 4)]);
        score = setMeasureEventsViaCommands(score, 2, [
          note('F', 4, 'quarter', 2),
          note('G', 4, '16th'),
          note('A', 4, 'eighth'),
          note('B', 4, '32nd'),
          note('C', 5, '32nd'),
          note('D', 5, '16th'),
          qNote('E', 5),
        ]);
        return score;
      },
    },
    {
      id: 'rests-all-values',
      title: '2. Rests of All Values',
      description: 'Whole, half, dotted half, quarter, dotted quarter, 8th, 16th, 32nd rests.',
      build: () => {
        let score = createEmptyScore({ title: '2. Rests of All Values', measures: 3 });
        score = setMeasureEventsViaCommands(score, 0, [rest('whole')]);
        score = setMeasureEventsViaCommands(score, 1, [rest('half', 1), rest('quarter')]);
        score = setMeasureEventsViaCommands(score, 2, [
          rest('quarter', 1),
          rest('eighth'),
          rest('quarter'),
          rest('16th'),
          rest('32nd'),
          rest('32nd'),
          rest('eighth'),
        ]);
        return score;
      },
    },
    {
      id: 'accidentals-and-chords',
      title: '3. Accidentals & Chords with Same Step',
      description: 'Sharps, flats, naturals, courtesy rules, and split-step chords.',
      build: () => {
        let score = createEmptyScore({ title: '3. Accidentals & Chords', measures: 2 });
        score = setMeasureEventsViaCommands(score, 0, [
          qNote('F', 4, 1),
          qNote('F', 4, 1),
          qNote('F', 4, 0),
          qNote('F', 4, 1),
        ]);
        score = setMeasureEventsViaCommands(score, 1, [
          createNote({ pitches: [createPitch('C', 4, 0), createPitch('D', 4, 0), createPitch('G', 4, 0)], baseType: 'half' }),
          createNote({ pitches: [createPitch('F', 4, 0), createPitch('F', 4, 1)], baseType: 'half' }),
        ]);
        return score;
      },
    },
    {
      id: 'beams-all-cases',
      title: '4. Metrical Beams & Fractional Stubs',
      description: 'Primary beams, 16th fractional beams, beams over rests, and 6/8 meter.',
      build: () => {
        let score = createEmptyScore({ title: '4. Beams All Cases', measures: 3 });
        score = setMeasureEventsViaCommands(score, 0, [
          note('C', 4, '16th'), note('D', 4, '16th'), note('E', 4, '16th'), note('F', 4, '16th'),
          note('G', 4, 'eighth'), note('A', 4, 'eighth'), qNote('B', 4), qNote('C', 5),
        ]);
        score = setMeasureEventsViaCommands(score, 1, [
          note('C', 5, 'eighth'), note('B', 4, '16th'), note('A', 4, '16th'),
          rest('eighth'), note('G', 4, 'eighth'), qNote('E', 4), rest('quarter'),
        ]);
        score = setTimeSignature(score.measures[2].id, { num: 6, den: 8 }).apply(score);
        score = setMeasureEventsViaCommands(score, 2, [
          note('A', 4, 'eighth'), note('B', 4, 'eighth'), note('C', 5, 'eighth'),
          note('D', 5, 'eighth'), note('C', 5, 'eighth'), note('B', 4, 'eighth'),
        ]);
        return score;
      },
    },
    {
      id: 'ties-same-system',
      title: '5. Ties on the Same System',
      description: 'Pitches tied within the same measure.',
      build: () => {
        let score = createEmptyScore({ title: '5. Ties Same System', measures: 1 });
        const n1 = hNote('G', 4);
        const n2 = hNote('G', 4);
        score = setMeasureEventsViaCommands(score, 0, [n1, n2]);
        score = toggleTie(n1.id, 0).apply(score);
        return score;
      },
    },
    {
      id: 'ties-across-barline',
      title: '6. Ties Across Barline',
      description: 'Pitches tied across a measure boundary on the same system.',
      build: () => {
        let score = createEmptyScore({ title: '6. Ties Across Barline', measures: 2 });
        const n1 = wNote('C', 5);
        const n2 = wNote('C', 5);
        score = setMeasureEventsViaCommands(score, 0, [n1]);
        score = setMeasureEventsViaCommands(score, 1, [n2]);
        score = toggleTie(n1.id, 0).apply(score);
        return score;
      },
    },
    {
      id: 'ties-across-system-break',
      title: '7. Ties Across System Break',
      description: 'Tie split into two half-ties across a system line break.',
      build: () => {
        let score = createEmptyScore({ title: '7. Ties Across System Break', measures: 4 });
        const n1 = wNote('E', 4);
        const n2 = wNote('E', 4);
        score = setMeasureEventsViaCommands(score, 0, [wNote('C', 4)]);
        score = setMeasureEventsViaCommands(score, 1, [n1]);
        score = setMeasureEventsViaCommands(score, 2, [n2]);
        score = setMeasureEventsViaCommands(score, 3, [wNote('G', 4)]);
        score = toggleTie(n1.id, 0).apply(score);
        return score;
      },
    },
    {
      id: 'slurs-stem-up',
      title: '8. Slurs over Stem-Up Notes',
      description: 'Legato slur positioned below noteheads on stem-up notes.',
      build: () => {
        let score = createEmptyScore({ title: '8. Slurs Stem Up', measures: 1 });
        const n1 = qNote('C', 4);
        const n2 = qNote('D', 4);
        const n3 = qNote('E', 4);
        const n4 = qNote('F', 4);
        score = setMeasureEventsViaCommands(score, 0, [n1, n2, n3, n4]);
        const staff = score.parts[0].staves[0];
        score = toggleSlur({
          kind: 'range',
          staffId: staff.id,
          voiceId: staff.measures[score.measures[0].id].voices[0].id,
          anchorId: n1.id,
          focusId: n4.id,
        }).apply(score);
        return score;
      },
    },
    {
      id: 'slurs-stem-down',
      title: '9. Slurs over Stem-Down Notes',
      description: 'Legato slur positioned above noteheads on stem-down notes.',
      build: () => {
        let score = createEmptyScore({ title: '9. Slurs Stem Down', measures: 1 });
        const n1 = qNote('C', 5);
        const n2 = qNote('D', 5);
        const n3 = qNote('E', 5);
        const n4 = qNote('C', 5);
        score = setMeasureEventsViaCommands(score, 0, [n1, n2, n3, n4]);
        const staff = score.parts[0].staves[0];
        score = toggleSlur({
          kind: 'range',
          staffId: staff.id,
          voiceId: staff.measures[score.measures[0].id].voices[0].id,
          anchorId: n1.id,
          focusId: n4.id,
        }).apply(score);
        return score;
      },
    },
    {
      id: 'slurs-long-multi-measure',
      title: '10. Long Multi-Measure Slurs',
      description: 'Slur spanning multiple measures and barlines.',
      build: () => {
        let score = createEmptyScore({ title: '10. Long Slur', measures: 3 });
        const n1 = hNote('C', 4);
        const n2 = hNote('E', 4);
        const n3 = hNote('G', 4);
        const n4 = hNote('B', 4);
        const n5 = wNote('C', 5);
        score = setMeasureEventsViaCommands(score, 0, [n1, n2]);
        score = setMeasureEventsViaCommands(score, 1, [n3, n4]);
        score = setMeasureEventsViaCommands(score, 2, [n5]);
        const staff = score.parts[0].staves[0];
        score = toggleSlur({
          kind: 'range',
          staffId: staff.id,
          voiceId: staff.measures[score.measures[0].id].voices[0].id,
          anchorId: n1.id,
          focusId: n5.id,
        }).apply(score);
        return score;
      },
    },
    {
      id: 'slurs-cross-system',
      title: '11. Slurs Across System Break',
      description: 'Slur split into two half-slurs across a system line break.',
      build: () => {
        let score = createEmptyScore({ title: '11. Cross-System Slur', measures: 4 });
        const n1 = wNote('D', 4);
        const n2 = wNote('A', 4);
        score = setMeasureEventsViaCommands(score, 0, [wNote('C', 4)]);
        score = setMeasureEventsViaCommands(score, 1, [n1]);
        score = setMeasureEventsViaCommands(score, 2, [n2]);
        score = setMeasureEventsViaCommands(score, 3, [wNote('C', 5)]);
        const staff = score.parts[0].staves[0];
        score = toggleSlur({
          kind: 'range',
          staffId: staff.id,
          voiceId: staff.measures[score.measures[0].id].voices[0].id,
          anchorId: n1.id,
          focusId: n2.id,
        }).apply(score);
        return score;
      },
    },
    {
      id: 'dynamics-range',
      title: '12. Dynamics Palette',
      description: 'pp, p, mp, mf, f, ff, sfz, fp markings below staff.',
      build: () => {
        let score = createEmptyScore({ title: '12. Dynamics Palette', measures: 2 });
        const notes = [
          qNote('C', 4), qNote('D', 4), qNote('E', 4), qNote('F', 4),
          qNote('G', 4), qNote('A', 4), qNote('B', 4), qNote('C', 5),
        ];
        score = setMeasureEventsViaCommands(score, 0, notes.slice(0, 4));
        score = setMeasureEventsViaCommands(score, 1, notes.slice(4, 8));
        const dyns = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp'];
        for (let i = 0; i < 8; i++) {
          score = setDynamic(notes[i].id, dyns[i]).apply(score);
        }
        return score;
      },
    },
    {
      id: 'articulations-stem-up',
      title: '13. Articulations on Stem-Up Notes',
      description: 'Staccato, tenuto, accent, marcato on notes with stems pointing up.',
      build: () => {
        let score = createEmptyScore({ title: '13. Articulations Stem Up', measures: 1 });
        const n1 = qNote('C', 4);
        const n2 = qNote('D', 4);
        const n3 = qNote('E', 4);
        const n4 = qNote('F', 4);
        score = setMeasureEventsViaCommands(score, 0, [n1, n2, n3, n4]);
        score = toggleArticulation(n1.id, 'staccato').apply(score);
        score = toggleArticulation(n2.id, 'tenuto').apply(score);
        score = toggleArticulation(n3.id, 'accent').apply(score);
        score = toggleArticulation(n4.id, 'marcato').apply(score);
        return score;
      },
    },
    {
      id: 'articulations-stem-down',
      title: '14. Articulations on Stem-Down Notes',
      description: 'Staccato, tenuto, accent, marcato on notes with stems pointing down.',
      build: () => {
        let score = createEmptyScore({ title: '14. Articulations Stem Down', measures: 1 });
        const n1 = qNote('A', 4);
        const n2 = qNote('B', 4);
        const n3 = qNote('C', 5);
        const n4 = qNote('D', 5);
        score = setMeasureEventsViaCommands(score, 0, [n1, n2, n3, n4]);
        score = toggleArticulation(n1.id, 'staccato').apply(score);
        score = toggleArticulation(n2.id, 'tenuto').apply(score);
        score = toggleArticulation(n3.id, 'accent').apply(score);
        score = toggleArticulation(n4.id, 'marcato').apply(score);
        return score;
      },
    },
    {
      id: 'key-change-with-naturals',
      title: '15. Mid-Score Key Change with Cancellation Naturals',
      description: 'Transition from 3 sharps (A major) to 1 flat (F major) showing cancellation naturals.',
      build: () => {
        let score = createEmptyScore({ title: '15. Key Change with Naturals', keySig: 3, measures: 2 });
        score = setKeySignature(score.measures[1].id, -1).apply(score);
        score = setMeasureEventsViaCommands(score, 0, [wNote('A', 4)]);
        score = setMeasureEventsViaCommands(score, 1, [wNote('F', 4)]);
        return score;
      },
    },
    {
      id: 'time-signature-changes',
      title: '16. Mid-Score Time Signature Changes',
      description: 'Transitions from 4/4 to 3/4 to 6/8 across consecutive measures.',
      build: () => {
        let score = createEmptyScore({ title: '16. Time Signature Changes', measures: 3 });
        score = setTimeSignature(score.measures[1].id, { num: 3, den: 4 }).apply(score);
        score = setTimeSignature(score.measures[2].id, { num: 6, den: 8 }).apply(score);
        score = setMeasureEventsViaCommands(score, 0, [wNote('C', 4)]);
        score = setMeasureEventsViaCommands(score, 1, [hNote('D', 4, 1)]);
        score = setMeasureEventsViaCommands(score, 2, [hNote('E', 4, 1)]);
        return score;
      },
    },
    {
      id: 'pickup-measure',
      title: '17. Pickup Measure (Anacrusis)',
      description: 'Unnumbered measure 0 with fractional beat duration (actualTicks).',
      build: () => {
        let score = createEmptyScore({ title: '17. Pickup Measure', measures: 2 });
        score = setPickup(score.measures[0].id, 960).apply(score);
        score = setMeasureEventsViaCommands(score, 0, [qNote('G', 4)]);
        score = setMeasureEventsViaCommands(score, 1, [wNote('C', 5)]);
        return score;
      },
    },
    {
      id: 'barlines-double-and-final',
      title: '18. Sectional Barlines: Double & Final',
      description: 'Standard single, sectional double, and final piece barlines.',
      build: () => {
        let score = createEmptyScore({ title: '18. Barlines', measures: 3 });
        score = setEndBarline(score.measures[0].id, 'single').apply(score);
        score = setEndBarline(score.measures[1].id, 'double').apply(score);
        score = setEndBarline(score.measures[2].id, 'final').apply(score);
        score = setMeasureEventsViaCommands(score, 0, [wNote('C', 4)]);
        score = setMeasureEventsViaCommands(score, 1, [wNote('D', 4)]);
        score = setMeasureEventsViaCommands(score, 2, [wNote('E', 4)]);
        return score;
      },
    },
    {
      id: 'repeats-start-and-end',
      title: '19. Repeat Signs: Start, End & Combined',
      description: 'Start repeat (|:), end repeat (:|), and combined back-to-back (:|:).',
      build: () => {
        let score = createEmptyScore({ title: '19. Repeats', measures: 3 });
        score = setRepeatStart(score.measures[0].id, true).apply(score);
        score = setRepeatEnd(score.measures[1].id, true).apply(score);
        score = setRepeatStart(score.measures[2].id, true).apply(score);
        score = setRepeatEnd(score.measures[2].id, true).apply(score);
        score = setMeasureEventsViaCommands(score, 0, [wNote('C', 4)]);
        score = setMeasureEventsViaCommands(score, 1, [wNote('D', 4)]);
        score = setMeasureEventsViaCommands(score, 2, [wNote('E', 4)]);
        return score;
      },
    },
    {
      id: 'voltas-open-and-closed-hooks',
      title: '20. Volta 1st & 2nd Endings (Open Right Hook Rule)',
      description: '1st ending with closing downward hook; 2nd ending with open right edge.',
      build: () => {
        let score = createEmptyScore({ title: '20. Voltas', measures: 3 });
        score = setRepeatStart(score.measures[0].id, true).apply(score);
        score = setRepeatEnd(score.measures[1].id, true).apply(score);
        score = setVolta(score.measures[1].id, { number: 1 }).apply(score);
        score = setVolta(score.measures[2].id, { number: 2 }).apply(score);
        score = setMeasureEventsViaCommands(score, 0, [wNote('C', 4)]);
        score = setMeasureEventsViaCommands(score, 1, [wNote('D', 4)]);
        score = setMeasureEventsViaCommands(score, 2, [wNote('E', 4)]);
        return score;
      },
    },
    {
      id: 'lyrics-hyphens-and-extenders',
      title: '21. Lyrics: Syllable Hyphens & Melisma Extenders',
      description: 'Multi-syllable word hyphens and melisma underline extenders.',
      build: () => {
        let score = createEmptyScore({ title: '21. Lyrics', measures: 2 });
        const n1 = qNote('C', 4);
        const n2 = qNote('D', 4);
        const n3 = hNote('E', 4);
        const n4 = wNote('F', 4);
        score = setMeasureEventsViaCommands(score, 0, [n1, n2, n3]);
        score = setMeasureEventsViaCommands(score, 1, [n4]);
        score = setLyrics(n1.id, 'Süt', 1).apply(score);
        score = setLyrics(n2.id, 'iç-', 1).apply(score);
        score = setLyrics(n3.id, 'tim_', 1).apply(score);
        return score;
      },
    },
    {
      id: 'header-four-fields',
      title: '22. Header Block: Title, Subtitle, Composer, Arranger',
      description: 'Complete four-field header block reserving full measured clearance.',
      build: () => {
        let score = createEmptyScore({ measures: 2 });
        score = setScoreMetadata({
          title: 'Süt İçtim Dilim Yandı',
          subtitle: 'Kayseri Türküsü',
          composer: 'Anonim',
          arranger: 'TRT Repertuarı',
        }).apply(score);
        score = setMeasureEventsViaCommands(score, 0, [wNote('G', 4)]);
        score = setMeasureEventsViaCommands(score, 1, [wNote('C', 5)]);
        return score;
      },
    },
    {
      id: 'tempo-markings',
      title: '23. Tempo Marking with Text Prefix & SMuFL Note',
      description: 'Prefix text "Allegro vivace", quarter-note glyph, and BPM " = 120".',
      build: () => {
        let score = createEmptyScore({ title: '23. Tempo Markings', measures: 2 });
        score = setTempo(score.measures[0].id, { bpm: 120, beatUnit: 1, tempoText: 'Allegro vivace' }).apply(score);
        score = setMeasureEventsViaCommands(score, 0, [wNote('C', 4)]);
        score = setMeasureEventsViaCommands(score, 1, [wNote('E', 4)]);
        return score;
      },
    },
    {
      id: 'bass-clef',
      title: '24. Bass Clef (F Clef) Scoring',
      description: 'Bass clef positioned on line 4 with low and high notes.',
      build: () => {
        let score = createEmptyScore({
          title: '24. Bass Clef',
          clef: { sign: 'F', line: 4 },
          measures: 2,
        });
        score = setMeasureEventsViaCommands(score, 0, [
          qNote('C', 2), qNote('E', 2), qNote('G', 2), qNote('C', 3),
        ]);
        score = setMeasureEventsViaCommands(score, 1, [hNote('D', 3), hNote('C', 4)]);
        return score;
      },
    },
    {
      id: 'wrapping-three-widths',
      title: '25. Measure Wrapping Across Widths',
      description: '8-measure piece demonstrating responsive line-breaking.',
      build: () => {
        let score = createEmptyScore({ title: '25. Wrapping at 3 Widths', measures: 8 });
        for (let m = 0; m < 8; m++) {
          score = setMeasureEventsViaCommands(score, m, [
            qNote('C', 4), qNote('E', 4), qNote('G', 4), qNote('C', 5),
          ]);
        }
        return score;
      },
    },
    {
      id: 'multi-voice',
      title: '26. Multi-Voice Polyphony (Pending M7a)',
      description: 'Two independent voices on a single staff (deferred to Milestone 7a).',
      pending: true,
      build: () => {
        let score = createEmptyScore({ title: 'Multi-Voice (Pending M7a)', measures: 2 });
        score = setMeasureEventsViaCommands(score, 0, [
          qNote('E', 5), qNote('F', 5), qNote('G', 5), qNote('A', 5),
        ]);
        score = setMeasureEventsViaCommands(score, 1, [hNote('G', 5), hNote('E', 5)]);
        return score;
      },
    },
  ];
}
