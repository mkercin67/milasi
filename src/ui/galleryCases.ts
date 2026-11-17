import {
  createEmptyScore,
  createNote,
  createPitch,
  createRest,
  newId,
} from '../core/factory';
import { Score } from '../core/model';
import {
  setDynamic,
  toggleArticulation,
  setScoreMetadata,
  setTimeSignature,
  setKeySignature,
  setEndBarline,
  setRepeatStart,
  setRepeatEnd,
  setVolta,
  setLyrics,
} from '../core/commands';

export interface GalleryCase {
  id: string;
  title: string;
  description: string;
  build: () => Score;
}

export function getGalleryCases(): GalleryCase[] {
  return [
    {
      id: 'basic-notes',
      title: 'A. Basic Notes & Durations',
      description: 'Whole, half, quarter, 8th, 16th notes and augmentation dots.',
      build: () => {
        const score = createEmptyScore({
          title: 'A. Basic Notes',
          clef: { sign: 'G', line: 2 },
          keySig: 0,
          timeSig: { num: 4, den: 4 },
          measures: 3,
        });
        const staff = score.parts[0].staves[0];
        const m1 = staff.measures[score.measures[0].id];
        const m2 = staff.measures[score.measures[1].id];
        const m3 = staff.measures[score.measures[2].id];

        // Measure 1: Whole note (1) + Half note (1) + Quarter note (1)
        m1.voices[0].events = [
          createNote({ pitches: [createPitch('C', 4)], baseType: 'whole' }),
        ];

        // Measure 2: Half, Quarter, 8th, 16th
        m2.voices[0].events = [
          createNote({ pitches: [createPitch('D', 4)], baseType: 'half', dots: 1 }), // Dotted half (3 beats)
          createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }), // Quarter (1 beat)
        ];

        // Measure 3: 8th and 16th notes with dots
        m3.voices[0].events = [
          createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter', dots: 1 }),
          createNote({ pitches: [createPitch('G', 4)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('A', 4)], baseType: '16th' }),
          createNote({ pitches: [createPitch('B', 4)], baseType: '16th' }),
          createNote({ pitches: [createPitch('C', 5)], baseType: 'eighth' }),
        ];

        return score;
      },
    },
    {
      id: 'accidental-rules',
      title: 'B. Accidental Rules & Naturals',
      description: 'Same-measure repeat, barline reset, natural cancellations.',
      build: () => {
        const score = createEmptyScore({
          title: 'B. Accidental Rules',
          clef: { sign: 'G', line: 2 },
          keySig: 0,
          timeSig: { num: 4, den: 4 },
          measures: 2,
        });
        const staff = score.parts[0].staves[0];
        const m1 = staff.measures[score.measures[0].id];
        const m2 = staff.measures[score.measures[1].id];

        // Measure 1: F#4, F#4 (courtesy/carried), F natural, F#4 again
        m1.voices[0].events = [
          createNote({ pitches: [createPitch('F', 4, 1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('F', 4, 1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('F', 4, 1)], baseType: 'quarter' }),
        ];

        // Measure 2: Barline reset -> F4 is natural without accidental, then G#4, G natural
        m2.voices[0].events = [
          createNote({ pitches: [createPitch('F', 4, 0)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('G', 4, 1)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('G', 4, 0)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'quarter' }),
        ];

        return score;
      },
    },
    {
      id: 'beam-groupings',
      title: 'C. Beam Groupings & Fractional Beams',
      description: 'Primary beams, 16th fractional beams, beams over rests, 6/8 compound beats.',
      build: () => {
        let score = createEmptyScore({
          title: 'C. Beam Groupings',
          clef: { sign: 'G', line: 2 },
          keySig: 0,
          timeSig: { num: 4, den: 4 },
          measures: 3,
        });
        const staff = score.parts[0].staves[0];
        const m1 = staff.measures[score.measures[0].id];
        const m2 = staff.measures[score.measures[1].id];
        const m3 = staff.measures[score.measures[2].id];

        // Measure 1: 4 sixteenths + 2 eighths
        m1.voices[0].events = [
          createNote({ pitches: [createPitch('C', 4)], baseType: '16th' }),
          createNote({ pitches: [createPitch('D', 4)], baseType: '16th' }),
          createNote({ pitches: [createPitch('E', 4)], baseType: '16th' }),
          createNote({ pitches: [createPitch('F', 4)], baseType: '16th' }),
          createNote({ pitches: [createPitch('G', 4)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('A', 4)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('B', 4)], baseType: 'quarter' }),
        ];

        // Measure 2: Eighth + 2 sixteenths + eighth rest + eighth note
        m2.voices[0].events = [
          createNote({ pitches: [createPitch('C', 5)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('B', 4)], baseType: '16th' }),
          createNote({ pitches: [createPitch('A', 4)], baseType: '16th' }),
          createRest({ baseType: 'eighth' }),
          createNote({ pitches: [createPitch('G', 4)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }),
        ];

        // Measure 3: 6/8 compound meter
        m3.voices[0].events = [
          createNote({ pitches: [createPitch('A', 4)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('B', 4)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('C', 5)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('D', 5)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('C', 5)], baseType: 'eighth' }),
          createNote({ pitches: [createPitch('B', 4)], baseType: 'eighth' }),
        ];
        score = setTimeSignature(score.measures[2].id, { num: 6, den: 8 }).apply(score);

        return score;
      },
    },
    {
      id: 'multi-voice',
      title: 'D. Multi-Voice Polyphony',
      description: 'Voice 1 stems up, Voice 2 stems down, shared measure space.',
      build: () => {
        const score = createEmptyScore({
          title: 'D. Multi-Voice',
          clef: { sign: 'G', line: 2 },
          keySig: 0,
          timeSig: { num: 4, den: 4 },
          measures: 2,
        });
        const staff = score.parts[0].staves[0];
        const m1 = staff.measures[score.measures[0].id];
        const m2 = staff.measures[score.measures[1].id];

        // Measure 1: Voice 1 (E5, F5, G5, A5)
        m1.voices[0].events = [
          createNote({ pitches: [createPitch('E', 5)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('F', 5)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('G', 5)], baseType: 'quarter' }),
          createNote({ pitches: [createPitch('A', 5)], baseType: 'quarter' }),
        ];

        // Measure 1: Voice 2 (C4, D4, E4, F4)
        m1.voices.push({
          id: newId(),
          events: [
            createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('F', 4)], baseType: 'quarter' }),
          ],
        });

        // Measure 2: Voice 1 half notes, Voice 2 quarter notes
        m2.voices[0].events = [
          createNote({ pitches: [createPitch('G', 5)], baseType: 'half' }),
          createNote({ pitches: [createPitch('E', 5)], baseType: 'half' }),
        ];
        m2.voices.push({
          id: newId(),
          events: [
            createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('D', 4)], baseType: 'quarter' }),
            createNote({ pitches: [createPitch('C', 4)], baseType: 'half' }),
          ],
        });

        return score;
      },
    },
    {
      id: 'notations-and-curves',
      title: 'E. Dynamics, Articulations, Ties & Slurs',
      description: 'Staccato, tenuto, accent, marcato, dynamics, ties per pitch, legato slurs.',
      build: () => {
        let score = createEmptyScore({
          title: 'E. Notations & Curves',
          clef: { sign: 'G', line: 2 },
          keySig: 0,
          timeSig: { num: 4, den: 4 },
          measures: 3,
        });
        const staff = score.parts[0].staves[0];
        const m1 = staff.measures[score.measures[0].id];
        const m2 = staff.measures[score.measures[1].id];
        const m3 = staff.measures[score.measures[2].id];

        const n1 = createNote({ pitches: [createPitch('C', 4)], baseType: 'quarter' });
        const n2 = createNote({ pitches: [createPitch('E', 4)], baseType: 'quarter' });
        const n3 = createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' });
        const n4 = createNote({ pitches: [createPitch('C', 5)], baseType: 'quarter' });

        // Add ties from n4 to m2 note 1
        n4.pitches[0].tiedToNext = true;
        n4.tiedToNext = true;

        m1.voices[0].events = [n1, n2, n3, n4];

        const m2n1 = createNote({ pitches: [createPitch('C', 5)], baseType: 'half' });
        const m2n2 = createNote({ pitches: [createPitch('B', 4)], baseType: 'quarter' });
        const m2n3 = createNote({ pitches: [createPitch('A', 4)], baseType: 'quarter' });
        m2.voices[0].events = [m2n1, m2n2, m2n3];

        const m3n1 = createNote({ pitches: [createPitch('G', 4)], baseType: 'whole' });
        m3.voices[0].events = [m3n1];

        // Apply slur across barlines from n2 to m2n2 BEFORE freezing score with commands
        staff.slurs = [
          {
            id: newId(),
            startEventId: n2.id,
            endEventId: m2n2.id,
          },
        ];

        // Apply dynamics via commands
        score = setDynamic(n1.id, 'f').apply(score);
        score = setDynamic(m2n2.id, 'p').apply(score);
        score = setDynamic(m3n1.id, 'mf').apply(score);

        // Apply articulations via commands
        score = toggleArticulation(n1.id, 'accent').apply(score);
        score = toggleArticulation(n2.id, 'staccato').apply(score);
        score = toggleArticulation(n3.id, 'tenuto').apply(score);
        score = toggleArticulation(m2n3.id, 'marcato').apply(score);

        return score;
      },
    },
    {
      id: 'score-structure-and-lyrics',
      title: 'F. Score Structure & Lyrics',
      description: 'Header metadata, key change, double/final barlines, repeats, voltas, lyrics.',
      build: () => {
        let score = createEmptyScore({
          clef: { sign: 'G', line: 2 },
          keySig: 0,
          timeSig: { num: 2, den: 4 },
          measures: 6,
        });

        const staff = score.parts[0].staves[0];

        // Add notes first BEFORE freezing score with commands
        const m1 = staff.measures[score.measures[0].id];
        const m1n1 = createNote({ pitches: [createPitch('G', 4)], baseType: 'quarter' });
        const m1n2 = createNote({ pitches: [createPitch('A', 4)], baseType: 'quarter' });
        m1.voices[0].events = [m1n1, m1n2];

        const m2 = staff.measures[score.measures[1].id];
        const m2n1 = createNote({ pitches: [createPitch('G', 4)], baseType: 'half' });
        m2.voices[0].events = [m2n1];

        // Metadata
        score = setScoreMetadata({
          title: 'Süt İçtim Dilim Yandı',
          subtitle: 'Kayseri Türküsü',
          composer: 'Anonim',
          arranger: 'TRT Repertuarı',
        }).apply(score);

        // Measure 1 & 2: Repeat section
        score = setRepeatStart(score.measures[0].id, true).apply(score);
        score = setRepeatEnd(score.measures[1].id, true).apply(score);
        score = setVolta(score.measures[1].id, { number: 1 }).apply(score);

        // Measure 3: Volta 2 (open)
        score = setVolta(score.measures[2].id, { number: 2, openRight: true }).apply(score);

        // Key signature change at measure 4 with naturals
        score = setKeySignature(score.measures[3].id, 1).apply(score);

        // Double barline at measure 4, final barline at measure 6
        score = setEndBarline(score.measures[3].id, 'double').apply(score);
        score = setEndBarline(score.measures[5].id, 'final').apply(score);

        // Lyrics
        score = setLyrics(m1n1.id, 'Süt', 1).apply(score);
        score = setLyrics(m1n2.id, 'iç-', 1).apply(score);
        score = setLyrics(m2n1.id, 'tim_', 1).apply(score);

        return score;
      },
    },
  ];
}
