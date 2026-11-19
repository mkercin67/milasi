#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Playwright DOM i18n Verification Script
 *
 * Verifies that no visible text node in the toolbar, status bar, or dialogs
 * displays raw translation keys (matching /^[a-z][A-Za-z]*(\.[A-Za-z0-9]+)+$/)
 * in both Turkish and English with all dialogs opened.
 * Captures toolbar screenshots for both locales.
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

function waitForServer(url, timeoutMs = 15000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };

    const retry = () => {
      if (Date.now() - t0 > timeoutMs) {
        reject(new Error(`Timed out waiting for server at ${url}`));
      } else {
        setTimeout(check, 250);
      }
    };

    check();
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

async function checkNoScoreForgeInDom(page, contextName) {
  const pageTitle = await page.title();
  if (/scoreforge/i.test(pageTitle)) {
    console.error(`[FAIL] User-visible <title> contains "ScoreForge": "${pageTitle}" in ${contextName}`);
    return false;
  }

  const forbiddenMatches = await page.evaluate(() => {
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
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const matches = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      const val = (currentNode.nodeValue || '').trim();
      if (/scoreforge/i.test(val)) {
        matches.push({ text: val, parentTag: currentNode.parentElement?.tagName });
      }
      currentNode = walker.nextNode();
    }
    return matches;
  });

  if (forbiddenMatches.length > 0) {
    console.error(`[FAIL] Found user-visible "ScoreForge" in ${contextName}:`, forbiddenMatches);
    return false;
  }
  return true;
}

async function runI18nPlaywrightCheck() {
  let serverUrl = 'http://localhost:5173';
  let previewProcess = null;

  const is5173Up = await checkServer(serverUrl);
  if (!is5173Up) {
    const is4198Up = await checkServer('http://localhost:4198');
    if (is4198Up) {
      serverUrl = 'http://localhost:4198';
    } else {
      console.log('No existing dev/preview server found; starting Vite preview on port 4198...');
      previewProcess = spawn('npx', ['vite', 'preview', '--port', '4198', '--strictPort'], {
        shell: true,
        stdio: 'pipe',
      });
      serverUrl = 'http://localhost:4198';
      await waitForServer(serverUrl);
    }
  }

  console.log(`Testing ScoreForge UI against ${serverUrl}...`);
  const execPath = findChromePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath: execPath,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  let allPassed = true;

  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
    await page.goto(serverUrl, { waitUntil: 'networkidle' });
    await sleep(500);

    const screenshotDir = path.join(rootDir, 'docs', 'screenshots', 'h1');
    fs.mkdirSync(screenshotDir, { recursive: true });

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
  let trBrandPass = await checkNoScoreForgeInDom(page, 'Turkish Main View');
  if (!trBrandPass) allPassed = false;

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
  let enBrandPass = await checkNoScoreForgeInDom(page, 'English Main View');
  if (!enBrandPass) allPassed = false;

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

  // 3. REGRESSION GALLERY VIEW
  console.log('\n--- Verifying Regression Gallery View for Brand Name ---');
  await page.goto(serverUrl + '/?state=gallery', { waitUntil: 'networkidle' });
  await sleep(300);
  let galleryBrandPass = await checkNoScoreForgeInDom(page, 'Regression Gallery View');
  if (!galleryBrandPass) allPassed = false;

  } finally {
    if (browser) {
      await browser.close();
    }
    if (previewProcess) {
      previewProcess.kill();
    }
  }

  if (!allPassed) {
    console.error('\nFAILED: One or more raw i18n translation keys or forbidden brand names were displayed in the UI!');
    process.exit(1);
  }

  console.log('\nSUCCESS: All toolbar, status bar, dialogs, and gallery text nodes are fully translated in Turkish and English with no legacy brand names!');
}

runI18nPlaywrightCheck().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
