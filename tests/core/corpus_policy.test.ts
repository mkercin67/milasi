// SPDX-License-Identifier: GPL-3.0-or-later
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Corpus & Intellectual Property Policy Enforcement (docs/CORPUS_POLICY.md)', () => {
  it('fails if any PDF file is tracked in git outside tests/private/', () => {
    let trackedFiles = '';
    try {
      trackedFiles = execSync('git ls-files', { encoding: 'utf8' });
    } catch (e) {
      // In environments where git is not directly callable, scan filesystem
      trackedFiles = '';
    }

    const trackedLines = trackedFiles
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const trackedPdfs = trackedLines.filter(
      (file) => file.toLowerCase().endsWith('.pdf') && !file.startsWith('tests/private/')
    );

    expect(
      trackedPdfs,
      `Tracked PDF files detected in git repository (must never be committed; place only in tests/private/): ${trackedPdfs.join(', ')}`
    ).toEqual([]);
  });

  it('fails if any score fixture in the repository lacks mandatory corpus header metadata', () => {
    const fixtureFiles = [
      path.resolve('src/ui/sutIctimScore.ts'),
      path.resolve('src/ui/beamDemoScore.ts'),
      path.resolve('tests/fixtures/bwv772Mm1to7.ts'),
      path.resolve('tests/fixtures/mozartK545Mm1to7.ts'),
    ];

    const requiredMetadataTags = [
      'Source:',
      'Composer:',
      'Composer Death Year:',
      'License:',
    ];

    for (const fixturePath of fixtureFiles) {
      expect(fs.existsSync(fixturePath), `Fixture file must exist: ${fixturePath}`).toBe(true);
      const content = fs.readFileSync(fixturePath, 'utf8');

      for (const tag of requiredMetadataTags) {
        expect(
          content.includes(tag),
          `Fixture ${path.basename(fixturePath)} is missing mandatory corpus metadata tag: "${tag}"`
        ).toBe(true);
      }
    }
  });
});
