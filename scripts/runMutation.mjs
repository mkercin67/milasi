// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * scripts/runMutation.mjs
 *
 * Applies a mutation patch under tests/mutations/<id>.patch to an isolated temporary git worktree
 * of HEAD (never modifying the working tree), runs the target vitest test file, and prints the
 * names of failing tests.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/runMutation.mjs <id>');
  process.exit(1);
}

const patchPath = path.resolve(`tests/mutations/${id}.patch`);
if (!fs.existsSync(patchPath)) {
  console.error(`Mutation patch not found: ${patchPath}`);
  process.exit(1);
}

const TARGET_TESTS = {
  'T2-leading-rests': 'tests/core/voice_creation_entry.test.ts',
  'T4-undo-voice-creation': 'tests/core/voice_creation_entry.test.ts',
  'T4-sort-voices': 'tests/core/voice_property.test.ts',
  'MARQUEE-v1-fallback': 'tests/ui/marquee_voice_selection.test.ts',
};

const targetTest = process.argv[3] || TARGET_TESTS[id];
if (!targetTest) {
  console.error(`Unknown mutation ID: ${id}. Supported IDs: ${Object.keys(TARGET_TESTS).join(', ')}`);
  process.exit(1);
}

const repoRoot = process.cwd();
const tempWorktreeName = `.wt-mutation-${id}-${Date.now()}`;
const tempWorktreePath = path.resolve(tempWorktreeName);

console.log(`=== RUNNING MUTATION TEST: ${id} ===`);
console.log(`Patch: ${patchPath}`);
console.log(`Target test: ${targetTest}`);
console.log(`Creating isolated worktree at ${tempWorktreePath}...`);

let exitCode = 0;
try {
  execSync(`git worktree add --detach "${tempWorktreePath}" HEAD`, { stdio: 'pipe' });

  // Link node_modules on Windows via directory junction
  const wtNodeModules = path.join(tempWorktreePath, 'node_modules');
  const mainNodeModules = path.join(repoRoot, 'node_modules');
  if (process.platform === 'win32') {
    execSync(`cmd /c mklink /J "${wtNodeModules}" "${mainNodeModules}"`, { stdio: 'pipe' });
  } else {
    fs.symlinkSync(mainNodeModules, wtNodeModules, 'junction');
  }

  // Copy current target test file from working copy into temporary worktree
  const srcTestFile = path.join(repoRoot, targetTest);
  const dstTestFile = path.join(tempWorktreePath, targetTest);
  if (fs.existsSync(srcTestFile)) {
    fs.mkdirSync(path.dirname(dstTestFile), { recursive: true });
    fs.copyFileSync(srcTestFile, dstTestFile);
  }

  // Apply patch to temporary worktree
  console.log(`Applying patch ${id}.patch to isolated worktree...`);
  execSync(`git -C "${tempWorktreePath}" apply "${patchPath}"`, { stdio: 'pipe' });

  // Run target test inside isolated worktree
  console.log(`Running test ${targetTest} in worktree...`);
  let testOutput = '';
  let testFailed = false;
  try {
    testOutput = execSync(`npx vitest run ${targetTest}`, {
      cwd: tempWorktreePath,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  } catch (err) {
    testFailed = true;
    testOutput = (err.stdout || '') + '\n' + (err.stderr || '');
  }

  if (!testFailed) {
    console.error(`ERROR: Mutation ${id} DID NOT fail any tests!`);
    console.log(testOutput);
    exitCode = 1;
  } else {
    console.log(`\nMutation ${id} successfully caused test failure as expected.`);
    console.log('--- FAILING TESTS ---');

    // Parse failing test lines
    const lines = testOutput.split('\n');
    const failingTests = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('× ') || trimmed.startsWith('FAIL ') || trimmed.includes('AssertionError:')) {
        failingTests.push(trimmed);
        console.log(trimmed);
      }
    }

    if (failingTests.length === 0) {
      // If specific markers weren't matched, print summary failure block
      console.log(testOutput.split('\n').filter((l) => l.includes('FAIL') || l.includes('failed')).join('\n'));
    }

    console.log(`\n=== MUTATION CHECK ${id}: PASS (Failure caught cleanly) ===\n`);
  }
} finally {
  console.log('Cleaning up isolated worktree...');
  try {
    const wtNodeModules = path.join(tempWorktreePath, 'node_modules');
    if (fs.existsSync(wtNodeModules)) {
      if (process.platform === 'win32') {
        execSync(`cmd /c rmdir "${wtNodeModules}"`, { stdio: 'pipe' });
      } else {
        fs.unlinkSync(wtNodeModules);
      }
    }
  } catch (e) {
    // ignore
  }

  try {
    execSync(`git worktree remove --force "${tempWorktreePath}"`, { stdio: 'pipe' });
  } catch (e) {
    // ignore
  }
}

process.exit(exitCode);
