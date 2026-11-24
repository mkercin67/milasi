// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Writes the acceptance fixture of the current step to tests/private/ (git-ignored) as a .sfscore file,
 * so it can be opened in the program (File > Open) and compared with the scan.
 * Usage: npm run fixture:export
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildBeethovenOp18No1Mm1to8 } from '../tests/fixtures/beethovenOp18No1Mm1to8.ts';
import { serializeScore } from '../src/io/json.ts';

mkdirSync('tests/private', { recursive: true });
const out = 'tests/private/beethoven_op18_1_mm1-8.sfscore';
writeFileSync(out, serializeScore(buildBeethovenOp18No1Mm1to8(), 2), 'utf8');
console.log(`Wrote ${out}. Open it in the program with the Open button.`);
