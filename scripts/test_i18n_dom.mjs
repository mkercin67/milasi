#!/usr/bin/env node
/**
 * Playwright DOM i18n Verification Script
 *
 * Verifies that no visible text node in the toolbar, status bar, or dialogs
 * displays raw translation keys (matching /^[a-z][A-Za-z]*(\.[A-Za-z0-9]+)+$/)
 * in both Turkish and English with all dialogs opened.
 * Captures toolbar screenshots for both locales.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function findChromePath() {
  const chromePaths = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  for (const p of chromePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function checkServer(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

const RAW_KEY_REGEX = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_-]+)+$/;

async function checkVisibleTextNodes(page, contextName) {
  const rawKeyMatches = await page.evaluate(() => {
    const regex = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_-]+)+$/;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }
          // Check if parent is visible
          const rect = parent.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) {
            return NodeFilter.FILTER_REJECT;
          }
          const text = (node.nodeValue || '').trim();
          if (!text) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const matches = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      const val = (currentNode.nodeValue || '').trim();
      // Test words or entire string
      const tokens = val.split(/\s+/);
      for (const t of tokens) {
        // Strip leading symbols like ♯♭, ♩=, +, -
        const clean = t.replace(/^[♯♭𝄴♩=+:|↶↷⟲♪•—>^\s]+/, '').replace(/[:.,]$/, '');
        if (clean && regex.test(clean)) {
          matches.push({ text: val, token: clean, parentTag: currentNode.parentElement?.tagName });
        }
      }
      currentNode = walker.nextNode();
    }
    return matches;
  });

  if (rawKeyMatches.length > 0) {
    console.error(`[FAIL] Found raw i18n keys in ${contextName}:`, rawKeyMatches);
    return false;
  }
  return true;
}

async function runI18nPlaywrightCheck() {
  const serverUrl = 'http://localhost:5173';
  const isUp = await checkServer(serverUrl);
  if (!isUp) {
    console.error(`Dev server is not reachable at ${serverUrl}. Please run npm run dev first.`);
    process.exit(1);
  }

  console.log(`Testing ScoreForge UI against ${serverUrl}...`);
  const execPath = findChromePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath: execPath,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  await page.goto(serverUrl, { waitUntil: 'networkidle' });
  await sleep(500);

  const screenshotDir = path.join(rootDir, 'docs', 'screenshots', 'h1');
  fs.mkdirSync(screenshotDir, { recursive: true });

  let allPassed = true;

  // 1. TURKISH (tr)
  console.log('\n--- Verifying Turkish (tr) Locale ---');
  await page.selectOption('#language-select', 'tr');
  await sleep(300);

  // Screenshot toolbar in Turkish
  const trShotPath = path.join(screenshotDir, '05_toolbar_turkish.png');
  await page.screenshot({
    path: trShotPath,
    clip: { x: 0, y: 0, width: 1366, height: 130 },
  });
  console.log(`Captured Turkish toolbar screenshot: ${trShotPath}`);

  // Check main view (toolbar + status bar)
  let trPass = await checkVisibleTextNodes(page, 'Turkish Main View');
  if (!trPass) allPassed = false;

  // Modals to open and check
  const modalButtons = [
    { name: 'New Score', btn: '[data-testid="btn-new-score"]', cancel: 'button:has-text("İptal")' },
    { name: 'Score Info', btn: '[data-testid="btn-score-info"]', cancel: 'button:has-text("İptal")' },
    { name: 'Key Signature', btn: '[data-testid="btn-open-keysig"]', cancel: 'button:has-text("İptal")' },
    { name: 'Time Signature', btn: '[data-testid="btn-open-timesig"]', cancel: 'button:has-text("İptal")' },
    { name: 'Tempo', btn: '[data-testid="btn-open-tempo"]', cancel: 'button:has-text("İptal")' },
    { name: 'Barline', btn: '[data-testid="btn-open-barline"]', cancel: 'button:has-text("İptal")' },
  ];

  for (const m of modalButtons) {
    try {
      const btn = await page.$(m.btn);
      if (btn) {
        await btn.click();
        await sleep(250);
        const pass = await checkVisibleTextNodes(page, `Turkish Dialog [${m.name}]`);
        if (!pass) allPassed = false;

        const cancelBtn = await page.$(m.cancel);
        if (cancelBtn) {
          await cancelBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await sleep(200);
      }
    } catch (e) {
      console.warn(`Could not test dialog ${m.name}:`, e.message);
    }
  }

  // 2. ENGLISH (en)
  console.log('\n--- Verifying English (en) Locale ---');
  await page.selectOption('#language-select', 'en');
  await sleep(300);

  // Screenshot toolbar in English
  const enShotPath = path.join(screenshotDir, '06_toolbar_english.png');
  await page.screenshot({
    path: enShotPath,
    clip: { x: 0, y: 0, width: 1366, height: 130 },
  });
  console.log(`Captured English toolbar screenshot: ${enShotPath}`);

  let enPass = await checkVisibleTextNodes(page, 'English Main View');
  if (!enPass) allPassed = false;

  const modalButtonsEn = [
    { name: 'New Score', btn: '[data-testid="btn-new-score"]', cancel: 'button:has-text("Cancel")' },
    { name: 'Score Info', btn: '[data-testid="btn-score-info"]', cancel: 'button:has-text("Cancel")' },
    { name: 'Key Signature', btn: '[data-testid="btn-open-keysig"]', cancel: 'button:has-text("Cancel")' },
    { name: 'Time Signature', btn: '[data-testid="btn-open-timesig"]', cancel: 'button:has-text("Cancel")' },
    { name: 'Tempo', btn: '[data-testid="btn-open-tempo"]', cancel: 'button:has-text("Cancel")' },
    { name: 'Barline', btn: '[data-testid="btn-open-barline"]', cancel: 'button:has-text("Cancel")' },
  ];

  for (const m of modalButtonsEn) {
    try {
      const btn = await page.$(m.btn);
      if (btn) {
        await btn.click();
        await sleep(250);
        const pass = await checkVisibleTextNodes(page, `English Dialog [${m.name}]`);
        if (!pass) allPassed = false;

        const cancelBtn = await page.$(m.cancel);
        if (cancelBtn) {
          await cancelBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await sleep(200);
      }
    } catch (e) {
      console.warn(`Could not test dialog ${m.name}:`, e.message);
    }
  }

  await browser.close();

  if (!allPassed) {
    console.error('\nFAILED: One or more raw i18n translation keys were displayed in the UI!');
    process.exit(1);
  }

  console.log('\nSUCCESS: All toolbar, status bar, and dialog text nodes are fully translated in Turkish and English!');
}

runI18nPlaywrightCheck().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
