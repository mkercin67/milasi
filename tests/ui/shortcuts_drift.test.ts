import { describe, it, expect } from 'vitest';
import { getCompleteKeyTable } from '../../src/ui/keymap';

// Dynamic Node require for test environment without requiring @types/node
declare const require: (module: string) => any;

describe('Shortcuts Documentation Drift Test', () => {
  it('ensures docs/SHORTCUTS.md exists and is up to date with keymap.ts', () => {
    const fs = require('fs');
    const path = require('path');
    const docsPath = path.resolve('docs/SHORTCUTS.md');
    expect(fs.existsSync(docsPath)).toBe(true);

    const keyTable = getCompleteKeyTable();
    expect(keyTable.length).toBeGreaterThan(50);

    const content = fs.readFileSync(docsPath, 'utf8');

    // Verify key action and physical codes are documented
    for (const entry of keyTable) {
      expect(content).toContain(entry.code);
    }

    // Verify specific critical physical key mappings
    expect(content).toContain('KeyS');
    expect(content).toContain('KeyT');
    expect(content).toContain('KeyJ');
    expect(content).toContain('KeyK');
    expect(content).toContain('KeyL');
    expect(content).toContain('Digit1');
    expect(content).toContain('Digit8');
  });
});
