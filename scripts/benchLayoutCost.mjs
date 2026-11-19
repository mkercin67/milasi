// SPDX-License-Identifier: GPL-3.0-or-later
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runnerPath = path.join(__dirname, 'benchLayoutCostRunner.ts');

try {
  execSync(`npx vite-node "${runnerPath}"`, {
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  process.exit(err.status ?? 1);
}
