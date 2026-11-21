// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * scripts/checkStaffZeroUsage.mjs  (Milestone 7b, docs/design/m7b-grand-staff.md, B6)
 *
 * Two rules keep the single-staff assumption from spreading while the code base moves to
 * multi-staff scores:
 *
 *  1. `parts[0].staves[0]` style indexing is forbidden in src/ except
 *     - in the allowlisted content builders (demo scores, gallery cases),
 *     - on lines carrying the marker `staff-zero-ok` followed by a reason,
 *     - in comments.
 *     Everything else must use findStaff(score, staffId) from src/core/staffLookup.ts.
 *
 *  2. Callers of firstStaff() (the legacy "the staff" default) are counted against a ceiling in
 *     docs/design/m7b-staff-ratchet.json. The ceiling may only go down. At the M7b acceptance audit the
 *     remaining callers were classified (missing-id fallbacks, the default cursor, the single-staff
 *     clef); see the "audit" entry of the JSON file.
 */
import fs from 'fs';
import path from 'path';

const ALLOWED_FILES = new Set(
  [
    'src/layout/systemBeams.ts', // LayoutSystem.staves, not Score staves
    'src/ui/Demo.tsx',
    'src/ui/beamDemoScore.ts',
    'src/ui/galleryBuilders.ts',
    'src/ui/galleryCases.ts',
    'src/ui/polyphonyBuilders.ts',
    'src/ui/sutIctimScore.ts',
  ].map((p) => path.normalize(p))
);
const LOOKUP_FILE = path.normalize('src/core/staffLookup.ts');
const INDEX_RE = /parts\[0\]\??\.staves|\.staves\[0\]/;

const violations = [];
let firstStaffCalls = 0;

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.normalize(path.relative(process.cwd(), fullPath));
    if (entry.isDirectory()) {
      scanDir(fullPath);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      if (relPath !== LOOKUP_FILE && /\bfirstStaff\(/.test(line)) firstStaffCalls++;
      if (INDEX_RE.test(line) && !ALLOWED_FILES.has(relPath) && !line.includes('staff-zero-ok')) {
        violations.push(`${relPath}:${idx + 1}: ${trimmed}`);
      }
    });
  }
}

scanDir(path.resolve('src'));

const ratchetPath = path.resolve('docs/design/m7b-staff-ratchet.json');
const ceiling = JSON.parse(fs.readFileSync(ratchetPath, 'utf8')).firstStaffCeiling;

let failed = false;
if (violations.length > 0) {
  console.error("FAIL: raw 'parts[0].staves[0]' indexing found. Use findStaff(score, staffId):");
  for (const v of violations) console.error('  ' + v);
  failed = true;
}
if (firstStaffCalls > ceiling) {
  console.error(
    `FAIL: firstStaff() has ${firstStaffCalls} callers, above the ceiling ${ceiling} in docs/design/m7b-staff-ratchet.json. New code must resolve the staff from the cursor/selection (findStaff).`
  );
  failed = true;
}
if (failed) process.exit(1);

console.log(`PASS: no raw staves[0] indexing; firstStaff() callers ${firstStaffCalls} <= ceiling ${ceiling}.`);
if (firstStaffCalls < ceiling) {
  console.log(`NOTE: lower firstStaffCeiling to ${firstStaffCalls} in docs/design/m7b-staff-ratchet.json.`);
}
