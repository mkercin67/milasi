// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

const SPDX_HEADER = '// SPDX-License-Identifier: GPL-3.0-or-later';
const DIRS = ['src', 'scripts', 'tests'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);

const isFix = process.argv.includes('--fix');

function collectFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      results.push(...collectFiles(full));
    } else {
      const ext = path.extname(ent.name);
      if (EXTENSIONS.has(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

function checkFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) return false;

  let headerIndex = 0;
  if (lines[0].startsWith('#!')) {
    headerIndex = 1;
  }

  if (lines[headerIndex] && lines[headerIndex].trim() === SPDX_HEADER) {
    return true;
  }

  if (isFix) {
    let newContent;
    if (lines[0].startsWith('#!')) {
      newContent = lines[0] + '\n' + SPDX_HEADER + '\n' + lines.slice(1).join('\n');
    } else {
      newContent = SPDX_HEADER + '\n' + content;
    }
    fs.writeFileSync(filepath, newContent, 'utf8');
    return true;
  }

  return false;
}

const allFiles = DIRS.flatMap((d) => collectFiles(path.resolve(d)));
const missing = [];

for (const f of allFiles) {
  const ok = checkFile(f);
  if (!ok) {
    missing.push(path.relative(process.cwd(), f));
  }
}

if (isFix) {
  console.log(`SPDX header fix applied to files in src/, scripts/, tests/. Checked ${allFiles.length} files.`);
} else {
  if (missing.length > 0) {
    console.error(`SPDX check failed: ${missing.length} file(s) missing SPDX header '${SPDX_HEADER}':`);
    for (const m of missing) {
      console.error(`  - ${m}`);
    }
    console.error(`Run 'npm run spdx' to automatically add missing headers.`);
    process.exit(1);
  } else {
    console.log(`✓ All ${allFiles.length} source files have valid SPDX GPL-3.0-or-later headers.`);
  }
}
