import { describe, expect, it } from 'vitest';

interface DirentLike {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

interface FsModule {
  readdirSync(path: string, options: { withFileTypes: true }): DirentLike[];
  readFileSync(path: string, encoding: string): string;
}

interface PathModule {
  resolve(...paths: string[]): string;
  join(...paths: string[]): string;
  relative(from: string, to: string): string;
}

declare const require: (module: string) => unknown;

describe('No raw keyboard events outside keymap.ts', () => {
  it('verifies that no file in src/ (except keymap.ts) checks event.code or event.key directly', () => {
    const fs = require('fs') as FsModule;
    const path = require('path') as PathModule;
    const srcDir = path.resolve('src');
    const violations: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          if (entry.name === 'keymap.ts') continue;

          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');

          const forbiddenPattern = /(\.code\s*===|\.code\s*!==|\.key\s*===|\.key\s*!==)/;

          lines.forEach((line: string, index: number) => {
            if (forbiddenPattern.test(line)) {
              violations.push(`${path.relative(srcDir, fullPath)}:${index + 1}: ${line.trim()}`);
            }
          });
        }
      }
    }

    scanDir(srcDir);
    expect(violations).toEqual([]);
  });
});
