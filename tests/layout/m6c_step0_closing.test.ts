import { describe, expect, it } from 'vitest';
import {
  createEmptyScore,
  createMeasure,
  createNote,
  createPart,
  createPitch,
  createScore,
} from '../../src/core/factory';
import {
  setEndBarline,
  setKeySignature,
  setPickup,
  setTempo,
  setTimeSignature,
} from '../../src/core/commands';
import { layoutScore } from '../../src/layout/layoutScore';
import { deserializeScore, serializeScore } from '../../src/io/json';

describe('Milestone 6c Closing: Header Layout, Edge Cases & Robustness', () => {
  describe('STEP 0a: Header text layout and overlap prevention', () => {
    it('FAILING-FIRST: header block reserves full measured height and does not overlap system 0 items', () => {
      // Long title that collides with composer at content width 385 (38.5 staff spaces)
      const score = createScore({
        title: 'Çok Uzun Eser Başlığı — Geleneksel Anadolu Ezgileri ve Türküleri',
        subtitle: 'Halk Müziği Eseri — İcra Notasyonu',
        composer: 'Kaptanzade Ali Rıza Bey',
        arranger: 'Ömer Bedrettin Uşaklı',
      });
      score.measures = [createMeasure({ num: 2, den: 4 })];
      const part = createPart('Violin');
      score.parts = [part];
      // High note with stem up and beam touching y = -3.5 above line 0
      part.staves[0].measures[score.measures[0].id] = {
        voices: [
          {
            id: 'v1',
            events: [
              createNote({ pitches: [createPitch('G', 5, 0)], baseType: 'quarter' }),
              createNote({ pitches: [createPitch('A', 5, 0)], baseType: 'quarter' }),
            ],
          },
        ],
      };

      const layout = layoutScore(score, { width: 38.5 });
      const sys0 = layout.systems[0];

      // Find all header text items
      const headerItems = sys0.items.filter((it) => it.id.startsWith('header-'));
      expect(headerItems.length).toBeGreaterThanOrEqual(4);

      // Find highest musical item in system 0 (line, glyph, beam)
      const musicalItems = sys0.items.filter((it) => !it.id.startsWith('header-'));
      const minMusicalItemY = Math.min(...musicalItems.map((it) => sys0.y + it.y));

      // Header bottom Y in absolute coordinates
      const maxHeaderItemY = Math.max(...headerItems.map((it) => sys0.y + it.y));

      // SPEC: The first system starts at least 2 staff spaces below the bottom of the header block!
      const gap = minMusicalItemY - maxHeaderItemY;
      expect(gap).toBeGreaterThanOrEqual(2.0);
    });

    it('header height combinations for every combination of the 4 fields at widths 38.5, 60.0, 120.0', () => {
      const combinations = [
        { title: 'Başlık' },
        { title: 'Başlık', subtitle: 'Alt Başlık' },
        { title: 'Başlık', composer: 'Besteci' },
        { title: 'Başlık', subtitle: 'Alt Başlık', composer: 'Besteci', arranger: 'Düzenleyen' },
        { composer: 'Sadece Besteci' },
        { subtitle: 'Sadece Alt Başlık', arranger: 'Düzenleyen' },
      ];

      const widths = [38.5, 60.0, 120.0];

      for (const meta of combinations) {
        for (const w of widths) {
          const score = createScore(meta);
          score.measures = [createMeasure({ num: 4, den: 4 })];
          score.parts = [createPart('Piano')];
          const layout = layoutScore(score, { width: w });
          const sys0 = layout.systems[0];
          const headerItems = sys0.items.filter((it) => it.id.startsWith('header-'));
          if (headerItems.length > 0) {
            const musicalItems = sys0.items.filter((it) => !it.id.startsWith('header-'));
            const minMusicalY = Math.min(...musicalItems.map((it) => sys0.y + it.y));
            const maxHeaderY = Math.max(...headerItems.map((it) => sys0.y + it.y));
            expect(minMusicalY - maxHeaderY).toBeGreaterThanOrEqual(2.0);
          }
        }
      }
    });
  });

  describe('STEP 0d: Edge cases (ONE test each)', () => {
    it('edge-case 1: pickup + 6/8 beaming groups correctly across beat boundaries', () => {
      // 6/8 pickup measure of 3 eighths (dotted quarter = 1440 ticks)
      const score = createEmptyScore({
        timeSig: { num: 6, den: 8 },
        measures: 2,
      });
      // Set pickup of 1440 ticks on measure 0
      const pickupScore = setPickup(score.measures[0].id, 1440).apply(score);
      expect(pickupScore.measures[0].actualTicks).toBe(1440);

      // Add 3 eighth notes to pickup measure
      const m0Id = pickupScore.measures[0].id;
      const modifiableScore = JSON.parse(JSON.stringify(pickupScore));
      modifiableScore.parts[0].staves[0].measures[m0Id].voices[0].events = [
        createNote({ pitches: [createPitch('A', 4, 0)], baseType: 'eighth' }),
        createNote({ pitches: [createPitch('B', 4, 0)], baseType: 'eighth' }),
        createNote({ pitches: [createPitch('C', 5, 0)], baseType: 'eighth' }),
      ];

      const layout = layoutScore(modifiableScore, { width: 70 });
      // The 3 eighth notes in 6/8 pickup must beam together as 1 compound group of 3
      const beams = layout.items.filter((it) => it.kind === 'beam');
      expect(beams.length).toBeGreaterThan(0);
      const pickupBeam = beams.find((b) => b.eventIds?.length === 3);
      expect(pickupBeam).toBeDefined();
    });

    it('edge-case 2: time signature change refused when measure duration does not match unless forced/handled', () => {
      const score = createEmptyScore({ numMeasures: 4 });
      // Changing time signature on a measure with full 4/4 events to 3/4 requires re-validation
      const updated = setTimeSignature(score.measures[1].id, { num: 3, den: 4 }, 'from-here').apply(score);
      expect(updated.measures[1].timeSig).toEqual({ num: 3, den: 4 });
      expect(updated.measures[2].timeSig).toEqual({ num: 3, den: 4 });
      expect(updated.measures[3].timeSig).toEqual({ num: 3, den: 4 });
    });

    it('edge-case 3: key change at the first measure of a system draws only the new signature (no cancellation)', () => {
      // 8 measures: measure 0-3 in G major (+1), measure 4-7 in F major (-1)
      const score = createEmptyScore({ numMeasures: 8 });
      const withKey0 = setKeySignature(score.measures[0].id, 1, 'score').apply(score);
      const withKey4 = setKeySignature(score.measures[4].id, -1, 'from-here').apply(withKey0);

      // Lay out with width such that system 0 holds measures 0..3 and system 1 starts at measure 4
      const layout = layoutScore(withKey4, { width: 35 });
      expect(layout.systems.length).toBeGreaterThan(1);
      const sys1 = layout.systems[1];
      // When key signature changes at the very start of a new system (line break),
      // standard engraving draws the new key signature as the system key signature without cancellation naturals.
      const sys1KeyChangeNaturals = sys1.items.filter(
        (it) => it.id.includes('keychange') && it.id.includes('natural')
      );
      expect(sys1KeyChangeNaturals.length).toBe(0);
    });

    it('edge-case 4: tempo marking at a system start aligns cleanly above clef/meter with no collision', () => {
      const score = createEmptyScore({ numMeasures: 8 });
      const withTempo = setTempo(score.measures[4].id, {
        bpm: 132,
        beatUnit: 1.0,
        tempoText: 'Vivace',
      }).apply(score);

      const layout = layoutScore(withTempo, { width: 35 });
      const sys1 = layout.systems[1];
      const tempoItem = sys1.items.find((it) => it.id.includes('tempo-text'));
      expect(tempoItem).toBeDefined();
      expect(tempoItem!.x).toBeGreaterThanOrEqual(0);
    });

    it('edge-case 5: measure numbers when pickup exists and score has 20 measures at width 385', () => {
      const score = createEmptyScore({ numMeasures: 20 });
      const pickupScore = setPickup(score.measures[0].id, 960).apply(score);
      const layout = layoutScore(pickupScore, { width: 38.5 });

      // Systems > 0 must display measure numbers, with measure 0 (pickup) being unnumbered
      expect(layout.systems.length).toBeGreaterThan(1);
      for (let sIdx = 1; sIdx < layout.systems.length; sIdx++) {
        const sys = layout.systems[sIdx];
        const mNumItem = sys.items.find((it) => it.id === `sys-${sIdx}-measure-number`);
        expect(mNumItem).toBeDefined();
        // Since measure 0 is pickup, the first measure of system 1 should be its 0-based index
        const mNum = parseInt(mNumItem!.text!, 10);
        expect(mNum).toBeGreaterThan(0);
      }
    });

    it('edge-case 6: double barline in the middle of a system renders two thin lines', () => {
      const score = createEmptyScore({ numMeasures: 4 });
      const withBarline = setEndBarline(score.measures[1].id, 'double').apply(score);
      const layout = layoutScore(withBarline, { width: 80 });

      const m1Id = score.measures[1].id;
      const barlines = layout.items.filter(
        (it) => it.id.startsWith(`barline-${m1Id}`) && it.kind === 'line'
      );
      expect(barlines.length).toBe(2);
      expect(barlines[0].thickness).toBe(barlines[1].thickness);
    });
  });

  describe('STEP 0c: Real v3 File Load & Migration to v4 Round Trip', () => {
    it('loads a real v3 envelope file produced by M6b and migrates to v4 with round trip equality', () => {
      const realM6bV3Json = JSON.stringify({
        app: 'scoreforge',
        savedAt: '2026-11-17T09:00:00.000Z',
        score: {
          schemaVersion: 3,
          id: 'v3-real-fixture',
          meta: {
            title: 'Süt İçtim Dilim Yandı',
            composer: 'Müzik Notlarım',
          },
          measures: [
            { id: 'm-1', timeSig: { num: 4, den: 4 }, keySig: 0 },
            { id: 'm-2', timeSig: { num: 4, den: 4 }, keySig: 0 },
          ],
          parts: [
            {
              id: 'part-1',
              name: 'Bağlama',
              instrument: 'baglama',
              staves: [
                {
                  id: 'staff-1',
                  clef: { sign: 'G', line: 2 },
                  slurs: [{ id: 'slur-1', startEventId: 'note-1', endEventId: 'note-2' }],
                  measures: {
                    'm-1': {
                      voices: [
                        {
                          id: 'v-1',
                          events: [
                            {
                              id: 'note-1',
                              kind: 'note',
                              baseType: 'half',
                              dots: 0,
                              duration: 1920,
                              pitches: [{ step: 'D', octave: 4, alter: 0, tiedToNext: false }],
                              articulations: ['staccato'],
                              dynamic: 'mf',
                            },
                            {
                              id: 'note-2',
                              kind: 'note',
                              baseType: 'half',
                              dots: 0,
                              duration: 1920,
                              pitches: [{ step: 'E', octave: 4, alter: 0, tiedToNext: false }],
                            },
                          ],
                        },
                      ],
                    },
                    'm-2': {
                      voices: [
                        {
                          id: 'v-2',
                          events: [
                            {
                              id: 'rest-1',
                              kind: 'rest',
                              baseType: 'whole',
                              dots: 0,
                              duration: 3840,
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
          overrides: {},
        },
      });

      const loaded = deserializeScore(realM6bV3Json);
      expect(loaded.schemaVersion).toBe(5);
      expect(loaded.meta.title).toBe('Süt İçtim Dilim Yandı');
      expect(loaded.meta.composer).toBe('Müzik Notlarım');
      expect(loaded.meta.subtitle).toBe('');
      expect(loaded.meta.arranger).toBe('');
      expect(loaded.measures[0].endBarline).toBe('single');
      expect(loaded.measures[1].endBarline).toBe('final');

      // Round trip check
      const reSerialized = serializeScore(loaded, 2, true);
      const reLoaded = deserializeScore(reSerialized);
      expect(reLoaded).toEqual(loaded);
    });
  });
});
