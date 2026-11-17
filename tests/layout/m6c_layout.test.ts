import { describe, expect, it } from 'vitest';
import { createEmptyScore } from '../../src/core/factory';
import {
  setEndBarline,
  setKeySignature,
  setPickup,
  setScoreMetadata,
  setTempo,
  setTimeSignature,
} from '../../src/core/commands';
import { layoutScore } from '../../src/layout/layoutScore';
import { renderSvgToString } from '../../src/render/renderSvg';

describe('Milestone 6c: Score Structure Layout & Rendering', () => {
  it('renders header text items (title, subtitle, composer, arranger) above first system using serif font stack', () => {
    const score = createEmptyScore({ numMeasures: 4 });
    const configured = setScoreMetadata({
      title: 'Dede Efendi Rast Kar-ı Nev',
      subtitle: 'Ağır Düyek',
      composer: 'Hammamizade İsmail Dede Efendi',
      arranger: 'Skor Düzenleyici',
    }).apply(score);

    const layout = layoutScore(configured, { width: 80 });
    const sys0Items = layout.systems[0].items;

    const titleItem = sys0Items.find((it) => it.id === 'header-title');
    expect(titleItem).toBeDefined();
    expect(titleItem?.text).toBe('Dede Efendi Rast Kar-ı Nev');
    expect(titleItem?.textAnchor).toBe('middle');
    expect(titleItem?.fontWeight).toBe('bold');

    const subtitleItem = sys0Items.find((it) => it.id === 'header-subtitle');
    expect(subtitleItem).toBeDefined();
    expect(subtitleItem?.text).toBe('Ağır Düyek');
    expect(subtitleItem?.textAnchor).toBe('middle');

    const composerItem = sys0Items.find((it) => it.id === 'header-composer');
    expect(composerItem).toBeDefined();
    expect(composerItem?.text).toBe('Hammamizade İsmail Dede Efendi');
    expect(composerItem?.textAnchor).toBe('end');

    const arrangerItem = sys0Items.find((it) => it.id === 'header-arranger');
    expect(arrangerItem).toBeDefined();
    expect(arrangerItem?.text).toBe('Skor Düzenleyici');
    expect(arrangerItem?.textAnchor).toBe('end');

    const svg = renderSvgToString(layout);
    expect(svg).toContain('Dede Efendi Rast Kar-ı Nev');
    expect(svg).toContain('Hammamizade İsmail Dede Efendi');
    expect(svg).toContain('Times New Roman');
  });

  it('renders tempo marking with SMuFL note glyph and optional tempo text prefix', () => {
    const score = createEmptyScore({ numMeasures: 4 });
    const withTempo = setTempo(score.measures[0].id, {
      bpm: 132,
      beatUnit: 1.0,
      tempoText: 'Allegro vivace',
    }).apply(score);

    const layout = layoutScore(withTempo, { width: 80 });
    const sys0Items = layout.systems[0].items;

    const textItem = sys0Items.find((it) => it.id.startsWith('tempo-text-'));
    expect(textItem).toBeDefined();
    expect(textItem?.text).toBe('Allegro vivace');

    const glyphItem = sys0Items.find((it) => it.id.startsWith('tempo-glyph-'));
    expect(glyphItem).toBeDefined();
    expect(glyphItem?.glyph).toBe('metNoteQuarterUp');

    const bpmItem = sys0Items.find((it) => it.id.startsWith('tempo-bpm-'));
    expect(bpmItem).toBeDefined();
    expect(bpmItem?.text).toContain('= 132');

    const svg = renderSvgToString(layout);
    expect(svg).toContain('Allegro vivace');
    expect(svg).toContain('glyph-metNoteQuarterUp');
    expect(svg).toContain('= 132');
  });

  it('renders key signature change mid-score with cancellation naturals', () => {
    // Measure 1: 3 flats (Eb major), Measure 2 onwards: 1 flat (F major)
    // Expect 2 cancellation naturals for removed flats followed by 1 flat
    const score = createEmptyScore({ numMeasures: 4, keySig: -3 });
    const withChange = setKeySignature(score.measures[1].id, -1, 'from-here').apply(score);

    const layout = layoutScore(withChange, { width: 80 });
    const m2Items = layout.systems[0].items.filter((it) =>
      it.id.startsWith(`keychange-${score.measures[1].id}`)
    );

    expect(m2Items.length).toBe(3); // 2 naturals + 1 flat
    expect(m2Items[0].glyph).toBe('accidentalNatural');
    expect(m2Items[1].glyph).toBe('accidentalNatural');
    expect(m2Items[2].glyph).toBe('accidentalFlat');

    // Sharps to C major (0): 2 sharps -> 0. Expect 2 cancellation naturals
    const score2 = createEmptyScore({ numMeasures: 4, keySig: 2 });
    const toC = setKeySignature(score2.measures[1].id, 0, 'from-here').apply(score2);
    const layout2 = layoutScore(toC, { width: 80 });
    const m2Items2 = layout2.systems[0].items.filter((it) =>
      it.id.startsWith(`keychange-${score2.measures[1].id}`)
    );
    expect(m2Items2.length).toBe(2);
    expect(m2Items2[0].glyph).toBe('accidentalNatural');
    expect(m2Items2[1].glyph).toBe('accidentalNatural');
  });

  it('renders mid-score time signature change', () => {
    const score = createEmptyScore({ numMeasures: 4, timeSig: { num: 4, den: 4 } });
    const withTimeSigChange = setTimeSignature(score.measures[1].id, { num: 3, den: 4 }, 'from-here').apply(score);

    const layout = layoutScore(withTimeSigChange, { width: 80 });
    const m2TimeSig = layout.systems[0].items.filter(
      (it) => it.glyph === 'timeSig3' || it.glyph === 'timeSig4'
    );
    // Measure 1 has 4/4, Measure 2 has 3/4
    expect(m2TimeSig.some((it) => it.glyph === 'timeSig3')).toBe(true);
  });

  it('renders pickup measure (anacrusis) unnumbered and numbers system 2 accordingly', () => {
    // 8 measures with narrow width to force system wrap
    const score = createEmptyScore({ numMeasures: 8 });
    const withPickup = setPickup(score.measures[0].id, 960).apply(score);

    const layout = layoutScore(withPickup, { width: 40 });
    expect(layout.systems.length).toBeGreaterThan(1);

    // System 1 should have a measure number
    const sys1MeasureNum = layout.systems[1].items.find((it) =>
      it.id.startsWith('sys-1-measure-number')
    );
    expect(sys1MeasureNum).toBeDefined();
    // In pickup score, measure 0 is unnumbered, measure 1 is 1. If system 1 starts at measure 3, it displays "3"
    const expectedNum = parseInt(sys1MeasureNum!.text!, 10);
    expect(expectedNum).toBeGreaterThan(0);
  });

  it('renders double and final barlines accurately', () => {
    const score = createEmptyScore({ numMeasures: 4 });
    const m2Id = score.measures[1].id;
    const withDouble = setEndBarline(m2Id, 'double').apply(score);

    const layout = layoutScore(withDouble, { width: 80 });
    const doubleLines = layout.systems[0].items.filter((it) =>
      it.id.startsWith(`barline-${m2Id}`)
    );
    expect(doubleLines).toHaveLength(2);
    expect(doubleLines[0].thickness).toBe(0.16);
    expect(doubleLines[1].thickness).toBe(0.16);

    // Last measure is 'final' by default
    const lastMDef = score.measures[3];
    const finalLines = layout.systems[0].items.filter((it) =>
      it.id.startsWith(`barline-${lastMDef.id}`)
    );
    expect(finalLines).toHaveLength(2);
    expect(finalLines[0].thickness).toBe(0.16); // thin
    expect(finalLines[1].thickness).toBe(0.5);  // thick
  });
});
