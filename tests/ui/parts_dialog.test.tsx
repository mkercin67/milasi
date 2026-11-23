// SPDX-License-Identifier: GPL-3.0-or-later
// M7c-6 step 4: new-score templates and the Parts dialog.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { applyTemplate, renamePart } from '../../src/core/ensembleCommands';
import { createEmptyScore } from '../../src/core/factory';
import type { Score } from '../../src/core/model';
import { allStaves } from '../../src/core/staffLookup';
import { I18nProvider } from '../../src/ui/i18n';
import { buildNewScore } from '../../src/ui/app/newScoreBuilder';
import { PartsModal } from '../../src/ui/app/modals/PartsModal';
import { allPartsGroup } from '../../src/ui/app/partsDialog';
import { NewScoreModal } from '../../src/ui/NewScoreModal';
import type { NewScoreConfig } from '../../src/ui/NewScoreModal';

const cfg = (over: Partial<NewScoreConfig>): NewScoreConfig => ({
  clef: { sign: 'G', line: 2 },
  keySig: 0,
  timeSig: { num: 4, den: 4 },
  measures: 4,
  ...over,
});
const ensemble = (t: Parameters<typeof applyTemplate>[0]): Score => applyTemplate(t).apply(createEmptyScore({ numMeasures: 2 }));
const modal = (score: Score, isOpen = true) =>
  renderToStaticMarkup(
    <I18nProvider initialLanguage="en">
      <PartsModal isOpen={isOpen} onClose={() => undefined} score={score} onCommand={() => undefined} />
    </I18nProvider>
  );

describe('M7c-6 new score templates and parts dialog (step 4)', () => {
  it('PD1: buildNewScore makes single, piano and ensemble scores', () => {
    expect(buildNewScore(cfg({})).parts.length).toBe(1);
    expect(allStaves(buildNewScore(cfg({ template: 'piano' }))).length).toBe(2);
    const satb = buildNewScore(cfg({ template: 'satb' }));
    expect(satb.parts.length).toBe(4);
    expect(satb.measures.length).toBe(4);
    expect(satb.groups.length).toBe(1);
    expect(buildNewScore(cfg({ template: 'stringQuartet' })).parts.map((p) => p.shortName).join(',')).toBe('Vln. I,Vln. II,Vla.,Vc.');
    expect(allStaves(buildNewScore(cfg({ template: 'voicePiano' }))).length).toBe(3);
  });

  it('PD2: a pickup measure gives every staff of an ensemble its pickup rest', () => {
    const s = buildNewScore(cfg({ template: 'stringQuartet', isPickup: true, pickupDurationTicks: 960 }));
    expect(s.measures[0].actualTicks).toBe(960);
    for (const st of allStaves(s)) {
      const ev = st.measures[s.measures[0].id].voices[0].events;
      expect(ev.reduce((a, e) => a + e.duration, 0)).toBe(960);
    }
  });

  it('PD3: renamePart sets both names and ignores unknown parts', () => {
    const s = ensemble('satb');
    const s2 = renamePart(s.parts[0].id, 'Soprano 1', 'S1').apply(s);
    expect(s2.parts[0].name).toBe('Soprano 1');
    expect(s2.parts[0].shortName).toBe('S1');
    expect(renamePart('missing', 'x', 'y').apply(s2)).toBe(s2);
    expect(renamePart(s2.parts[0].id, 'Soprano 1', 'S1').apply(s2)).toBe(s2);
  });

  it('PD4: allPartsGroup finds the group over every part, not groups over some', () => {
    expect(allPartsGroup(ensemble('satb'))?.partIds.length).toBe(4);
    expect(allPartsGroup(ensemble('voicePiano'))).toBeUndefined();
    expect(allPartsGroup(createEmptyScore({ numMeasures: 1 }))).toBeUndefined();
  });

  it('PD5: the Parts dialog lists the parts and disables impossible moves', () => {
    const html = modal(ensemble('stringQuartet'));
    for (let i = 0; i < 4; i++) expect(html).toContain(`data-testid="part-row-${i}"`);
    expect(/data-testid="part-up-0"[^>]*disabled/.test(html)).toBe(true);
    expect(/data-testid="part-up-1"[^>]*disabled/.test(html)).toBe(false);
    expect(/data-testid="part-down-3"[^>]*disabled/.test(html)).toBe(true);
    expect(html).toContain('data-testid="btn-remove-group"');
    expect(modal(ensemble('voicePiano'))).not.toContain('data-testid="btn-remove-group"');
    expect(modal(ensemble('stringQuartet'), false)).toBe('');
  });

  it('PD6: the last part cannot be removed from the dialog', () => {
    const html = modal(createEmptyScore({ numMeasures: 1 }));
    expect(/data-testid="part-remove-0"[^>]*disabled/.test(html)).toBe(true);
  });

  it('PD7: the New Score dialog offers the ensemble templates in both languages', () => {
    const render = (lang: 'tr' | 'en') =>
      renderToStaticMarkup(
        <I18nProvider initialLanguage={lang}>
          <NewScoreModal isOpen canUndo={false} onClose={() => undefined} onCreate={() => undefined} />
        </I18nProvider>
      );
    const tr = render('tr');
    for (const id of ['satb', 'stringQuartet', 'voicePiano']) expect(tr).toContain(`data-testid="template-${id}"`);
    expect(tr).toContain('Koro (SATB)');
    expect(render('en')).toContain('String quartet');
  });
});
