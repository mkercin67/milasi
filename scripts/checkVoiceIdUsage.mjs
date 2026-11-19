// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * scripts/checkVoiceIdUsage.mjs
 *
 * Scans all source files under src/ and asserts that 'voiceId' is not used
 * outside allowed files:
 *  - src/core/validate.ts (for error location reporting)
 *  - src/io/migrations.ts (for deterministic ID migration)
 */

import fs from 'fs';
import path from 'path';

const ALLOWED_FILES = new Set([
  path.normalize('src/core/validate.ts'),
  path.normalize('src/io/migrations.ts'),
]);

const srcDir = path.resolve('src');
let violations = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.normalize(path.relative(process.cwd(), fullPath));
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      if (ALLOWED_FILES.has(relPath)) {
        continue;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('voiceId')) {
          violations.push(`${relPath}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

function test(name, fn) {
  fn();
}

test('asserts no voiceId in src/ outside validate.ts and migrations.ts', () => {
  scanDir(srcDir);

  if (violations.length > 0) {
    console.error(`ERROR: Found prohibited 'voiceId' usages outside allowed files:\n`);
    violations.forEach((v) => console.error(`  ${v}`));
    process.exit(1);
  } else {
    console.log(`PASS: No forbidden 'voiceId' usages found in src/ outside allowed files.`);
  }
});
