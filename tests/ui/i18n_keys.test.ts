// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import trTranslations from '../../src/ui/i18n/locales/tr.json';
import enTranslations from '../../src/ui/i18n/locales/en.json';

/**
 * Extracts i18n keys from source code and constants.
 */
function extractUsedI18nKeys(): { codeKeys: Set<string>; dynamicKeys: Set<string> } {
  const srcDir = path.resolve('src');

  const codeKeys = new Set<string>();
  const dynamicKeys = new Set<string>();

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.name.endsWith('.ts') || ent.name.endsWith('.tsx')) {
        // Exclude locale JSON files or test fixtures
        if (full.includes('locales')) continue;

        const content = fs.readFileSync(full, 'utf-8');

        // Match literal t('key') and t("key")
        const literalMatches = content.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g);
        for (const m of literalMatches) {
          codeKeys.add(m[1]);
        }

        // Match constants with label / labelKey: 'key'
        const labelMatches = content.matchAll(/\b(?:labelKey|label)\s*:\s*['"]([a-zA-Z0-9_.-]+)['"]/g);
        for (const m of labelMatches) {
          // If it looks like a dotted key e.g. mode.select, palette.duration.whole
          if (m[1].includes('.')) {
            codeKeys.add(m[1]);
          }
        }
      }
    }
  }

  walk(srcDir);

  // Dynamic template expansions known in the UI
  const durations = ['whole', 'half', 'quarter', 'eighth', '16th', '32nd'];
  const modes = ['select', 'input', 'position', 'lyrics'];

  for (const d of durations) {
    dynamicKeys.add(`duration.${d}.note`);
    dynamicKeys.add(`duration.${d}.rest`);
  }
  for (const m of modes) {
    dynamicKeys.add(`mode.${m}`);
  }

  return { codeKeys, dynamicKeys };
}

describe('i18n Static Analysis and Key Integrity', () => {
  const { codeKeys, dynamicKeys } = extractUsedI18nKeys();
  const allRequiredKeys = new Set([...codeKeys, ...dynamicKeys]);
  const trKeys = new Set(Object.keys(trTranslations));
  const enKeys = new Set(Object.keys(enTranslations));

  it('fails if any code key or constant key is missing in tr.json', () => {
    const missingInTr: string[] = [];
    for (const k of allRequiredKeys) {
      if (!trKeys.has(k)) {
        missingInTr.push(k);
      }
    }
    expect(
      missingInTr,
      `The following i18n keys are used in code but missing from tr.json: ${missingInTr.join(', ')}`
    ).toEqual([]);
  });

  it('fails if any code key or constant key is missing in en.json', () => {
    const missingInEn: string[] = [];
    for (const k of allRequiredKeys) {
      if (!enKeys.has(k)) {
        missingInEn.push(k);
      }
    }
    expect(
      missingInEn,
      `The following i18n keys are used in code but missing from en.json: ${missingInEn.join(', ')}`
    ).toEqual([]);
  });

  it('reports unused keys in tr.json and en.json without failing the build', () => {
    const unusedInTr = Array.from(trKeys).filter((k) => !allRequiredKeys.has(k));
    const unusedInEn = Array.from(enKeys).filter((k) => !allRequiredKeys.has(k));

    if (unusedInTr.length > 0 || unusedInEn.length > 0) {
      console.log(`[i18n report] Potential unused keys in tr.json (${unusedInTr.length}):`, unusedInTr.slice(0, 10));
      console.log(`[i18n report] Potential unused keys in en.json (${unusedInEn.length}):`, unusedInEn.slice(0, 10));
    }
    // Report only as specified: "(b) fail if tr.json or en.json contain keys that no code uses (report only)"
    expect(true).toBe(true);
  });
});
