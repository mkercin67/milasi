// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const polyCardIds = [
  'poly-1-stems-opposite-thirds-aligned',
  'poly-2-second-shared-stem-line',
  'poly-3-unison-shared-and-displaced',
  'poly-4-rests-shared-and-elevated',
  'poly-5-voices-3-and-4-offsets',
  'poly-6-ties-in-both-voices',
  'poly-7-beams-in-both-voices',
  'poly-8-dots-in-both-voices',
  'poly-9-bwv-140-reduction-whole-fixture',
];

const outDir = path.resolve('docs/screenshots/m7a');
const artifactDir = path.resolve('C:/Users/Murat/.gemini/antigravity/brain/0e08571a-6366-416f-a983-aad9fe52732a');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(artifactDir, { recursive: true });

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

async function main() {
  const execPath = findChromePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath: execPath,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 2 });
  console.log('Navigating to Regression Gallery on localhost:5173...');
  await page.goto('http://localhost:5173/?state=gallery', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="regression-gallery"]', { timeout: 15000 });

  const summary = [];

  for (const cardId of polyCardIds) {
    const selector = `[data-testid="gallery-case-${cardId}"]`;
    await page.waitForSelector(selector, { timeout: 10000 });
    const cardEl = page.locator(selector);

    // Scroll card into view
    await cardEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);

    // Count DOM elements inside SVG
    const domCounts = await cardEl.evaluate((el) => {
      const svg = el.querySelector('svg');
      if (!svg) return { glyphs: 0, lines: 0, paths: 0, total: 0 };
      const glyphs = svg.querySelectorAll('use, text').length;
      const lines = svg.querySelectorAll('line').length;
      const paths = svg.querySelectorAll('path').length;
      return { glyphs, lines, paths, total: glyphs + lines + paths };
    });

    const filename = `${cardId}.png`;
    const outPath = path.join(outDir, filename);
    const artifactPath = path.join(artifactDir, filename);

    const cardBuf = await cardEl.screenshot();
    fs.writeFileSync(outPath, cardBuf);
    try { fs.writeFileSync(artifactPath, cardBuf); } catch {}

    const size = cardBuf.length;
    console.log(`Captured ${cardId}: DOM total = ${domCounts.total} (glyphs: ${domCounts.glyphs}, lines: ${domCounts.lines}, paths: ${domCounts.paths}), size = ${size} bytes`);

    summary.push({
      cardId,
      filename,
      domCounts,
      sizeBytes: size,
      outPath,
      artifactPath,
    });
  }

  // Also capture full gallery screenshot
  const fullGalleryPath = path.join(outDir, 'polyphony_gallery_full.png');
  const fullArtifactPath = path.join(artifactDir, 'polyphony_gallery_full.png');
  try {
    if (fs.existsSync(fullGalleryPath)) {
      try { fs.unlinkSync(fullGalleryPath); } catch {}
    }
    const buf = await page.screenshot({ fullPage: true });
    fs.writeFileSync(fullGalleryPath, buf);
    try { fs.writeFileSync(fullArtifactPath, buf); } catch {}
    console.log(`Captured full gallery screenshot (${buf.length} bytes)`);
  } catch (err) {
    console.warn(`Could not overwrite full gallery screenshot directly: ${err.message}`);
  }

  await browser.close();

  const jsonSummaryPath = path.join(outDir, 'cards-summary.json');
  fs.writeFileSync(jsonSummaryPath, JSON.stringify(summary, null, 2));
  console.log(`Summary written to ${jsonSummaryPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
