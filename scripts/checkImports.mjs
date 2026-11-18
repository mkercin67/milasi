// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('src');

/**
 * Architectural layer rules:
 * Key = folder/layer name
 * forbidden = layers that this layer CANNOT import from
 */
const RULES = {
  core: ['ui', 'layout', 'render', 'playback'],
  layout: ['ui', 'render', 'playback'],
  render: ['ui', 'playback'],
  playback: ['ui', 'render'],
  io: ['ui', 'layout', 'render', 'playback'],
};

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getFiles(SRC_DIR);
let errors = 0;

for (const file of files) {
  const relPath = path.relative(SRC_DIR, file).replace(/\\/g, '/');
  const sourceLayer = relPath.split('/')[0];
  const forbidden = RULES[sourceLayer];
  if (!forbidden) continue;

  const content = fs.readFileSync(file, 'utf8');
  // Match import statements: import ... from '...' or import('...')
  const importRegex = /(?:import\s+[\s\S]*?from\s+['"]([^'"]+)['"])|(?:import\(['"]([^'"]+)['"]\))/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importTarget = match[1] || match[2];
    if (!importTarget.startsWith('.')) continue;

    const resolved = path.resolve(path.dirname(file), importTarget);
    const targetRel = path.relative(SRC_DIR, resolved).replace(/\\/g, '/');
    const targetLayer = targetRel.split('/')[0];

    if (forbidden.includes(targetLayer)) {
      console.error(
        `ARCHITECTURAL VIOLATION: ${relPath} (${sourceLayer}) imports from ${targetRel} (${targetLayer}) which is forbidden.`
      );
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`Total import boundary violations: ${errors}`);
  process.exit(1);
} else {
  console.log(`✓ All folder boundary import rules verified cleanly across ${files.length} files.`);
}
