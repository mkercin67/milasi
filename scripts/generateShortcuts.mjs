#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DOCS_PATH = path.resolve('docs/SHORTCUTS.md');

function extractKeyTable() {
  const runner = `
    import { getCompleteKeyTable } from './src/ui/keymap.ts';
    console.log(JSON.stringify(getCompleteKeyTable()));
  `;
  const output = execSync('npx tsx -e "' + runner.replace(/\n/g, ' ') + '"', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit']
  });
  return JSON.parse(output.trim());
}

export function generateMarkdown(entries) {
  let md = `# MiLaSi — Keyboard Shortcuts Reference

> **Generated dynamically from \`src/ui/keymap.ts\`**  
> **Physical Layout Rule:** All shortcuts operate exclusively on physical key positions (\`event.code\`). They function identically on US QWERTY, Turkish Q, AZERTY, Dvorak, or any other keyboard layout.

---

## 1. Global Shortcuts (All Modes)

| Key | Physical Code | Modifiers | Action |
|-----|---------------|-----------|--------|
`;

  const globalEntries = entries.filter(e => e.mode === 'all');
  for (const e of globalEntries) {
    md += `| \`${e.key}\` | \`${e.code}\` | ${e.modifiers === 'none' ? '-' : `\`${e.modifiers}\``} | ${e.action} |\n`;
  }

  md += `\n---

## 2. Select Mode (\`mode: 'select'\`)

Activated via \`KeyV\` or \`Escape\`. Primary mode for navigation, transposition, deletion, copying, and notation editing.

| Key | Physical Code | Modifiers | Action |
|-----|---------------|-----------|--------|
`;

  const selectEntries = entries.filter(e => e.mode === 'select');
  for (const e of selectEntries) {
    md += `| \`${e.key}\` | \`${e.code}\` | ${e.modifiers === 'none' ? '-' : `\`${e.modifiers}\``} | ${e.action} |\n`;
  }

  md += `\n---

## 3. Note Input Mode (\`mode: 'input'\`)

Activated via \`KeyN\`. Enter pitches, rests, and note durations.

| Key | Physical Code | Modifiers | Action |
|-----|---------------|-----------|--------|
`;

  const inputEntries = entries.filter(e => e.mode === 'input');
  for (const e of inputEntries) {
    md += `| \`${e.key}\` | \`${e.code}\` | ${e.modifiers === 'none' ? '-' : `\`${e.modifiers}\``} | ${e.action} |\n`;
  }

  md += `\n---

## 4. Position Mode (\`mode: 'position'\`)

Activated via \`KeyP\`. Fine engraving layout nudging (\`dx\` / \`dy\`).

| Key | Physical Code | Modifiers | Action |
|-----|---------------|-----------|--------|
`;

  const positionEntries = entries.filter(e => e.mode === 'position');
  for (const e of positionEntries) {
    md += `| \`${e.key}\` | \`${e.code}\` | ${e.modifiers === 'none' ? '-' : `\`${e.modifiers}\``} | ${e.action} |\n`;
  }

  md += `\n---

## 5. Lyrics Mode (\`mode: 'lyrics'\`)

Activated via \`KeyU\`. Syllable entry and melisma extender input aligned to noteheads.

| Key | Physical Code | Modifiers | Action |
|-----|---------------|-----------|--------|
`;

  const lyricsEntries = entries.filter(e => e.mode === 'lyrics');
  for (const e of lyricsEntries) {
    md += `| \`${e.key}\` | \`${e.code}\` | ${e.modifiers === 'none' ? '-' : `\`${e.modifiers}\``} | ${e.action} |\n`;
  }

  md += `\n---

## 6. Summary of Key Notation Mappings

- **Tie (Bağ):** \`KeyT\` (Select and Position modes)
- **Slur (Legato bağı):** \`KeyS\` (Select and Position modes)
- **Articulations:**
  - Staccato: \`KeyJ\`
  - Tenuto: \`KeyK\`
  - Accent (Aksan): \`KeyL\`
  - Marcato: \`Shift+KeyL\`
- **Dynamics:** \`Shift+Digit1\` through \`Shift+Digit8\` (\`pp\`, \`p\`, \`mp\`, \`mf\`, \`f\`, \`ff\`, \`sfz\`, \`fp\`)
- **Pitch Entry:** Letters \`KeyC\`..\`KeyB\` (C, D, E, F, G, A, B)
- **Rest Entry:** \`Digit0\`
- **Augmentation Dot:** \`Period\` (never used for articulations)
`;

  return md;
}

function main() {
  const isCheck = process.argv.includes('--check');
  const entries = extractKeyTable();
  const generated = generateMarkdown(entries);

  if (isCheck) {
    if (!fs.existsSync(DOCS_PATH)) {
      console.error('Error: docs/SHORTCUTS.md does not exist. Run node scripts/generateShortcuts.mjs');
      process.exit(1);
    }
    const current = fs.readFileSync(DOCS_PATH, 'utf8').replace(/\r\n/g, '\n');
    const expected = generated.replace(/\r\n/g, '\n');
    if (current !== expected) {
      console.error('Error: docs/SHORTCUTS.md is out of sync with src/ui/keymap.ts! Run node scripts/generateShortcuts.mjs to update.');
      process.exit(1);
    }
    console.log('✓ docs/SHORTCUTS.md is up to date with src/ui/keymap.ts.');
    return;
  }

  fs.writeFileSync(DOCS_PATH, generated, 'utf8');
  console.log(`✓ Generated ${DOCS_PATH} successfully (${entries.length} shortcuts documented).`);
}

main();
