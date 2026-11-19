// SPDX-License-Identifier: GPL-3.0-or-later
import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

function killProcessTree(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${proc.pid} /f /t`, { stdio: 'ignore' });
    } else {
      try {
        execSync(`pkill -P ${proc.pid}`, { stdio: 'ignore' });
      } catch {}
      try {
        process.kill(-proc.pid, 'SIGKILL');
      } catch {
        try {
          proc.kill('SIGKILL');
        } catch {}
      }
    }
  } catch {}
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function runSmokeTest() {
  const port = 4198;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Starting Vite preview server for smoke test on port ${port}...`);

  const isWin = process.platform === 'win32';
  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    shell: isWin,
    detached: !isWin,
    stdio: 'ignore',
  });

  let browser;
  let page;

  try {
    await waitForServer(baseUrl);
    console.log(`Vite preview ready at ${baseUrl}`);

    const execPath = findChromePath();
    browser = await chromium.launch({
      headless: true,
      executablePath: execPath,
      args: ['--no-sandbox', '--disable-gpu'],
    });

    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    console.log('Loading ScoreForge application...');
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.score-event-group', { timeout: 10000 });

    // Enter input mode by pressing 'n'
    console.log('Switching to Input mode...');
    await page.keyboard.press('KeyN');
    await sleep(200);

    // Type 4 notes: C, D, E, F
    console.log('Typing 4 notes: C, D, E, F...');
    await page.keyboard.press('KeyC');
    await sleep(100);
    await page.keyboard.press('KeyD');
    await sleep(100);
    await page.keyboard.press('KeyE');
    await sleep(100);
    await page.keyboard.press('KeyF');
    await sleep(200);

    // Verify SVG contains note items
    const noteCount = await page.evaluate(() => {
      const groups = document.querySelectorAll('.score-event-group');
      return groups.length;
    });

    console.log(`Verified SVG event count: ${noteCount}`);
    if (noteCount < 4) {
      throw new Error(`Smoke test failed: expected at least 4 note events in SVG, got ${noteCount}`);
    }

    console.log('Smoke test passed successfully!');
  } catch (err) {
    console.error('Smoke test failure:', err);
    if (page) {
      fs.mkdirSync('artifacts', { recursive: true });
      await page.screenshot({ path: 'artifacts/smoke-failure.png' });
      console.log('Saved failure screenshot to artifacts/smoke-failure.png');
    }
    throw err;
  } finally {
    if (browser) await browser.close();
    if (preview) {
      killProcessTree(preview);
    }
  }
}

runSmokeTest().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
