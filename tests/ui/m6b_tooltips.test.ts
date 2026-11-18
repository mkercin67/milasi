// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../src/ui/i18n';
import { Toolbar } from '../../src/ui/Toolbar';

describe('Milestone 6b: Toolbar Button Tooltip Verification', () => {
  it('ensures every toolbar action shortcut has its key clearly indicated in its tooltip', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        I18nProvider,
        null,
        React.createElement(Toolbar, {
          canUndo: true,
          canRedo: true,
          onUndo: () => {},
          onRedo: () => {},
          onOpenNewScore: () => {},
          onOpen: () => {},
          onSave: () => {},
          mode: 'select',
          onChangeMode: () => {},
          activeDuration: 'quarter',
          onChangeDuration: () => {},
          activeDots: 0,
          onToggleDot: () => {},
          isRestSelected: false,
          onToggleRest: () => {},
          onInsertMeasure: () => {},
          onDeleteMeasure: () => {},
        })
      )
    );

    // Extract all title="..." attributes from the toolbar HTML
    const titleRegex = /title="([^"]+)"/g;
    const tooltips: string[] = [];
    let match;
    while ((match = titleRegex.exec(html)) !== null) {
      tooltips.push(match[1]);
    }

    console.log('Extracted Toolbar Tooltips count:', tooltips.length);

    // Check specific required button tooltips
    expect(tooltips).toContain('Geri Al (Ctrl+Z)');
    expect(tooltips).toContain('Yinele (Ctrl+Shift+Z)');
    expect(tooltips).toContain('Aç (Ctrl+O)');
    expect(tooltips).toContain('Kaydet (Ctrl+S)');
    expect(tooltips).toContain('Ölçü Ekle (Ctrl+B)');
    expect(tooltips).toContain('Çal (Space)');
    expect(tooltips).toContain('Durdur (Esc)');
    expect(tooltips).toContain('Seçim (V)');
    expect(tooltips).toContain('Nota girişi (N)');
    expect(tooltips).toContain('Konum (P)');
    expect(tooltips).toContain('Staccato (J)');
    expect(tooltips).toContain('Tenuto (K)');
    expect(tooltips).toContain('Aksan (L)');
    expect(tooltips).toContain('Markato (Shift+L)');
    expect(tooltips).toContain('Bağ (T)');
    expect(tooltips).toContain('Legato bağı (S)');

    // Dynamics Shift+1..Shift+8
    expect(tooltips).toContain('pp (Shift+1)');
    expect(tooltips).toContain('p (Shift+2)');
    expect(tooltips).toContain('mp (Shift+3)');
    expect(tooltips).toContain('mf (Shift+4)');
    expect(tooltips).toContain('f (Shift+5)');
    expect(tooltips).toContain('ff (Shift+6)');
    expect(tooltips).toContain('sfz (Shift+7)');
    expect(tooltips).toContain('fp (Shift+8)');

    // Ensure Delete Measure has NO shortcut key shown
    const deleteMeasureTooltip = tooltips.find((t) => t.includes('Ölçüyü Sil'));
    expect(deleteMeasureTooltip).toBeDefined();
    expect(deleteMeasureTooltip).not.toContain('Ctrl');
    expect(deleteMeasureTooltip).not.toContain('Del');

    // Verify that every single action that has a dedicated toolbar button includes its key
    const toolbarActionKeys = ['J', 'K', 'L', 'S', 'T', 'V', 'N', 'P', '1', '2', '3', '4', '5', '6', '7', '8'];
    for (const k of toolbarActionKeys) {
      const existsInTooltips = tooltips.some((t) => t.includes(`(${k})`) || t.includes(`Shift+${k})`) || t.includes(`${k}`));
      expect(existsInTooltips, `Expected key ${k} to appear in a toolbar tooltip`).toBe(true);
    }
  });
});
