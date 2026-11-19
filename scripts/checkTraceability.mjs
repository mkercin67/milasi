// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

const TRACEABILITY_FILE = path.resolve('docs/design/schema-v7-traceability.json');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkTraceability() {
  console.log('--- Checking Schema v7 Machine Traceability Matrix ---');

  if (!fs.existsSync(TRACEABILITY_FILE)) {
    console.error(`ERROR: Traceability file not found: ${TRACEABILITY_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(TRACEABILITY_FILE, 'utf-8');
  let entries;
  try {
    entries = JSON.parse(raw);
  } catch (err) {
    console.error(`ERROR: Failed to parse JSON in ${TRACEABILITY_FILE}:`, err.message);
    process.exit(1);
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    console.error('ERROR: Traceability matrix must be a non-empty array.');
    process.exit(1);
  }

  const seenIds = new Set();
  const fileCache = new Map();
  let errors = 0;
  let doneCount = 0;

  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx];
    const { planItemId, codeLocation, testFile, testName, status } = entry;

    if (!planItemId) {
      console.error(`Row ${idx}: Missing planItemId.`);
      errors++;
      continue;
    }

    if (seenIds.has(planItemId)) {
      console.error(`Row ${idx}: Duplicated planItemId "${planItemId}".`);
      errors++;
    }
    seenIds.add(planItemId);

    if (status !== 'DONE') {
      console.log(`[SKIPPED] ${planItemId} (${status})`);
      continue;
    }

    doneCount++;

    if (!codeLocation) {
      console.error(`[FAIL] ${planItemId}: Status is DONE but codeLocation is missing.`);
      errors++;
    }

    if (!testFile) {
      console.error(`[FAIL] ${planItemId}: Status is DONE but testFile is missing.`);
      errors++;
      continue;
    }

    const resolvedTestFile = path.resolve(testFile);
    if (!fs.existsSync(resolvedTestFile)) {
      console.error(`[FAIL] ${planItemId}: Test file does not exist: ${testFile}`);
      errors++;
      continue;
    }

    if (!testName) {
      console.error(`[FAIL] ${planItemId}: Status is DONE but testName is missing.`);
      errors++;
      continue;
    }

    let fileContent = fileCache.get(resolvedTestFile);
    if (!fileContent) {
      fileContent = fs.readFileSync(resolvedTestFile, 'utf-8');
      fileCache.set(resolvedTestFile, fileContent);
    }

    // Match it('literal', ...) or test('literal', ...)
    const pattern = new RegExp(`(?:it|test)\\s*\\(\\s*['"\`]${escapeRegex(testName)}['"\`]`, 'm');
    if (!pattern.test(fileContent)) {
      console.error(`[FAIL] ${planItemId}: Literal test name "${testName}" not found inside it() or test() in ${testFile}`);
      errors++;
    } else {
      console.log(`[PASS] ${planItemId} -> ${testFile} :: "${testName}"`);
    }
  }

  console.log('----------------------------------------------------');
  if (errors > 0) {
    console.error(`FAILED: Traceability check failed with ${errors} error(s).`);
    process.exit(1);
  }

  console.log(`✓ All ${doneCount} DONE traceability rows statically verified against actual test files.`);
}

checkTraceability();
