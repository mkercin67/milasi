// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Writes the acceptance fixture of the current step (Bach; the Beethoven file holds the owner's own entry and is never overwritten) to tests/private/ (git-ignored) as a .sfscore file,
 * so it can be opened in the program (File > Open) and compared with the scan.
 * Usage: npm run fixture:export
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildBachBwv140KeyboardMm1to6, buildBachBwv140Mm1to6 } from '../tests/fixtures/bachBwv140Mm1to6.ts';
import { buildSchubertD547Mm1to5 } from '../tests/fixtures/schubertD547Mm1to5.ts';
import { buildK545Mm1to7 } from '../tests/fixtures/mozartK545Mm1to7.ts';
import { buildBwv772Mm1to7 } from '../tests/fixtures/bwv772Mm1to7.ts';
import { buildBreidenbachMeditationMm13to21 } from '../tests/fixtures/breidenbachMeditationMm13to21.ts';
import { buildBreidenbachMeditationMm148to153 } from '../tests/fixtures/breidenbachMeditationMm148to153.ts';
import { serializeScore } from '../src/io/json.ts';

mkdirSync('tests/private', { recursive: true });
const files = {
  'bach_bwv140_7_mm1-6.sfscore': buildBachBwv140Mm1to6(),
  'bach_bwv140_7_keyboard_mm1-6.sfscore': buildBachBwv140KeyboardMm1to6(),
  'schubert_d547_mm1-5.sfscore': buildSchubertD547Mm1to5(),
  'k545_fixture_mm1-7.sfscore': buildK545Mm1to7(),
  'bwv772_fixture_mm1-7.sfscore': buildBwv772Mm1to7(),
  'meditation_mm13-21.sfscore': buildBreidenbachMeditationMm13to21(),
  'meditation_mm148-153.sfscore': buildBreidenbachMeditationMm148to153(),
};
for (const [name, score] of Object.entries(files)) {
  const out = `tests/private/${name}`;
  writeFileSync(out, serializeScore(score, 2), 'utf8');
  console.log(`Wrote ${out}`);
}
console.log('Open it in the program with the Open button.');
