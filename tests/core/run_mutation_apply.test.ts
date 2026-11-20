// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('runMutation.mjs Patch Application Behavior (F4)', () => {
  it('exits non-zero with "PATCH DID NOT APPLY" when git apply fails on an unapplicable patch', () => {
    // Create an invalid dummy patch that cannot apply to any file
    const invalidPatchPath = path.resolve('tests/mutations/INVALID-TEST-PATCH.patch');
    const invalidDiff = `diff --git a/src/core/model.ts b/src/core/model.ts
--- a/src/core/model.ts
+++ b/src/core/model.ts
@@ -9999,5 +9999,5 @@
+NON_EXISTENT_CONTENT_FOR_TESTING_THAT_FAILS_GIT_APPLY
`;
    (fs as any).writeFileSync(invalidPatchPath, invalidDiff);
    const leftovers = () =>
      (fs as any).readdirSync('.').filter((n: string) => n.startsWith('.wt-mutation-INVALID-TEST-PATCH-'));
    const before = leftovers().length;

    try {
      let threw = false;
      let output = '';
      try {
        output = (execSync as any)('node scripts/runMutation.mjs INVALID-TEST-PATCH tests/core/model.test.ts', {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      } catch (err: any) {
        threw = true;
        output = (err.stdout || '') + '\n' + (err.stderr || '');
      }

      expect(threw).toBe(true);
      expect(output).toContain('ERROR: PATCH DID NOT APPLY');
      expect(output).toContain('INVALID-TEST-PATCH.patch failed to apply to isolated worktree');
      // The failed run must not leave its temporary worktree directory behind.
      expect(leftovers().length).toBe(before);
    } finally {
      if ((fs as any).existsSync(invalidPatchPath)) {
        (fs as any).unlinkSync(invalidPatchPath);
      }
    }
  });
});
